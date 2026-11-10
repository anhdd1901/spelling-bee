import { fetchViaProxy, fetchWithTimeout } from './fetchProxy'
import { findImage } from './images'
import { OXFORD_SEARCH, oxfordBodyCheck, parseOxfordHtml, parseOxfordSuggestions, type OxfordEntry } from './oxford'
import { posToVi } from './pos'
import { translateToVi, type Translation } from './translate'

export interface PosInfo {
  en: string
  vi: string
  meanings: string[]
}

export interface WordInfo {
  word: string
  headword: string
  phonetic?: string
  audioUS?: string
  audioUK?: string
  /** Tiếng đọc đúng của từ đã nhập khi Oxford đổi sang từ gốc ("beans" → "bean"); phát trước audioUS. */
  audioExact?: string
  pos: PosInfo[]
  meaningVi?: string
  definitionEn?: string
  definitionVi?: string
  image?: string
  /** Ảnh chủ đề của Oxford (dự phòng khi không tìm được ảnh riêng). */
  oxfordImage?: string
  /** Phiên bản cách chọn ảnh; khác IMAGE_VERSION thì chỉ tìm lại ảnh, không tra lại từ điển. */
  imageVersion?: number
  /** Gợi ý chính tả của Oxford khi không tìm thấy từ ("diswasher" → "dishwasher"). */
  suggestions?: string[]
  /** 'oxford' khi lấy được từ Oxford, 'backup' khi dùng nguồn dự phòng. */
  source: 'oxford' | 'backup' | 'none'
}

/** Dự phòng: dictionaryapi.dev (có CORS). */
export function parseFreeDictionary(json: unknown, word: string): OxfordEntry | null {
  const entries = json as {
    word?: string
    phonetic?: string
    phonetics?: { text?: string; audio?: string }[]
    meanings?: { partOfSpeech?: string; definitions?: { definition?: string }[] }[]
  }[]
  if (!Array.isArray(entries) || !entries.length) return null
  const phonetics = entries.flatMap((e) => e.phonetics ?? [])
  const audios = phonetics.map((p) => p.audio).filter((a): a is string => !!a)
  const meanings = entries.flatMap((e) => e.meanings ?? [])
  return {
    headword: entries[0].word ?? word,
    pos: [...new Set(meanings.map((m) => m.partOfSpeech).filter((p): p is string => !!p))],
    phonUS: entries[0].phonetic ?? phonetics.find((p) => p.text)?.text,
    audioUS: audios.find((a) => a.includes('-us')) ?? audios[0],
    audioUK: audios.find((a) => a.includes('-uk')),
    definitions: meanings.flatMap((m) => m.definitions ?? []).map((d) => d.definition ?? '').filter(Boolean).slice(0, 3),
  }
}

/** Gộp dữ liệu Oxford + bản dịch thành thông tin hiển thị. */
export function mergeInfo(word: string, entry: OxfordEntry | null, tr: Translation | null, source: WordInfo['source']): WordInfo {
  const posNames = [...(entry?.pos ?? [])]
  for (const b of tr?.byPos ?? []) if (!posNames.includes(b.pos)) posNames.push(b.pos)
  const pos = posNames.map((en) => ({
    en,
    vi: posToVi(en),
    meanings: tr?.byPos.find((b) => b.pos === en)?.meanings ?? [],
  }))
  const main = tr?.main && tr.main.toLowerCase() !== word.toLowerCase() ? tr.main : undefined
  return {
    word,
    headword: entry?.headword ?? word,
    phonetic: entry?.phonUS ?? entry?.phonUK,
    audioUS: entry?.audioUS,
    audioUK: entry?.audioUK,
    pos,
    meaningVi: main ?? pos[0]?.meanings[0],
    definitionEn: entry?.definitions[0],
    image: entry?.image,
    source,
  }
}

/** Tăng số này khi đổi cách chọn ảnh: cache cũ chỉ phải tìm lại ảnh. */
export const IMAGE_VERSION = 2

export interface OxfordResult {
  entry: OxfordEntry | null
  suggestions: string[]
}

export interface LookupDeps {
  fetchOxford: (word: string) => Promise<OxfordResult>
  fetchBackup: (word: string) => Promise<OxfordEntry | null>
  translate: (text: string, withDict?: boolean) => Promise<Translation>
  findImage: (word: string, pos: string[]) => Promise<string | undefined>
}

export const defaultDeps: LookupDeps = {
  fetchOxford: async (w) => {
    const html = await fetchViaProxy(OXFORD_SEARCH + encodeURIComponent(w), { check: oxfordBodyCheck })
    const entry = parseOxfordHtml(html)
    return { entry, suggestions: entry ? [] : parseOxfordSuggestions(html) }
  },
  fetchBackup: async (w) => {
    const r = await fetchWithTimeout(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`, 8000)
    return r.ok ? parseFreeDictionary(await r.json(), w) : null
  },
  translate: translateToVi,
  findImage,
}

const safe = async <T>(p: Promise<T>): Promise<T | null> => {
  try {
    return await p
  } catch {
    return null
  }
}

export async function lookupWord(word: string, deps: LookupDeps = defaultDeps): Promise<WordInfo> {
  const [oxford, tr] = await Promise.all([safe(deps.fetchOxford(word)), safe(deps.translate(word, true))])
  let entry = oxford?.entry ?? null
  let source: WordInfo['source'] = entry ? 'oxford' : 'none'
  let exact: OxfordEntry | null = null
  if (!entry) {
    entry = await safe(deps.fetchBackup(word))
    if (entry) source = 'backup'
  } else if (entry.headword.toLowerCase() !== word.toLowerCase()) {
    // Oxford tự đổi sang từ gốc ("beans" → "bean"): lấy tiếng đọc đúng của từ bé đã nhập nếu có.
    // Giữ tiếng Oxford của từ gốc làm dự phòng, vì file của từ điển dự phòng có lúc hỏng.
    exact = await safe(deps.fetchBackup(word))
  }
  const info = mergeInfo(word, entry, tr, source)
  if (exact) {
    info.audioExact = exact.audioUS ?? exact.audioUK
    info.phonetic = exact.phonUS ?? exact.phonUK ?? info.phonetic
  }
  if (!entry && oxford?.suggestions.length) info.suggestions = oxford.suggestions
  info.oxfordImage = info.image
  const [defVi, image] = await Promise.all([
    info.definitionEn ? safe(deps.translate(info.definitionEn, false)) : Promise.resolve(null),
    safe(deps.findImage(word, info.pos.map((p) => p.en))),
  ])
  info.definitionVi = defVi?.main || undefined
  // Ảnh Oxford thường là ảnh ghép theo chủ đề, nên chỉ dùng khi không tìm được ảnh riêng.
  info.image = image ?? info.oxfordImage
  info.imageVersion = IMAGE_VERSION
  return info
}

// ---------- cache ----------
const CACHE_PREFIX = 'spelling-kids:lookup:v5:'
const inflight = new Map<string, Promise<WordInfo>>()

function readCache(word: string): WordInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + word.toLowerCase())
    return raw ? (JSON.parse(raw) as WordInfo) : null
  } catch {
    return null
  }
}

function writeCache(info: WordInfo) {
  try {
    localStorage.setItem(CACHE_PREFIX + info.word.toLowerCase(), JSON.stringify(info))
  } catch {
    /* đầy bộ nhớ: bỏ qua */
  }
}

const isFresh = (info: WordInfo) => info.source !== 'none' && info.imageVersion === IMAGE_VERSION

/** Kết quả đã cache và còn dùng được ngay (đã có dữ liệu từ điển và ảnh theo cách chọn mới nhất). */
export function getCached(word: string): WordInfo | null {
  const hit = readCache(word)
  return hit && isFresh(hit) ? hit : null
}

/**
 * Tra từ có cache (localStorage) và gộp các lần gọi trùng nhau.
 * Cache cũ chỉ lệch cách chọn ảnh thì chỉ tìm lại ảnh, không gọi Oxford (tránh hết lượt proxy).
 */
export function lookupCached(word: string, deps: LookupDeps = defaultDeps): Promise<WordInfo> {
  const key = word.toLowerCase()
  const hit = readCache(key)
  if (hit && isFresh(hit)) return Promise.resolve(hit)
  const pending = inflight.get(key)
  if (pending) return pending
  const work: Promise<WordInfo> =
    hit && hit.source !== 'none'
      ? safe(deps.findImage(word, hit.pos.map((p) => p.en))).then((img) => ({
          ...hit,
          image: img ?? hit.oxfordImage,
          imageVersion: IMAGE_VERSION,
        }))
      : lookupWord(word, deps)
  const p = work
    .then((info) => {
      // Chỉ cache khi có dữ liệu thật, để lần sau còn thử lại khi mạng lỗi.
      if (info.source !== 'none') writeCache(info)
      return info
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}
