import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { swipeDecision } from '../lib/practice'
import type { Feedback } from './useFeedback'

const LEAVE_MS = 350
const TAP_PX = 10

type Drag = { id: number; startX: number; startY: number; moved: boolean; samples: { x: number; t: number }[] }

/** Dùng một lần cho mỗi từ: cha remount bằng `key` mới cho từ kế tiếp. */
export function SwipeCard({
  feedback,
  hasNext,
  onSkip,
  onLeave,
  onTap,
  skipSignal = 0,
  className,
  style,
  children,
}: {
  feedback: Feedback
  hasNext: boolean
  onSkip(): void
  /** Gọi ngay khi thẻ bắt đầu trượt đi (bỏ qua); cha nối với `lock` của useFeedback. */
  onLeave?(): void
  onTap?(): void
  /** Tăng số này để một nút bấm bắt đầu đúng chuỗi trượt đi như khi gạt (onLeave, rồi onSkip sau LEAVE_MS). */
  skipSignal?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveDx, setLeaveDx] = useState(0)
  const drag = useRef<Drag | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const skipRef = useRef(onSkip)
  useEffect(() => {
    skipRef.current = onSkip
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  function startLeave(delta: number) {
    if (timer.current) return
    setLeaving(true)
    setLeaveDx(delta)
    onLeave?.()
    timer.current = setTimeout(() => skipRef.current(), LEAVE_MS)
  }

  const lastSignal = useRef(skipSignal)
  useEffect(() => {
    if (skipSignal === lastSignal.current) return
    lastSignal.current = skipSignal
    startLeave(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipSignal])

  function down(e: PointerEvent<HTMLDivElement>) {
    if (leaving || feedback === 'right') return
    if ((e.target as HTMLElement).closest('input, button')) return
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] }
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* bỏ qua */ }
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const delta = e.clientX - d.startX
    if (Math.abs(delta) >= TAP_PX || Math.abs(e.clientY - d.startY) >= TAP_PX) d.moved = true
    d.samples.push({ x: e.clientX, t: e.timeStamp })
    if (d.samples.length > 20) d.samples.shift()
    if (d.moved) {
      setDragging(true)
      setDx(Math.min(0, delta))
    }
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    setDragging(false)
    const delta = Math.min(0, e.clientX - d.startX)
    const movedFar = Math.abs(e.clientX - d.startX) >= TAP_PX || Math.abs(e.clientY - d.startY) >= TAP_PX
    if (!d.moved && !movedFar) {
      setDx(0)
      onTap?.()
      return
    }
    const now = e.timeStamp
    const recent = d.samples.filter((s) => now - s.t <= 100)
    const first = recent[0]
    const velocity = first && now > first.t ? (e.clientX - first.x) / (now - first.t) : 0
    const width = e.currentTarget.offsetWidth || e.currentTarget.getBoundingClientRect().width
    if (swipeDecision(delta, width, velocity) === 'skip') {
      startLeave(delta)
    } else {
      setDx(0)
    }
  }

  function cancel(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    setDragging(false)
    setDx(0)
  }

  const cls = [
    'practice-card',
    className,
    feedback === 'right' && !leaving && 'right',
    feedback === 'wrong' && !leaving && 'wrong',
    leaving && 'leaving',
    dragging && 'dragging',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="card-stack">
      {hasNext && <div className="next-peek" aria-hidden="true" />}
      <div
        className={cls}
        style={{
          ...style,
          ...(leaving
            ? ({ '--dx': `${leaveDx}px` } as CSSProperties)
            : dx !== 0
              ? { transform: `translateX(${dx}px)` }
              : null),
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
      >
        {children}
      </div>
    </div>
  )
}
