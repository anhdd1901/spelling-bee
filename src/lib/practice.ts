export type Mode = 'speak' | 'write'
/** Khóa = chữ của từ, viết thường. */
export type SkipCounts = Record<string, number>
export type Outcome = 'correct' | 'skipped'
export interface Round {
  words: string[]
  outcomes: Outcome[]
  redone: string[]
}
export type RoundAction = { type: 'correct' } | { type: 'skip' } | { type: 'redo'; word: string }

export function roundSize(total: number, random: () => number = Math.random): number {
  if (total < 15) return total
  return Math.min(total, 15 + Math.floor(random() * 6))
}

/** Chọn các từ cho một lượt: ưu tiên từ hay bị bỏ qua, rồi trộn thứ tự. Không sửa mảng đầu vào. */
export function pickRound(words: string[], skips: SkipCounts, random: () => number = Math.random): string[] {
  const size = roundSize(words.length, random)
  const ranked = words
    .map((w) => ({ w, skips: skips[w.toLowerCase()] ?? 0, tie: random() }))
    .sort((a, b) => b.skips - a.skips || a.tie - b.tie)
    .slice(0, size)
    .map((x) => x.w)
  for (let i = ranked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[ranked[i], ranked[j]] = [ranked[j], ranked[i]]
  }
  return ranked
}

export function startRound(words: string[]): Round {
  return { words, outcomes: [], redone: [] }
}

export function currentWord(round: Round): string | undefined {
  return round.words[round.outcomes.length]
}

export function isDone(round: Round): boolean {
  return round.outcomes.length >= round.words.length
}

export function roundReducer(round: Round, action: RoundAction): Round {
  switch (action.type) {
    case 'correct':
    case 'skip':
      if (isDone(round)) return round
      return { ...round, outcomes: [...round.outcomes, action.type === 'correct' ? 'correct' : 'skipped'] }
    case 'redo':
      if (round.redone.includes(action.word) || !skippedWords(round).includes(action.word)) return round
      return { ...round, redone: [...round.redone, action.word] }
  }
}

export function skippedWords(round: Round): string[] {
  return round.words.filter((_, i) => round.outcomes[i] === 'skipped')
}

export function score(round: Round): { correct: number; total: number; percent: number; stars: 1 | 2 | 3 } {
  const total = round.words.length
  const correct = round.outcomes.filter((o) => o === 'correct').length
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100)
  return { correct, total, percent, stars: percent >= 90 ? 3 : percent >= 60 ? 2 : 1 }
}

export function recordSkip(counts: SkipCounts, word: string): SkipCounts {
  const k = word.toLowerCase()
  return { ...counts, [k]: (counts[k] ?? 0) + 1 }
}

export function recordCorrect(counts: SkipCounts, word: string): SkipCounts {
  const next = { ...counts }
  delete next[word.toLowerCase()]
  return next
}

export function pruneSkips(counts: SkipCounts, words: string[]): SkipCounts {
  const keep = new Set(words.map((w) => w.toLowerCase()))
  return Object.fromEntries(Object.entries(counts).filter(([k]) => keep.has(k)))
}

export function swipeDecision(dx: number, width: number, velocity: number): 'skip' | 'back' {
  return dx <= -width / 3 || (velocity <= -0.5 && dx <= -30) ? 'skip' : 'back'
}
