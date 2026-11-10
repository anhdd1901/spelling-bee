import { describe, expect, it } from 'vitest'
import { EMOJI_CDN, emojiImage, pickWikiImage, singularForms } from './images'

describe('image pickers', () => {
  it('skips wikipedia disambiguation pages', () => {
    expect(pickWikiImage({ type: 'disambiguation', thumbnail: { source: 'a' } })).toBeUndefined()
    expect(pickWikiImage({ type: 'standard', thumbnail: { source: 'a' } })).toBe('a')
    expect(pickWikiImage({ type: 'standard', description: '2003 film by X', thumbnail: { source: 'a' } })).toBeUndefined()
    expect(pickWikiImage({ type: 'no-extract', thumbnail: { source: 'a' } })).toBeUndefined()
  })
})

describe('emoji images', () => {
  const index = { computer: '1f4bb', bone: '1f9b4', baby: '1f476', box: '1f4e6' }
  it('maps words (and plurals) to Fluent 3D emoji', () => {
    expect(emojiImage('Computer', index)).toBe(EMOJI_CDN + '1f4bb.webp')
    expect(emojiImage('bones', index)).toBe(EMOJI_CDN + '1f9b4.webp')
    expect(emojiImage('babies', index)).toBe(EMOJI_CDN + '1f476.webp')
    expect(emojiImage('boxes', index)).toBe(EMOJI_CDN + '1f4e6.webp')
    expect(emojiImage('consequence', index)).toBeUndefined()
  })
  it('does not singularize words ending in ss', () => {
    expect(singularForms('glass')).toEqual(['glass'])
  })
})

describe('emoji index (generated)', () => {
  it('is kid-safe and finds modern pictures for everyday words', async () => {
    const index = (await import('../data/emoji-index.json')).default as Record<string, string>
    expect(index.computer).toBe('1f4bb')
    expect(index.body).toBeUndefined()
    expect(Object.values(index)).not.toContain('1f480') // đầu lâu
  })
})
