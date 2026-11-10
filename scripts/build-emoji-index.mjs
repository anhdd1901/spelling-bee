// Dựng bảng tra từ tiếng Anh → emoji 3D (Fluent Emoji, gói @lobehub/fluent-emoji-3d).
// Chạy: node scripts/build-emoji-index.mjs  (cần mạng để lấy danh sách file ảnh có sẵn)
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const data = require('emojibase-data/en/compact.json')
const PKG = '@lobehub/fluent-emoji-3d@1.1.0'

const res = await fetch(`https://data.jsdelivr.com/v1/packages/npm/${PKG}?structure=flat`)
const files = new Set(
  (await res.json()).files.map((f) => f.name).filter((n) => n.startsWith('/assets/')).map((n) => n.slice(8, -5)),
)

const fileFor = (hex) => {
  const h = hex.toLowerCase()
  for (const c of [h, h.replace(/-fe0f/g, ''), `${h}-fe0f`]) if (files.has(c)) return c
  return null
}

// Nhóm 2 = component, 9 = cờ: bỏ.
const SKIP_GROUPS = new Set([2, 9])
// Emoji không hợp với trẻ em: không bao giờ dùng.
const BLOCK = new Set(
  '1F480 2620 26B0 26B1 1F52B 1F4A3 1F52A 1F5E1 2694 1F489 1F48A 1F6AC 1F595 1FA78 1F37A 1F37B 1F377 1F378 1F379 1F942 1F943 1F376 1F9EB 1F9A0 1F47F 1F608 1F4A9 1F92C 1F92E 1F922 1F975 1F976 1F635 1F480 1FA93 1F5F3 1F3F4 1F3F3 1F51E 1F48B 1F445 1F444'.split(' '),
)
const best = new Map() // word -> {file, score}
const offer = (word, file, score) => {
  if (!/^[a-z]+(?:[-'][a-z]+)*$/.test(word)) return
  const cur = best.get(word)
  if (!cur || score < cur.score) best.set(word, { file, score })
}

for (const e of data) {
  if (SKIP_GROUPS.has(e.group) || BLOCK.has(e.hexcode.split('-')[0])) continue
  const file = fileFor(e.hexcode)
  if (!file) continue
  const label = e.label.toLowerCase().replace(/^(?:flag|keycap): /, '')
  const order = e.order ?? 99999
  // Điểm thấp hơn = khớp tốt hơn: tên emoji đúng bằng từ > tên có từ đó ở cuối ("red apple") > tag.
  if (!label.includes(' ')) offer(label, file, order)
  else {
    const parts = label.split(' ')
    if (parts.length === 2) {
      offer(parts[1], file, 200000 + order)
      // "angry face", "smiling face"… → tính từ đứng trước "face"
      if (parts[1] === 'face') offer(parts[0], file, 300000 + order)
    }
  }
  for (const t of e.tags ?? []) offer(t.toLowerCase(), file, 400000 + order)
}

const extra = JSON.parse(readFileSync(new URL('./emoji-overrides.json', import.meta.url), 'utf8'))
const out = Object.fromEntries([...best.entries()].sort().map(([w, v]) => [w, v.file]))
for (const [w, hex] of Object.entries(extra)) {
  if (w.startsWith('//')) continue
  const f = hex ? fileFor(hex) : null
  if (f) out[w] = f
  else delete out[w]
}
writeFileSync(new URL('../src/data/emoji-index.json', import.meta.url), JSON.stringify(out))
console.log('words:', Object.keys(out).length)
