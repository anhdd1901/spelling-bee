import { useEffect, useRef, useState } from 'react'
import { playPronunciation } from '../lib/audio'
import type { PlayResult } from '../lib/audio'
import { getCached, lookupCached, usAudioUrls } from '../lib/lookup'
import type { WordInfo } from '../lib/lookup'
import {
  currentWord,
  isDone,
  pickRound,
  recordCorrect,
  recordSkip,
  roundReducer,
  score,
  startRound,
} from '../lib/practice'
import type { Mode, Round, RoundAction, SkipCounts } from '../lib/practice'
import { playFanfare } from '../lib/sfx'
import { loadSkipCounts, saveSkipCounts } from '../lib/storage'
import { Honeycomb } from './Honeycomb'
import { PracticeResults } from './PracticeResults'
import { SpeakCard } from './SpeakCard'
import { WriteCard } from './WriteCard'

export interface StageProps {
  word: string
  info: WordInfo | null
  hasNext: boolean
  onCorrect(): void
  onSkip(): void
  playModel(): Promise<PlayResult>
}

export function PracticeScreen({
  mode,
  words,
  infos,
  onInfo,
  onExit,
  random,
}: {
  mode: Mode
  words: string[]
  infos: Record<string, WordInfo>
  onInfo(info: WordInfo): void
  onExit(): void
  random?: () => number
}) {
  const newRound = () => startRound(pickRound(words, loadSkipCounts(mode), random))
  const [round, setRound] = useState<Round>(newRound)
  const [roundId, setRoundId] = useState(0)
  const [redo, setRedo] = useState<{ word: string; n: number } | null>(null)
  const redoCount = useRef(0)
  const fanfared = useRef(-1)
  /** Khóa của thẻ đang hiện; lượt phát mẫu đến muộn của thẻ khác bị bỏ. */
  const activeKey = useRef<string | null>(null)

  const dispatch = (a: RoundAction) => setRound((r) => roundReducer(r, a))
  const finished = isDone(round)
  const { percent } = score(round)

  useEffect(() => {
    if (finished && percent === 100 && fanfared.current !== roundId) {
      fanfared.current = roundId
      playFanfare()
    }
  }, [finished, percent, roundId])

  const save = (fn: (c: SkipCounts, w: string) => SkipCounts, word: string) =>
    saveSkipCounts(mode, fn(loadSkipCounts(mode), word))

  const playModelFor = (word: string, key: string) => async (): Promise<PlayResult> => {
    let info: WordInfo | null = infos[word.toLowerCase()] ?? getCached(word)
    let waited = false
    if (!info) {
      waited = true
      try {
        info = await lookupCached(word)
        onInfo(info)
      } catch {
        info = null
      }
    }
    if (waited && activeKey.current !== key) return 'audio'
    return playPronunciation(info ? usAudioUrls(info) : undefined, word)
  }

  const stage = (word: string, hasNext: boolean, onCorrect: () => void, onSkip: () => void, key: string) => {
    const props: StageProps = {
      word,
      info: infos[word.toLowerCase()] ?? getCached(word),
      hasNext,
      onCorrect,
      onSkip,
      playModel: playModelFor(word, key),
    }
    return mode === 'write' ? <WriteCard key={key} {...props} /> : <SpeakCard key={key} {...props} />
  }

  const word = currentWord(round)
  const cardKey = redo ? `redo-${redo.n}` : finished || word === undefined ? 'results' : `${roundId}-${round.outcomes.length}`
  useEffect(() => {
    activeKey.current = cardKey
  })
  useEffect(() => () => { activeKey.current = null }, [])
  let body
  if (redo) {
    body = stage(
      redo.word,
      false,
      () => {
        dispatch({ type: 'redo', word: redo.word })
        save(recordCorrect, redo.word)
        setRedo(null)
      },
      () => setRedo(null),
      cardKey,
    )
  } else if (finished || word === undefined) {
    body = (
      <PracticeResults
        round={round}
        onRedo={(w) => setRedo({ word: w, n: ++redoCount.current })}
        onNewRound={() => {
          setRound(newRound())
          setRoundId((n) => n + 1)
        }}
        onExit={onExit}
      />
    )
  } else {
    body = stage(
      word,
      round.outcomes.length + 1 < round.words.length,
      () => {
        dispatch({ type: 'correct' })
        save(recordCorrect, word)
      },
      () => {
        dispatch({ type: 'skip' })
        save(recordSkip, word)
      },
      cardKey,
    )
  }

  return (
    <main className="practice">
      <header className="practice-top">
        <button type="button" className="icon-btn back" aria-label="Quay lại danh sách" onClick={onExit}>←</button>
        <h1>{mode === 'speak' ? 'Luyện nói' : 'Luyện viết'}</h1>
      </header>
      {!redo && !finished && <Honeycomb total={round.words.length} outcomes={round.outcomes} />}
      <div className="practice-stage">{body}</div>
    </main>
  )
}
