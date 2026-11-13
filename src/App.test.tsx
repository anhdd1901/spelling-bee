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
vi.mock('./lib/lookup', async (importActual) => ({
  usAudioUrls: (await importActual<typeof import('./lib/lookup')>()).usAudioUrls,
  getCached: () => null,
  lookupCached: (w: string) => lookup(w),
}))
const play = vi.fn().mockResolvedValue('audio')
vi.mock('./lib/audio', () => ({
  unlockAudio: vi.fn(),
  playPronunciation: (...a: unknown[]) => play(...a),
  stopPlayback: vi.fn(),
}))

vi.mock('./lib/sfx', () => ({
  primeSfx: vi.fn(),
  playDing: vi.fn(),
  playBuzz: vi.fn(),
  playFanfare: vi.fn(),
}))
vi.mock('./lib/speech', async (importActual) => ({
  ...(await importActual<typeof import('./lib/speech')>()),
  speechSupported: () => false,
}))

import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    lookup.mockReset().mockImplementation(async (word: string) => catInfo(word))
    play.mockClear()
  })

  it('adds several typed words, deletes one without asking, and has no edit button', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat, dog bird{Enter}')
    const list = screen.getByRole('list', { name: '' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /Sửa từ/ })).not.toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Xóa từ bird' }))
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

  it('deletes several selected words with the bulk delete mode', async () => {
    const u = userEvent.setup()
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Xóa nhiều' })).not.toBeInTheDocument()
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat dog bird fish{Enter}')
    await u.click(screen.getByRole('button', { name: 'Xóa nhiều' }))

    // trong chế độ chọn: không còn nút xóa từng từ, chạm thẻ là chọn chứ không phát âm
    expect(screen.queryByRole('button', { name: /^Xóa từ/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa (0)' })).toBeDisabled()
    await u.click(screen.getByRole('button', { name: 'Chọn từ cat' }))
    await u.click(screen.getByRole('button', { name: 'Chọn từ bird' }))
    await u.click(screen.getByRole('button', { name: 'Chọn từ dog' }))
    await u.click(screen.getByRole('button', { name: 'Chọn từ dog' })) // bỏ chọn
    expect(screen.getByRole('button', { name: 'Chọn từ cat' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Chọn từ dog' })).toHaveAttribute('aria-pressed', 'false')
    expect(play).not.toHaveBeenCalled()

    await u.click(screen.getByRole('button', { name: 'Xóa (2)' }))
    expect(screen.getByText('🗑️ Đã xóa 2 từ')).toHaveClass('toast')
    expect(JSON.parse(localStorage.getItem('spelling-kids:words:v1')!).map((w: { text: string }) => w.text)).toEqual([
      'dog',
      'fish',
    ])
    // tự thoát chế độ chọn
    expect(screen.getByRole('button', { name: 'Xóa từ dog' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa nhiều' })).toBeInTheDocument()
  })

  it('select-all picks only the filtered words, and Xong leaves without deleting', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat dog cow{Enter}')
    await u.click(screen.getByRole('button', { name: 'Xóa nhiều' }))
    await u.click(screen.getByRole('button', { name: 'Chọn hết' }))
    expect(screen.getByRole('button', { name: 'Xóa (3)' })).toBeEnabled()
    await u.click(screen.getByRole('button', { name: 'Xong' }))
    expect(screen.getAllByRole('button', { name: /^Xóa từ/ })).toHaveLength(3)

    await u.type(screen.getByRole('searchbox'), 'c')
    await u.click(screen.getByRole('button', { name: 'Xóa nhiều' }))
    expect(screen.getByRole('button', { name: 'Xóa (0)' })).toBeDisabled() // thoát là bỏ chọn
    await u.click(screen.getByRole('button', { name: 'Chọn hết' }))
    await u.click(screen.getByRole('button', { name: 'Xóa (2)' }))
    expect(JSON.parse(localStorage.getItem('spelling-kids:words:v1')!).map((w: { text: string }) => w.text)).toEqual([
      'dog',
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
  it('practice buttons are disabled when the list is empty', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: '🎤 Luyện nói' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '✏️ Luyện viết' })).toBeDisabled()
  })

  it('writing practice replaces the list, and back returns with the words intact', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat dog{Enter}')
    await u.click(screen.getByRole('button', { name: '✏️ Luyện viết' }))
    expect(await screen.findByLabelText('Bé viết từ vừa nghe')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Danh sách từ' })).not.toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Quay lại danh sách' }))
    expect(screen.getByRole('button', { name: 'Xóa từ cat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa từ dog' })).toBeInTheDocument()
  })

  it('speaking practice shows its title', async () => {
    const u = userEvent.setup()
    render(<App />)
    await u.type(screen.getByLabelText('Từ tiếng Anh'), 'cat dog{Enter}')
    await u.click(screen.getByRole('button', { name: '🎤 Luyện nói' }))
    expect(await screen.findByRole('heading', { name: 'Luyện nói' })).toBeInTheDocument()
  })

  it('deleting a word also prunes its skip counts in both modes', async () => {
    localStorage.setItem('spelling-kids:skips:write:v1', JSON.stringify({ cat: 2, dog: 1 }))
    localStorage.setItem('spelling-kids:skips:speak:v1', JSON.stringify({ cat: 3 }))
    localStorage.setItem(
      'spelling-kids:words:v1',
      JSON.stringify([
        { id: 'a', text: 'cat' },
        { id: 'b', text: 'dog' },
      ]),
    )
    const u = userEvent.setup()
    render(<App />)
    await u.click(screen.getByRole('button', { name: 'Xóa từ cat' }))
    expect(JSON.parse(localStorage.getItem('spelling-kids:skips:write:v1')!)).toEqual({ dog: 1 })
    expect(JSON.parse(localStorage.getItem('spelling-kids:skips:speak:v1')!)).toEqual({})
  })
})
