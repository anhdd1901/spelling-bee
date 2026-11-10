# Spelling Bee

Web app (chỉ có frontend) giúp trẻ 5–10 tuổi học từ vựng tiếng Anh:

- Nhập từ bằng bàn phím (một hoặc nhiều từ cùng lúc), hoặc **chụp/tải ảnh** để app tự đọc chữ (OCR ngay trong trình duyệt).
- Chạm vào từ để **nghe phát âm của Oxford Learner's Dictionaries** (giọng Mỹ/Anh) và xem thẻ chi tiết: từ loại, nghĩa tiếng Việt, giải thích, hình minh họa.
- Sửa, xóa, thêm từ bất cứ lúc nào; danh sách được lưu trên máy.
- Dùng tốt trên máy tính lẫn điện thoại, cài được như app (PWA).

```bash
npm install
npm run dev        # http://localhost:5173
npx vitest run     # test
npm run build      # bản production trong dist/
```

Bản build trong `dist/` là web tĩnh, đưa lên Netlify, Vercel, GitHub Pages… đều được. Chi tiết thiết kế xem [spec](docs/superpowers/specs/2026-11-10-spelling-kids-design.md).
