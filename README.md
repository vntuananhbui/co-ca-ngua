# Cờ cá ngựa (web tĩnh)

Mở thẳng `index.html` bằng trình duyệt là chơi (không build, không backend). Pass-and-play 2–4 người, 1 xúc xắc, 4 quân/người.

## Luật đã chốt
- Bàn: vòng ngoài 52 ô; mỗi màu có đường đích 6 ô (5 ô màu + ô đích cuối ở tâm bàn). Thứ tự lượt: Đỏ → Xanh lá → Vàng → Xanh dương (2 người: Đỏ & Vàng; 3 người: Đỏ, Xanh lá, Vàng).
- Tung 6 mới xuất quân ra ô xuất phát của màu mình. Ra 6 (và đi xong) được tung tiếp; không giới hạn số lần 6 liên tiếp.
- Đi vào ô thường có quân đối thủ → đá **tất cả** quân đối thủ ở ô đó về chuồng. Ô an toàn (không đá, quân cùng tồn tại): 4 ô xuất phát + 4 ô sao ★ (cách ô xuất phát 8 ô). Quân cùng màu được chồng nhau. Quân trong đường đích không bị đá.
- Vào ô đích cuối phải đúng số bước; quân nào đi quá đích thì không được chọn.
- Không có nước đi hợp lệ (kể cả khi ra 6) → tự qua lượt. Chỉ quân đi hợp lệ mới bấm được.
- Ai đưa đủ 4 quân về đích trước thắng; ván dừng ngay (kể cả khi nước thắng là 6). Có nút Chơi lại / Đổi số người.
- Không áp dụng: thưởng lượt khi đá quân/về đích, phạt ba lần 6, chặn đường bằng chồng quân.

## Cấu trúc
- `js/game.js` — engine luật, không phụ thuộc DOM (dùng được cả trong Node).
- `js/board.js` — toạ độ lưới 15×15 của các ô.
- `js/ui.js`, `css/style.css`, `index.html` — giao diện.
- Test: xem `TEST.md`.
