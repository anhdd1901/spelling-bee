import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('sfx', () => {
  it('không có AudioContext thì không ném lỗi', async () => {
    vi.resetModules()
    const { playDing, playBuzz, playFanfare } = await import('./sfx')
    expect(() => {
      playDing()
      playBuzz()
      playFanfare()
    }).not.toThrow()
  })

  it('primeSfx: không AudioContext thì không lỗi; có thì tạo và resume ngay', async () => {
    vi.resetModules()
    const { primeSfx } = await import('./sfx')
    expect(() => primeSfx()).not.toThrow()

    const resume = vi.fn()
    class FakeCtx {
      state = 'suspended'
      resume = resume
    }
    vi.stubGlobal('AudioContext', FakeCtx)
    vi.resetModules()
    const sfx = await import('./sfx')
    sfx.primeSfx()
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('có AudioContext thì tạo oscillator và start', async () => {
    vi.resetModules()
    let created = 0
    let started = 0
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    })
    class FakeCtx {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume = vi.fn()
      createGain() {
        return { gain: param(), connect: vi.fn() }
      }
      createOscillator() {
        created++
        return {
          type: '',
          frequency: param(),
          connect: vi.fn(),
          start: () => { started++ },
          stop: vi.fn(),
        }
      }
    }
    vi.stubGlobal('AudioContext', FakeCtx)
    const { playDing, playBuzz, playFanfare } = await import('./sfx')
    playDing()
    expect(created).toBe(2)
    playBuzz()
    expect(created).toBe(3)
    playFanfare()
    expect(created).toBe(7)
    expect(started).toBe(7)
  })
})
