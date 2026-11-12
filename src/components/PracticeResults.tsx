import { score, skippedWords } from '../lib/practice'
import type { Round } from '../lib/practice'
import { Honeycomb } from './Honeycomb'

export function PracticeResults({
  round,
  onRedo,
  onNewRound,
  onExit,
}: {
  round: Round
  onRedo(word: string): void
  onNewRound(): void
  onExit(): void
}) {
  const { correct, total, percent, stars } = score(round)
  const skipped = skippedWords(round)
  return (
    <section className="results">
      <div className="stars" role="img" aria-label={`${stars} trên 3 sao`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= stars ? 'star on' : 'star'} aria-hidden="true">★</span>
        ))}
      </div>
      <p className="percent">{percent}%</p>
      <p className="results-line">Bé làm đúng {correct} trên {total} từ</p>
      <Honeycomb total={total} outcomes={round.outcomes} />
      {skipped.length > 0 ? (
        <div className="redo">
          <h2>Luyện lại nhé:</h2>
          <div className="redo-chips">
            {skipped.map((w) => {
              const ok = round.redone.includes(w)
              return (
                <button
                  key={w}
                  type="button"
                  className={ok ? 'chip-btn ok' : 'chip-btn'}
                  aria-label={ok ? `${w}, đã làm đúng` : `Luyện lại ${w}`}
                  onClick={() => onRedo(w)}
                >
                  {w}{ok && ' ✅'}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="all-good">Bé làm đúng hết rồi! 🐝</p>
      )}
      <div className="results-actions">
        <button type="button" className="btn btn-add" onClick={onNewRound}>Luyện lượt mới</button>
        <button type="button" className="btn" onClick={onExit}>Về danh sách</button>
      </div>
    </section>
  )
}
