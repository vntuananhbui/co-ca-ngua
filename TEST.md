# Chạy test

Yêu cầu: Node.js >= 20 (đã chạy trên v24.22.3). Không cần cài gói nào.

```bash
cd co-ca-ngua
node --test test/*.test.js
```

- `test/game.test.js`: unit test engine luật (`js/game.js`) + hình học bàn cờ (`js/board.js`). Xúc xắc inject bằng `rollDice(state, value)` hoặc `createGame(n, { rng })`. Phủ AC1–AC5, kèm mô phỏng 200 ván seed cố định.
- `test/ui-smoke.test.js`: smoke test giao diện headless — DOM giả tối thiểu, nạp đúng các `<script>` trong `index.html`, bấm chọn 2/3/4 người, tung/đi đến khi thắng, bấm Chơi lại; kiểm không có `console.error`.

Gói cài thêm: không có.
