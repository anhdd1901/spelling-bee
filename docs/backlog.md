# Backlog

- Chưa thử trên iPhone/Android thật (tự phát âm sau khi tải, camera).
- Âm thanh của dictionaryapi.dev (nguồn dự phòng, tiếng đúng cho số nhiều như "beans") đang lỗi 502; hiện phát tiếng Oxford của từ gốc thay thế. Tìm nguồn khác nếu cần đọc đúng dạng số nhiều.
- Thử luyện nói trên iPhone/Android thật, kể cả khi mở từ biểu tượng ngoài màn hình chính (PWA); thử micro thật (môi trường tự động chỉ test bằng giả lập).
- minor (deferred) plan-1: test thêm các ngưỡng `swipeDecision` (dx=-100/width 300, v=-0.5, dx=-30), tie-break của `pickRound`, `stop()` chặt hơn trong speech.test, `onresult` rỗng, cấu trúc `HOMOPHONES`, đường hất nhanh/pointercancel của `SwipeCard`, tần số/gain của sfx, `unlockAudio` khi bấm Xong/🔊, lượt mới đọc lại số lần bỏ qua.
- minor (deferred) plan-1: `wrong()` gọi lại trong 400ms không lắc lại; ngón tay thứ hai ghi đè thao tác kéo trong `SwipeCard`.
- minor (deferred) plan-1: CSS luyện tập còn màu cứng (#fffdf3, #cfc8e6, #cfe3f7, #e0daf0, #dff7ee, #fff3b0) và viền 3px ở `.icon-btn`/`.chip-btn`; `.speak-card` background #fff thừa; vòng sóng micro khi giảm chuyển động thành viền tĩnh.
- minor (deferred) plan-1: `SpeakCard` và `WriteCard` lặp khoảng 20 dòng (settled/mounted/noSound/leave/skip), có thể gom thành hook.
- minor (deferred) plan-1: iOS — lần đọc mẫu sau khi tra từ xong chạy ngoài thao tác bấm, dựa vào `unlockAudio` đã mở khóa trước đó.
