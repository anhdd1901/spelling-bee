import { describe, expect, it, vi } from 'vitest'
import { handleOxfordRequest } from './oxfordProxy'

describe('handleOxfordRequest', () => {
  it('fetches only the Oxford search page for a word and caches it on the CDN', async () => {
    const fetcher = vi.fn(async () => new Response('<h1 class="headword">cat</h1>', { status: 200 }))
    const res = await handleOxfordRequest('https://app.test/api/oxford?q=cat', fetcher as unknown as typeof fetch)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('headword')
    expect(res.headers.get('Cache-Control')).toContain('s-maxage')
    expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://www.oxfordlearnersdictionaries.com/search/english/direct/?q=cat',
    )
  })
  it('rejects anything that is not a word (not an open proxy)', async () => {
    const fetcher = vi.fn()
    for (const q of ['', 'https://evil.com', '../etc', 'a'.repeat(60)]) {
      const res = await handleOxfordRequest(`https://app.test/api/oxford?q=${encodeURIComponent(q)}`, fetcher)
      expect(res.status).toBe(400)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('reports upstream failures as 502', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 403 }))
    const res = await handleOxfordRequest('https://app.test/api/oxford?q=cat', fetcher as unknown as typeof fetch)
    expect(res.status).toBe(502)
  })
})
