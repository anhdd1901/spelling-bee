import { fetchWithTimeout } from './fetchProxy'

interface WikiSummary {
  type?: string
  description?: string
  thumbnail?: { source: string }
  originalimage?: { source: string }
}

const OFF_TOPIC =
  /\b(film|movie|album|song|single|band|novel|book by|series|episode|video game|company|brand|surname|given name|village|town|city|county|river|district|album|magazine|newspaper|politician|footballer|singer|rapper|actor|actress|painting|ep by|play by|software|programming)\b/i

export function pickWikiImage(s: WikiSummary): string | undefined {
  if (!s || s.type !== 'standard') return undefined
  // Trang về tác phẩm, tổ chức, địa danh, người… thì ảnh không minh họa đúng nghĩa từ.
  if (OFF_TOPIC.test(s.description ?? '')) return undefined
  return s.thumbnail?.source ?? s.originalimage?.source
}

export const EMOJI_CDN = 'https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/'

/** Các dạng số ít có thể có của một từ: "bones" → bone, "boxes" → box, "babies" → baby. */
export function singularForms(word: string): string[] {
  const w = word.toLowerCase()
  const out = [w]
  if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y')
  if (w.endsWith('es') && w.length > 3) out.push(w.slice(0, -2))
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 2) out.push(w.slice(0, -1))
  return out
}

/** Tra emoji 3D cho từ (bảng tra dựng sẵn bởi scripts/build-emoji-index.mjs). */
export function emojiImage(word: string, index: Record<string, string>): string | undefined {
  for (const w of singularForms(word)) if (index[w]) return EMOJI_CDN + index[w] + '.webp'
  return undefined
}

let indexPromise: Promise<Record<string, string>> | null = null
const loadEmojiIndex = () =>
  (indexPromise ??= import('../data/emoji-index.json').then((m) => m.default as Record<string, string>))

async function photoImage(word: string): Promise<string | undefined> {
  try {
    const r = await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`, 8000)
    if (r.ok) {
      const img = pickWikiImage(await r.json())
      if (img) return img
    }
  } catch {
    /* thử nguồn sau */
  }
  return undefined
}

/**
 * Tìm ảnh minh họa, ưu tiên thứ gần gũi với trẻ em:
 * 1. Emoji 3D (Fluent Emoji): hiện đại, dễ thương, đúng nghĩa với từ thông dụng.
 * 2. Ảnh Wikipedia, chỉ cho danh từ và chỉ khi trang nói đúng về sự vật đó.
 * Không có ảnh phù hợp thì trả undefined (ô ảnh để trống), không dùng ảnh tìm kiếm ngẫu nhiên.
 */
export async function findImage(word: string, pos: string[] = []): Promise<string | undefined> {
  try {
    const emoji = emojiImage(word, await loadEmojiIndex())
    if (emoji) return emoji
  } catch {
    /* thử ảnh chụp */
  }
  const isNoun = pos.length === 0 || pos.some((p) => p.toLowerCase().includes('noun'))
  return isNoun ? photoImage(word) : undefined
}
