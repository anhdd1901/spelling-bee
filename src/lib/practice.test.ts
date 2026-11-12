import { describe, expect, it } from 'vitest'
import {
  currentWord,
  isDone,
  pickRound,
  pruneSkips,
  recordCorrect,
  recordSkip,
  roundReducer,
  roundSize,
  score,
  skippedWords,
  startRound,
  swipeDecision,
  type Outcome,
  type Round,
} from './practice'

const seq = (...v: number[]) => {
  let i = 0
  return () => v[i++ % v.length]
}
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`)
const roundOf = (correct: number, skipped: number): Round => {
  const outcomes: Outcome[] = [...Array(correct).fill('correct'), ...Array(skipped).fill('skipped')]
  return { words: words(outcomes.length), outcomes, redone: [] }
}

describe('practice round', () => {
  it('roundSize: dưới 15 lấy hết, từ 15 trở lên lấy 15–20 và không quá tổng', () => {
    expect(roundSize(0)).toBe(0)
    expect(roundSize(14, () => 0.99)).toBe(14)
    expect(roundSize(15, () => 0.99)).toBe(15)
    expect(roundSize(40, () => 0)).toBe(15)
    expect(roundSize(40, () => 0.99)).toBe(20)
    expect(roundSize(17, () => 0.99)).toBe(17)
  })
  it('pickRound ưu tiên từ hay bỏ qua và không lặp từ', () => {
    const r = pickRound(words(40), { w39: 3, w38: 1 }, seq(0.1, 0.7, 0.4))
    expect(r).toHaveLength(15)
    expect(new Set(r).size).toBe(15)
    expect(r).toContain('w39')
    expect(r).toContain('w38')
  })
  it('pickRound không sửa mảng đầu vào', () => {
    const w = words(5)
    pickRound(w, {})
    expect(w).toEqual(words(5))
  })
  it('reducer: đúng, bỏ qua, hết lượt, làm lại', () => {
    let r = startRound(['a', 'b', 'c'])
    expect(currentWord(r)).toBe('a')
    r = roundReducer(r, { type: 'correct' })
    r = roundReducer(r, { type: 'skip' })
    r = roundReducer(r, { type: 'correct' })
    expect(isDone(r)).toBe(true)
    expect(currentWord(r)).toBeUndefined()
    expect(roundReducer(r, { type: 'correct' })).toEqual(r)
    expect(skippedWords(r)).toEqual(['b'])
    expect(score(r)).toEqual({ correct: 2, total: 3, percent: 67, stars: 2 })
    const again = roundReducer(roundReducer(r, { type: 'redo', word: 'b' }), { type: 'redo', word: 'b' })
    expect(again.redone).toEqual(['b'])
    expect(score(again).percent).toBe(67)
    expect(roundReducer(r, { type: 'redo', word: 'a' }).redone).toEqual([])
  })
  it('score: ngưỡng sao 90 và 60, lượt rỗng', () => {
    expect(score(roundOf(9, 1))).toEqual({ correct: 9, total: 10, percent: 90, stars: 3 })
    expect(score(roundOf(6, 4))).toEqual({ correct: 6, total: 10, percent: 60, stars: 2 })
    expect(score(roundOf(5, 5))).toEqual({ correct: 5, total: 10, percent: 50, stars: 1 })
    expect(score(roundOf(18, 0))).toEqual({ correct: 18, total: 18, percent: 100, stars: 3 })
    expect(score(roundOf(0, 0))).toEqual({ correct: 0, total: 0, percent: 0, stars: 1 })
  })
  it('recordSkip/recordCorrect/pruneSkips không phân biệt hoa thường', () => {
    expect(recordSkip({ cat: 1 }, 'Cat')).toEqual({ cat: 2 })
    expect(recordCorrect({ cat: 2, dog: 1 }, 'CAT')).toEqual({ dog: 1 })
    expect(pruneSkips({ cat: 2, dog: 1 }, ['Dog'])).toEqual({ dog: 1 })
  })
  it('swipeDecision', () => {
    expect(swipeDecision(-101, 300, 0)).toBe('skip')
    expect(swipeDecision(-99, 300, 0)).toBe('back')
    expect(swipeDecision(-40, 300, -0.6)).toBe('skip')
    expect(swipeDecision(-10, 300, -2)).toBe('back')
    expect(swipeDecision(200, 300, 2)).toBe('back')
  })
})
