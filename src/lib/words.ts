const WORD_RE = /^[a-z]+(?:['-][a-z]+)*$/

/** Chuẩn hóa một từ: bỏ dấu câu ở hai đầu, chữ thường. Trả '' nếu không phải từ tiếng Anh. */
export function normalizeWord(raw: string): string {
  const w = raw
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
    .toLowerCase()
  if (!WORD_RE.test(w)) return ''
  return w === 'i' ? 'I' : w
}

export interface ExtractOptions {
  /** Độ dài tối thiểu; "a" và "I" luôn được giữ. */
  minLength?: number
}

/** Tách văn bản (gõ tay hoặc OCR) thành danh sách từ duy nhất, giữ thứ tự xuất hiện. */
export function extractWords(text: string, opts: ExtractOptions = {}): string[] {
  const min = opts.minLength ?? 1
  const seen = new Set<string>()
  const out: string[] = []
  for (const token of text.split(/[\s,;|/\\]+/)) {
    const w = normalizeWord(token)
    if (!w) continue
    if (w.length < min && w !== 'a' && w !== 'I') continue
    const key = w.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(w)
  }
  return out
}
