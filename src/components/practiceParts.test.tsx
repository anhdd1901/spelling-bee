import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Honeycomb } from './Honeycomb'
import { SwipeCard } from './SwipeCard'
import { RIGHT_MS, WRONG_MS, useFeedback } from './useFeedback'
import { playBuzz, playDing } from '../lib/sfx'

vi.mock('../lib/sfx', () => ({ playDing: vi.fn(), playBuzz: vi.fn(), playFanfare: vi.fn() }))

describe('Honeycomb', () => {
  it('nhãn và trạng thái từng ô', () => {
    render(<Honeycomb total={4} outcomes={['correct', 'skipped']} />)
    expect(screen.getByRole('list', { name: 'Từ 3 trên 4' })).toBeInTheDocument()
    const cells = screen.getAllByRole('listitem')
    expect(cells.map((c) => c.className)).toEqual(['cell correct', 'cell skipped', 'cell current', 'cell'])
  })

  it('hết lượt: nhãn "Từ 4 trên 4", không ô nào current', () => {
    render(<Honeycomb total={4} outcomes={['correct', 'skipped', 'correct', 'correct']} />)
    expect(screen.getByRole('list', { name: 'Từ 4 trên 4' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').some((c) => c.classList.contains('current'))).toBe(false)
  })
})

describe('useFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('right() phát ding và gọi onCorrect đúng một lần sau RIGHT_MS, kể cả khi gọi hai lần', () => {
    const onCorrect = vi.fn()
    const { result } = renderHook(() => useFeedback(onCorrect))
    act(() => { result.current.right() })
    act(() => { result.current.right() })
    expect(result.current.feedback).toBe('right')
    expect(playDing).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(RIGHT_MS - 1) })
    expect(onCorrect).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onCorrect).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onCorrect).toHaveBeenCalledTimes(1)
  })

  it('đang right thì wrong() không làm gì', () => {
    const { result } = renderHook(() => useFeedback(vi.fn()))
    act(() => { result.current.right() })
    act(() => { result.current.wrong() })
    expect(playBuzz).not.toHaveBeenCalled()
    expect(result.current.feedback).toBe('right')
  })

  it('wrong() phát buzz, feedback về null sau WRONG_MS, không gọi onCorrect', () => {
    const onCorrect = vi.fn()
    const { result } = renderHook(() => useFeedback(onCorrect))
    act(() => { result.current.wrong() })
    expect(playBuzz).toHaveBeenCalledTimes(1)
    expect(result.current.feedback).toBe('wrong')
    act(() => { vi.advanceTimersByTime(WRONG_MS) })
    expect(result.current.feedback).toBeNull()
    expect(onCorrect).not.toHaveBeenCalled()
  })

  it('unmount trước RIGHT_MS thì không gọi onCorrect', () => {
    const onCorrect = vi.fn()
    const { result, unmount } = renderHook(() => useFeedback(onCorrect))
    act(() => { result.current.right() })
    unmount()
    act(() => { vi.advanceTimersByTime(RIGHT_MS * 2) })
    expect(onCorrect).not.toHaveBeenCalled()
  })
})

describe('SwipeCard', () => {
  it('class theo feedback và hasNext', () => {
    const { rerender, container } = render(
      <SwipeCard feedback={null} hasNext={false} onSkip={vi.fn()}>x</SwipeCard>,
    )
    expect(container.querySelector('.next-peek')).toBeNull()
    const card = () => container.querySelector('.practice-card') as HTMLElement
    expect(card()).not.toHaveClass('right')
    expect(card()).not.toHaveClass('wrong')
    rerender(<SwipeCard feedback="right" hasNext onSkip={vi.fn()}>x</SwipeCard>)
    expect(card()).toHaveClass('right')
    expect(container.querySelector('.next-peek')).not.toBeNull()
    rerender(<SwipeCard feedback="wrong" hasNext onSkip={vi.fn()}>x</SwipeCard>)
    expect(card()).toHaveClass('wrong')
  })

  describe('kéo', () => {
    function setup(onTap?: () => void) {
      vi.useFakeTimers()
      const onSkip = vi.fn()
      const { container } = render(
        <SwipeCard feedback={null} hasNext onSkip={onSkip} onTap={onTap}>
          <span>mặt</span>
          <input aria-label="o" />
        </SwipeCard>,
      )
      const card = container.querySelector('.practice-card') as HTMLElement
      Object.defineProperty(card, 'offsetWidth', { value: 300, configurable: true })
      card.setPointerCapture = vi.fn()
      return { card, onSkip }
    }
    afterEach(() => vi.useRealTimers())

    it('kéo qua 1/3 chiều rộng thì leaving rồi onSkip sau 0,35s', () => {
      const { card, onSkip } = setup()
      fireEvent.pointerDown(card, { clientX: 250, clientY: 0, pointerId: 1 })
      fireEvent.pointerMove(card, { clientX: 100, clientY: 0, pointerId: 1 })
      fireEvent.pointerUp(card, { clientX: 100, clientY: 0, pointerId: 1 })
      expect(card).toHaveClass('leaving')
      expect(onSkip).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(350) })
      expect(onSkip).toHaveBeenCalledTimes(1)
    })

    it('trượt đi từ chỗ thả tay (--dx) và chỉ một kết quả: onSkip một lần, onCorrect không bao giờ', () => {
      const onSkip = vi.fn()
      const onCorrect = vi.fn()
      let api!: ReturnType<typeof useFeedback>
      function Harness() {
        api = useFeedback(onCorrect)
        return (
          <SwipeCard feedback={api.feedback} hasNext onSkip={onSkip} onLeave={api.lock}>
            x
          </SwipeCard>
        )
      }
      vi.useFakeTimers()
      const { container } = render(<Harness />)
      const card = container.querySelector('.practice-card') as HTMLElement
      Object.defineProperty(card, 'offsetWidth', { value: 300, configurable: true })
      card.setPointerCapture = vi.fn()
      fireEvent.pointerDown(card, { clientX: 250, clientY: 0, pointerId: 1 })
      fireEvent.pointerMove(card, { clientX: 100, clientY: 0, pointerId: 1 })
      fireEvent.pointerUp(card, { clientX: 100, clientY: 0, pointerId: 1 })
      expect(card).toHaveClass('leaving')
      expect(card.style.getPropertyValue('--dx')).toBe('-150px')
      act(() => { api.right() })
      expect(card).not.toHaveClass('right')
      act(() => { vi.advanceTimersByTime(5000) })
      expect(onSkip).toHaveBeenCalledTimes(1)
      expect(onCorrect).not.toHaveBeenCalled()
    })

    it('kéo ngắn thì quay về, không skip', () => {
      const { card, onSkip } = setup()
      fireEvent.pointerDown(card, { clientX: 250, clientY: 0, pointerId: 1 })
      act(() => { vi.advanceTimersByTime(500) })
      fireEvent.pointerMove(card, { clientX: 220, clientY: 0, pointerId: 1 })
      fireEvent.pointerUp(card, { clientX: 220, clientY: 0, pointerId: 1 })
      expect(card).not.toHaveClass('leaving')
      act(() => { vi.advanceTimersByTime(1000) })
      expect(onSkip).not.toHaveBeenCalled()
    })

    it('chạm (<10px) gọi onTap', () => {
      const onTap = vi.fn()
      const { card } = setup(onTap)
      fireEvent.pointerDown(card, { clientX: 100, clientY: 0, pointerId: 1 })
      fireEvent.pointerUp(card, { clientX: 103, clientY: 0, pointerId: 1 })
      expect(onTap).toHaveBeenCalledTimes(1)
    })

    it('bắt đầu kéo trên input thì bỏ qua', () => {
      const { card, onSkip } = setup()
      const input = screen.getByLabelText('o')
      fireEvent.pointerDown(input, { clientX: 250, clientY: 0, pointerId: 1 })
      fireEvent.pointerMove(card, { clientX: 0, clientY: 0, pointerId: 1 })
      fireEvent.pointerUp(card, { clientX: 0, clientY: 0, pointerId: 1 })
      expect(card).not.toHaveClass('leaving')
      act(() => { vi.advanceTimersByTime(1000) })
      expect(onSkip).not.toHaveBeenCalled()
    })
  })
})
