import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchViaProxy, PROXIES, resetProxyState } from './fetchProxy'

const ok = (body: string) => new Response(body, { status: 200 })

describe('fetchViaProxy', () => {
  beforeEach(() => resetProxyState())
  it('returns the first valid body even if other proxies fail', async () => {
    const big = 'x'.repeat(500)
    const fetcher = vi.fn(async (u: string) => {
      if (u.startsWith(PROXIES[0]('').slice(0, 20))) throw new Error('down')
      if (u.includes('allorigins')) return ok(big)
      return new Response('no', { status: 500 })
    })
    await expect(fetchViaProxy('https://a.b/c', { fetcher })).resolves.toBe(big)
    expect(fetcher).toHaveBeenCalledTimes(PROXIES.length)
    expect(fetcher.mock.calls.some(([u]) => u.includes(encodeURIComponent('https://a.b/c')))).toBe(true)
  })
  it('skips bodies rejected by check', async () => {
    const fetcher = vi.fn(async (u: string) => ok(u.includes('allorigins') ? 'GOOD page' : 'proxy error page'))
    const check = (b: string): 'done' | 'bad' => (b.includes('GOOD') ? 'done' : 'bad')
    await expect(fetchViaProxy('https://a.b/c', { fetcher, check })).resolves.toBe('GOOD page')
  })
  it('uses only the primary proxy when it works', async () => {
    const fetcher = vi.fn(async (_u: string) => ok('x'.repeat(500)))
    await fetchViaProxy('https://a.b/c', { fetcher })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toBe(PROXIES[0]('https://a.b/c'))
  })
  it('rests the primary proxy for a minute after it says "too many requests"', async () => {
    const primary = PROXIES[0]('https://a.b/c')
    const fetcher = vi.fn(async (u: string) => (u === primary ? new Response('', { status: 429 }) : ok('y'.repeat(500))))
    await fetchViaProxy('https://a.b/c', { fetcher })
    fetcher.mockClear()
    await fetchViaProxy('https://a.b/c', { fetcher })
    expect(fetcher.mock.calls.map(([u]) => u)).not.toContain(primary)
  })
  it('throws when all proxies fail', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('no', { status: 500 }))
    await expect(fetchViaProxy('https://a.b/c', { fetcher })).rejects.toThrow('all proxies failed')
  })
})
