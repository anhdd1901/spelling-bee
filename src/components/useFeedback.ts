import { useCallback, useEffect, useRef, useState } from 'react'
import { playBuzz, playDing } from '../lib/sfx'

export type Feedback = 'right' | 'wrong' | null
export const RIGHT_MS = 350
export const WRONG_MS = 400

/** Dùng một lần cho mỗi từ: cha remount bằng `key` mới cho từ kế tiếp.
 *  right(): phát ding, feedback='right', sau RIGHT_MS gọi onCorrect.
 *  wrong(): phát buzz, feedback='wrong', sau WRONG_MS về null.
 *  Đang 'right' thì right()/wrong() không làm gì. Unmount thì hủy timer. */
export function useFeedback(onCorrect: () => void) {
  const [feedback, setFeedback] = useState<Feedback>(null)
  const state = useRef<Feedback>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cb = useRef(onCorrect)
  useEffect(() => {
    cb.current = onCorrect
  })

  /** Khóa: sau khi thẻ đã trượt đi (bỏ qua) thì right()/wrong() không còn tác dụng. */
  const lock = useCallback(() => {
    clearTimeout(timer.current)
    state.current = 'right'
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const right = useCallback(() => {
    if (state.current === 'right') return
    clearTimeout(timer.current)
    state.current = 'right'
    setFeedback('right')
    playDing()
    timer.current = setTimeout(() => cb.current(), RIGHT_MS)
  }, [])

  const wrong = useCallback(() => {
    if (state.current === 'right') return
    clearTimeout(timer.current)
    state.current = 'wrong'
    setFeedback('wrong')
    playBuzz()
    timer.current = setTimeout(() => {
      state.current = null
      setFeedback(null)
    }, WRONG_MS)
  }, [])

  return { feedback, right, wrong, lock }
}
