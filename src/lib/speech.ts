// So khớp giọng nói với từ cần đọc và bọc Web Speech API (SpeechRecognition).

export const HOMOPHONES: string[][] = [
  ['be', 'bee'], ['to', 'too', 'two'], ['for', 'four'], ['ate', 'eight'], ['one', 'won'],
  ['I', 'eye'], ['see', 'sea'], ['sun', 'son'], ['no', 'know'], ['new', 'knew'],
  ['night', 'knight'], ['right', 'write'], ['here', 'hear'], ['there', 'their'],
  ['by', 'buy', 'bye'], ['hi', 'high'], ['our', 'hour'], ['red', 'read'], ['blue', 'blew'],
  ['flower', 'flour'], ['meat', 'meet'], ['pair', 'pear'], ['bear', 'bare'], ['hair', 'hare'],
  ['deer', 'dear'], ['tail', 'tale'], ['sail', 'sale'], ['week', 'weak'], ['wood', 'would'],
  ['hole', 'whole'], ['road', 'rode'], ['plane', 'plain'], ['nose', 'knows'], ['ant', 'aunt'],
  ['not', 'knot'], ['peace', 'piece'], ['mail', 'male'], ['wait', 'weight'], ['where', 'wear'],
  ['which', 'witch'],
]

const NUMBERS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13',
  fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18',
  nineteen: '19', twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60',
  seventy: '70', eighty: '80', ninety: '90', hundred: '100',
}

/** Chuẩn hóa: viết thường, bỏ ' và -, ký tự không phải chữ/số thành khoảng trắng. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/['-]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Các từ đọc giống `word` (không gồm chính nó), viết thường. */
export function homophonesOf(word: string): string[] {
  const w = word.toLowerCase()
  const group = HOMOPHONES.find((g) => g.some((x) => x.toLowerCase() === w))
  return group ? group.map((x) => x.toLowerCase()).filter((x) => x !== w) : []
}

export function matchesWord(target: string, alternatives: string[]): boolean {
  const t = normalize(target)
  if (!t) return false
  const accepted = new Set<string>()
  for (const x of [t, ...homophonesOf(target).map(normalize)]) {
    accepted.add(x)
    if (NUMBERS[x]) accepted.add(NUMBERS[x])
  }
  return alternatives.some((alt) => {
    const n = normalize(alt)
    if (!n) return false
    return n.split(' ').some((tok) => accepted.has(tok)) || accepted.has(n.replace(/ /g, ''))
  })
}

// lib.dom của TypeScript không khai báo lớp SpeechRecognition (chỉ có kiểu sự kiện).
interface RecognitionAlternative { transcript: string }
interface RecognitionEvent { results: ArrayLike<ArrayLike<RecognitionAlternative>> }
interface RecognitionErrorEvent { error: string }
interface Recognition {
  lang: string
  maxAlternatives: number
  interimResults: boolean
  continuous: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition
type SpeechWindow = { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as SpeechWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function speechSupported(): boolean {
  return recognitionCtor() !== undefined
}

export type ListenResult =
  | { kind: 'heard'; alternatives: string[] }
  | { kind: 'silent' }
  | { kind: 'denied' }
  | { kind: 'error' }

export interface Listening { result: Promise<ListenResult>; stop(): void }

/** Gọi đồng bộ trong handler click. `stop()` hủy phiên; promise khi đó ra 'silent'. */
export function listenOnce(): Listening {
  const Ctor = recognitionCtor()
  if (!Ctor) return { result: Promise.resolve({ kind: 'error' }), stop() {} }

  let recognition: Recognition
  let settle: (r: ListenResult) => void = () => {}
  const result = new Promise<ListenResult>((resolve) => {
    let done = false
    settle = (r) => {
      if (done) return
      done = true
      resolve(r)
    }
  })

  try {
    recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 5
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (e) => {
      const first = e.results[0]
      const alternatives: string[] = []
      if (first) {
        for (let i = 0; i < first.length; i++) {
          const t = first[i].transcript
          if (t.trim()) alternatives.push(t)
        }
      }
      settle(alternatives.length ? { kind: 'heard', alternatives } : { kind: 'silent' })
    }
    recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') settle({ kind: 'silent' })
      else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') settle({ kind: 'denied' })
      else settle({ kind: 'error' })
    }
    recognition.onend = () => settle({ kind: 'silent' })
    recognition.start()
  } catch {
    settle({ kind: 'error' })
    return { result, stop() {} }
  }

  return {
    result,
    stop() {
      settle({ kind: 'silent' })
      try { recognition.abort() } catch { /* đã dừng */ }
    },
  }
}
