/** CORS proxy công cộng, gọi song song, lấy kết quả hợp lệ đến trước. Đổi hoặc thêm ở đây khi một proxy chết. */
export const PROXIES: ((url: string) => string)[] = [
  (u) => `https://proxy.corsfix.com/?${u}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
]

export async function fetchWithTimeout(url: string, ms = 12000, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  init?.signal?.addEventListener('abort', () => ctrl.abort())
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

export interface ProxyOptions {
  /**
   * Kiểm tra nội dung: 'done' = đủ dùng (dừng đọc sớm), 'more' = đọc tiếp,
   * 'bad' = không phải trang mong muốn (bỏ proxy này). `ended` = đã đọc hết.
   */
  check?: (body: string, ended: boolean) => 'done' | 'more' | 'bad'
  timeoutMs?: number
  fetcher?: (url: string, init: RequestInit) => Promise<Response>
}

async function readUntil(res: Response, check: NonNullable<ProxyOptions['check']>): Promise<string> {
  if (!res.body) {
    const all = await res.text()
    if (check(all, true) === 'bad') throw new Error('bad body')
    return all
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let body = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (value) body += dec.decode(value, { stream: !done })
    const verdict = check(body, done)
    if (verdict === 'done' || (done && verdict !== 'bad')) {
      if (!done) reader.cancel().catch(() => {})
      return body
    }
    if (verdict === 'bad' || done) {
      reader.cancel().catch(() => {})
      throw new Error('bad body')
    }
  }
}

class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

// Proxy đầu tiên (corsfix) nhanh nhưng chỉ cho 60 lượt/phút; bị từ chối (429) thì tạm nghỉ nó 1 phút.
const PRIMARY_COOLDOWN_MS = 60_000
let primaryBlockedUntil = 0
export const resetProxyState = () => {
  primaryBlockedUntil = 0
}

/**
 * Lấy nội dung của một trang không bật CORS qua proxy:
 * thử proxy chính trước (nhanh), lỗi thì gọi song song các proxy còn lại, lấy kết quả đến trước.
 */
export async function fetchViaProxy(url: string, opts: ProxyOptions = {}): Promise<string> {
  const check = opts.check ?? ((b: string, ended: boolean) => (ended ? (b.length > 200 ? 'done' : 'bad') : 'more'))
  const fetcher = opts.fetcher ?? ((u: string, init: RequestInit) => fetch(u, init))
  const attempt = async (wrap: (u: string) => string, signal: AbortSignal) => {
    const res = await fetcher(wrap(url), { signal })
    if (!res.ok) throw new HttpError(res.status)
    return readUntil(res, check)
  }

  const [primary, ...rest] = PROXIES
  if (Date.now() >= primaryBlockedUntil) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Math.min(opts.timeoutMs ?? 20000, 10000))
    try {
      return await attempt(primary, ctrl.signal)
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) primaryBlockedUntil = Date.now() + PRIMARY_COOLDOWN_MS
    } finally {
      clearTimeout(timer)
      ctrl.abort()
    }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000)
  try {
    return await Promise.any(rest.map((wrap) => attempt(wrap, ctrl.signal)))
  } catch {
    throw new Error('all proxies failed')
  } finally {
    clearTimeout(timer)
    ctrl.abort() // hủy các proxy chậm hơn
  }
}
