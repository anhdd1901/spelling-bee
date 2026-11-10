import { useEffect, useMemo, useState } from 'react'
import { wordsFromImage } from '../lib/ocr'
import { Sheet } from './Sheet'

interface Props {
  file: File
  existing: Set<string>
  onAdd: (words: string[]) => void
  onClose: () => void
}

export function PhotoImport({ file, existing, onAdd, onClose }: Props) {
  const preview = useMemo(() => URL.createObjectURL(file), [file])
  const [progress, setProgress] = useState(0)
  const [words, setWords] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const close = () => {
    URL.revokeObjectURL(preview)
    onClose()
  }

  useEffect(() => {
    let alive = true
    wordsFromImage(file, (p) => alive && setProgress(p))
      .then((ws) => {
        if (!alive) return
        setWords(ws)
        setSelected(new Set(ws.filter((w) => !existing.has(w.toLowerCase()))))
      })
      .catch(() => alive && setError('Ôi, không đọc được ảnh này. Thử ảnh rõ hơn nhé!'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  const toggle = (w: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(w)) n.delete(w)
      else n.add(w)
      return n
    })

  const chosen = words?.filter((w) => selected.has(w)) ?? []

  return (
    <Sheet title="Từ trong ảnh" onClose={close}>
      <div className="ocr">
        <img className="ocr-preview" src={preview} alt="Ảnh bé vừa chọn" />
        {error && <p className="hint error">{error}</p>}
        {!words && !error && (
          <div className="ocr-loading" role="status" aria-live="polite">
            <p>🔍 Đang tìm chữ trong ảnh…</p>
            <div className="progress" aria-hidden>
              <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
        {words && words.length === 0 && <p className="hint">Không thấy từ tiếng Anh nào. Thử ảnh khác nhé! 🙈</p>}
        {words && words.length > 0 && (
          <>
            <p className="hint">Chạm vào từ để chọn hoặc bỏ chọn:</p>
            <div className="chip-list">
              {words.map((w) => {
                const dup = existing.has(w.toLowerCase())
                return (
                  <button
                    key={w}
                    type="button"
                    className={`chip ${selected.has(w) ? 'on' : ''}`}
                    aria-pressed={selected.has(w)}
                    onClick={() => toggle(w)}
                    title={dup ? 'Từ này đã có rồi' : undefined}
                  >
                    {selected.has(w) ? '✅' : '⬜'} {w}
                    {dup && <small> (đã có)</small>}
                  </button>
                )
              })}
            </div>
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set(words))}>
                Chọn hết
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set())}>
                Bỏ hết
              </button>
              <button
                type="button"
                className="btn btn-add"
                disabled={!chosen.length}
                onClick={() => {
                  onAdd(chosen)
                  close()
                }}
              >
                ➕ Thêm {chosen.length} từ
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
