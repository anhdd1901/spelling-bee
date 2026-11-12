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

  const playModelFor = (word: string) => async (): Promise<PlayResult> => {
    let info: WordInfo | null = infos[word.toLowerCase()] ?? getCached(word)
    if (!info) {
      try {
        info = await lookupCached(word)
        onInfo(info)
      } catch {
        info = null
      }
    }
    return playPronunciation(info ? usAudioUrls(info) : undefined, word)
  }

  const stage = (word: string, hasNext: boolean, onCorrect: () => void, onSkip: () => void, key: string) => {
    const props: StageProps = {
      word,
      info: infos[word.toLowerCase()] ?? null,
      hasNext,
      onCorrect,
      onSkip,
      playModel: playModelFor(word),
    }
    // Chế độ nói do SpeakCard (Task 5) đảm nhận.
    return mode === 'write' ? <WriteCard key={key} {...props} /> : null
  }

  const word = currentWord(round)
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
      `redo-${redo.n}`,
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
      `${roundId}-${round.outcomes.length}`,
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
