import { describe, expect, it } from 'vitest'
import { parseGoogleTranslate } from './translate'

describe('parseGoogleTranslate', () => {
  it('reads main translation and per-POS meanings', () => {
    const json = [
      [['quả táo', 'apple', null, null, 10]],
      [['noun', ['táo', 'quả táo'], [], 'apple', 1], ['verb', ['chạy'], [], 'apple', 2]],
      'en',
    ]
    expect(parseGoogleTranslate(json)).toEqual({
      main: 'quả táo',
      byPos: [
        { pos: 'noun', meanings: ['táo', 'quả táo'] },
        { pos: 'verb', meanings: ['chạy'] },
      ],
    })
  })
  it('puts specific meanings first', () => {
    const json = [
      [['quả táo', 'apple']],
      [['noun', ['mối bất hòa', 'táo'], [['mối bất hòa', ['discord', 'breach', 'apple']], ['táo', ['apple']]], 'apple', 1]],
    ]
    expect(parseGoogleTranslate(json).byPos[0].meanings).toEqual(['táo', 'mối bất hòa'])
  })
  it('handles missing dictionary part', () => {
    expect(parseGoogleTranslate([[['xin chào', 'hello']], null, 'en'])).toEqual({ main: 'xin chào', byPos: [] })
  })
})
