Đọc hết file này trước khi làm việc.

## Tổng quan
Spelling Bee: web app frontend-only cho trẻ 5–10 tuổi. Nhập từ tiếng Anh (gõ phím hoặc OCR từ ảnh), bấm để nghe phát âm Oxford và xem thẻ chi tiết (từ loại, nghĩa tiếng Việt, hình). Có màn luyện nói (nhận dạng giọng nói) và luyện viết (nghe rồi gõ), mỗi lượt 15–20 từ, chấm điểm cuối lượt.

## Tài liệu
- Spec: [docs/superpowers/specs/2026-11-10-spelling-kids-design.md](docs/superpowers/specs/2026-11-10-spelling-kids-design.md)
- Kế hoạch đã làm: [docs/superpowers/plans/2026-11-13-practice-modes.md](docs/superpowers/plans/2026-11-13-practice-modes.md) (luyện nói/viết)
- Backlog: [docs/backlog.md](docs/backlog.md)

## Công nghệ
Vite 8 + React 19 + TypeScript 7, Vitest 5 + Testing Library (jsdom), tesseract.js 7 (OCR trong trình duyệt), pdfjs-dist 6 (đọc PDF, nạp lười), @dnd-kit (kéo-thả), emojibase-data (dev, dựng bảng emoji).

## Lệnh
- Cài: `npm install`
- Chạy dev: `npm run dev` (http://localhost:5173)
- Test: `npx vitest run`
- Typecheck + build: `npm run build`
- Lint: `npm run lint`
- Deploy: push lên `main` (Vercel tự build), hoặc `npx vercel deploy --prod`. Production: https://spelling-bee-blue.vercel.app

## Cấu trúc thư mục
- `src/lib/` – logic thuần: `words.ts` (tách/chuẩn hóa từ), `storage.ts`, `oxford.ts` (parse HTML Oxford), `lookup.ts` (gom dữ liệu + cache), `translate.ts`, `images.ts`, `audio.ts`, `ocr.ts`, `pdf.ts` (đọc từ trong PDF: lớp chữ hoặc OCR trang scan), `fetchProxy.ts`, `practice.ts` (chọn từ cho lượt, trạng thái lượt, điểm, số lần bỏ qua), `speech.ts` (so khớp giọng nói, bảng đồng âm, bọc `SpeechRecognition`), `sfx.ts` (tiếng tinh/è bằng Web Audio).
- `src/components/` – UI: `WordInput`, `PhotoImport` (dùng `Sheet`), `WordCard` (kéo-thả), `WordDetail` (khối thay chỗ header, không phải popup), `FitText` (chữ một dòng, tự thu nhỏ). Luyện tập: `PracticeScreen` (khung, lượt, làm lại) + `PracticeResults`, `SpeakCard`, `WriteCard`, `SwipeCard` (thẻ vuốt, dùng một lần cho mỗi từ) + `useFeedback`, `Honeycomb` (tiến độ).
- `src/data/emoji-index.json` – bảng từ → emoji 3D (file sinh ra); `scripts/` – script dựng bảng + `emoji-overrides.json`.
- `public/` – manifest, service worker, icon; `public/icons/` – icon 3D của nút Chụp ảnh / Tải ảnh / PDF.
- `api/oxford.ts` – hàm serverless Vercel `GET /api/oxford?q=word` (logic ở `src/server/oxfordProxy.ts`): lấy trang Oxford phía server, cache CDN 1 ngày. Import trong `api/` phải có đuôi `.js` (Node ESM).

## Quy tắc then chốt
- Gần như không có backend: bản production dùng hàm `/api/oxford` của chính app để lấy trang Oxford; hàm lỗi hoặc chạy local thì dùng CORS proxy công cộng (`fetchProxy.ts`). mp3 Oxford phát trực tiếp.
- Luôn có đường dự phòng: dictionaryapi.dev → Web Speech API (spec mục Nguồn dữ liệu).
- Logic mạng/parse viết thuần trong `src/lib`, test bằng HTML/JSON mẫu, không gọi mạng thật trong test.

## Lưu ý / chỗ dễ vấp
- CORS proxy công cộng có thể chết; thêm hoặc đổi proxy trong `PROXIES` ở `fetchProxy.ts` (gọi song song, đọc stream và dừng sớm theo `oxfordBodyCheck`). corsfix chỉ miễn phí cho localhost và giới hạn 60 lượt/phút: bị 429 thì `fetchViaProxy` nghỉ nó 1 phút; tra nền trong App chạy từng từ, cách nhau `PREFETCH_GAP_MS`. Xem backlog.
- Đổi cách chọn ảnh thì tăng `IMAGE_VERSION` trong `lookup.ts` (chỉ tìm lại ảnh), không đổi `CACHE_PREFIX` (sẽ bắt tra lại Oxford cho mọi từ).
- Trình duyệt trên Linux thường không có giọng đọc (`speechSynthesis` rỗng): `playPronunciation` trả `'none'` và UI báo "Chưa có tiếng đọc".
- File âm thanh của dictionaryapi.dev có lúc lỗi 502: luôn để tiếng Oxford làm dự phòng phía sau (`audioExact` rồi `audioUS`).
- Không dùng `-webkit-text-stroke` cho chữ Baloo 2 vì sẽ hiện vạch ngang giữa chữ.
- Trang khóa cuộn (`body { overflow: hidden }`), chỉ `.words-scroll` cuộn; phần tử mới đặt ở `.top` thì phải giữ chiều cao gọn.
- Bảng emoji (`src/data/emoji-index.json`) là file sinh ra: sửa `scripts/emoji-overrides.json` rồi chạy `node scripts/build-emoji-index.mjs` (cần mạng), không sửa tay file JSON.
- Kéo-thả (@dnd-kit): animation của `.card` phải dùng `backwards`, không dùng `both`, nếu không transform của animation sẽ đè transform kéo-thả.
- Luyện nói dùng Web Speech API: Firefox không có, Chrome cần mạng. `listenOnce()` (tức `recognition.start()`), `unlockAudio()` và `primeSfx()` phải gọi đồng bộ trong handler click (iOS). Gọi `stopPlayback()` trước khi mở micro để tiếng mẫu không bị chấm là tiếng bé. Từ đồng âm thêm vào `HOMOPHONES` trong `speech.ts`.
- `SwipeCard`/`useFeedback` chỉ dùng cho một từ: đổi từ thì remount bằng `key` mới; thẻ phải truyền `onLeave={lock}` để bỏ qua và làm đúng không cùng xảy ra; nút Bỏ qua đi qua `skipSignal` để trượt giống thao tác gạt.
- Số lần bỏ qua lưu ở `spelling-kids:skips:<speak|write>:v1`; xóa từ thì `App` dọn số liệu bằng `pruneSkips`.
- `.practice` nằm trong `.app` (flex), không tự đặt `100dvh`. CSS của màn luyện phải bọc trong `.practice …` khi trùng tên class với màn chính (ví dụ `.icon-btn`, `.no-sound`). Bố cục gọn khi bàn phím điện thoại mở dùng class `kb-open` (theo `visualViewport`), vì media query chiều cao không chạy khi bàn phím bật.
- Còn worktree trong `.claude/worktrees/` thì `npx vitest run` ở thư mục gốc quét cả bản sao đó (React trùng → hàng loạt test lỗi giả): dọn worktree trước, hoặc chạy test ngay trong worktree.
- Ảnh mẫu để thử OCR: `docs/samples/ocr-test.png`; PDF mẫu: `docs/samples/pdf-text-12pages.pdf` (có chữ, 12 trang), `docs/samples/pdf-scan.pdf` (scan).
- pdf.js vẽ trang phải dùng `intent: 'print'`: chế độ mặc định chờ `requestAnimationFrame`, sẽ treo khi tab ở nền (hoặc pane trình duyệt của Claude bị ẩn). `destroy()` nằm ở loading task, không ở document.
- tesseract.js tải worker + dữ liệu ngôn ngữ từ CDN ở lần dùng đầu (~10MB), nên cần mạng.
- Audio trên iOS chỉ phát được khi gắn với thao tác bấm của người dùng: gọi `play()` ngay trong handler click.
