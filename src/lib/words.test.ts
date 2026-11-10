import { describe, expect, it } from 'vitest'
import { extractWords, normalizeWord } from './words'

describe('normalizeWord', () => {
  it('lowercases and trims', () => {
    expect(normalizeWord('  Apple ')).toBe('apple')
  })
  it('strips punctuation at edges but keeps inner apostrophe/hyphen', () => {
    expect(normalizeWord('"ice-cream",')).toBe('ice-cream')
    expect(normalizeWord("don't!")).toBe("don't")
  })
  it('returns empty string for non-words', () => {
    expect(normalizeWord('123')).toBe('')
    expect(normalizeWord('!!')).toBe('')
  })
  it('keeps "I" as uppercase', () => {
    expect(normalizeWord('i')).toBe('I')
  })
})

describe('extractWords', () => {
  it('splits by spaces, commas, newlines and dedupes', () => {
    expect(extractWords('cat, dog\nCat  bird;fish')).toEqual(['cat', 'dog', 'bird', 'fish'])
  })
  it('ignores numbers and junk from OCR', () => {
    expect(extractWords('1. Apple  2) b@nana | ~ zz9 tree')).toEqual(['apple', 'tree'])
  })
  it('can drop single letters except a and I', () => {
    expect(extractWords('a x I b go', { minLength: 2 })).toEqual(['a', 'I', 'go'])
  })
})
