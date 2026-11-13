import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { unlockAudio } from '../lib/audio'
import { homophonesOf } from '../lib/speech'
import type { StageProps } from './PracticeScreen'
import { SwipeCard } from './SwipeCard'
import { useFeedback } from './useFeedback'

function EraserIcon() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20.5 16.8 6.8c1-1.1 2.7-1.2 3.8-.2l4.6 4c1.1 1 1.2 2.7.2 3.8L15 26" />
      <path d="M5 20.5c-1 1.1-.9 2.8.2 3.8l2.2 1.9c.5.4 1.1.7 1.8.7H26" />
      <path d="m10.5 13.2 8.9 7.7" />
    </svg>
  )
}

/** Dùng một lần cho mỗi từ: cha remount bằng `key` mới. */
export function WriteCard({ word, info, hasNext, onCorrect, onSkip, playModel }: StageProps) {
  const [value, setValue] = useState('')
  const [noSound, setNoSound] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const settled = useRef(false)
  const mounted = useRef(true)
  const [skipSignal, setSkipSignal] = useState(0)
  const { feedback, right, wrong, lock } = useFeedback(onCorrect)

  const hear = () => {
    void playModel().then((r) => {
      if (mounted.current) setNoSound(r === 'none')
    })
  }

  const started = useRef(false)
  useEffect(() => {
    mounted.current = true
    input.current?.focus()
    if (started.current) return
    started.current = true
    hear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => { mounted.current = false }, [])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    unlockAudio()
    if (settled.current) return
    const typed = value.trim().replace(/[\u2018\u2019]/g, "'")
    if (!typed) return
    if (typed.toLowerCase() === word.toLowerCase()) {
      settled.current = true
      right()
    } else {
      wrong()
      setValue('')
      input.current?.focus()
    }
  }

  const leave = () => {
    if (settled.current) return
    settled.current = true
    lock()
  }

  // Nút cũng đi qua đúng chuỗi của cú gạt: SwipeCard gọi leave rồi onSkip.
  const skip = () => {
    if (settled.current) return
    setSkipSignal((n) => n + 1)
  }

  const showMeaning = !!info?.meaningVi && (noSound || homophonesOf(word).length > 0)

  return (
    <SwipeCard feedback={feedback} hasNext={hasNext} onSkip={onSkip} onLeave={leave} skipSignal={skipSignal} className="write-card">
      <div className="write-body">
        <button type="button" className="icon-btn listen" aria-label="Nghe lại" onClick={() => { unlockAudio(); hear() }}>
          🔊
        </button>
        <button type="button" className="icon-btn eraser" aria-label="Xóa hết chữ" onClick={() => { setValue(''); input.current?.focus() }}>
          <EraserIcon />
        </button>
        {noSound && <p className="no-sound">🔇 Chưa có tiếng đọc</p>}
        {noSound && info?.image && <img className="write-image" src={info.image} alt="" />}
        <form onSubmit={submit}>
          <input
            ref={input}
            className="write-input"
            aria-label="Bé viết từ vừa nghe"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {showMeaning && <p className="write-meaning">{info?.meaningVi}</p>}
          <button type="submit" className="btn btn-done">Xong ✓</button>
        </form>
        <button type="button" className="skip-link" onClick={skip}>Bỏ qua ⏭</button>
      </div>
    </SwipeCard>
  )
}
