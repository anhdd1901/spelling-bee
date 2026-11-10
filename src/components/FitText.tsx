import { useLayoutEffect, useRef, type CSSProperties } from 'react'

interface Props {
  text: string
  className?: string
  style?: CSSProperties
  as?: 'span' | 'h2'
}

/**
 * Chữ luôn một dòng, không ngắt giữa từ: hiển thị ở cỡ chữ CSS (cỡ tối đa),
 * nếu không vừa thì thu nhỏ đúng tỉ lệ cho vừa khung cha.
 */
export function FitText({ text, className, style, as: Tag = 'span' }: Props) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const fit = () => {
      el.style.fontSize = ''
      const cs = getComputedStyle(parent)
      const avail = parent.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
      const need = el.scrollWidth
      if (avail > 0 && need > avail) {
        const base = parseFloat(getComputedStyle(el).fontSize)
        el.style.fontSize = `${Math.floor(base * (avail / need) * 10) / 10}px`
      }
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(parent)
    document.fonts?.ready.then(fit).catch(() => {})
    return () => ro.disconnect()
  }, [text])

  return (
    <Tag ref={ref as never} className={className} style={style}>
      {text}
    </Tag>
  )
}
