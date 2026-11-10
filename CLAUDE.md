Đọc hết file này trước khi làm việc.

## Tổng quan
Spelling Bee: web app frontend-only cho trẻ 5–10 tuổi. Nhập từ tiếng Anh (gõ phím hoặc OCR từ ảnh), bấm để nghe phát âm Oxford và xem thẻ chi tiết (từ loại, nghĩa tiếng Việt, hình).

## Tài liệu
- Spec: [docs/superpowers/specs/2026-11-10-spelling-kids-design.md](docs/superpowers/specs/2026-11-10-spelling-kids-design.md)
- Backlog: [docs/backlog.md](docs/backlog.md)

## Công nghệ
Vite 8 + React 19 + TypeScript 7, Vitest 5 + Testing Library (jsdom), tesseract.js 7 (OCR trong trình duyệt), @dnd-kit (kéo-thả), emojibase-data (dev, dựng bảng emoji).

## Lệnh
- Cài: `npm install`
- Chạy dev: `npm run dev` (http://localhost:5173)
- Test: `npx vitest run`
- Typecheck + build: `npm run build`
- Lint: `npm run lint`

## Cấu trúc thư mục
- `src/lib/` – logic thuần: `words.ts` (tách/chuẩn hóa từ), `storage.ts`, `oxford.ts` (parse HTML Oxford), `lookup.ts` (gom dữ liệu + cache), `translate.ts`, `images.ts`, `audio.ts`, `ocr.ts`, `fetchProxy.ts`.
- `src/components/` – UI: `WordInput`, `PhotoImport` (dùng `Sheet`), `WordCard` (kéo-thả), `WordDetail` (khối thay chỗ header, không phải popup), `FitText` (chữ một dòng, tự thu nhỏ).
- `src/data/emoji-index.json` – bảng từ → emoji 3D (file sinh ra); `scripts/` – script dựng bảng + `emoji-overrides.json`.
- `public/` – manifest, service worker, icon.

## Quy tắc then chốt
- Không có backend: mọi gọi mạng từ trình duyệt; trang Oxford phải đi qua CORS proxy (`fetchProxy.ts`), mp3 Oxford phát trực tiếp.
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
- Ảnh mẫu để thử OCR: `docs/samples/ocr-test.png`.
- tesseract.js tải worker + dữ liệu ngôn ngữ từ CDN ở lần dùng đầu (~10MB), nên cần mạng.
- Audio trên iOS chỉ phát được khi gắn với thao tác bấm của người dùng: gọi `play()` ngay trong handler click.
