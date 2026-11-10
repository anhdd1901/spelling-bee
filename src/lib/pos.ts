const VI: Record<string, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  pronoun: 'Đại từ',
  preposition: 'Giới từ',
  conjunction: 'Liên từ',
  determiner: 'Từ hạn định',
  exclamation: 'Thán từ',
  interjection: 'Thán từ',
  article: 'Mạo từ',
  'indefinite article': 'Mạo từ',
  'definite article': 'Mạo từ',
  number: 'Số từ',
  'modal verb': 'Động từ khuyết thiếu',
  'auxiliary verb': 'Trợ động từ',
  'phrasal verb': 'Cụm động từ',
  abbreviation: 'Từ viết tắt',
  prefix: 'Tiền tố',
  suffix: 'Hậu tố',
}

export function posToVi(pos: string): string {
  return VI[pos.toLowerCase().trim()] ?? pos
}

export type PosGroup = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other'

export function posGroup(pos: string | undefined): PosGroup | undefined {
  if (!pos) return undefined
  const p = pos.toLowerCase()
  if (p.includes('adverb')) return 'adverb'
  if (p.includes('noun')) return 'noun'
  if (p.includes('verb')) return 'verb'
  if (p.includes('adjective')) return 'adjective'
  return 'other'
}

/** Màu theo từ loại: `bg` nhạt cho nền thẻ từ, `strong` đậm cho tag. */
export const POS_COLORS: Record<PosGroup | 'unknown', { bg: string; strong: string; label: string }> = {
  noun: { bg: '#ffc2a6', strong: '#ff7a45', label: 'Danh từ' },
  verb: { bg: '#a9dcff', strong: '#2f9be0', label: 'Động từ' },
  adjective: { bg: '#dcc2f7', strong: '#9a5fd0', label: 'Tính từ' },
  adverb: { bg: '#a6ebd2', strong: '#1fa77e', label: 'Trạng từ' },
  other: { bg: '#ffe48a', strong: '#d99a00', label: 'Loại khác' },
  unknown: { bg: '#ece8f6', strong: '#8d84ad', label: 'Đang tìm' },
}

export function posColor(pos: string | undefined) {
  return POS_COLORS[posGroup(pos) ?? 'unknown']
}
