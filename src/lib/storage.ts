export interface WordItem {
  id: string
  text: string
}

const KEY = 'spelling-kids:words:v1'

export function loadWords(): WordItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((w) => w && typeof w.text === 'string' && typeof w.id === 'string') : []
  } catch {
    return []
  }
}

export function saveWords(words: WordItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(words))
  } catch {
    /* bỏ qua */
  }
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/** Thêm các từ mới, bỏ qua từ đã có (không phân biệt hoa thường). Trả về danh sách mới + số từ bị trùng. */
export function addWords(list: WordItem[], texts: string[]): { list: WordItem[]; added: number; duplicates: number } {
  const have = new Set(list.map((w) => w.text.toLowerCase()))
  const next = [...list]
  let duplicates = 0
  for (const t of texts) {
    const k = t.toLowerCase()
    if (have.has(k)) {
      duplicates++
      continue
    }
    have.add(k)
    next.push({ id: newId(), text: t })
  }
  return { list: next, added: next.length - list.length, duplicates }
}

export const removeWord = (list: WordItem[], id: string) => list.filter((w) => w.id !== id)

/** Chuyển từ `fromId` tới vị trí của từ `toId` (dùng cho kéo-thả). */
export function moveWord(list: WordItem[], fromId: string, toId: string): WordItem[] {
  const from = list.findIndex((w) => w.id === fromId)
  const to = list.findIndex((w) => w.id === toId)
  if (from < 0 || to < 0 || from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Sửa chính tả một từ theo gợi ý (giữ nguyên vị trí). Nếu từ đúng đã có trong danh sách thì bỏ từ sai.
 * Trả về danh sách mới và mục từ đúng.
 */
export function correctWord(list: WordItem[], id: string, text: string): { list: WordItem[]; item: WordItem } {
  const existing = list.find((w) => w.id !== id && w.text.toLowerCase() === text.toLowerCase())
  if (existing) return { list: list.filter((w) => w.id !== id), item: existing }
  const item = { id, text }
  return { list: list.map((w) => (w.id === id ? item : w)), item }
}
