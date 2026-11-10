import { useState, type FormEvent } from 'react'
import { extractWords } from '../lib/words'

interface Props {
  onAdd: (words: string[]) => void
  onPhoto: (file: File) => void
}

export function WordInput({ onAdd, onPhoto }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const words = extractWords(value)
    if (!words.length) {
      setError(value.trim() ? 'Hãy gõ chữ cái tiếng Anh nhé (a–z) 🙂' : 'Gõ một từ tiếng Anh vào đây nhé!')
      return
    }
    onAdd(words)
    setValue('')
    setError('')
  }

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onPhoto(f)
    e.target.value = ''
  }

  return (
    <section className="panel input-panel" aria-label="Thêm từ mới">
      <form onSubmit={submit} className="type-row">
        <label htmlFor="word-input" className="sr-only">
          Từ tiếng Anh
        </label>
        <input
          id="word-input"
          className="big-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError('')
          }}
          placeholder="Gõ từ tiếng Anh… (vd: cat, dog)"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={!!error}
          aria-describedby={error ? 'word-error' : undefined}
        />
        <button type="submit" className="btn btn-add">
          <span aria-hidden>➕</span> Thêm
        </button>
      </form>
      {error && (
        <p id="word-error" className="hint error" role="alert">
          {error}
        </p>
      )}
      <div className="photo-row">
        <label className="btn btn-photo camera">
          <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
          <span aria-hidden>📸</span> Chụp ảnh
        </label>
        <label className="btn btn-photo upload">
          <input type="file" accept="image/*" onChange={pick} hidden />
          <span aria-hidden>🖼️</span> Tải ảnh lên
        </label>
      </div>
    </section>
  )
}
