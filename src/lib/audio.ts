// Một thẻ <audio> dùng chung: "mở khóa" ngay trong thao tác bấm để iOS/Android cho phát sau khi tải xong dữ liệu.
const SILENT =
  'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'

let el: HTMLAudioElement | null = null
const player = () => (el ??= new Audio())

/** Gọi đồng bộ trong handler click, trước mọi await. */
export function unlockAudio() {
  const a = player()
  if (a.src && !a.paused) return
  a.src = SILENT
  a.play().catch(() => {})
}

/** Dừng tiếng đang phát (mp3 và giọng đọc của máy); không ném lỗi khi thiếu. */
export function stopPlayback(): void {
  try { el?.pause() } catch { /* bỏ qua */ }
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel()
  } catch { /* bỏ qua */ }
}

/** Trình duyệt có giọng đọc không (Chrome/Brave trên Linux thường không có). Danh sách giọng có thể nạp trễ. */
export function hasBrowserVoices(waitMs = 600): Promise<boolean> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve(false)
  if (speechSynthesis.getVoices().length) return Promise.resolve(true)
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices().length > 0)
    speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, waitMs)
  })
}

function speakWithBrowser(word: string) {
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.85
  speechSynthesis.speak(u)
}

/** Kết quả phát âm: file mp3, giọng đọc của máy, hoặc không phát được gì. */
export type PlayResult = 'audio' | 'tts' | 'none'

/**
 * Phát lần lượt các file âm thanh (file đầu hỏng thì thử file sau); hết file thì đọc bằng giọng của trình duyệt;
 * máy không có giọng đọc thì trả 'none' để báo cho bé.
 */
export async function playPronunciation(urls: string | (string | undefined)[] | undefined, word: string): Promise<PlayResult> {
  const list = (Array.isArray(urls) ? urls : [urls]).filter((u): u is string => !!u)
  for (const url of [...new Set(list)]) {
    try {
      const a = player()
      a.pause()
      a.src = url
      await a.play()
      return 'audio'
    } catch {
      /* thử file sau */
    }
  }
  if (!(await hasBrowserVoices())) return 'none'
  speakWithBrowser(word)
  return 'tts'
}
