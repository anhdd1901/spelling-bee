# Spelling Bee: thiết kế

## Mục tiêu
Web app chỉ có frontend (không backend) cho trẻ 5–10 tuổi: nhập từ tiếng Anh, bấm vào từ để nghe phát âm (lấy từ Oxford Learner's Dictionaries) và xem thẻ chi tiết (từ, từ loại, nghĩa tiếng Việt, hình minh họa). Dùng tốt trên cả máy tính lẫn điện thoại (responsive + cài được như app PWA).

## Tính năng
1. **Nhập từ bằng bàn phím**: ô nhập lớn, Enter hoặc nút "Thêm". Nhập nhiều từ cách nhau bằng dấu phẩy, khoảng trắng hay xuống dòng cũng được.
2. **Nhập từ ảnh**: nút "Chụp ảnh" (camera trên điện thoại, `capture="environment"`) và "Tải ảnh lên". OCR bằng tesseract.js (chạy ngay trong trình duyệt). Các từ đọc được hiện thành chip có thể chọn hoặc bỏ chọn; bấm "Thêm các từ đã chọn".
3. **Danh sách từ ("Từ của bé")**: mỗi từ là một thẻ, màu nền theo từ loại (danh từ cam, động từ xanh dương, tính từ tím, trạng từ xanh lá, loại khác vàng, chưa tra xong thì xám), có chú thích màu. Thẻ đang chọn đổi màu viền sang màu đậm của từ loại. Chữ luôn một dòng, không ngắt giữa từ, tự thu nhỏ cho vừa. Trong thẻ chỉ có chữ và nút xóa 🗑️ nằm cùng hàng (bấm là xóa luôn, không hỏi lại). Không có chức năng sửa từ. Ô tìm kiếm nằm cùng hàng với tiêu đề "Từ của bé" (màn hẹp thì xuống dòng riêng). Bên phải ô tìm kiếm có nút "Xóa nhiều": vào chế độ chọn, chạm thẻ để chọn/bỏ chọn (không phát âm, không kéo-thả, ẩn nút 🗑️), thanh nút "Chọn hết" (các từ đang hiện theo bộ lọc) · "Xóa (n)" (xóa luôn, không hỏi lại, rồi thoát) · "Xong" (thoát, bỏ chọn). Lúc nào cũng thêm được từ mới, từ trùng tự bỏ qua.
4. **Khối chi tiết**: không phải popup. Khối này thay chỗ phần tên app và khối thêm từ, có nút ✕ để quay lại. Bố cục ngang: [từ, phiên âm, nút nghe Mỹ/Anh] · [tag từ loại, nghĩa chính chữ to, các nghĩa phụ chữ nhỏ bên dưới] · [ảnh ở cuối bên phải]. Trên màn hình hẹp, chữ xếp thành một cột bên trái, ảnh vẫn nằm bên phải. Không có dòng nguồn phát âm, không có khối giải thích.
5. **Lưu** danh sách từ trong `localStorage`; kết quả tra cứu được cache trong `localStorage`; số lần bỏ qua khi luyện tập cũng lưu trong `localStorage`.
6. **Kéo-thả** để đổi vị trí từ: chuột rê quá 6px, cảm ứng nhấn giữ 0,2 giây. Tắt khi đang tìm kiếm.
7. **Khi không nghe được**: lần tra lỗi không bị giữ lại, bấm vào từ là tra lại. Không có tiếng (máy không có giọng đọc) thì hiện "🔇 Chưa có tiếng đọc". Từ sai chính tả thì hiện gợi ý của Oxford ("Có phải bé muốn viết: dishwasher"), chạm để sửa từ và nghe luôn. Oxford đổi sang từ gốc (beans → bean) thì phát tiếng đúng của từ đã nhập nếu có, không có thì phát tiếng từ gốc, và ghi "từ gốc: bean".
8. **Cuộn**: cả trang không cuộn, chỉ vùng danh sách từ cuộn.
9. **Luyện nói** và 10. **Luyện viết**: xem mục *Luyện tập* bên dưới.

## Luyện tập (luyện nói, luyện viết)

### Vào và ra
- Màn chính có 2 nút gọn **🎤 Luyện nói** và **✏️ Luyện viết** bên phải tiêu đề app. Màn hẹp: hai nút thay chỗ dòng tagline để `.top` không cao thêm. Danh sách rỗng thì hai nút bị khóa.
- App đổi màn bằng trạng thái `view: 'home' | 'speak' | 'write'`, không dùng router. Màn luyện chiếm cả màn hình: nút **←** quay về danh sách (không hỏi lại, lượt đang dở bị bỏ), thanh tiến độ tổ ong, một thẻ to ở giữa (xem *Giao diện màn luyện*).
- Từ dùng để luyện là các từ trong "Từ của bé".

### Chọn từ cho một lượt
- Danh sách có từ 15 từ trở lên: số từ của lượt là một số ngẫu nhiên trong 15–20, không vượt quá số từ đang có. Ít hơn 15 từ: lấy hết.
- Ưu tiên từ hay bị bỏ qua: sắp xếp theo số lần bỏ qua giảm dần (bằng nhau thì ngẫu nhiên), lấy đủ số từ, rồi trộn ngẫu nhiên thứ tự hiện.
- Số lần bỏ qua lưu trong `localStorage`, **riêng cho từng chế độ** (nói/viết), theo chữ của từ (không phân biệt hoa thường). Bỏ qua: +1. Làm đúng: về 0. Ghi ngay khi từ có kết quả. Xóa từ khỏi danh sách thì xóa luôn số liệu của từ đó.

### Thẻ và phản hồi chung
- **Đúng**: tiếng "tinh", thẻ trượt sang trái, thẻ kế tiếp hiện ra.
- **Sai**: tiếng "è", thẻ lắc nhẹ, bé làm lại cùng từ đó (không giới hạn số lần). Sai nhiều lần cũng không có gợi ý thêm: bé đã có nút nghe lại và bỏ qua.
- **Bỏ qua**: bé kéo thẻ sang trái, hoặc bấm nút nhỏ màu nhạt **Bỏ qua ⏭** dưới thẻ (làm giống hệt thao tác gạt). Thả khi đã kéo quá 1/3 chiều rộng thẻ (hoặc hất nhanh sang trái) thì thẻ trượt đi, sang từ kế tiếp. Chưa quá ngưỡng thì thẻ bật về chỗ cũ. Chỉ kéo được sang trái. Di chuyển dưới 10px tính là chạm, không phải kéo. Viết bằng pointer events, không dùng @dnd-kit.
- Tiếng "tinh" và "è" tạo bằng Web Audio API (không cần file âm thanh).
- Có `prefers-reduced-motion`: thay trượt/lắc bằng hiện mờ dần, vẫn phát tiếng.
- Nghe mẫu dùng lại `lookup` (có cache) + `playPronunciation` (Oxford → dictionaryapi.dev → giọng của trình duyệt). Không phát được thì hiện "🔇 Chưa có tiếng đọc".

### Luyện nói
- Thẻ hiện hình nhỏ ở trên (emoji 3D/ảnh từ tra cứu, như khối chi tiết) và chữ của từ thật to ở dưới, màu nền theo từ loại như thẻ ở màn chính. Từ chưa có hình thì chỉ hiện chữ. **Chạm vào thẻ** thì nghe mẫu.
- Dưới thẻ có nút **🎤** to. Bé bấm, nói, nhận dạng tự dừng khi bé im rồi chấm. Đang nghe thì nút đổi trạng thái (nhấp nháy). Đang phát mẫu thì không nghe.
- Nhận dạng bằng Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`), `lang = 'en-US'`, `maxAlternatives = 5`, không lấy kết quả tạm.
- **So khớp** (`matchesWord`, hàm thuần): chuẩn hóa cả hai phía (chữ thường, bỏ dấu câu, coi `-` và `'` như không có). Đúng khi một phương án bất kỳ có một từ trùng với từ cần đọc, hoặc cả phương án ghép liền (bỏ khoảng trắng) trùng với từ cần đọc (`ice cream` khớp `ice-cream`).
- **Từ đồng âm**: `speech.ts` có bảng vài chục cặp đồng âm thường gặp (bee/be, two/too/to, eye/I, knight/night…). Phương án trùng với từ đồng âm của từ cần đọc cũng tính đúng, vì máy nhận dạng không phân biệt được.
- Bị chấm sai thì hiện dòng nhỏ màu nhạt dưới thẻ "Máy nghe là: be" (phương án đầu tiên), mất đi khi bé nói lần sau.
- Không nghe thấy gì (`no-speech`, kết quả rỗng): không tính sai, không phát "è", hiện "Chưa nghe thấy, bé bấm 🎤 nói lại nhé".
- Trình duyệt không hỗ trợ nhận dạng (ví dụ Firefox): màn luyện nói hiện "Máy này chưa nghe được bé nói — hãy mở bằng Chrome hoặc Safari", vẫn nghe mẫu và bỏ qua được. Bé không cho phép dùng micro: hiện "Bé cần cho phép dùng micro".
- Giới hạn: chỉ kiểm tra được "máy nghe ra đúng từ đó không", không chấm độ chuẩn từng âm. Chrome gửi tiếng lên máy chủ của Google để nhận dạng, nên cần mạng.

### Luyện viết
- Thẻ trắng, không hiện từ. Góc trên có nút **🔊** (nghe lại) và nút **tẩy** (xóa hết chữ đã gõ).
- Giữa thẻ là ô gõ chữ to (nút Xong ✓ ngay dưới ô), tắt tự sửa và gợi ý của bàn phím: `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck={false}`. Bé bấm Enter hoặc nút **Xong ✓** để kiểm tra. Ô trống thì không kiểm tra.
- Thẻ hiện lên thì app tự đọc mẫu một lần. Âm thanh được "mở khóa" (`unlockAudio`) trong thao tác bấm vào màn luyện và mỗi lần bấm kiểm tra, để iPhone cho phát.
- So khớp: bỏ khoảng trắng hai đầu, không phân biệt hoa thường, phải trùng hoàn toàn (kể cả `-` và `'`). Không chấp nhận từ đồng âm.
- Không hiện số ô chữ hay gợi ý độ dài.
- Từ có từ đồng âm trong bảng (app đọc "two", bé có thể viết "too"): luôn hiện nghĩa tiếng Việt ("hai") trên thẻ để bé biết cần viết từ nào.
- Không phát được tiếng nào: hiện "🔇 Chưa có tiếng đọc" kèm hình và nghĩa tiếng Việt của từ làm gợi ý, không hiện chữ tiếng Anh.
- Sai: tiếng "è", thẻ lắc, ô gõ bị xóa trắng và giữ con trỏ trong ô.

### Kết quả
- Hết thẻ cuối (đúng hoặc bỏ qua) thì sang màn kết quả: điểm **% = số từ làm đúng / số từ của lượt**, làm tròn. Làm sai rồi làm lại đúng vẫn tính là đúng; chỉ từ bị bỏ qua là sai.
- Sao theo điểm: 3 ⭐ khi ≥ 90%, 2 ⭐ khi ≥ 60%, 1 ⭐ khi thấp hơn. Đạt 100% thì phát tiếng "tinh" dài hơn (Web Audio), không có pháo hoa.
- Bên dưới là các từ bị bỏ qua. Nhấn một từ thì mở lại thẻ của từ đó (cùng chế độ, có thể làm sai nhiều lần hoặc gạt đi để thôi). Làm đúng thì quay về màn kết quả và từ đó được đánh ✅. **Điểm không đổi.** Làm đúng ở đây cũng đưa số lần bỏ qua của từ về 0.
- Hai nút: **Luyện lượt mới** (chọn lại từ) và **Về danh sách**.
- Lượt đang làm dở không được lưu: tải lại trang hoặc rời app thì làm lại từ đầu (số lần bỏ qua của các từ đã làm vẫn còn vì ghi ngay).

### Giao diện màn luyện
- Dùng lại hệ thống sẵn có (Baloo 2, nền vàng kem chấm bi, viền `--shadow` 4px, bóng đổ đồ chơi, các biến màu). Không thêm font hay màu nền mới.
- Bố cục: một cột canh giữa, rộng tối đa 520px. Hàng trên: nút ← · tổ ong tiến độ · tên chế độ. Giữa: chồng thẻ. Dưới: nút chính (🎤 hoặc Xong ✓), rồi nút chữ nhỏ màu nhạt "Bỏ qua ⏭".
- **Tổ ong tiến độ** (điểm nhấn duy nhất): một hàng ô lục giác, mỗi từ một ô. Đúng: đầy mật `--sun`. Bỏ qua: rỗng, viền nhạt. Đang làm: viền đậm, nảy nhẹ. Có nhãn "3/18" cho trình đọc màn hình. Màn kết quả hiện lại tổ ong của cả lượt.
- **Chồng thẻ**: sau thẻ hiện tại ló ra mép thẻ kế tiếp (lệch, nghiêng nhẹ). Đúng: viền thẻ đổi `--green`, trượt trái 0,35s, thẻ sau tiến lên. Sai: viền đổi `--pink`, lắc ngang 3 nhịp trong 0,4s.
- **Thẻ luyện nói**: hình ở trên, chữ ở dưới cỡ `clamp(2.6rem, 12vw, 5rem)` đậm 800, một dòng, tự thu nhỏ bằng `FitText`. Nút 🎤 tròn 96px màu `--pink`; đang nghe có 2 vòng sóng tỏa ra và nhãn "Bé nói đi…". Dòng "Máy nghe là: …" nằm giữa thẻ và nút 🎤.
- **Thẻ luyện viết**: trắng, kẻ dòng mờ như vở ô li; ô gõ không khung, chữ to nằm trên dòng kẻ đậm ở giữa. Góc trên trái nút 🔊 (`--blue`), góc trên phải nút tẩy (hình SVG vẽ riêng). Nghĩa tiếng Việt (khi có) nằm dưới dòng viết. Nút Xong ✓ màu `--green`. Khi bàn phím điện thoại bật, thẻ thấp lại để nút Xong ✓ vẫn trong màn hình.
- **Màn kết quả**: hàng sao, số % to màu `--orange` có bóng chữ như tiêu đề app, dòng "Bé làm đúng 15 trên 18 từ", tổ ong, "Luyện lại nhé:" với các thẻ từ nhỏ (làm lại đúng thì có ✅), hai nút. Không bỏ qua từ nào thì thay danh sách bằng "Bé làm đúng hết rồi! 🐝".
- Chuyển động chỉ để trả lời thao tác của bé (trượt, lắc, đổ mật, vòng sóng); không có gì tự chạy khi mở màn.

### Cấu trúc code
- `src/lib/practice.ts` (thuần, có test): `pickRound(words, skipCounts, random)`, reducer trạng thái lượt (`correct` / `wrong` / `skip` / `retry` → `results`), `score()`.
- `src/lib/speech.ts`: bọc `SpeechRecognition` (hỗ trợ không, nghe một lần → phương án hoặc lỗi), `matchesWord` và bảng từ đồng âm (có test).
- `src/lib/sfx.ts`: tiếng tinh / è bằng Web Audio.
- `src/lib/storage.ts`: thêm đọc/ghi số lần bỏ qua theo chế độ; xóa từ thì dọn số liệu.
- `src/components/PracticeScreen.tsx` (khung chung: tiến độ, vuốt thẻ, kết quả), `SpeakCard.tsx`, `WriteCard.tsx`.
- Test: logic thuần bằng dữ liệu giả, màn luyện bằng Testing Library với `SpeechRecognition` giả lập. Micro và iPhone thử trên máy thật.

## Nguồn dữ liệu (đều gọi từ trình duyệt)
| Dữ liệu | Nguồn chính | Dự phòng |
|---|---|---|
| Phát âm, từ loại, phiên âm, định nghĩa EN | Trang Oxford `/search/english/direct/?q=` lấy qua hàm `/api/oxford` của app trên Vercel (production), dự phòng bằng CORS proxy (allorigins, tự đổi proxy khi lỗi) và đọc `data-src-mp3`, `.pos`, `.phon`, `.def` | dictionaryapi.dev; cuối cùng là Web Speech API |
| Nghĩa tiếng Việt | Google Translate `translate_a/single` (`dt=t`, `dt=bd` cho nghĩa theo từ loại) | – |
| Hình | Emoji 3D Fluent (`@lobehub/fluent-emoji-3d` qua jsDelivr), tra bằng bảng `src/data/emoji-index.json` | Ảnh Wikipedia, chỉ cho danh từ, bỏ trang disambiguation hoặc trang về phim, địa danh, người…; cuối cùng là ảnh chủ đề của Oxford. Không có thì để ô trống |

File mp3 Oxford phát trực tiếp bằng `<audio>` (không vướng CORS). Trang Oxford thì phải qua proxy vì trình duyệt chặn CORS.

## Giao diện
- Font **Baloo 2** (bo tròn, có tiếng Việt). Nền vàng kem, thẻ từ nhiều màu kẹo, bo góc lớn, đổ bóng dày kiểu đồ chơi.
- Vùng bấm ≥ 48px, chữ to, chủ yếu dùng biểu tượng + chữ tiếng Việt ngắn.
- Chữ trong thẻ từ không dùng viền chữ (`-webkit-text-stroke`), vì với Baloo 2 viền này tạo ra vạch ngang cắt qua giữa chữ cái.
- Điện thoại: lưới 2 cột. Máy tính: lưới nhiều cột. Hộp chọn từ trong ảnh (OCR) vẫn là bottom sheet hoặc modal.
- Hiệu ứng nảy nhẹ khi bấm; tôn trọng `prefers-reduced-motion`.

## Công nghệ
Vite + React + TypeScript, Vitest + Testing Library, tesseract.js. PWA bằng manifest + service worker đơn giản.

## Giới hạn đã biết
- Production chạy trên Vercel với một hàm serverless duy nhất (`/api/oxford`, chỉ nhận một từ, không phải proxy mở) vì proxy công cộng corsfix không cho domain chưa đăng ký. Mọi thứ khác vẫn chạy trong trình duyệt.
- Ảnh ưu tiên thứ gần gũi với trẻ em và đời sống hiện tại: emoji 3D trước, ảnh bách khoa sau (ảnh Wikipedia có thể cũ, ví dụ máy tính thế hệ đầu). Bảng emoji dựng bằng `node scripts/build-emoji-index.mjs`; sửa tay ở `scripts/emoji-overrides.json`.
- Luyện nói dựa vào Web Speech API: Firefox không có; Chrome cần mạng. Chưa kiểm chứng: trên iPhone, nhận dạng giọng nói có thể không chạy khi app mở từ biểu tượng ngoài màn hình chính (PWA) dù chạy trong Safari. Cần thử trên máy thật.
