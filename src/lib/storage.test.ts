import { beforeEach, describe, expect, it } from 'vitest'
import { addWords, correctWord, loadWords, moveWord, removeWord, removeWords, saveWords } from './storage'

describe('word list', () => {
  beforeEach(() => localStorage.clear())
  it('adds new words and skips duplicates', () => {
    const r1 = addWords([], ['cat', 'dog'])
    const r2 = addWords(r1.list, ['Cat', 'bird'])
    expect(r2.list.map((w) => w.text)).toEqual(['cat', 'dog', 'bird'])
    expect(r2).toMatchObject({ added: 1, duplicates: 1 })
  })
  it('removes and persists', () => {
    const { list } = addWords([], ['cat', 'dog'])
    saveWords(removeWord(list, list[0].id))
    expect(loadWords().map((w) => w.text)).toEqual(['dog'])
  })
  it('removes several words at once', () => {
    const { list } = addWords([], ['a', 'b', 'c', 'd'])
    expect(removeWords(list, [list[1].id, list[3].id, 'missing']).map((w) => w.text)).toEqual(['a', 'c'])
    expect(removeWords(list, []).map((w) => w.text)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('moves a word to another position (drag and drop)', () => {
    const { list } = addWords([], ['a', 'b', 'c', 'd'])
    const ids = list.map((w) => w.id)
    expect(moveWord(list, ids[0], ids[2]).map((w) => w.text)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveWord(list, ids[3], ids[1]).map((w) => w.text)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveWord(list, ids[1], 'missing')).toBe(list)
  })
  it('corrects a misspelled word in place, or drops it if the right word exists', () => {
    const { list } = addWords([], ['cat', 'diswasher', 'dog'])
    const r = correctWord(list, list[1].id, 'dishwasher')
    expect(r.list.map((w) => w.text)).toEqual(['cat', 'dishwasher', 'dog'])
    expect(r.item).toEqual({ id: list[1].id, text: 'dishwasher' })
    const r2 = correctWord(list, list[1].id, 'dog')
    expect(r2.list.map((w) => w.text)).toEqual(['cat', 'dog'])
    expect(r2.item).toBe(list[2])
  })
  it('survives corrupted storage', () => {
    localStorage.setItem('spelling-kids:words:v1', '{bad')
    expect(loadWords()).toEqual([])
  })
})
