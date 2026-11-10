/**
 * Proxy riêng (hàm serverless trên Vercel) chỉ để lấy trang tra từ của Oxford Learner's Dictionaries.
 * Không phải proxy mở: chỉ nhận một từ tiếng Anh và chỉ gọi tới trang tìm kiếm của Oxford.
 */
const OXFORD_SEARCH = 'https://www.oxfordlearnersdictionaries.com/search/english/direct/?q='
const WORD_RE = /^[A-Za-z][A-Za-z' -]{0,39}$/

export async function handleOxfordRequest(requestUrl: string, fetcher: typeof fetch = fetch): Promise<Response> {
  const q = new URL(requestUrl).searchParams.get('q')?.trim() ?? ''
  if (!WORD_RE.test(q)) return new Response('bad word', { status: 400 })
  let upstream: Response
  try {
    upstream = await fetcher(OXFORD_SEARCH + encodeURIComponent(q), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SpellingBee/1.0; kids vocabulary app)',
        Accept: 'text/html',
      },
    })
  } catch {
    return new Response('upstream error', { status: 502 })
  }
  if (!upstream.ok) return new Response(`upstream ${upstream.status}`, { status: 502 })
  return new Response(await upstream.text(), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Cache trên CDN của Vercel 1 ngày: cùng một từ không phải gọi Oxford lại.
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
