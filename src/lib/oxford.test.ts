import { describe, expect, it } from 'vitest'
import { parseOxfordHtml, parseOxfordSuggestions } from './oxford'

const SAMPLE = `<html><body><div class="top-container"><div class="top-g">
<h1 class="headword">apple</h1><span class="pos">noun</span>
<span class="phonetics"><div class="phons_br"><div class="sound pron-uk" data-src-mp3="https://x/uk/apple__gb_5.mp3"></div><span class="phon">/ˈæpl/</span></div>
<div class="phons_n_am"><div class="sound pron-us" data-src-mp3="https://x/us/apple__us_1.mp3"></div><span class="phon">/ˈæpəl/</span></div></span>
</div></div>
<ol><li class="sense"><div id="ox-enlarge"><a class="topic" href="https://x/fullsize/fruit.png"><img class="thumb" src="https://x/thumb/fruit.png"></a></div>
<span class="def">a round fruit with shiny red or green skin</span></li>
<li class="sense"><span class="def">a second   meaning</span></li></ol></body></html>`

describe('parseOxfordHtml', () => {
  it('extracts headword, pos, phonetics, audio, defs and image', () => {
    expect(parseOxfordHtml(SAMPLE)).toEqual({
      headword: 'apple',
      pos: ['noun'],
      phonUK: '/ˈæpl/',
      phonUS: '/ˈæpəl/',
      audioUK: 'https://x/uk/apple__gb_5.mp3',
      audioUS: 'https://x/us/apple__us_1.mp3',
      definitions: ['a round fruit with shiny red or green skin', 'a second meaning'],
      image: 'https://x/fullsize/fruit.png',
    })
  })
  it('returns null for the spellcheck / not found page', () => {
    expect(parseOxfordHtml('<h1>No exact match found for “qwzzx”</h1>')).toBeNull()
  })
})

import { oxfordBodyCheck } from './oxford'
describe('oxfordBodyCheck', () => {
  it('stops early once three definitions have streamed in', () => {
    const head = '<link href="https://www.oxfordlearnersdictionaries.com/x"><h1 class="headword">a</h1>'
    expect(oxfordBodyCheck(head + '<span class="def">x</span>', false)).toBe('more')
    expect(oxfordBodyCheck(head + '<span class="def">x</span>'.repeat(3), false)).toBe('done')
  })
  it('rejects non-oxford pages', () => {
    expect(oxfordBodyCheck('proxy error', true)).toBe('bad')
    expect(oxfordBodyCheck('x'.repeat(5000), false)).toBe('bad')
  })
})

describe('parseOxfordSuggestions', () => {
  it('reads "Did you mean" suggestions', () => {
    const html = `<h1>No exact match found for “diswasher” in English</h1><div class="didyoumean">Did you mean:</div>
      <ul class="result-list"><li><a href=https://x/?q=dishwasher class="dym-link">dishwasher</a></li>
      <li><a href=https://x/?q=dishwashers class="dym-link">dishwashers</a></li>
      <li><a class="dym-link">dispatcher</a></li><li><a class="dym-link">fourth</a></li></ul>`
    expect(parseOxfordSuggestions(html)).toEqual(['dishwasher', 'dishwashers', 'dispatcher'])
    expect(oxfordBodyCheck(html, false)).toBe('done')
  })
})
