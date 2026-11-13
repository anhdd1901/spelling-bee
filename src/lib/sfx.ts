let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Gọi đồng bộ trong handler click: tạo/đánh thức AudioContext để tiếng ding/buzz đến sau còn phát được (iOS). */
export function primeSfx(): void {
  getCtx()
}

/** Một nốt: tần số `from` (trượt tới `to` nếu có), bắt đầu sau `at` giây, dài `dur` giây. */
function tone(c: AudioContext, type: OscillatorType, from: number, at: number, dur: number, gain: number, to?: number) {
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  if (to !== undefined) osc.frequency.linearRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur)
}

function play(fn: (c: AudioContext) => void) {
  try {
    const c = getCtx()
    if (c) fn(c)
  } catch {
    // âm thanh chỉ là phần thêm, lỗi thì bỏ qua
  }
}

export function playDing(): void {
  play((c) => {
    tone(c, 'sine', 880, 0, 0.12, 0.25)
    tone(c, 'sine', 1320, 0.12, 0.12, 0.25)
  })
}

export function playBuzz(): void {
  play((c) => tone(c, 'sawtooth', 160, 0, 0.35, 0.2, 110))
}

export function playFanfare(): void {
  play((c) => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(c, 'sine', f, i * 0.12, 0.12, 0.25))
  })
}
