import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const catInfo = (word: string) => ({
    word,
    headword: word,
    phonetic: '/kæt/',
    audioUS: 'https://ox/us/cat.mp3',
    pos: [{ en: 'noun', vi: 'Danh từ', meanings: ['con mèo'] }],
    meaningVi: 'con mèo',
    definitionVi: 'một con vật nhỏ',
    definitionEn: 'a small animal',
    image: 'https://img/cat.jpg',
    source: 'oxford',
  })
const lookup = vi.fn(async (word: string) => catInfo(word))
vi.mock('./lib/lookup', () => ({
  getCached: () => null,
  lookupCached: (w: string) => lookup(w),
}))
const play = vi.fn().mockResolvedValue('audio')
vi.mock('./lib/audio', () => ({
  unlockAudio: vi.fn(),
  playPronunciation: (...a: unknown[]) => play(...a),
}))

import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    lookup.mockReset().mockImplementation(async (word: string) => catInfo(word))
    play.mockClear()
  })

  it('adds several typed words, deletes one, and has no edit button', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat, dog bird{Enter}')
    const list = screen.getByRole('list', { name: '' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /Sửa từ/ })).not.toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Xóa từ bird' }))
    await u.click(screen.getByRole('button', { name: 'Xóa' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)

    // vẫn thêm được từ mới sau đó, và từ trùng bị bỏ qua
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'fish cat{Enter}')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(JSON.parse(localStorage.getItem('spelling-kids:words:v1')!).map((w: { text: string }) => w.text)).toEqual([
      'cat',
      'dog',
      'fish',
    ])
  })

  it('filters the word list with the search box', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat dog cow{Enter}')
    await u.type(screen.getByRole('searchbox'), 'C')
    expect(screen.getByRole('button', { name: 'Nghe và xem từ cat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nghe và xem từ cow' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nghe và xem từ dog' })).not.toBeInTheDocument()
    await u.type(screen.getByRole('searchbox'), 'zz')
    expect(screen.getByText(/Không thấy từ nào/)).toBeInTheDocument()
  })

  it('clicking a word plays the Oxford audio and shows details', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat{Enter}')
    await u.click(screen.getByRole('button', { name: 'Nghe và xem từ cat' }))
    const detail = await screen.findByRole('region', { name: 'Chi tiết từ cat' })
    expect(await within(detail).findByText('con mèo')).toHaveClass('meaning-text')
    expect(within(detail).getByText('Danh từ')).toHaveClass('pos-tag')
    expect(within(detail).queryByText('Nghĩa là')).not.toBeInTheDocument()
    expect(within(detail).getByAltText('Hình minh họa cho cat')).toHaveAttribute('src', 'https://img/cat.jpg')
    expect(play).toHaveBeenCalledWith([undefined, 'https://ox/us/cat.mp3'], 'cat')
    // khối chi tiết thay chỗ ô thêm từ, không phải popup
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Từ tiếng Anh')).not.toBeInTheDocument()
    await u.click(within(detail).getByRole('button', { name: /Đóng/ }))
    expect(screen.getByLabelText('Từ tiếng Anh')).toBeInTheDocument()
  })

  it('rejects non-English input with a friendly message', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), '123{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('a–z')
  })

  it('looks the word up again on click when the background lookup failed', async () => {
    const failed = { word: 'cat', headword: 'cat', pos: [], source: 'none' }
    lookup.mockResolvedValueOnce(failed as never)
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat{Enter}')
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledTimes(1))
    await u.click(screen.getByRole('button', { name: 'Nghe và xem từ cat' }))
    await vi.waitFor(() => expect(play).toHaveBeenCalledWith([undefined, 'https://ox/us/cat.mp3'], 'cat'))
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it('says when there is no sound, and fixes spelling from a suggestion', async () => {
    lookup.mockImplementation(async (word: string) =>
      word === 'diswasher'
        ? ({ word, headword: word, pos: [], meaningVi: 'máy rửa bát', source: 'none', suggestions: ['dishwasher', 'dishwashers'] } as never)
        : catInfo(word),
    )
    play.mockResolvedValueOnce('none')
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'diswasher{Enter}')
    await u.click(screen.getByRole('button', { name: 'Nghe và xem từ diswasher' }))
    const detail = await screen.findByRole('region', { name: 'Chi tiết từ diswasher' })
    expect(await within(detail).findByText(/Chưa có tiếng đọc/)).toBeInTheDocument()
    await u.click(within(detail).getByRole('button', { name: /dishwasher$/ }))
    expect(await screen.findByRole('region', { name: 'Chi tiết từ dishwasher' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nghe và xem từ diswasher' })).not.toBeInTheDocument()
    expect(play).toHaveBeenLastCalledWith([undefined, 'https://ox/us/cat.mp3'], 'dishwasher')
    expect(JSON.parse(localStorage.getItem('spelling-kids:words:v1')!)[0].text).toBe('dishwasher')
  })
})
