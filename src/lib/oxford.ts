export interface OxfordEntry {
  headword: string
  pos: string[]
  phonUS?: string
  phonUK?: string
  audioUS?: string
  audioUK?: string
  definitions: string[]
  image?: string
}

export const OXFORD_SEARCH = 'https://www.oxfordlearnersdictionaries.com/search/english/direct/?q='

/** Dùng khi đọc stream: đủ khi đã có phần đầu mục từ và định nghĩa đầu tiên. */
export function oxfordBodyCheck(body: string, ended: boolean): 'done' | 'more' | 'bad' {
  const isOxford = body.includes('oxfordlearnersdictionaries')
  if (ended) return isOxford ? 'done' : 'bad'
  if (body.length > 4000 && !isOxford) return 'bad'
  const firstDef = body.indexOf('class="def"')
  if (body.includes('headword') && firstDef > 0) {
    const second = body.indexOf('class="def"', firstDef + 20)
    if (second > 0 && body.indexOf('class="def"', second + 20) > 0) return 'done'
  }
  if (/No exact match found/.test(body)) {
    const list = body.indexOf('result-list')
    if (list > 0 && body.indexOf('</ul>', list) > 0) return 'done'
  }
  return 'more'
}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

/** Đọc trang từ điển Oxford. Trả null nếu là trang "không tìm thấy". */
export function parseOxfordHtml(html: string): OxfordEntry | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const h1 = doc.querySelector('h1.headword')
  if (!h1) return null
  const top = doc.querySelector('.top-container') ?? doc
  const pos = [...new Set([...top.querySelectorAll('.pos')].map(text).filter(Boolean))]
  const br = doc.querySelector('.phons_br')
  const am = doc.querySelector('.phons_n_am')
  const mp3 = (sel: string, scope: ParentNode | null) =>
    (scope?.querySelector(sel) ?? doc.querySelector(sel))?.getAttribute('data-src-mp3') ?? undefined
  const definitions = [...doc.querySelectorAll('.sense .def, span.def')]
    .map(text)
    .filter(Boolean)
    .filter((d, i, a) => a.indexOf(d) === i)
    .slice(0, 3)
  const image =
    doc.querySelector('#ox-enlarge a.topic')?.getAttribute('href') ??
    doc.querySelector('img.thumb')?.getAttribute('src') ??
    undefined
  return {
    headword: text(h1),
    pos,
    phonUK: text(br?.querySelector('.phon')) || undefined,
    phonUS: text(am?.querySelector('.phon')) || undefined,
    audioUK: mp3('.pron-uk[data-src-mp3]', br),
    audioUS: mp3('.pron-us[data-src-mp3]', am),
    definitions,
    image,
  }
}

/** Gợi ý chính tả trên trang "No exact match found" của Oxford ("Did you mean: dishwasher"). */
export function parseOxfordSuggestions(html: string, limit = 3): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const words = [...doc.querySelectorAll('.result-list a.dym-link, .result-list a')].map(text).filter(Boolean)
  return [...new Set(words)].slice(0, limit)
}
