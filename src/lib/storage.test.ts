import { beforeEach, describe, expect, it } from 'vitest'
import { addWords, correctWord, loadWords, loadSkipCounts, moveWord, removeWord, removeWords, saveSkipCounts, saveWords } from './storage'

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
  it('skip counts: lưu riêng từng chế độ, dữ liệu hỏng coi như rỗng', () => {
    saveSkipCounts('speak', { cat: 2 })
    expect(loadSkipCounts('speak')).toEqual({ cat: 2 })
    expect(loadSkipCounts('write')).toEqual({})
    for (const bad of ['not json', '[1,2]', '"x"', 'null']) {
      localStorage.setItem('spelling-kids:skips:write:v1', bad)
      expect(loadSkipCounts('write')).toEqual({})
    }
    localStorage.setItem('spelling-kids:skips:write:v1', '{"cat":"x","dog":2,"owl":-1,"bee":1.5}')
    expect(loadSkipCounts('write')).toEqual({ dog: 2 })
  })
})
