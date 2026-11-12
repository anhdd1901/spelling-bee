import type { Outcome } from '../lib/practice'

export function Honeycomb({ total, outcomes }: { total: number; outcomes: Outcome[] }) {
  const n = Math.min(outcomes.length + 1, total)
  return (
    <ol className="honeycomb" aria-label={`Từ ${n} trên ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const state = i < outcomes.length ? outcomes[i] : i === outcomes.length ? 'current' : ''
        return <li key={i} className={state ? `cell ${state}` : 'cell'} />
      })}
    </ol>
  )
}
