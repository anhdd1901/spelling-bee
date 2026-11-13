import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordInfo } from '../lib/lookup'
import type { ListenResult } from '../lib/speech'

const cachedMock = vi.fn((_w: string): WordInfo | null => null)
const lookup = vi.fn(async (w: string): Promise<WordInfo> => ({ ...info0(w) }))
function info0(w: string): WordInfo { return { word: w, headword: w, pos: [], meaningVi: '', source: 'oxford' } }
vi.mock('../lib/lookup', async (importActual) => ({
  ...(await importActual<typeof import('../lib/lookup')>()),
  getCached: (w: string) => cachedMock(w),
  lookupCached: (w: string) => lookup(w),
}))
vi.mock('../lib/audio', () => ({ unlockAudio: vi.fn(), playPronunciation: vi.fn(), stopPlayback: vi.fn() }))
vi.mock('../lib/sfx', () => ({ playDing: vi.fn(), playBuzz: vi.fn(), playFanfare: vi.fn(), primeSfx: vi.fn() }))

type Session = { resolve(r: ListenResult): void; stop: ReturnType<typeof vi.fn> }
const sessions: Session[] = []
const supported = vi.fn(() => true)
const listen = vi.fn(() => {
  let resolve!: (r: ListenResult) => void
  const result = new Promise<ListenResult>((res) => { resolve = res })
  const stop = vi.fn()
  sessions.push({ resolve, stop })
  return { result, stop }
})
vi.mock('../lib/speech', async (importActual) => ({
  ...(await importActual<typeof import('../lib/speech')>()),
  speechSupported: () => supported(),
  listenOnce: () => listen(),
}))

import { SpeakCard } from './SpeakCard'
import { PracticeScreen } from './PracticeScreen'
import { stopPlayback, unlockAudio } from '../lib/audio'
import { playBuzz, playDing, primeSfx } from '../lib/sfx'
import { RIGHT_MS } from './useFeedback'

const info: WordInfo = { word: 'bee', headword: 'bee', pos: [{ en: 'noun', vi: 'Danh từ', meanings: ['con ong'] }], meaningVi: 'con ong', image: 'https://img/bee.jpg', source: 'oxford' }

function setup(word = 'bee', playResult: 'audio' | 'none' = 'audio') {
  const props = {
    word,
    info,
    hasNext: true,
    onCorrect: vi.fn(),
    onSkip: vi.fn(),
    playModel: vi.fn().mockResolvedValue(playResult),
  }
  const utils = render(<SpeakCard {...props} />)
  return { props, ...utils }
}
const mic = () => screen.getByRole('button', { name: 'Bấm để nói' })
const press = async () => {
  await act(async () => { fireEvent.click(mic()) })
}
const hear = async (i: number, r: ListenResult) => {
  await act(async () => { sessions[i].resolve(r) })
}
const settle = async (ms: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('SpeakCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    sessions.length = 0
    supported.mockReturnValue(true)
  })
  afterEach(() => vi.useRealTimers())

  it('hiện chữ và hình của từ; chạm thẻ thì đọc mẫu', async () => {
    const { props, container } = setup()
    expect(screen.getByText('bee')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://img/bee.jpg')
    const card = screen.getByRole('button', { name: 'Nghe đọc mẫu bee' })
    await act(async () => {
      fireEvent.pointerDown(card, { pointerId: 1, clientX: 100, clientY: 10 })
      fireEvent.pointerUp(card, { pointerId: 1, clientX: 100, clientY: 10 })
    })
    expect(unlockAudio).toHaveBeenCalledTimes(1)
    expect(props.playModel).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.keyDown(card, { key: 'Enter' }) })
    expect(props.playModel).toHaveBeenCalledTimes(2)
  })

  it('chạm thẻ mà không có tiếng → "🔇 Chưa có tiếng đọc"', async () => {
    setup('bee', 'none')
    const card = screen.getByRole('button', { name: 'Nghe đọc mẫu bee' })
    await act(async () => { fireEvent.keyDown(card, { key: ' ' }) })
    expect(screen.getByText('🔇 Chưa có tiếng đọc')).toBeInTheDocument()
  })

  it('nói đúng → ding, gọi onCorrect sau khi trượt', async () => {
    const { props } = setup()
    await press()
    await hear(0, { kind: 'heard', alternatives: ['bee'] })
    expect(playDing).toHaveBeenCalledTimes(1)
    expect(props.onCorrect).not.toHaveBeenCalled()
    await settle(RIGHT_MS)
    expect(props.onCorrect).toHaveBeenCalledTimes(1)
  })

  it('nói từ đồng âm ("be" cho "bee") → đúng', async () => {
    const { props } = setup()
    await press()
    await hear(0, { kind: 'heard', alternatives: ['Be.'] })
    await settle(RIGHT_MS)
    expect(props.onCorrect).toHaveBeenCalledTimes(1)
  })

  it('nói sai → buzz, hiện "Máy nghe là: able", không gọi onCorrect; bấm 🎤 lần nữa thì dòng đó mất', async () => {
    const { props } = setup()
    await press()
    await hear(0, { kind: 'heard', alternatives: ['able', 'apple'] })
    expect(playBuzz).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Máy nghe là: able')).toBeInTheDocument()
    await settle(1000)
    expect(props.onCorrect).not.toHaveBeenCalled()
    await press()
    expect(screen.queryByText('Máy nghe là: able')).toBeNull()
    expect(sessions).toHaveLength(2)
  })

  it('silent → thông báo, không buzz', async () => {
    setup()
    await press()
    await hear(0, { kind: 'silent' })
    expect(screen.getByText('Chưa nghe thấy, bé bấm 🎤 nói lại nhé')).toBeInTheDocument()
    expect(playBuzz).not.toHaveBeenCalled()
    expect(mic()).toHaveAttribute('aria-pressed', 'false')
  })

  it('denied → thông báo, không buzz', async () => {
    setup()
    await press()
    await hear(0, { kind: 'denied' })
    expect(screen.getByText('Bé cần cho phép dùng micro')).toBeInTheDocument()
    expect(playBuzz).not.toHaveBeenCalled()
  })

  it('error → thông báo, không buzz, không gọi onCorrect', async () => {
    const { props } = setup()
    await press()
    await hear(0, { kind: 'error' })
    expect(screen.getByText('Máy chưa nghe được, bé thử lại nhé')).toBeInTheDocument()
    expect(playBuzz).not.toHaveBeenCalled()
    await settle(1000)
    expect(props.onCorrect).not.toHaveBeenCalled()
  })

  it('đang nghe: nút aria-pressed, nhãn "Bé nói đi…"; bấm 🎤 lần nữa không mở phiên thứ hai', async () => {
    setup()
    expect(mic()).toHaveAttribute('aria-pressed', 'false')
    await press()
    expect(mic()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Bé nói đi…')).toBeInTheDocument()
    await press()
    await press()
    expect(listen).toHaveBeenCalledTimes(1)
  })

  it('bấm 🎤: dừng tiếng mẫu và mở khóa sfx, đều trước listenOnce', async () => {
    const order: string[] = []
    vi.mocked(stopPlayback).mockImplementation(() => { order.push('stop') })
    vi.mocked(primeSfx).mockImplementation(() => { order.push('prime') })
    listen.mockImplementationOnce(() => {
      order.push('listen')
      return { result: new Promise<ListenResult>(() => {}), stop: vi.fn() }
    })
    setup()
    await press()
    expect(order).toEqual(['stop', 'prime', 'listen'])
  })

  it('chạm thẻ hoặc Enter khi đang nghe không phát mẫu', async () => {
    const { props } = setup()
    await press()
    const card = screen.getByRole('button', { name: 'Nghe đọc mẫu bee' })
    await act(async () => {
      fireEvent.pointerDown(card, { pointerId: 1, clientX: 100, clientY: 10 })
      fireEvent.pointerUp(card, { pointerId: 1, clientX: 100, clientY: 10 })
      fireEvent.keyDown(card, { key: 'Enter' })
    })
    expect(props.playModel).not.toHaveBeenCalled()
  })

  it('Enter sau khi đã đúng không phát mẫu', async () => {
    const { props } = setup()
    await press()
    await hear(0, { kind: 'heard', alternatives: ['bee'] })
    await act(async () => { fireEvent.keyDown(screen.getByRole('button', { name: 'Nghe đọc mẫu bee' }), { key: 'Enter' }) })
    expect(props.playModel).not.toHaveBeenCalled()
  })

  it('đang đọc mẫu (chưa xong) bấm 🎤 vẫn nghe được', async () => {
    const { props } = setup()
    props.playModel.mockReturnValue(new Promise(() => {}))
    const card = screen.getByRole('button', { name: 'Nghe đọc mẫu bee' })
    await act(async () => { fireEvent.keyDown(card, { key: 'Enter' }) })
    await press()
    expect(stopPlayback).toHaveBeenCalled()
    expect(listen).toHaveBeenCalledTimes(1)
  })

  it('đọc mẫu truyền canPlay: false khi đang nghe', async () => {
    const { props } = setup()
    const card = screen.getByRole('button', { name: 'Nghe đọc mẫu bee' })
    await act(async () => { fireEvent.keyDown(card, { key: 'Enter' }) })
    const canPlay = props.playModel.mock.calls[0][0] as () => boolean
    expect(canPlay()).toBe(true)
    await press()
    expect(canPlay()).toBe(false)
  })

  it('kích hoạt bằng trình đọc màn hình (click detail 0) thì đọc mẫu', async () => {
    const { props } = setup()
    const card = screen.getByRole('button', { name: 'Nghe đọc mẫu bee' })
    await act(async () => { fireEvent.click(card, { detail: 0 }) })
    expect(props.playModel).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.click(card, { detail: 1 }) })
    expect(props.playModel).toHaveBeenCalledTimes(1)
  })

  it('unmount khi đang nghe → gọi stop(); kết quả đến sau không gọi onCorrect, không phát tiếng', async () => {
    const { props, unmount } = setup()
    await press()
    unmount()
    expect(sessions[0].stop).toHaveBeenCalledTimes(1)
    await hear(0, { kind: 'heard', alternatives: ['bee'] })
    await settle(1000)
    expect(props.onCorrect).not.toHaveBeenCalled()
    expect(playDing).not.toHaveBeenCalled()
    expect(playBuzz).not.toHaveBeenCalled()
  })

  it('đang trượt đi (Bỏ qua) rồi nhận kết quả đúng → stop(), không gọi onCorrect', async () => {
    const { props } = setup()
    await press()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua ⏭' })) })
    expect(sessions[0].stop).toHaveBeenCalled()
    await hear(0, { kind: 'heard', alternatives: ['bee'] })
    await settle(1000)
    expect(props.onCorrect).not.toHaveBeenCalled()
    expect(playDing).not.toHaveBeenCalled()
    expect(props.onSkip).toHaveBeenCalledTimes(1)
  })

  it('không hỗ trợ: không có nút 🎤, có thông báo, Bỏ qua ⏭ vẫn gọi onSkip', async () => {
    supported.mockReturnValue(false)
    const { props } = setup()
    expect(screen.queryByRole('button', { name: 'Bấm để nói' })).toBeNull()
    expect(screen.getByText('Máy này chưa nghe được bé nói — hãy mở bằng Chrome hoặc Safari')).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua ⏭' })) })
    await settle(400)
    expect(props.onSkip).toHaveBeenCalledTimes(1)
  })

  it('PracticeScreen mode="speak" render SpeakCard, tiêu đề "Luyện nói"', async () => {
    await act(async () => {
      render(
        <PracticeScreen mode="speak" words={['bee']} infos={{ bee: info }} onInfo={vi.fn()} onExit={vi.fn()} random={() => 0} />,
      )
    })
    expect(screen.getByRole('heading', { name: 'Luyện nói' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nghe đọc mẫu bee' })).toBeInTheDocument()
    expect(mic()).toBeInTheDocument()
  })

  it('tra từ xong khi bé đã bấm 🎤 → không phát mẫu; unmount thì dừng tiếng', async () => {
    const { playPronunciation } = await import('../lib/audio')
    let release!: (i: WordInfo) => void
    lookup.mockImplementationOnce(() => new Promise<WordInfo>((r) => { release = r }))
    cachedMock.mockReturnValue(null)
    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(
        <PracticeScreen mode="speak" words={['bee']} infos={{}} onInfo={vi.fn()} onExit={vi.fn()} random={() => 0} />,
      )
    })
    const card = screen.getByRole('button', { name: 'Nghe đọc mẫu bee' })
    await act(async () => { fireEvent.keyDown(card, { key: 'Enter' }) })
    await press()
    await act(async () => { release(info) })
    expect(playPronunciation).not.toHaveBeenCalled()
    vi.mocked(stopPlayback).mockClear()
    view.unmount()
    expect(stopPlayback).toHaveBeenCalled()
  })

  it('bàn phím ảo (visualViewport thấp) thêm lớp kb-open, gỡ listener khi unmount', async () => {
    const vv = Object.assign(new EventTarget(), { height: 800 })
    const orig = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv })
    const remove = vi.spyOn(vv, 'removeEventListener')
    try {
      let view!: ReturnType<typeof render>
      await act(async () => {
        view = render(
          <PracticeScreen mode="speak" words={['bee']} infos={{ bee: info }} onInfo={vi.fn()} onExit={vi.fn()} random={() => 0} />,
        )
      })
      const main = () => view.container.querySelector('main')!
      expect(main()).not.toHaveClass('kb-open')
      vv.height = 300
      await act(async () => { vv.dispatchEvent(new Event('resize')) })
      expect(main()).toHaveClass('kb-open')
      vv.height = 800
      await act(async () => { vv.dispatchEvent(new Event('resize')) })
      expect(main()).not.toHaveClass('kb-open')
      view.unmount()
      expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    } finally {
      if (orig) Object.defineProperty(window, 'visualViewport', orig)
      else delete (window as unknown as Record<string, unknown>).visualViewport
    }
  })
})
