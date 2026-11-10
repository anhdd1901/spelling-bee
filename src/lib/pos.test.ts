import { describe, expect, it } from 'vitest'
import { posColor, posGroup, posToVi } from './pos'

describe('pos', () => {
  it('groups parts of speech', () => {
    expect(posGroup('noun')).toBe('noun')
    expect(posGroup('phrasal verb')).toBe('verb')
    expect(posGroup('adverb')).toBe('adverb')
    expect(posGroup('adjective')).toBe('adjective')
    expect(posGroup('exclamation')).toBe('other')
    expect(posGroup(undefined)).toBeUndefined()
  })
  it('gives a neutral color while unknown', () => {
    expect(posColor(undefined).label).toBe('Đang tìm')
    expect(posColor('verb').label).toBe('Động từ')
  })
  it('translates names to Vietnamese', () => {
    expect(posToVi('adjective')).toBe('Tính từ')
  })
})
