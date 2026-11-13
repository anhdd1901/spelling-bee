import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { stopPlayback, unlockAudio } from '../lib/audio'
import { posColor } from '../lib/pos'
import { primeSfx } from '../lib/sfx'
import { listenOnce, matchesWord, speechSupported } from '../lib/speech'
import type { ListenResult, Listening } from '../lib/speech'
import { FitText } from './FitText'
import type { StageProps } from './PracticeScreen'
import { SwipeCard } from './SwipeCard'
import { useFeedback } from './useFeedback'

function MicIcon() {
  return (
    <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="11.5" y="3.5" width="9" height="16" rx="4.5" fill="currentColor" />
      <path d="M7 15.5a9 9 0 0 0 18 0M16 24.5v4M11.5 28.5h9" />
    </svg>
  )
}

/** Dùng một lần cho mỗi từ: cha remount bằng `key` mới. */
export function SpeakCard({ word, info, hasNext, onCorrect, onSkip, playModel }: StageProps) {
  const [listening, setListening] = useState(false)
  const [notice, setNotice] = useState('')
  const [noSound, setNoSound] = useState(false)
  const [skipSignal, setSkipSignal] = useState(0)
  const settled = useRef(false)
  const mounted = useRef(true)
  const session = useRef<Listening | null>(null)
  const { feedback, right, wrong, lock } = useFeedback(onCorrect)
  const supported = speechSupported()

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      session.current?.stop()
      session.current = null
    }
  }, [])

  const hear = () => {
    if (settled.current || session.current) return
    unlockAudio()
    // Tra từ xong muộn mà bé đã bấm 🎤 thì không phát mẫu vào micro.
    void playModel(() => !session.current && !settled.current).then(
      (r) => { if (mounted.current) setNoSound(r === 'none') },
      () => {},
    )
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      hear()
    }
  }

  const speak = () => {
    if (settled.current || session.current) return
    setNotice('')
    stopPlayback()
    primeSfx()
    const s = listenOnce()
    session.current = s
    setListening(true)
    void s.result.then((r: ListenResult) => {
      if (session.current !== s) return
      session.current = null
      if (!mounted.current || settled.current) return
      setListening(false)
      if (r.kind === 'heard') {
        if (matchesWord(word, r.alternatives)) {
          settled.current = true
          right()
        } else {
          wrong()
          setNotice(`Máy nghe là: ${r.alternatives[0]}`)
        }
      } else if (r.kind === 'silent') {
        setNotice('Chưa nghe thấy, bé bấm 🎤 nói lại nhé')
      } else if (r.kind === 'denied') {
        setNotice('Bé cần cho phép dùng micro')
      } else {
        setNotice('Máy chưa nghe được, bé thử lại nhé')
      }
    })
  }

  const leave = () => {
    if (settled.current) return
    settled.current = true
    lock()
    session.current?.stop()
    session.current = null
    setListening(false)
  }

  // Nút cũng đi qua đúng chuỗi của cú gạt: SwipeCard gọi leave rồi onSkip.
  const skip = () => {
    if (settled.current) return
    setSkipSignal((n) => n + 1)
  }

  return (
    <SwipeCard
      feedback={feedback}
      hasNext={hasNext}
      onSkip={onSkip}
      onLeave={leave}
      onTap={hear}
      skipSignal={skipSignal}
      className="speak-card"
      style={{ backgroundColor: posColor(info?.pos[0]?.en).bg }}
    >
      <div className="speak-body">
        <div className="speak-face" role="button" tabIndex={0} aria-label={`Nghe đọc mẫu ${word}`} onKeyDown={onKey}
          onClick={(e) => { if (e.detail === 0) hear() }}>
          {info?.image && <img className="speak-image" src={info.image} alt="" draggable={false} />}
          <div className="speak-word">
            <FitText text={word} />
          </div>
        </div>
        {noSound && <p className="no-sound">🔇 Chưa có tiếng đọc</p>}
        <p className="speak-notice" role="status">{notice}</p>
        {supported ? (
          <>
            <button
              type="button"
              className={`mic-btn${listening ? ' listening' : ''}`}
              aria-label="Bấm để nói"
              aria-pressed={listening}
              onClick={speak}
            >
              <span className="ring" aria-hidden="true" />
              <span className="ring ring2" aria-hidden="true" />
              <MicIcon />
            </button>
            <p className="mic-label">{listening ? 'Bé nói đi…' : ''}</p>
          </>
        ) : (
          <p className="no-sound">Máy này chưa nghe được bé nói — hãy mở bằng Chrome hoặc Safari</p>
        )}
        <button type="button" className="skip-link" onClick={skip}>Bỏ qua ⏭</button>
      </div>
    </SwipeCard>
  )
}
