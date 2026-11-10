import { fetchWithTimeout } from './fetchProxy'

export interface ViMeaning {
  pos: string
  meanings: string[]
}

export interface Translation {
  main: string
  byPos: ViMeaning[]
}

const GT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q='

/** Đọc JSON trả về của Google Translate (dt=t + dt=bd). */
export function parseGoogleTranslate(json: unknown): Translation {
  const arr = json as unknown[]
  const sentences = (arr?.[0] as unknown[][] | null) ?? []
  const main = sentences.map((s) => (s?.[0] as string) ?? '').join('').trim()
  const dict = (arr?.[1] as unknown[][] | null) ?? []
  const byPos = dict
    .map((d) => {
      // d[2] = [[nghĩa, [các từ tiếng Anh dịch ngược]], ...]: nghĩa ít từ dịch ngược thì cụ thể hơn, xếp lên trước.
      const detail = (d?.[2] as [string, string[]][] | undefined) ?? []
      const spread = (m: string) => detail.find((x) => x?.[0] === m)?.[1]?.length ?? 99
      const meanings = [...((d?.[1] as string[]) ?? [])].sort((a, b) => spread(a) - spread(b))
      return { pos: String(d?.[0] ?? ''), meanings: meanings.slice(0, 5) }
    })
    .filter((d) => d.pos && d.meanings.length)
  return { main, byPos }
}

export async function translateToVi(text: string, withDict = true): Promise<Translation> {
  const url = withDict ? GT + encodeURIComponent(text) : GT.replace('&dt=bd', '') + encodeURIComponent(text)
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`)
  return parseGoogleTranslate(await res.json())
}
