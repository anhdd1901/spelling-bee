import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PhotoImport } from './components/PhotoImport'
import { WordCard } from './components/WordCard'
import { WordDetail } from './components/WordDetail'
import { WordInput } from './components/WordInput'
import { playPronunciation, unlockAudio, type PlayResult } from './lib/audio'
import { getCached, lookupCached, type WordInfo } from './lib/lookup'
import { POS_COLORS } from './lib/pos'
import { addWords, correctWord, loadWords, moveWord, removeWord, saveWords, type WordItem } from './lib/storage'

/** Nghỉ giữa hai lần tra nền: proxy Oxford chỉ cho khoảng 60 lượt mỗi phút. */
const PREFETCH_GAP_MS = 1100
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Đã có dữ liệu từ điển thật (lần tra lỗi thì phải tra lại khi bấm). */
const usable = (i: WordInfo | null | undefined): i is WordInfo => !!i && i.source !== 'none'

const LEGEND = (['noun', 'verb', 'adjective', 'adverb', 'other'] as const).map((k) => POS_COLORS[k])

export default function App() {
  const [words, setWords] = useState<WordItem[]>(loadWords)
  const [infos, setInfos] = useState<Record<string, WordInfo>>({})
  const [openWord, setOpenWord] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sound, setSound] = useState<PlayResult | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const openRef = useRef<string | null>(null)
  const lastDragEnd = useRef(0)
  const sensors = useSensors(
    // Chuột: rê quá 6px mới tính là kéo, nên bấm bình thường vẫn mở từ.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Cảm ứng: nhấn giữ 0,2 giây mới kéo, để vuốt danh sách vẫn cuộn được.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    lastDragEnd.current = Date.now()
    if (over && active.id !== over.id) setWords((ws) => moveWord(ws, String(active.id), String(over.id)))
  }

  useEffect(() => saveWords(words), [words])

  const say = useCallback((msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }, [])

  const remember = useCallback((info: WordInfo) => {
    setInfos((m) => ({ ...m, [info.word.toLowerCase()]: info }))
  }, [])

  // Tải sẵn thông tin các từ ở nền (từng từ một, có giãn cách để không vượt giới hạn proxy)
  // để có màu từ loại và bấm vào là nghe ngay.
  useEffect(() => {
    let cancelled = false
    const todo = words.map((w) => w.text).filter((t) => !usable(infos[t.toLowerCase()]))
    const fromCache = todo.map(getCached).filter((x): x is WordInfo => !!x)
    if (fromCache.length) {
      setInfos((m) => Object.fromEntries([...Object.entries(m), ...fromCache.map((i) => [i.word.toLowerCase(), i])]))
    }
    const queue = todo.filter((t) => !getCached(t))
    ;(async () => {
      for (const t of queue) {
        if (cancelled) return
        try {
          const info = await lookupCached(t)
          if (!cancelled) remember(info)
        } catch {
          /* thử lại khi bấm */
        }
        await sleep(PREFETCH_GAP_MS)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  const handleAdd = (texts: string[]) => {
    const r = addWords(words, texts)
    setWords(r.list)
    if (r.added && r.duplicates) say(`🎉 Đã thêm ${r.added} từ (bỏ qua ${r.duplicates} từ đã có)`)
    else if (r.added) say(r.added === 1 ? `🎉 Đã thêm "${texts[0]}"` : `🎉 Đã thêm ${r.added} từ`)
    else say('Từ này có rồi nha! 😉')
  }

  const speak = (info: WordInfo, accent: 'us' | 'uk' = 'us') => {
    // Có tiếng đúng của từ đã nhập (số nhiều…) thì phát trước, hỏng thì phát tiếng Oxford.
    const urls = accent === 'uk' ? [info.audioExact, info.audioUK] : [info.audioExact, info.audioUS ?? info.audioUK]
    setSound(null)
    return playPronunciation(urls, info.word).then((r) => {
      if (openRef.current?.toLowerCase() === info.word.toLowerCase()) setSound(r)
      return r
    })
  }

  const open = (item: WordItem) => {
    if (Date.now() - lastDragEnd.current < 250) return // cú click ngay sau khi thả thẻ
    unlockAudio() // phải chạy ngay trong thao tác bấm
    const key = item.text.toLowerCase()
    setOpenWord(item.text)
    setSound(null)
    openRef.current = item.text
    const known = usable(infos[key]) ? infos[key] : getCached(key)
    if (known) {
      remember(known)
      setLoading(false)
      speak(known)
      return
    }
    // Chưa tra hoặc lần trước tra lỗi: tra lại ngay.
    setLoading(true)
    lookupCached(item.text)
      .then((info) => {
        remember(info)
        if (openRef.current === item.text) speak(info)
      })
      .finally(() => openRef.current === item.text && setLoading(false))
  }

  /** Bé chọn gợi ý chính tả: sửa từ trong danh sách rồi mở luôn từ đúng. */
  const fixSpelling = (suggestion: string) => {
    const wrong = words.find((w) => w.text === openWord)
    if (!wrong) return
    const r = correctWord(words, wrong.id, suggestion)
    setWords(r.list)
    say(`✏️ Đã sửa thành "${r.item.text}"`)
    open(r.item)
  }

  const retry = () => {
    if (!openWord) return
    setLoading(true)
    lookupCached(openWord)
      .then((info) => {
        remember(info)
        if (usable(info)) speak(info)
      })
      .finally(() => setLoading(false))
  }

  const del = (id: string) => {
    const w = words.find((x) => x.id === id)
    setWords(removeWord(words, id))
    if (w && openWord === w.text) closeDetail()
    if (w) say(`🗑️ Đã xóa "${w.text}"`)
  }

  const existing = useMemo(() => new Set(words.map((w) => w.text.toLowerCase())), [words])
  const q = query.trim().toLowerCase()
  const shown = q ? words.filter((w) => w.text.toLowerCase().includes(q)) : words
  const closeDetail = useCallback(() => {
    setOpenWord(null)
    openRef.current = null
  }, [])
  const closePhoto = useCallback(() => setPhoto(null), [])

  return (
    <div className="app">
      <div className="top">
        {openWord ? (
          <WordDetail
            key={openWord}
            word={openWord}
            info={infos[openWord.toLowerCase()] ?? null}
            loading={loading}
            sound={sound}
            onPlay={(accent) => {
              const info = infos[openWord.toLowerCase()]
              unlockAudio()
              if (info) speak(info, accent)
              else playPronunciation(undefined, openWord).then(setSound)
            }}
            onFix={fixSpelling}
            onClose={closeDetail}
            onRetry={retry}
          />
        ) : (
          <>
            <header className="hero">
              <div className="logo" aria-hidden>
                <span>🐝</span>
              </div>
              <div>
                <h1>Spelling Bee</h1>
                <p className="tagline">Gõ hoặc chụp từ tiếng Anh, chạm để nghe đọc!</p>
              </div>
            </header>
            <WordInput onAdd={handleAdd} onPhoto={setPhoto} />
          </>
        )}
      </div>

      <section className="panel words-panel" aria-label="Danh sách từ">
        <div className="words-head">
          <h2>
            Từ của bé <span className="count">{words.length}</span>
          </h2>
          <label className="search">
            <span aria-hidden>🔍</span>
            <span className="sr-only">Tìm từ</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm từ…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        </div>
        <ul className="legend" aria-label="Màu theo từ loại">
          {LEGEND.map((c) => (
            <li key={c.label}>
              <span className="dot" style={{ background: c.bg, borderColor: c.strong }} />
              {c.label}
            </li>
          ))}
        </ul>
        <div className="words-scroll">
          {words.length === 0 ? (
            <div className="empty">
              <div className="empty-emoji" aria-hidden>
                🦉
              </div>
              <p>Chưa có từ nào. Hãy thêm từ đầu tiên nhé!</p>
              <p className="hint">Ví dụ: apple, cat, happy, run</p>
            </div>
          ) : shown.length === 0 ? (
            <div className="empty">
              <p>Không thấy từ nào có “{query.trim()}” 🙈</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} onDragCancel={() => (lastDragEnd.current = Date.now())}>
              <SortableContext items={shown.map((w) => w.id)} strategy={rectSortingStrategy}>
                <ul className="grid">
                  {shown.map((w) => (
                    <WordCard
                      key={w.id}
                      item={w}
                      info={infos[w.text.toLowerCase()] ?? null}
                      active={openWord === w.text}
                      dragDisabled={!!q}
                      onOpen={open}
                      onDelete={del}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </section>

      {photo && <PhotoImport file={photo} existing={existing} onAdd={handleAdd} onClose={closePhoto} />}
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}
