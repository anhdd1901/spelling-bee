# Spelling Bee: thiết kế

## Mục tiêu
Web app chỉ có frontend (không backend) cho trẻ 5–10 tuổi: nhập từ tiếng Anh, bấm vào từ để nghe phát âm (lấy từ Oxford Learner's Dictionaries) và xem thẻ chi tiết (từ, từ loại, nghĩa tiếng Việt, hình minh họa). Dùng tốt trên cả máy tính lẫn điện thoại (responsive + cài được như app PWA).

## Tính năng
1. **Nhập từ bằng bàn phím**: ô nhập lớn, Enter hoặc nút "Thêm". Nhập nhiều từ cách nhau bằng dấu phẩy, khoảng trắng hay xuống dòng cũng được.
2. **Nhập từ ảnh**: nút "Chụp ảnh" (camera trên điện thoại, `capture="environment"`) và "Tải ảnh lên". OCR bằng tesseract.js (chạy ngay trong trình duyệt). Các từ đọc được hiện thành chip có thể chọn hoặc bỏ chọn; bấm "Thêm các từ đã chọn".
3. **Danh sách từ ("Từ của bé")**: mỗi từ là một thẻ, màu nền theo từ loại (danh từ cam, động từ xanh dương, tính từ tím, trạng từ xanh lá, loại khác vàng, chưa tra xong thì xám), có chú thích màu. Thẻ đang chọn đổi màu viền sang màu đậm của từ loại. Chữ luôn một dòng, không ngắt giữa từ, tự thu nhỏ cho vừa. Trong thẻ chỉ có chữ và nút xóa 🗑️ nằm cùng hàng (có hỏi lại trước khi xóa). Không có chức năng sửa từ. Ô tìm kiếm nằm cùng hàng với tiêu đề "Từ của bé". Lúc nào cũng thêm được từ mới, từ trùng tự bỏ qua.
4. **Khối chi tiết**: không phải popup. Khối này thay chỗ phần tên app và khối thêm từ, có nút ✕ để quay lại. Bố cục ngang: [từ, phiên âm, nút nghe Mỹ/Anh] · [tag từ loại, nghĩa chính chữ to, các nghĩa phụ chữ nhỏ bên dưới] · [ảnh ở cuối bên phải]. Trên màn hình hẹp, chữ xếp thành một cột bên trái, ảnh vẫn nằm bên phải. Không có dòng nguồn phát âm, không có khối giải thích.
5. **Lưu** danh sách từ trong `localStorage`; kết quả tra cứu được cache trong `localStorage`.
6. **Kéo-thả** để đổi vị trí từ: chuột rê quá 6px, cảm ứng nhấn giữ 0,2 giây. Tắt khi đang tìm kiếm.
7. **Khi không nghe được**: lần tra lỗi không bị giữ lại, bấm vào từ là tra lại. Không có tiếng (máy không có giọng đọc) thì hiện "🔇 Chưa có tiếng đọc". Từ sai chính tả thì hiện gợi ý của Oxford ("Có phải bé muốn viết: dishwasher"), chạm để sửa từ và nghe luôn. Oxford đổi sang từ gốc (beans → bean) thì phát tiếng đúng của từ đã nhập nếu có, không có thì phát tiếng từ gốc, và ghi "từ gốc: bean".
8. **Cuộn**: cả trang không cuộn, chỉ vùng danh sách từ cuộn.

## Nguồn dữ liệu (đều gọi từ trình duyệt)
| Dữ liệu | Nguồn chính | Dự phòng |
|---|---|---|
| Phát âm, từ loại, phiên âm, định nghĩa EN | Trang Oxford `/search/english/direct/?q=` lấy qua CORS proxy (allorigins, tự đổi proxy khi lỗi) và đọc `data-src-mp3`, `.pos`, `.phon`, `.def` | dictionaryapi.dev; cuối cùng là Web Speech API |
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
- Phụ thuộc CORS proxy công cộng: nếu mọi proxy hỏng thì dùng dictionaryapi.dev + giọng máy.
- Ảnh ưu tiên thứ gần gũi với trẻ em và đời sống hiện tại: emoji 3D trước, ảnh bách khoa sau (ảnh Wikipedia có thể cũ, ví dụ máy tính thế hệ đầu). Bảng emoji dựng bằng `node scripts/build-emoji-index.mjs`; sửa tay ở `scripts/emoji-overrides.json`.
