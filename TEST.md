# Chạy test

Yêu cầu: Node.js >= 20 (đã chạy trên v24.22.3). Không cần cài gói nào.

```bash
cd co-ca-ngua
node --test test/*.test.js
```

- `test/game.test.js`: unit test engine luật (`js/game.js`) + hình học bàn cờ (`js/board.js`). Xúc xắc inject bằng `rollDice(state, value)` hoặc `createGame(n, { rng })`. Phủ AC1–AC5, kèm mô phỏng 200 ván seed cố định.
- `test/game.test.js` còn có test `pathCells` (đường nhảy từng ô cho animation).
- `test/ui-smoke.test.js`: smoke test giao diện headless — DOM giả tối thiểu, nạp đúng các `<script>` trong `index.html`, bấm chọn 2/3/4 người, tung/đi đến khi thắng, bấm Chơi lại; kiểm không có `console.error`. Ván chơi trọn chạy **có bật animation** với đồng hồ giả (`setTimeout` do test điều khiển); các test `ANIM …` kiểm xúc xắc lắc (≥3 mặt, dừng đúng giá trị engine), quân nhảy đúng từng ô theo `board.js`, quân bị đá rung rồi về chuồng, khoá UI trong lúc animation, người thắng hiện sau animation, `prefers-reduced-motion`.

Gói cài thêm: không có.

## Kết quả lần chạy gần nhất (nhánh feature/animation)

Lệnh: `node --test test/*.test.js` (Node v24.22.3), 40 test = 31 cũ + 9 mới.

```
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## Chạy thử bằng tay
1. Mở `index.html` bằng trình duyệt (double-click, không cần server), chọn số người.
2. Bấm "Tung xúc xắc" (hoặc Space): xúc xắc rung ~0.7s, đổi mặt liên tục rồi dừng ở giá trị thật; nút tung bị mờ trong lúc lắc.
3. Ra 6 → bấm quân sáng viền: quân nhảy 1 bước ra ô xuất phát. Các lượt sau quân nhảy lần lượt từng ô (~0.18s/ô), qua góc và rẽ vào đường đích.
4. Đi vào ô có quân đối thủ (không phải ô ★): quân bị đá rung/mờ rồi về chuồng.
5. Bật "giảm chuyển động" của hệ điều hành (prefers-reduced-motion) → mọi thứ cập nhật tức thì như bản cũ.
6. Tuỳ chỉnh tốc độ khi debug: trong console gõ `LUDO_ANIM = { diceMs: 1500, stepMs: 400 }` hoặc `LUDO_ANIM = false` để tắt.
