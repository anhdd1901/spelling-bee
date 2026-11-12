# Luyện nói và luyện viết: kế hoạch thực hiện (plan-1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm hai màn luyện tập (luyện nói bằng nhận dạng giọng nói, luyện viết bằng gõ phím) dùng các từ trong "Từ của bé", có chấm điểm cuối lượt.

**Architecture:** Logic thuần (chọn từ, trạng thái lượt, điểm, so khớp giọng nói) nằm trong `src/lib` và có test. `App` đổi màn bằng state `view`; `PracticeScreen` là khung chung (tổ ong tiến độ, chồng thẻ, kết quả) và nhúng `SpeakCard` hoặc `WriteCard`. Không thêm thư viện.

**Tech Stack:** React 19, TypeScript 7, Vitest 5 + Testing Library (jsdom), Web Speech API (`SpeechRecognition`), Web Audio API.

**Spec:** `docs/superpowers/specs/2026-11-10-spelling-kids-design.md`, mục *Luyện tập* (đọc cả mục *Giao diện màn luyện*).

## Global Constraints

- Không thêm dependency. Không gọi mạng thật, micro thật hay âm thanh thật trong test (giả lập `lookup`, `audio`, `speech`, `sfx` bằng `vi.mock` như `src/App.test.tsx`).
- Mọi chữ hiển thị là tiếng Việt, đúng nguyên văn các chuỗi ghi trong từng task.
- CSS viết tiếp vào `src/index.css` (một mục `/* ---------- practice ---------- */`), dùng biến màu sẵn có (`--shadow`, `--sun`, `--pink`, `--green`, `--blue`, `--orange`), viền 4px, bóng `0 Npx 0 var(--shadow)`. Không dùng `-webkit-text-stroke`. Vùng bấm ≥ 48px.
- Animation của thẻ dùng `backwards`, không dùng `both`.
- `prefers-reduced-motion`: quy tắc toàn cục hiện tắt hết animation; với thẻ luyện, thay trượt/lắc bằng mờ dần (ghi đè bằng selector cụ thể hơn + `!important`). Tiếng vẫn phát, thời gian chờ vẫn giữ.
- iOS: `unlockAudio()` và `recognition.start()` phải gọi đồng bộ trong handler click, trước mọi `await`.
- Sau mỗi task: `npx vitest run` (phạm vi file của task), `npm run lint`, `npm run build` đều sạch; commit `<loại>(plan-1/task-N): …` và đánh `[x]` các bước của task trong file này, cùng commit.

## Review Focus

1. Máy nhận dạng trả chữ số cho số đếm ("2" khi bé đọc "two"), viết hoa hoặc kèm dấu câu ("Cat.") → vẫn tính đúng. *Test ở Task 2.*
2. Nhận dạng lỗi vì mạng hoặc micro hỏng (`network`, `audio-capture`) → không tính sai, không phát "è", hiện "Máy chưa nghe được, bé thử lại nhé". *Test ở Task 5.*
3. Bé bấm 🎤 nhiều lần liên tiếp, hoặc gạt thẻ khi máy đang nghe → chỉ có một phiên nghe; rời thẻ thì hủy phiên, kết quả đến muộn không chấm vào thẻ sau. *Test ở Task 5.*
4. Bé bấm Enter/Xong ✓ hai lần trong lúc thẻ đang trượt đi → chỉ sang một từ, không nhảy cóc. *Test ở Task 4.*
5. Dữ liệu số lần bỏ qua trong `localStorage` bị hỏng (không phải JSON, không phải object, giá trị không phải số) → coi như rỗng, app vẫn chạy. *Test ở Task 1.*

---

### Task 1: Logic lượt luyện và lưu số lần bỏ qua

**Files:**
- Create: `src/lib/practice.ts`, `src/lib/practice.test.ts`
- Modify: `src/lib/storage.ts`, `src/lib/storage.test.ts`

**Interfaces (Produces):**

```ts
// src/lib/practice.ts
export type Mode = 'speak' | 'write'
/** Khóa = chữ của từ, viết thường. */
export type SkipCounts = Record<string, number>
export type Outcome = 'correct' | 'skipped'
export interface Round { words: string[]; outcomes: Outcome[]; redone: string[] }
export type RoundAction = { type: 'correct' } | { type: 'skip' } | { type: 'redo'; word: string }

export function roundSize(total: number, random?: () => number): number
export function pickRound(words: string[], skips: SkipCounts, random?: () => number): string[]
export function startRound(words: string[]): Round
export function roundReducer(round: Round, action: RoundAction): Round
export function currentWord(round: Round): string | undefined   // undefined khi hết lượt
export function isDone(round: Round): boolean
export function skippedWords(round: Round): string[]
export function score(round: Round): { correct: number; total: number; percent: number; stars: 1 | 2 | 3 }
export function recordSkip(counts: SkipCounts, word: string): SkipCounts     // +1
export function recordCorrect(counts: SkipCounts, word: string): SkipCounts  // xóa khóa
export function pruneSkips(counts: SkipCounts, words: string[]): SkipCounts  // chỉ giữ từ còn trong danh sách
export function swipeDecision(dx: number, width: number, velocity: number): 'skip' | 'back'

// src/lib/storage.ts
export function loadSkipCounts(mode: Mode): SkipCounts
export function saveSkipCounts(mode: Mode, counts: SkipCounts): void
```

Quy tắc (từ spec):
- `roundSize`: `total < 15` → `total`; ngược lại `min(total, 15 + floor(random() * 6))`.
- `pickRound`: sắp theo số lần bỏ qua giảm dần, bằng nhau thì ngẫu nhiên; lấy `roundSize` từ đầu; trộn (Fisher–Yates dùng `random`) rồi trả về. Không sửa mảng đầu vào.
- `roundReducer`: `correct`/`skip` thêm một outcome cho từ hiện tại, hết lượt rồi thì bỏ qua action; `redo` thêm `word` vào `redone` nếu từ đó đang là `skipped` và chưa có.
- `score`: `percent = round(correct / total * 100)` (`total = 0` → 0); sao theo `percent`: ≥ 90 → 3, ≥ 60 → 2, còn lại 1. `redone` không đổi điểm.
- `swipeDecision`: `'skip'` khi `dx <= -width / 3` hoặc (`velocity <= -0.5` px/ms và `dx <= -30`); còn lại `'back'`.
- Khóa lưu: `spelling-kids:skips:<mode>:v1`. `loadSkipCounts` chỉ giữ các cặp có giá trị là số nguyên dương.

- [ ] **Step 1: Viết test (fail)** trong `practice.test.ts`:

```ts
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length] }
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`)

it('roundSize: dưới 15 lấy hết, từ 15 trở lên lấy 15–20 và không quá tổng', () => {
  expect(roundSize(0)).toBe(0); expect(roundSize(14, () => 0.99)).toBe(14)
  expect(roundSize(15, () => 0.99)).toBe(15); expect(roundSize(40, () => 0)).toBe(15)
  expect(roundSize(40, () => 0.99)).toBe(20); expect(roundSize(17, () => 0.99)).toBe(17)
})
it('pickRound ưu tiên từ hay bỏ qua và không lặp từ', () => {
  const r = pickRound(words(40), { w39: 3, w38: 1 }, seq(0.1, 0.7, 0.4))
  expect(r).toHaveLength(15); expect(new Set(r).size).toBe(15)
  expect(r).toContain('w39'); expect(r).toContain('w38')
})
it('pickRound không sửa mảng đầu vào', () => { const w = words(5); pickRound(w, {}); expect(w).toEqual(words(5)) })
it('reducer: đúng, bỏ qua, hết lượt, làm lại', () => {
  let r = startRound(['a', 'b', 'c'])
  expect(currentWord(r)).toBe('a')
  r = roundReducer(r, { type: 'correct' }); r = roundReducer(r, { type: 'skip' }); r = roundReducer(r, { type: 'correct' })
  expect(isDone(r)).toBe(true); expect(currentWord(r)).toBeUndefined()
  expect(roundReducer(r, { type: 'correct' })).toEqual(r)
  expect(skippedWords(r)).toEqual(['b'])
  expect(score(r)).toEqual({ correct: 2, total: 3, percent: 67, stars: 2 })
  const again = roundReducer(roundReducer(r, { type: 'redo', word: 'b' }), { type: 'redo', word: 'b' })
  expect(again.redone).toEqual(['b']); expect(score(again).percent).toBe(67)
  expect(roundReducer(r, { type: 'redo', word: 'a' }).redone).toEqual([])
})
it('score: ngưỡng sao 90 và 60, lượt rỗng', () => { /* 9/10 → 3 sao; 6/10 → 2; 5/10 → 1; 18/18 → 100, 3 sao; rỗng → percent 0, stars 1 */ })
it('recordSkip/recordCorrect/pruneSkips không phân biệt hoa thường', () => {
  expect(recordSkip({ cat: 1 }, 'Cat')).toEqual({ cat: 2 })
  expect(recordCorrect({ cat: 2, dog: 1 }, 'CAT')).toEqual({ dog: 1 })
  expect(pruneSkips({ cat: 2, dog: 1 }, ['Dog'])).toEqual({ dog: 1 })
})
it('swipeDecision', () => {
  expect(swipeDecision(-101, 300, 0)).toBe('skip'); expect(swipeDecision(-99, 300, 0)).toBe('back')
  expect(swipeDecision(-40, 300, -0.6)).toBe('skip'); expect(swipeDecision(-10, 300, -2)).toBe('back')
  expect(swipeDecision(200, 300, 2)).toBe('back')
})
```

Trong `storage.test.ts` (Review Focus 5):

```ts
it('skip counts: lưu riêng từng chế độ, dữ liệu hỏng coi như rỗng', () => {
  saveSkipCounts('speak', { cat: 2 })
  expect(loadSkipCounts('speak')).toEqual({ cat: 2 }); expect(loadSkipCounts('write')).toEqual({})
  for (const bad of ['not json', '[1,2]', '"x"', 'null']) {
    localStorage.setItem('spelling-kids:skips:write:v1', bad); expect(loadSkipCounts('write')).toEqual({})
  }
  localStorage.setItem('spelling-kids:skips:write:v1', '{"cat":"x","dog":2,"owl":-1,"bee":1.5}')
  expect(loadSkipCounts('write')).toEqual({ dog: 2 })
})
```

- [ ] **Step 2:** `npx vitest run src/lib/practice.test.ts src/lib/storage.test.ts` → FAIL (chưa có hàm).
- [ ] **Step 3:** Viết `practice.ts` và hai hàm trong `storage.ts` theo Interfaces và Quy tắc.
- [ ] **Step 4:** Chạy lại → PASS. `npm run lint && npm run build` sạch.
- [ ] **Step 5:** Commit `feat(plan-1/task-1): practice round logic and skip counts`.

---

### Task 2: So khớp giọng nói và bọc SpeechRecognition

**Files:**
- Create: `src/lib/speech.ts`, `src/lib/speech.test.ts`

**Interfaces (Produces):**

```ts
export const HOMOPHONES: string[][]
/** Các từ đọc giống `word` (không gồm chính nó), viết thường. */
export function homophonesOf(word: string): string[]
export function matchesWord(target: string, alternatives: string[]): boolean
export function speechSupported(): boolean
export type ListenResult =
  | { kind: 'heard'; alternatives: string[] }   // ít nhất một phương án không rỗng
  | { kind: 'silent' }                          // no-speech, aborted, kết thúc mà không có kết quả
  | { kind: 'denied' }                          // not-allowed, service-not-allowed
  | { kind: 'error' }                           // lỗi khác (network, audio-capture…) hoặc start() ném lỗi
export interface Listening { result: Promise<ListenResult>; stop(): void }
/** Gọi đồng bộ trong handler click. `stop()` hủy phiên; promise khi đó ra 'silent'. */
export function listenOnce(): Listening
```

Quyết định:
- `matchesWord`: chuẩn hóa = viết thường, đổi `’` thành `'`, xóa `'` và `-`, mọi ký tự không phải chữ cái hay chữ số thành khoảng trắng. Tập chấp nhận = từ cần đọc + `homophonesOf` + dạng chữ số nếu là số đếm, tất cả đã chuẩn hóa. Đúng khi một phương án có một token thuộc tập, hoặc cả phương án ghép liền (bỏ khoảng trắng) thuộc tập.
- Số đếm: bảng `zero`…`twenty`, `thirty`, `forty`, `fifty`, `sixty`, `seventy`, `eighty`, `ninety`, `hundred` ↔ `0`…`20`, `30`…`90`, `100`.
- `HOMOPHONES` (đúng danh sách này):
  `be/bee`, `to/too/two`, `for/four`, `ate/eight`, `one/won`, `I/eye`, `see/sea`, `sun/son`, `no/know`, `new/knew`, `night/knight`, `right/write`, `here/hear`, `there/their`, `by/buy/bye`, `hi/high`, `our/hour`, `red/read`, `blue/blew`, `flower/flour`, `meat/meet`, `pair/pear`, `bear/bare`, `hair/hare`, `deer/dear`, `tail/tale`, `sail/sale`, `week/weak`, `wood/would`, `hole/whole`, `road/rode`, `plane/plain`, `nose/knows`, `ant/aunt`, `not/knot`, `peace/piece`, `mail/male`, `wait/weight`, `where/wear`, `which/witch`.
- `listenOnce`: dùng `window.SpeechRecognition ?? window.webkitSpeechRecognition`; `lang = 'en-US'`, `maxAlternatives = 5`, `interimResults = false`, `continuous = false`. Lấy mọi `transcript` của kết quả đầu tiên. Promise chỉ resolve một lần (ở `onresult`, `onerror` hoặc `onend`). Nếu `lib.dom` của TypeScript 7 chưa có kiểu `SpeechRecognition`, khai báo một interface tối thiểu ngay trong file, không dùng `any`.

- [ ] **Step 1: Viết test (fail):**

```ts
it.each([
  ['cat', ['cat'], true], ['cat', ['Cat.'], true], ['cat', ['a cat'], true], ['cat', ['cut', 'cap'], false],
  ['cat', ['cut', 'cat'], true], ['cat', ['category'], false], ['cat', [], false], ['cat', [''], false],
  ['ice-cream', ['ice cream'], true], ["don't", ['dont'], true], ["don't", ['don’t'], true],
  ['bee', ['be'], true], ['two', ['too'], true], ['I', ['eye'], true], ['knight', ['night'], true],
  ['two', ['2'], true], ['eight', ['8'], true], ['twenty', ['20'], true], ['cat', ['2'], false],   // Review Focus 1
])('matchesWord(%s, %j) → %s', (t, alts, want) => expect(matchesWord(t, alts)).toBe(want))

it('homophonesOf không gồm chính từ đó, không phân biệt hoa thường', () => {
  expect(homophonesOf('Two').sort()).toEqual(['to', 'too']); expect(homophonesOf('cat')).toEqual([])
})
```

`listenOnce` với lớp giả gắn vào `window.webkitSpeechRecognition` (lớp giả lưu instance cuối để test gọi `onresult`/`onerror`/`onend`):

```ts
it('heard: trả mọi phương án', …)            // onresult với 2 alternative → { kind: 'heard', alternatives: ['cat', 'cap'] }
it('no-speech và aborted → silent', …)
it('not-allowed → denied', …)
it('network → error', …)
it('onend không có kết quả → silent; onend sau onresult không đổi kết quả', …)
it('stop() gọi abort() và ra silent', …)
it('start() ném lỗi → error', …)
it('đặt lang en-US, maxAlternatives 5', …)
it('speechSupported theo việc có lớp nhận dạng hay không', …)
```

- [ ] **Step 2:** `npx vitest run src/lib/speech.test.ts` → FAIL.
- [ ] **Step 3:** Viết `speech.ts`.
- [ ] **Step 4:** Chạy lại → PASS; lint + build sạch.
- [ ] **Step 5:** Commit `feat(plan-1/task-2): speech matching and recognition wrapper`.

---

### Task 3: Tiếng phản hồi, tổ ong tiến độ, thẻ vuốt

**Files:**
- Create: `src/lib/sfx.ts`, `src/lib/sfx.test.ts`, `src/components/Honeycomb.tsx`, `src/components/SwipeCard.tsx`, `src/components/useFeedback.ts`, `src/components/practiceParts.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `Outcome`, `swipeDecision` (Task 1).
- Produces:

```ts
// src/lib/sfx.ts — không có AudioContext thì không làm gì, không ném lỗi
export function playDing(): void     // sine 880Hz rồi 1320Hz, mỗi nốt 0,12s, gain 0,25
export function playBuzz(): void     // sawtooth 160Hz trượt xuống 110Hz trong 0,35s, gain 0,2
export function playFanfare(): void  // sine 523, 659, 784, 1047Hz, mỗi nốt 0,12s

// src/components/Honeycomb.tsx
export function Honeycomb(props: { total: number; outcomes: Outcome[] }): JSX.Element
// <ol aria-label="Từ {n} trên {total}">, n = min(outcomes.length + 1, total); mỗi <li> có class 'cell' + 'correct' | 'skipped' | 'current' | ''

// src/components/useFeedback.ts
export type Feedback = 'right' | 'wrong' | null
export const RIGHT_MS = 350
export const WRONG_MS = 400
/** right(): phát ding, feedback='right', sau RIGHT_MS gọi onCorrect. wrong(): phát buzz, feedback='wrong', sau WRONG_MS về null.
 *  Đang 'right' thì right()/wrong() không làm gì. Unmount thì hủy timer. */
export function useFeedback(onCorrect: () => void): { feedback: Feedback; right(): void; wrong(): void }

// src/components/SwipeCard.tsx
export function SwipeCard(props: {
  feedback: Feedback
  hasNext: boolean            // vẽ mép thẻ kế tiếp phía sau
  onSkip(): void
  onTap?(): void              // di chuyển < 10px thì là chạm
  className?: string
  style?: CSSProperties
  children: ReactNode
}): JSX.Element
```

Quyết định:
- `sfx.ts`: một `AudioContext` dùng chung, tạo lười; `resume()` nếu đang `suspended`.
- `SwipeCard`: pointer events + `setPointerCapture`; chỉ dịch sang trái (`dx` kẹp ≤ 0); `touch-action: pan-y`. Thả tay: `swipeDecision(dx, chiều rộng thẻ, vận tốc 100ms cuối)`; `'skip'` → thêm class `leaving` (trượt trái 0,35s) rồi gọi `onSkip`; `'back'` → về chỗ cũ có transition. Kéo bắt đầu trên `input`, `button` thì bỏ qua (để gõ và bấm bình thường). Class theo `feedback`: `right` (viền `--green`, trượt trái `RIGHT_MS`), `wrong` (viền `--pink`, lắc 3 nhịp `WRONG_MS`).
- CSS ô lục giác bằng `clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)`; ô `correct` nền `--sun`; `skipped` nền trong, viền nhạt; `current` viền đậm và nảy nhẹ. Hàng tổ ong tự xuống dòng khi hẹp.

- [ ] **Step 1: Viết test (fail):**

```ts
// sfx.test.ts
it('không có AudioContext thì không ném lỗi', () => { expect(() => { playDing(); playBuzz(); playFanfare() }).not.toThrow() })
it('có AudioContext thì tạo oscillator và start', …)   // AudioContext giả đếm createOscillator: ding 2, buzz 1, fanfare 4

// practiceParts.test.tsx (vi.mock('../lib/sfx'))
it('Honeycomb: nhãn và trạng thái từng ô', () => {
  render(<Honeycomb total={4} outcomes={['correct', 'skipped']} />)
  expect(screen.getByRole('list', { name: 'Từ 3 trên 4' })).toBeInTheDocument()
  const cells = screen.getAllByRole('listitem')
  expect(cells.map((c) => c.className)).toEqual(['cell correct', 'cell skipped', 'cell current', 'cell'])
})
it('Honeycomb hết lượt: nhãn "Từ 4 trên 4", không ô nào current', …)
it('useFeedback: right() phát ding và gọi onCorrect đúng một lần sau RIGHT_MS, kể cả khi gọi right() hai lần', …)  // vi.useFakeTimers — Review Focus 4
it('useFeedback: wrong() phát buzz, feedback về null sau WRONG_MS, không gọi onCorrect', …)
it('useFeedback: unmount trước RIGHT_MS thì không gọi onCorrect', …)
it('SwipeCard: class theo feedback và hasNext', …)   // 'right' / 'wrong'; có phần tử .next-peek khi hasNext
```

- [ ] **Step 2:** `npx vitest run src/lib/sfx.test.ts src/components/practiceParts.test.tsx` → FAIL.
- [ ] **Step 3:** Viết `sfx.ts`, `Honeycomb.tsx`, `useFeedback.ts`, `SwipeCard.tsx` và CSS (tổ ong, chồng thẻ, trượt, lắc, ghi đè reduced-motion).
- [ ] **Step 4:** Chạy lại → PASS; lint + build sạch.
- [ ] **Step 5:** Commit `feat(plan-1/task-3): sfx, honeycomb progress and swipe card`.

---

### Task 4: Màn luyện, màn kết quả và luyện viết

**Files:**
- Create: `src/components/PracticeScreen.tsx`, `src/components/PracticeResults.tsx`, `src/components/WriteCard.tsx`, `src/components/PracticeScreen.test.tsx`
- Modify: `src/lib/lookup.ts` (thêm `usAudioUrls`), `src/App.tsx` (dùng `usAudioUrls` trong `speak`), `src/index.css`

**Interfaces:**
- Consumes: Task 1 (`pickRound`, `startRound`, `roundReducer`, `currentWord`, `isDone`, `skippedWords`, `score`, `recordSkip`, `recordCorrect`, `Mode`, `loadSkipCounts`, `saveSkipCounts`), Task 2 (`homophonesOf`), Task 3 (`Honeycomb`, `SwipeCard`, `useFeedback`, `playFanfare`), `lookupCached`, `getCached`, `playPronunciation`, `unlockAudio`.
- Produces:

```ts
// src/lib/lookup.ts
/** Thứ tự file tiếng giọng Mỹ: tiếng đúng của từ đã nhập, rồi Oxford. */
export function usAudioUrls(info: WordInfo): (string | undefined)[]   // [audioExact, audioUS ?? audioUK]

// Props chung của SpeakCard (Task 5) và WriteCard
export interface StageProps {
  word: string
  info: WordInfo | null
  hasNext: boolean
  onCorrect(): void                     // gọi sau khi thẻ đã trượt đi
  onSkip(): void
  playModel(): Promise<PlayResult>      // đọc mẫu từ hiện tại
}
// export từ PracticeScreen.tsx: StageProps
export function WriteCard(props: StageProps): JSX.Element
export function PracticeResults(props: { round: Round; onRedo(word: string): void; onNewRound(): void; onExit(): void }): JSX.Element
export function PracticeScreen(props: {
  mode: Mode
  words: string[]
  infos: Record<string, WordInfo>       // khóa viết thường, như trong App
  onInfo(info: WordInfo): void          // báo App khi tra được từ mới
  onExit(): void
  random?: () => number                 // cho test
}): JSX.Element
```

Quyết định:
- `PracticeScreen`: tạo lượt bằng `pickRound(words, loadSkipCounts(mode), random)` khi mount và khi bấm "Luyện lượt mới". Thẻ hiện tại có `key` = vị trí trong lượt để remount mỗi từ. `onCorrect` → `dispatch correct` + `recordCorrect` + lưu ngay; `onSkip` → `dispatch skip` + `recordSkip` + lưu ngay. Hết lượt → `PracticeResults`; nếu `percent === 100` thì `playFanfare()` một lần.
- Làm lại: state `redo: string | null`. Đang `redo` thì hiện thẻ của từ đó (`hasNext = false`, ẩn tổ ong); `onCorrect` → `dispatch redo` + `recordCorrect` + về kết quả; `onSkip` → về kết quả, không ghi gì.
- `playModel`: lấy `infos[word]` hoặc `getCached`, chưa có thì `lookupCached(word)` (bắt lỗi → coi như không có info) và gọi `onInfo`; rồi `playPronunciation(info ? usAudioUrls(info) : undefined, word)`.
- Khung: nút `←` (`aria-label="Quay lại danh sách"`), `Honeycomb`, tiêu đề `Luyện nói` hoặc `Luyện viết`. `mode === 'speak'` render `SpeakCard` (Task 5); cho tới Task 5, render dòng tạm `null` cho chế độ nói (test Task 4 chỉ dùng `mode="write"`).
- `WriteCard`:
  - Thẻ trắng kẻ dòng (class `write-card`), nút `🔊` (`aria-label="Nghe lại"`) góc trên trái, nút tẩy (`aria-label="Xóa hết chữ"`, biểu tượng SVG vẽ trong file) góc trên phải.
  - `<input aria-label="Bé viết từ vừa nghe" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="done">`, tự focus khi thẻ hiện.
  - Nút `Xong ✓` (màu `--green`) và Enter: ô trống (sau khi trim) thì không làm gì. Đúng khi `value.trim().toLowerCase() === word.toLowerCase()` → `right()`. Sai → `wrong()`, xóa ô, giữ focus. Gọi `unlockAudio()` đầu handler.
  - Mount: gọi `playModel()` một lần; kết quả `'none'` → hiện `🔇 Chưa có tiếng đọc` + hình (`info.image`) + `info.meaningVi`. Bấm 🔊 cũng cập nhật trạng thái này.
  - `homophonesOf(word).length > 0` và có `info.meaningVi` → luôn hiện nghĩa tiếng Việt dưới dòng viết.
  - Không bao giờ hiện chữ tiếng Anh của từ.
  - Nút chữ nhỏ `Bỏ qua ⏭` dưới nút Xong → `onSkip`.
- `PracticeResults`: hàng sao (`aria-label="{n} trên 3 sao"`), số `{percent}%`, dòng `Bé làm đúng {correct} trên {total} từ`, `Honeycomb` cả lượt. Có từ bỏ qua: tiêu đề `Luyện lại nhé:` và mỗi từ một nút (`aria-label="Luyện lại {word}"`, từ đã làm lại đúng có `✅` và `aria-label="{word}, đã làm đúng"`, vẫn bấm được). Không có từ bỏ qua: `Bé làm đúng hết rồi! 🐝`. Hai nút `Luyện lượt mới`, `Về danh sách`.
- CSS: cột canh giữa `max-width: 520px`; số % màu `--orange` có `text-shadow` như `.hero h1`; `@media (max-height: 520px)` thu thấp thẻ để nút Xong ✓ còn trong màn hình khi bàn phím bật.

- [ ] **Step 1: Viết test (fail)** trong `PracticeScreen.test.tsx`. Mock `../lib/lookup` (`getCached: () => null`, `lookupCached`, `usAudioUrls` thật qua `importActual`), `../lib/audio` (`play` trả `'audio'` mặc định), `../lib/sfx`. Dùng `random={() => 0}` và danh sách ngắn; đọc thứ tự từ qua số lần `play` được gọi với tham số thứ hai. Dùng `vi.useFakeTimers({ shouldAdvanceTime: true })` hoặc `findBy…` để qua `RIGHT_MS`.

```ts
it('tự đọc mẫu khi thẻ hiện, không hiện chữ của từ', …)                 // play gọi 1 lần với word; queryByText(word) null
it('gõ đúng (kể cả hoa thường, khoảng trắng " Cat ") → ding, sang từ sau, tổ ong "Từ 2 trên 3"', …)
it('gõ sai → buzz, ô gõ bị xóa trắng và còn focus, vẫn ở từ cũ', …)
it('ô trống bấm Xong ✓ → không ding, không buzz', …)
it('nút tẩy xóa chữ đã gõ; nút Nghe lại đọc lại từ', …)
it('Bỏ qua ⏭ → sang từ sau và lưu số lần bỏ qua ngay', …)              // loadSkipCounts('write')[word] === 1
it('làm đúng → số lần bỏ qua của từ đó về 0', …)                        // đặt sẵn saveSkipCounts('write', { cat: 2 })
it('bấm Enter hai lần liền khi gõ đúng → chỉ sang một từ', …)           // Review Focus 4
it('hết lượt: % , sao, danh sách từ bỏ qua', …)                         // 2 đúng 1 bỏ qua → "67%", "2 trên 3 sao", "Bé làm đúng 2 trên 3 từ", nút "Luyện lại dog"
it('đúng hết: "100%", "Bé làm đúng hết rồi! 🐝", fanfare phát một lần', …)
it('làm lại từ bỏ qua: gõ đúng → về kết quả, từ có ✅, % không đổi, số lần bỏ qua về 0', …)
it('làm lại rồi bỏ qua → về kết quả, từ chưa có ✅', …)
it('Luyện lượt mới bắt đầu lại từ đầu; Về danh sách và ← gọi onExit', …)
it('không có tiếng (play → "none"): hiện "🔇 Chưa có tiếng đọc", hình và nghĩa tiếng Việt, không hiện chữ tiếng Anh', …)
it('không có tiếng và tra lỗi (lookupCached reject): hiện "🔇 Chưa có tiếng đọc", vẫn bỏ qua được', …)
it('từ có đồng âm ("two", meaningVi "hai") luôn hiện nghĩa; từ thường ("cat") thì không', …)
it('ô gõ tắt tự sửa: autocorrect="off", autocapitalize="off", spellcheck="false"', …)
```

- [ ] **Step 2:** `npx vitest run src/components/PracticeScreen.test.tsx` → FAIL.
- [ ] **Step 3:** Viết `usAudioUrls` (và dùng nó trong `App.speak` cho giọng Mỹ), `WriteCard`, `PracticeResults`, `PracticeScreen`, CSS.
- [ ] **Step 4:** `npx vitest run` (toàn bộ, vì có sửa `App.tsx`) → PASS; lint + build sạch.
- [ ] **Step 5:** Commit `feat(plan-1/task-4): practice screen, results and writing practice`.

---

### Task 5: Luyện nói

**Files:**
- Create: `src/components/SpeakCard.tsx`, `src/components/SpeakCard.test.tsx`
- Modify: `src/components/PracticeScreen.tsx` (render `SpeakCard` khi `mode === 'speak'`), `src/index.css`

**Interfaces:**
- Consumes: `StageProps` (Task 4), `listenOnce`, `matchesWord`, `speechSupported`, `ListenResult` (Task 2), `SwipeCard`, `useFeedback` (Task 3), `FitText`, `posColor`.
- Produces: `export function SpeakCard(props: StageProps): JSX.Element`

Quyết định:
- Mặt thẻ: nền `posColor(info?.pos[0]?.en).bg`; hình `info.image` ở trên (không có thì bỏ, `alt=""`), chữ của từ bằng `FitText` ở dưới. `SwipeCard.onTap` → `unlockAudio()` + `playModel()`; kết quả `'none'` → hiện `🔇 Chưa có tiếng đọc`. Thẻ có `role="button"` và `aria-label="Nghe đọc mẫu {word}"`, Enter/Space cũng đọc mẫu.
- Nút micro tròn 96px màu `--pink`, `aria-label="Bấm để nói"`. Bấm: nếu đang nghe hoặc đang đọc mẫu thì bỏ qua; ngược lại `listenOnce()` ngay trong handler, đổi trạng thái đang nghe (`aria-pressed="true"`, class `listening` có 2 vòng sóng, nhãn dưới nút `Bé nói đi…`).
- Xử lý `ListenResult`:
  - `heard` + `matchesWord(word, alternatives)` → `right()`.
  - `heard` không khớp → `wrong()` và hiện `Máy nghe là: {alternatives[0]}`.
  - `silent` → `Chưa nghe thấy, bé bấm 🎤 nói lại nhé` (không buzz).
  - `denied` → `Bé cần cho phép dùng micro` (không buzz).
  - `error` → `Máy chưa nghe được, bé thử lại nhé` (không buzz).
  - Mỗi lần bấm 🎤 xóa dòng thông báo cũ.
- Unmount (sang thẻ khác, rời màn) → `stop()` phiên đang nghe và bỏ qua kết quả đến sau.
- `speechSupported()` là `false`: không vẽ nút 🎤, hiện `Máy này chưa nghe được bé nói — hãy mở bằng Chrome hoặc Safari`; chạm thẻ nghe mẫu và `Bỏ qua ⏭` vẫn dùng được.
- Nút chữ nhỏ `Bỏ qua ⏭` dưới nút 🎤 → `onSkip`.

- [ ] **Step 1: Viết test (fail).** Mock `../lib/speech` giữ `matchesWord` thật (`importActual`), thay `speechSupported` và `listenOnce` bằng bản giả trả `{ result: promise điều khiển được, stop: vi.fn() }`. Mock `../lib/sfx`, `../lib/audio`.

```ts
it('hiện chữ và hình của từ; chạm thẻ thì đọc mẫu', …)
it('nói đúng → ding, gọi onCorrect sau khi trượt', …)
it('nói từ đồng âm ("be" cho "bee") → đúng', …)
it('nói sai → buzz, hiện "Máy nghe là: able", không gọi onCorrect; bấm 🎤 lần nữa thì dòng đó mất', …)
it('silent → "Chưa nghe thấy, bé bấm 🎤 nói lại nhé", không buzz', …)
it('denied → "Bé cần cho phép dùng micro", không buzz', …)
it('error → "Máy chưa nghe được, bé thử lại nhé", không buzz, không gọi onCorrect', …)            // Review Focus 2
it('đang nghe: nút aria-pressed, nhãn "Bé nói đi…"; bấm 🎤 lần nữa không mở phiên thứ hai', …)    // Review Focus 3: listenOnce gọi 1 lần
it('unmount khi đang nghe → gọi stop(); kết quả đến sau không gọi onCorrect, không phát tiếng', …) // Review Focus 3
it('không hỗ trợ: không có nút 🎤, có thông báo, Bỏ qua ⏭ vẫn gọi onSkip', …)
it('PracticeScreen mode="speak" render SpeakCard, tiêu đề "Luyện nói"', …)
```

- [ ] **Step 2:** `npx vitest run src/components/SpeakCard.test.tsx` → FAIL.
- [ ] **Step 3:** Viết `SpeakCard.tsx`, nối vào `PracticeScreen`, CSS (nút micro, vòng sóng, dòng thông báo).
- [ ] **Step 4:** `npx vitest run src/components` → PASS; lint + build sạch.
- [ ] **Step 5:** Commit `feat(plan-1/task-5): speaking practice`.

---

### Task 6: Nối vào App, kiểm tra trên trình duyệt, tài liệu

**Files:**
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/index.css`, `CLAUDE.md`, `docs/backlog.md`

**Interfaces:**
- Consumes: `PracticeScreen`, `Mode`, `pruneSkips`, `loadSkipCounts`, `saveSkipCounts`.

Quyết định:
- `App`: state `view: 'home' | Mode` (mặc định `'home'`). `view !== 'home'` → chỉ render `<PracticeScreen mode={view} words={words.map((w) => w.text)} infos={infos} onInfo={remember} onExit={() => setView('home')} />` bên trong `.app` (giữ toast). Vào màn luyện thì đóng khối chi tiết và thoát chế độ "Xóa nhiều".
- Trong `header.hero`, bên phải tiêu đề: hai nút `🎤 Luyện nói` và `✏️ Luyện viết` (class `btn small`), `disabled` khi `words.length === 0`; handler gọi `unlockAudio()` rồi `setView`. Màn ≤ 640px: ẩn `.tagline`, hai nút nằm dưới tiêu đề trên một hàng; `.top` không cao hơn hiện tại.
- Dọn số liệu: trong effect lưu `words`, với mỗi chế độ `saveSkipCounts(mode, pruneSkips(loadSkipCounts(mode), words.map((w) => w.text)))`.
- `CLAUDE.md`: thêm vào *Cấu trúc thư mục* (`practice.ts`, `speech.ts`, `sfx.ts`, `PracticeScreen`, `PracticeResults`, `SpeakCard`, `WriteCard`, `SwipeCard`, `Honeycomb`) và *Lưu ý* (nhận dạng giọng nói cần Chrome/Safari và mạng; `recognition.start()` phải nằm trong handler click; thêm cặp đồng âm ở `HOMOPHONES`).
- `docs/backlog.md`: thêm dòng "Thử luyện nói trên iPhone/Android thật, kể cả khi mở từ biểu tượng ngoài màn hình chính (PWA)".

- [ ] **Step 1: Viết test (fail)** trong `App.test.tsx` (thêm mock `./lib/sfx`, `./lib/speech` với `speechSupported: () => false`):

```ts
it('danh sách rỗng: hai nút luyện bị khóa', …)
it('bấm "✏️ Luyện viết" → màn luyện viết (ô "Bé viết từ vừa nghe"), ẩn danh sách; ← quay lại danh sách còn nguyên từ', …)
it('bấm "🎤 Luyện nói" → màn luyện nói có tiêu đề "Luyện nói"', …)
it('xóa từ thì số lần bỏ qua của từ đó cũng bị xóa ở cả hai chế độ', …)
```

- [ ] **Step 2:** `npx vitest run src/App.test.tsx` → FAIL.
- [ ] **Step 3:** Sửa `App.tsx` và CSS.
- [ ] **Step 4:** `npx vitest run` (toàn bộ) → PASS; `npm run lint && npm run build` sạch.
- [ ] **Step 5: Chạy thử trên trình duyệt** (`npm run dev`, skill `agent-browser`), ở 2 cỡ màn 390×844 và 1280×800, chụp màn hình từng bước:
  - Thêm 3–4 từ, vào Luyện viết: nghe mẫu, gõ sai (thẻ lắc, ô bị xóa), gõ đúng (thẻ trượt, ô tổ ong đầy mật), bỏ qua bằng nút và bằng kéo chuột, màn kết quả, làm lại một từ, lượt mới, quay lại.
  - Vào Luyện nói: chạm thẻ nghe mẫu, bỏ qua, màn kết quả. Micro thật không thử được trong môi trường tự động: ghi rõ trong báo cáo là phần nhận dạng chỉ mới qua test giả lập.
  - Kiểm tra: không có thanh cuộn ngang, nút ≥ 48px, màn chính không cao thêm ở 390px, chế độ giảm chuyển động (mờ dần thay cho trượt/lắc).
  - Sửa lỗi giao diện tìm thấy rồi chạy lại Step 4.
- [ ] **Step 6:** Cập nhật `CLAUDE.md` và `docs/backlog.md`.
- [ ] **Step 7:** Commit `feat(plan-1/task-6): practice entry points, docs and browser check`.
