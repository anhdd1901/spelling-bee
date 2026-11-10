import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  /** Đang ở chế độ "Xóa nhiều": chạm thẻ là chọn/bỏ chọn. */
  selecting?: boolean
  selected?: boolean
  onOpen: (item: WordItem) => void
  onDelete: (id: string) => void
  onToggle?: (id: string) => void
}

export function WordCard({ item, info, active, dragDisabled, selecting, selected, onOpen, onDelete, onToggle }: Props) {
  const noDrag = dragDisabled || selecting
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: item.id, disabled: noDrag })
  const color = posColor(info?.pos[0]?.en)
  const style = {
    '--c': color.bg,
    '--c-strong': color.strong,
    transform: CSS.Translate.toString(transform),
    transition,
  } as React.CSSProperties
  const cls = ['card', active && !selecting && 'active', isDragging && 'dragging', !noDrag && 'draggable', selecting && 'selecting', selected && 'selected']

  return (
    <li ref={setNodeRef} className={cls.filter(Boolean).join(' ')} style={style} {...listeners}>
      {selecting ? (
        <button
          type="button"
          className="card-main"
          onClick={() => onToggle?.(item.id)}
          aria-label={`Chọn từ ${item.text}`}
          aria-pressed={!!selected}
        >
          <FitText className="card-word" text={item.text} />
        </button>
      ) : (
        <button type="button" className="card-main" onClick={() => onOpen(item)} aria-label={`Nghe và xem từ ${item.text}`}>
          <FitText className="card-word" text={item.text} />
        </button>
      )}
      {selecting ? (
        <span className="check" aria-hidden>
          {selected ? '✓' : ''}
        </span>
      ) : (
        <button type="button" className="icon-btn" aria-label={`Xóa từ ${item.text}`} onClick={() => onDelete(item.id)}>
          🗑️
        </button>
      )}
    </li>
  )
}
