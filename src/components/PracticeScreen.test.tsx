import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordInfo } from '../lib/lookup'

const lookup = vi.fn(async (w: string): Promise<WordInfo> => info(w))
vi.mock('../lib/lookup', async (importActual) => ({
  usAudioUrls: (await importActual<typeof import('../lib/lookup')>()).usAudioUrls,
  getCached: () => null,
  lookupCached: (w: string) => lookup(w),
}))
const play = vi.fn().mockResolvedValue('audio')
vi.mock('../lib/audio', () => ({
  unlockAudio: vi.fn(),
  playPronunciation: (...a: unknown[]) => play(...a),
}))
vi.mock('../lib/sfx', () => ({ playDing: vi.fn(), playBuzz: vi.fn(), playFanfare: vi.fn() }))

import { PracticeScreen } from './PracticeScreen'
import { loadSkipCounts, saveSkipCounts } from '../lib/storage'
import { playBuzz, playDing, playFanfare } from '../lib/sfx'
import { RIGHT_MS } from './useFeedback'

function info(word: string, extra: Partial<WordInfo> = {}): WordInfo {
  return { word, headword: word, pos: [], meaningVi: 'nghĩa ' + word, image: `https://img/${word}.jpg`, source: 'oxford', ...extra }
}

const current = () => play.mock.calls[play.mock.calls.length - 1][1] as string
const box = () => screen.getByLabelText('Bé viết từ vừa nghe') as HTMLInputElement
const type = (v: string) => fireEvent.change(box(), { target: { value: v } })
const done = () => fireEvent.click(screen.getByRole('button', { name: 'Xong ✓' }))
const settle = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function mount(
  words: string[],
  extra: { onExit?: () => void; infos?: Record<string, WordInfo>; onInfo?: () => void } = {},
) {
  await act(async () => {
    render(
      <PracticeScreen
        mode="write"
        words={words}
        infos={extra.infos ?? {}}
        onInfo={extra.onInfo ?? vi.fn()}
        onExit={extra.onExit ?? vi.fn()}
        random={() => 0}
      />,
    )
  })
}
async function answer() {
  type(current())
  done()
  await settle(RIGHT_MS)
}
async function skip() {
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua ⏭' }))
  await settle()
}

describe('PracticeScreen luyện viết', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.clearAllMocks()
    play.mockResolvedValue('audio')
    lookup.mockImplementation(async (w: string) => info(w))
  })
  afterEach(() => vi.useRealTimers())

  it('tự đọc mẫu khi thẻ hiện, không hiện chữ của từ', async () => {
    await mount(['cat', 'dog', 'bird'])
    expect(play).toHaveBeenCalledTimes(1)
    expect(['cat', 'dog', 'bird']).toContain(current())
    expect(screen.queryByText(current())).toBeNull()
    expect(screen.getByRole('heading', { name: 'Luyện viết' })).toBeInTheDocument()
  })

  it('gõ đúng (hoa thường, khoảng trắng) → ding, sang từ sau, tổ ong "Từ 2 trên 3"', async () => {
    await mount(['cat', 'dog', 'bird'])
    const first = current()
    type(' ' + first.toUpperCase() + ' ')
    done()
    expect(playDing).toHaveBeenCalledTimes(1)
    await settle(RIGHT_MS)
    expect(screen.getByRole('list', { name: 'Từ 2 trên 3' })).toBeInTheDocument()
    expect(current()).not.toBe(first)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('gõ sai → buzz, ô bị xóa trắng và còn focus, vẫn ở từ cũ', async () => {
    await mount(['cat', 'dog', 'bird'])
    type('xyz')
    done()
    expect(playBuzz).toHaveBeenCalledTimes(1)
    expect(box().value).toBe('')
    expect(box()).toHaveFocus()
    await settle(1000)
    expect(screen.getByRole('list', { name: 'Từ 1 trên 3' })).toBeInTheDocument()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('ô trống bấm Xong ✓ → không ding, không buzz', async () => {
    await mount(['cat', 'dog'])
    type('   ')
    done()
    expect(playDing).not.toHaveBeenCalled()
    expect(playBuzz).not.toHaveBeenCalled()
  })

  it('nút tẩy xóa chữ đã gõ; nút Nghe lại đọc lại từ', async () => {
    await mount(['cat', 'dog'])
    type('abc')
    fireEvent.click(screen.getByRole('button', { name: 'Xóa hết chữ' }))
    expect(box().value).toBe('')
    const w = current()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Nghe lại' }))
    })
    expect(play).toHaveBeenCalledTimes(2)
    expect(current()).toBe(w)
  })

  it('Bỏ qua ⏭ → sang từ sau và lưu số lần bỏ qua ngay', async () => {
    await mount(['cat', 'dog', 'bird'])
    const first = current()
    await skip()
    expect(loadSkipCounts('write')[first]).toBe(1)
    expect(screen.getByRole('list', { name: 'Từ 2 trên 3' })).toBeInTheDocument()
  })

  it('bấm Bỏ qua hai lần liền → chỉ sang một từ', async () => {
    await mount(['cat', 'dog', 'bird'])
    const b = screen.getByRole('button', { name: 'Bỏ qua ⏭' })
    fireEvent.click(b)
    fireEvent.click(b)
    await settle()
    expect(screen.getByRole('list', { name: 'Từ 2 trên 3' })).toBeInTheDocument()
  })

  it('làm đúng → số lần bỏ qua của từ đó về 0', async () => {
    saveSkipCounts('write', { cat: 2 })
    await mount(['cat'])
    await answer()
    expect(loadSkipCounts('write').cat).toBeUndefined()
  })

  it('bấm Enter hai lần liền khi gõ đúng → chỉ sang một từ', async () => {
    await mount(['cat', 'dog', 'bird'])
    type(current())
    fireEvent.submit(box().closest('form')!)
    fireEvent.submit(box().closest('form')!)
    await settle(RIGHT_MS)
    expect(screen.getByRole('list', { name: 'Từ 2 trên 3' })).toBeInTheDocument()
    expect(playDing).toHaveBeenCalledTimes(1)
  })

  it('gạt thẻ đang trượt rồi gõ đúng → chỉ onSkip, không ghi đúng', async () => {
    await mount(['cat', 'dog', 'bird'])
    const first = current()
    const card = document.querySelector('.practice-card') as HTMLElement
    Object.defineProperty(card, 'offsetWidth', { value: 300 })
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 250, clientY: 10 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 100, clientY: 10 })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 100, clientY: 10 })
    type(first)
    done()
    expect(playDing).not.toHaveBeenCalled()
    await settle(RIGHT_MS + 100)
    expect(loadSkipCounts('write')[first]).toBe(1)
    expect(screen.getByRole('list', { name: 'Từ 2 trên 3' })).toBeInTheDocument()
  })

  it('hết lượt: %, sao, danh sách từ bỏ qua', async () => {
    await mount(['cat', 'dog', 'bird'])
    await answer()
    await answer()
    const last = current()
    await skip()
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByLabelText('2 trên 3 sao')).toBeInTheDocument()
    expect(screen.getByText('Bé làm đúng 2 trên 3 từ')).toBeInTheDocument()
    expect(screen.getByText('Luyện lại nhé:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Luyện lại ${last}` })).toBeInTheDocument()
    expect(playFanfare).not.toHaveBeenCalled()
  })

  it('đúng hết: "100%", "Bé làm đúng hết rồi! 🐝", fanfare một lần', async () => {
    await mount(['cat', 'dog'])
    await answer()
    await answer()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Bé làm đúng hết rồi! 🐝')).toBeInTheDocument()
    expect(screen.getByLabelText('3 trên 3 sao')).toBeInTheDocument()
    await settle(1000)
    expect(playFanfare).toHaveBeenCalledTimes(1)
  })

  it('làm lại từ bỏ qua: gõ đúng → về kết quả, từ có ✅, % không đổi, số lần bỏ qua về 0', async () => {
    await mount(['cat', 'dog', 'bird'])
    await answer()
    await answer()
    const w = current()
    await skip()
    fireEvent.click(screen.getByRole('button', { name: `Luyện lại ${w}` }))
    await settle()
    expect(screen.queryByRole('list', { name: /Từ \d trên/ })).toBeNull()
    expect(current()).toBe(w)
    await answer()
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${w}, đã làm đúng` })).toBeInTheDocument()
    expect(loadSkipCounts('write')[w]).toBeUndefined()
  })

  it('làm lại rồi bỏ qua → về kết quả, từ chưa có ✅', async () => {
    await mount(['cat', 'dog'])
    await answer()
    const w = current()
    await skip()
    expect(loadSkipCounts('write')[w]).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: `Luyện lại ${w}` }))
    await settle()
    await skip()
    expect(screen.getByRole('button', { name: `Luyện lại ${w}` })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `${w}, đã làm đúng` })).toBeNull()
    expect(loadSkipCounts('write')[w]).toBe(1)
  })

  it('Luyện lượt mới bắt đầu lại từ đầu; Về danh sách và ← gọi onExit', async () => {
    const onExit = vi.fn()
    await mount(['cat', 'dog'], { onExit })
    await answer()
    await answer()
    fireEvent.click(screen.getByRole('button', { name: 'Luyện lượt mới' }))
    await settle()
    expect(screen.getByRole('list', { name: 'Từ 1 trên 2' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    await answer()
    await answer()
    fireEvent.click(screen.getByRole('button', { name: 'Về danh sách' }))
    expect(onExit).toHaveBeenCalledTimes(2)
  })

  it('không có tiếng: hiện "🔇 Chưa có tiếng đọc", hình và nghĩa, không hiện chữ tiếng Anh', async () => {
    play.mockResolvedValue('none')
    await mount(['cat'], { infos: { cat: info('cat') } })
    expect(screen.getByText('🔇 Chưa có tiếng đọc')).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://img/cat.jpg')
    expect(screen.getByText('nghĩa cat')).toBeInTheDocument()
    expect(screen.queryByText('cat')).toBeNull()
  })

  it('không có tiếng và tra lỗi: vẫn báo, vẫn bỏ qua được', async () => {
    play.mockResolvedValue('none')
    lookup.mockRejectedValue(new Error('mạng'))
    await mount(['cat', 'dog'])
    expect(screen.getByText('🔇 Chưa có tiếng đọc')).toBeInTheDocument()
    await skip()
    expect(screen.getByRole('list', { name: 'Từ 2 trên 2' })).toBeInTheDocument()
  })

  it('tra được từ mới khi phát mẫu → báo onInfo', async () => {
    const onInfo = vi.fn()
    await mount(['cat'], { onInfo })
    expect(onInfo).toHaveBeenCalledWith(expect.objectContaining({ word: 'cat' }))
    expect(play.mock.calls[0][0]).toEqual([undefined, undefined])
  })

  it('từ có đồng âm luôn hiện nghĩa; từ thường thì không', async () => {
    await mount(['two'], { infos: { two: info('two', { meaningVi: 'hai' }) } })
    expect(screen.getByText('hai')).toBeInTheDocument()
    expect(screen.queryByText('two')).toBeNull()
  })

  it('từ thường không hiện nghĩa khi có tiếng', async () => {
    await mount(['cat'], { infos: { cat: info('cat') } })
    expect(screen.queryByText('nghĩa cat')).toBeNull()
  })

  it('ô gõ tắt tự sửa', async () => {
    await mount(['cat'])
    expect(box()).toHaveAttribute('autocorrect', 'off')
    expect(box()).toHaveAttribute('autocapitalize', 'off')
    expect(box()).toHaveAttribute('spellcheck', 'false')
    expect(box()).toHaveFocus()
  })
})
