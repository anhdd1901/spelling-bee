import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { FitText } from './FitText'
import type { WordInfo } from '../lib/lookup'
import { posColor } from '../lib/pos'
import type { WordItem } from '../lib/storage'

interface Props {
  item: WordItem
  info: WordInfo | null
  active: boolean
  /** Tắt kéo-thả (ví dụ khi đang lọc bằng ô tìm kiếm). */
  dragDisabled?: boolean
  onOpen: (item: WordItem) => void
  onDelete: (id: string) => void
}

export function WordCard({ item, info, active, dragDisabled, onOpen, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: dragDisabled || confirming,
  })
  const color = posColor(info?.pos[0]?.en)
  const style = {
    '--c': color.bg,
    '--c-strong': color.strong,
    transform: CSS.Translate.toString(transform),
    transition,
  } as React.CSSProperties

  if (confirming) {
    return (
      <li className="card confirming" style={style} ref={setNodeRef}>
        <p className="confirm-text">
          Xóa <b>{item.text}</b>?
        </p>
        <div className="card-actions">
          <button type="button" className="btn btn-danger small" onClick={() => onDelete(item.id)}>
            Xóa
          </button>
          <button type="button" className="btn btn-ghost small" onClick={() => setConfirming(false)}>
            Không
          </button>
        </div>
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      className={`card ${active ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${dragDisabled ? '' : 'draggable'}`}
      style={style}
      {...listeners}
    >
      <button type="button" className="card-main" onClick={() => onOpen(item)} aria-label={`Nghe và xem từ ${item.text}`}>
        <FitText className="card-word" text={item.text} />
      </button>
      <button type="button" className="icon-btn" aria-label={`Xóa từ ${item.text}`} onClick={() => setConfirming(true)}>
        🗑️
      </button>
    </li>
  )
}
