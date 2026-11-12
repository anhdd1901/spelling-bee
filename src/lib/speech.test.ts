import { afterEach, describe, expect, it } from 'vitest'
import { homophonesOf, listenOnce, matchesWord, speechSupported } from './speech'

describe('matchesWord', () => {
  it.each([
    ['cat', ['cat'], true], ['cat', ['Cat.'], true], ['cat', ['a cat'], true], ['cat', ['cut', 'cap'], false],
    ['cat', ['cut', 'cat'], true], ['cat', ['category'], false], ['cat', [], false], ['cat', [''], false],
    ['ice-cream', ['ice cream'], true], ["don't", ['dont'], true], ["don't", ['don’t'], true],
    ['bee', ['be'], true], ['two', ['too'], true], ['I', ['eye'], true], ['knight', ['night'], true],
    ['two', ['2'], true], ['eight', ['8'], true], ['twenty', ['20'], true], ['cat', ['2'], false],
  ] as [string, string[], boolean][])('matchesWord(%s, %j) → %s', (t, alts, want) =>
    expect(matchesWord(t, alts)).toBe(want))

  it('homophonesOf không gồm chính từ đó, không phân biệt hoa thường', () => {
    expect(homophonesOf('Two').sort()).toEqual(['to', 'too'])
    expect(homophonesOf('cat')).toEqual([])
  })
})

class FakeRecognition {
  static last: FakeRecognition | null = null
  static throwOnStart = false
  lang = ''
  maxAlternatives = 0
  interimResults = true
  continuous = true
  aborted = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onend: (() => void) | null = null
  constructor() { FakeRecognition.last = this }
  start() { if (FakeRecognition.throwOnStart) throw new Error('boom') }
  abort() { this.aborted = true; this.onend?.() }
  stop() {}
}

const w = window as unknown as Record<string, unknown>
function clear() {
  delete w.webkitSpeechRecognition
  delete w.SpeechRecognition
}
function install() {
  clear()
  w.webkitSpeechRecognition = FakeRecognition
  FakeRecognition.last = null
  FakeRecognition.throwOnStart = false
}
const resultEvent = (alts: string[]) => ({ results: [alts.map((transcript) => ({ transcript }))] })

describe('listenOnce', () => {
  afterEach(() => { clear(); FakeRecognition.throwOnStart = false })

  it('heard: trả mọi phương án', async () => {
    install()
    const l = listenOnce()
    FakeRecognition.last!.onresult!(resultEvent(['cat', 'cap']))
    expect(await l.result).toEqual({ kind: 'heard', alternatives: ['cat', 'cap'] })
  })

  it('no-speech và aborted → silent', async () => {
    for (const error of ['no-speech', 'aborted']) {
      install()
      const l = listenOnce()
      FakeRecognition.last!.onerror!({ error })
      expect(await l.result).toEqual({ kind: 'silent' })
    }
  })

  it('not-allowed → denied', async () => {
    for (const error of ['not-allowed', 'service-not-allowed']) {
      install()
      const l = listenOnce()
      FakeRecognition.last!.onerror!({ error })
      expect(await l.result).toEqual({ kind: 'denied' })
    }
  })

  it('network và audio-capture → error', async () => {
    for (const error of ['network', 'audio-capture']) {
      install()
      const l = listenOnce()
      FakeRecognition.last!.onerror!({ error })
      expect(await l.result).toEqual({ kind: 'error' })
    }
  })

  it('onend không có kết quả → silent; onend sau onresult không đổi kết quả', async () => {
    install()
    const a = listenOnce()
    FakeRecognition.last!.onend!()
    expect(await a.result).toEqual({ kind: 'silent' })
    install()
    const b = listenOnce()
    FakeRecognition.last!.onresult!(resultEvent(['cat']))
    FakeRecognition.last!.onend!()
    expect(await b.result).toEqual({ kind: 'heard', alternatives: ['cat'] })
  })

  it('onend không đè lỗi đã báo', async () => {
    install()
    const l = listenOnce()
    FakeRecognition.last!.onerror!({ error: 'network' })
    FakeRecognition.last!.onend!()
    expect(await l.result).toEqual({ kind: 'error' })
  })

  it('kết quả toàn phương án rỗng → silent', async () => {
    install()
    const l = listenOnce()
    FakeRecognition.last!.onresult!(resultEvent(['', '  ']))
    expect(await l.result).toEqual({ kind: 'silent' })
  })

  it('stop() gọi abort() và ra silent', async () => {
    install()
    const l = listenOnce()
    l.stop()
    expect(FakeRecognition.last!.aborted).toBe(true)
    expect(await l.result).toEqual({ kind: 'silent' })
  })

  it('start() ném lỗi → error', async () => {
    install()
    FakeRecognition.throwOnStart = true
    const l = listenOnce()
    expect(await l.result).toEqual({ kind: 'error' })
  })

  it('đặt lang en-US, maxAlternatives 5', () => {
    install()
    listenOnce()
    const r = FakeRecognition.last!
    expect(r.lang).toBe('en-US')
    expect(r.maxAlternatives).toBe(5)
    expect(r.interimResults).toBe(false)
    expect(r.continuous).toBe(false)
  })

  it('không có lớp nhận dạng → error', async () => {
    clear()
    expect(await listenOnce().result).toEqual({ kind: 'error' })
  })

  it('speechSupported theo việc có lớp nhận dạng hay không', () => {
    clear()
    expect(speechSupported()).toBe(false)
    install()
    expect(speechSupported()).toBe(true)
    delete w.webkitSpeechRecognition
    w.SpeechRecognition = FakeRecognition
    expect(speechSupported()).toBe(true)
  })
})
