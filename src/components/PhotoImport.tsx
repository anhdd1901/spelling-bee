import { useEffect, useState } from 'react'
import { wordsFromImage } from '../lib/ocr'
import { isPdf, MAX_PDF_PAGES, wordsFromPdf } from '../lib/pdf'
import { Sheet } from './Sheet'

interface Props {
  file: File
  existing: Set<string>
  onAdd: (words: string[]) => void
  onClose: () => void
}

export function PhotoImport({ file, existing, onAdd, onClose }: Props) {
  const pdf = isPdf(file)
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [words, setWords] = useState<string[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const ctl = new AbortController()
    let url: string | undefined
    const show = (blob: Blob) => {
      if (!alive) return
      url = URL.createObjectURL(blob)
      setPreview(url)
    }
    const onProgress = (p: number) => alive && setProgress(p)
    const job = pdf
      ? wordsFromPdf(file, { onProgress, onPreview: show, signal: ctl.signal })
      : (show(file), wordsFromImage(file, onProgress).then((ws) => ({ words: ws, truncated: false })))
    job
      .then((r) => {
        if (!alive) return
        setWords(r.words)
        setTruncated(r.truncated)
        setSelected(new Set(r.words.filter((w) => !existing.has(w.toLowerCase()))))
      })
      .catch(
        () =>
          alive &&
          setError(pdf ? 'Ôi, không mở được file PDF này. Thử file khác nhé!' : 'Ôi, không đọc được ảnh này. Thử ảnh rõ hơn nhé!'),
      )
    return () => {
      alive = false
      ctl.abort()
      if (url) URL.revokeObjectURL(url)
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
    <Sheet title={pdf ? 'Từ trong tài liệu' : 'Từ trong ảnh'} onClose={onClose}>
      <div className="ocr">
        {preview && (
          <img className="ocr-preview" src={preview} alt={pdf ? 'Trang đầu của tài liệu' : 'Ảnh bé vừa chọn'} />
        )}
        {error && <p className="hint error">{error}</p>}
        {!words && !error && (
          <div className="ocr-loading" role="status" aria-live="polite">
            <p>🔍 Đang tìm chữ trong {pdf ? 'tài liệu' : 'ảnh'}…</p>
            <div className="progress" aria-hidden>
              <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
        {words && words.length === 0 && <p className="hint">Không thấy từ tiếng Anh nào. Thử {pdf ? 'file' : 'ảnh'} khác nhé! 🙈</p>}
        {truncated && <p className="hint">📄 Chỉ đọc {MAX_PDF_PAGES} trang đầu của tài liệu.</p>}
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
                  onClose()
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
