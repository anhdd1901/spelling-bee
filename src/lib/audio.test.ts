import { describe, expect, it, vi } from 'vitest'

describe('playPronunciation', () => {
  it('tries the next file when one is broken, and reports "none" when nothing can speak', async () => {
    const tried: string[] = []
    class FakeAudio {
      src = ''
      paused = true
      pause() {}
      play() {
        tried.push(this.src)
        return this.src.includes('broken') ? Promise.reject(new Error('NotSupportedError')) : Promise.resolve()
      }
    }
    vi.stubGlobal('Audio', FakeAudio)
    vi.resetModules()
    const { playPronunciation } = await import('./audio')

    await expect(playPronunciation(['https://x/broken.mp3', undefined, 'https://ox/bean.mp3'], 'beans')).resolves.toBe('audio')
    expect(tried).toEqual(['https://x/broken.mp3', 'https://ox/bean.mp3'])

    // jsdom không có speechSynthesis → giống trình duyệt không có giọng đọc
    await expect(playPronunciation(['https://x/broken.mp3'], 'beans')).resolves.toBe('none')
    vi.unstubAllGlobals()
  })
})
