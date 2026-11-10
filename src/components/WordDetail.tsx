import { useState } from 'react'
import type { PlayResult } from '../lib/audio'
import type { WordInfo } from '../lib/lookup'
import { posColor } from '../lib/pos'
import { FitText } from './FitText'

interface Props {
  word: string
  info: WordInfo | null
  loading: boolean
  /** Kết quả lần phát gần nhất; 'none' = không phát được tiếng nào. */
  sound: PlayResult | null
  onPlay: (accent: 'us' | 'uk') => void
  onFix: (suggestion: string) => void
  onClose: () => void
  onRetry: () => void
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Khối chi tiết từ, nằm thay chỗ phần đầu trang (tên app + ô thêm từ). */
export function WordDetail({ word, info, loading, sound, onPlay, onFix, onClose, onRetry }: Props) {
  const [badImg, setBadImg] = useState<string>()
  const [playing, setPlaying] = useState<'us' | 'uk' | null>(null)

  const play = (accent: 'us' | 'uk') => {
    setPlaying(accent)
    onPlay(accent)
    setTimeout(() => setPlaying(null), 600)
  }
  const suggestions = info?.suggestions ?? []
  const baseWord = info && info.headword.toLowerCase() !== word.toLowerCase() ? info.headword : null
  const suggestionList = suggestions.length > 0 && (
    <div className="suggest">
      <p>Có phải bé muốn viết:</p>
      <div className="suggest-list">
        {suggestions.map((s) => (
          <button key={s} type="button" className="btn btn-suggest small" onClick={() => onFix(s)}>
            ✨ {s}
          </button>
        ))}
      </div>
    </div>
  )

  const main = info?.meaningVi
  const extra = (info?.pos ?? [])
    .map((p) => ({ ...p, meanings: p.meanings.filter((m) => !main || !same(m, main)) }))
    .filter((p) => p.meanings.length)
  const many = (info?.pos.length ?? 0) > 1

  return (
    <section className="panel detail" aria-label={`Chi tiết từ ${word}`}>
      <button type="button" className="close-btn" onClick={onClose} aria-label="Đóng, quay lại thêm từ">
        ✕
      </button>

      <div className="detail-head">
        <FitText as="h2" className="detail-word" text={word} />
        {(info?.phonetic || baseWord) && (
          <p className="phonetic">
            {info?.phonetic}
            {baseWord && <span className="base-word"> · từ gốc: {baseWord}</span>}
          </p>
        )}
        <div className="listen-row">
          <button type="button" className={`btn btn-listen us ${playing === 'us' ? 'pulse' : ''}`} onClick={() => play('us')} disabled={loading}>
            🔊 Mỹ
          </button>
          {info?.audioUK && (
            <button type="button" className={`btn btn-listen uk ${playing === 'uk' ? 'pulse' : ''}`} onClick={() => play('uk')}>
              🔊 Anh
            </button>
          )}
        </div>
      </div>

      <div className="detail-meaning">
        {loading ? (
          <div className="loading-dots" role="status" aria-label="Đang tìm nghĩa">
            <span />
            <span />
            <span />
          </div>
        ) : info && (main || info.pos.length) ? (
          <>
            {info.pos.length > 0 && (
              <div className="pos-tags">
                {info.pos.map((p) => (
                  <span key={p.en} className="pos-tag" style={{ background: posColor(p.en).strong }}>
                    {p.vi}
                  </span>
                ))}
              </div>
            )}
            {main && <p className="meaning-text">{main}</p>}
            {extra.length > 0 && (
              <ul className="sub-meanings">
                {extra.map((p) => (
                  <li key={p.en}>
                    {many && (
                      <b className="sub-pos" style={{ color: posColor(p.en).strong }}>
                        {p.vi}:{' '}
                      </b>
                    )}
                    {p.meanings.slice(0, 4).join(', ')}
                  </li>
                ))}
              </ul>
            )}
            {suggestionList}
          </>
        ) : (
          <div className="not-found">
            <p>😕 Chưa tìm được từ này. Bé kiểm tra lại chính tả nhé.</p>
            {suggestionList || (
              <button type="button" className="btn btn-ghost small" onClick={onRetry}>
                🔄 Thử lại
              </button>
            )}
          </div>
        )}
        {!loading && sound === 'none' && (
          <p className="no-sound" role="status">
            🔇{' '}
            {info?.source === 'none'
              ? 'Chưa có tiếng đọc cho từ này.'
              : 'Chưa phát được tiếng. Bấm nút 🔊 để thử lại nhé.'}
          </p>
        )}
      </div>

      <div className="detail-picture">
        {info?.image && info.image !== badImg ? (
          <img src={info.image} alt={`Hình minh họa cho ${word}`} onError={() => setBadImg(info.image)} referrerPolicy="no-referrer" />
        ) : (
          <div className={`picture-placeholder ${loading ? 'loading' : ''}`} aria-hidden />
        )}
      </div>
    </section>
  )
}
