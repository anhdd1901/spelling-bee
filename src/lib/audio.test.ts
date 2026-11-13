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

describe('stopPlayback', () => {
  it('pauses the shared player and cancels speechSynthesis; safe when neither exists', async () => {
    vi.resetModules()
    const { stopPlayback } = await import('./audio')
    expect(() => stopPlayback()).not.toThrow()

    const pause = vi.fn()
    class FakeAudio {
      src = ''
      paused = true
      pause = pause
      play() { return Promise.resolve() }
    }
    const cancel = vi.fn()
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('speechSynthesis', { cancel, getVoices: () => [], addEventListener: vi.fn() })
    vi.resetModules()
    const audio = await import('./audio')
    audio.unlockAudio()
    audio.stopPlayback()
    expect(pause).toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
