import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCached, IMAGE_VERSION, lookupCached, lookupWord, parseFreeDictionary, type LookupDeps } from './lookup'

const oxEntry = {
  headword: 'run',
  pos: ['verb'],
  phonUS: '/rʌn/',
  audioUS: 'https://ox/us/run.mp3',
  audioUK: 'https://ox/uk/run.mp3',
  definitions: ['to move using your legs'],
}

function deps(over: Partial<LookupDeps> = {}): LookupDeps {
  return {
    fetchOxford: vi.fn().mockResolvedValue({ entry: oxEntry, suggestions: [] }),
    fetchBackup: vi.fn().mockResolvedValue(null),
    translate: vi.fn(async (t: string) =>
      t === 'run'
        ? { main: 'chạy', byPos: [{ pos: 'verb', meanings: ['chạy'] }, { pos: 'noun', meanings: ['cuộc chạy'] }] }
        : { main: 'di chuyển bằng chân', byPos: [] },
    ),
    findImage: vi.fn().mockResolvedValue('https://img/run.jpg'),
    ...over,
  }
}

describe('lookupWord', () => {
  it('merges oxford data with vietnamese meanings and image', async () => {
    const info = await lookupWord('run', deps())
    expect(info).toMatchObject({
      headword: 'run',
      phonetic: '/rʌn/',
      audioUS: 'https://ox/us/run.mp3',
      meaningVi: 'chạy',
      definitionVi: 'di chuyển bằng chân',
      image: 'https://img/run.jpg',
      source: 'oxford',
    })
    expect(info.pos).toEqual([
      { en: 'verb', vi: 'Động từ', meanings: ['chạy'] },
      { en: 'noun', vi: 'Danh từ', meanings: ['cuộc chạy'] },
    ])
  })
  it('passes parts of speech to the image search', async () => {
    const d = deps()
    await lookupWord('run', d)
    expect(d.findImage).toHaveBeenCalledWith('run', ['verb', 'noun'])
  })
  it('uses the backup dictionary when oxford fails', async () => {
    const d = deps({
      fetchOxford: vi.fn().mockRejectedValue(new Error('cors')),
      fetchBackup: vi.fn().mockResolvedValue({ ...oxEntry, audioUS: 'https://free/run-us.mp3' }),
    })
    const info = await lookupWord('run', d)
    expect(info.source).toBe('backup')
    expect(info.audioUS).toBe('https://free/run-us.mp3')
  })
  it('still returns something when everything fails', async () => {
    const fail = vi.fn().mockRejectedValue(new Error('x'))
    const info = await lookupWord('zzz', { fetchOxford: fail, fetchBackup: fail, translate: fail, findImage: fail })
    expect(info).toMatchObject({ word: 'zzz', source: 'none', pos: [] })
  })
  it('prefers a searched picture, falling back to the oxford topic picture', async () => {
    const ox = vi.fn().mockResolvedValue({ entry: { ...oxEntry, image: 'https://ox/pic.png' }, suggestions: [] })
    expect((await lookupWord('run', deps({ fetchOxford: ox }))).image).toBe('https://img/run.jpg')
    const none = deps({ fetchOxford: ox, findImage: vi.fn().mockResolvedValue(undefined) })
    expect((await lookupWord('run', none)).image).toBe('https://ox/pic.png')
  })
})

describe('lookupCached', () => {
  beforeEach(() => localStorage.clear())
  it('caches results in localStorage', async () => {
    const d = deps()
    await lookupCached('run', d)
    await lookupCached('Run', d)
    expect(d.fetchOxford).toHaveBeenCalledTimes(1)
  })
})

describe('parseFreeDictionary', () => {
  it('picks US audio and parts of speech', () => {
    const e = parseFreeDictionary(
      [
        {
          word: 'run',
          phonetics: [{ text: '/ɹʌn/', audio: 'https://a/run-uk.mp3' }, { audio: 'https://a/run-us.mp3' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'Act of running.' }] },
            { partOfSpeech: 'verb', definitions: [{ definition: 'To move swiftly.' }] },
          ],
        },
      ],
      'run',
    )
    expect(e).toMatchObject({ pos: ['noun', 'verb'], audioUS: 'https://a/run-us.mp3', audioUK: 'https://a/run-uk.mp3' })
  })
})

describe('lookupCached when dictionaries are down', () => {
  beforeEach(() => localStorage.clear())
  it('does not cache results without dictionary data, so a later click retries', async () => {
    const fail = vi.fn().mockRejectedValue(new Error('x'))
    const d = deps({ fetchOxford: fail, fetchBackup: fail })
    await lookupCached('cat', d)
    await lookupCached('cat', d)
    expect(fail).toHaveBeenCalledTimes(4)
  })
})

describe('lookup fixes', () => {
  beforeEach(() => localStorage.clear())

  it('uses the exact plural audio when oxford switches to the base word', async () => {
    const d = deps({
      fetchOxford: vi.fn().mockResolvedValue({ entry: { ...oxEntry, headword: 'bean' }, suggestions: [] }),
      fetchBackup: vi.fn().mockResolvedValue({ headword: 'beans', pos: ['noun'], phonUS: '/biːnz/', audioUS: 'https://free/beans-au.mp3', definitions: [] }),
    })
    const info = await lookupWord('beans', d)
    expect(info).toMatchObject({
      source: 'oxford',
      headword: 'bean',
      audioExact: 'https://free/beans-au.mp3',
      audioUS: 'https://ox/us/run.mp3', // vẫn giữ tiếng Oxford làm dự phòng
      phonetic: '/biːnz/',
    })
  })

  it('keeps oxford audio for the base word when no exact audio exists', async () => {
    const d = deps({ fetchOxford: vi.fn().mockResolvedValue({ entry: { ...oxEntry, headword: 'bean' }, suggestions: [] }) })
    const info = await lookupWord('beans', d)
    expect(info.audioUS).toBe('https://ox/us/run.mp3')
    expect(info.audioExact).toBeUndefined()
  })

  it('returns oxford spelling suggestions for misspelled words', async () => {
    const d = deps({ fetchOxford: vi.fn().mockResolvedValue({ entry: null, suggestions: ['dishwasher', 'dishwashers'] }) })
    const info = await lookupWord('diswasher', d)
    expect(info).toMatchObject({ source: 'none', suggestions: ['dishwasher', 'dishwashers'] })
  })

  it('refreshes only the picture for cache entries from an older image version', async () => {
    const d = deps()
    const old = await lookupWord('run', d)
    localStorage.setItem('spelling-kids:lookup:v5:run', JSON.stringify({ ...old, image: 'old.png', imageVersion: IMAGE_VERSION - 1 }))
    expect(getCached('run')).toBeNull()
    const fetchOxford = vi.fn()
    const findImage = vi.fn().mockResolvedValue('new.png')
    const info = await lookupCached('run', deps({ fetchOxford, findImage }))
    expect(fetchOxford).not.toHaveBeenCalled()
    expect(info.image).toBe('new.png')
    expect(getCached('run')?.image).toBe('new.png')
  })
})
