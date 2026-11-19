// Unit test cho engine luật chơi. Chạy: node --test test/   (Node >= 18, không cần cài gói)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/game.js');
const B = require('../js/board.js');

const YARD = E.YARD, GOAL = E.GOAL;
const tokensOf = (s, color) => s.players.find((p) => p.color === color).tokens;

// ---------- Khởi tạo (AC1) ----------
test('AC1: tạo ván 2/3/4 người, mỗi người 4 quân trong chuồng, lượt đầu là Đỏ', () => {
  for (const n of [2, 3, 4]) {
    const s = E.createGame(n);
    assert.equal(s.players.length, n);
    s.players.forEach((p) => assert.deepEqual(p.tokens, [YARD, YARD, YARD, YARD]));
    assert.equal(s.players[0].color, 'red');
    assert.equal(s.phase, 'roll');
  }
  assert.deepEqual(E.createGame(2).players.map((p) => p.color), ['red', 'yellow']);
  assert.throws(() => E.createGame(1));
  assert.throws(() => E.createGame(5));
});

// ---------- AC2: xuất quân, tự qua lượt, đi đúng số ô ----------
test('AC2: cả 4 quân trong chuồng, không ra 6 → tự qua lượt', () => {
  for (let v = 1; v <= 5; v++) {
    const s = E.createGame(4);
    const r = E.rollDice(s, v);
    assert.equal(r.passed, true);
    assert.deepEqual(r.movable, []);
    assert.equal(s.current, 1, 'sang lượt người kế');
    assert.equal(s.phase, 'roll');
  }
});

test('AC2: lượt vòng quanh, người cuối qua lượt thì về người đầu', () => {
  const s = E.createGame(3);
  E.rollDice(s, 1); E.rollDice(s, 2); E.rollDice(s, 3);
  assert.equal(s.current, 0);
});

test('AC2: ra 6 → xuất quân ra ô xuất phát của màu', () => {
  const s = E.createGame(4);
  const r = E.rollDice(s, 6);
  assert.equal(r.passed, false);
  assert.deepEqual(r.movable, [0, 1, 2, 3]);
  const m = E.moveToken(s, 2);
  assert.equal(m.from, YARD);
  assert.equal(m.to, 0);
  assert.deepEqual(tokensOf(s, 'red'), [YARD, YARD, 0, YARD]);
  assert.equal(E.absolutePosition('red', 0), E.START.red);
  assert.equal(E.absolutePosition('blue', 0), E.START.blue);
});

test('AC2: quân đi đúng số ô bằng giá trị xúc xắc', () => {
  const s = E.createGame(2);
  tokensOf(s, 'red')[0] = 3;
  E.rollDice(s, 4);
  assert.deepEqual(E.movableTokens(s), [0], 'chỉ quân trên bàn được đi khi không ra 6');
  E.moveToken(s, 0);
  assert.equal(tokensOf(s, 'red')[0], 7);
  assert.equal(s.current, 1);
});

test('AC2: quân trong chuồng không được chọn khi không ra 6; chọn sai bị từ chối', () => {
  const s = E.createGame(2);
  tokensOf(s, 'red')[0] = 3;
  E.rollDice(s, 2);
  assert.throws(() => E.moveToken(s, 1), /không hợp lệ/);
  assert.equal(s.phase, 'move', 'state không đổi khi chọn sai');
});

test('AC2: chưa tung thì không đi được, đang chờ đi thì không tung lại được', () => {
  const s = E.createGame(2);
  assert.throws(() => E.moveToken(s, 0));
  E.rollDice(s, 6);
  assert.throws(() => E.rollDice(s, 3));
});

test('xúc xắc inject qua rng: giá trị luôn 1..6', () => {
  const seq = [0, 0.1667, 0.5, 0.9999];
  let i = 0;
  const s = E.createGame(4, { rng: () => seq[i++] });
  const vals = [];
  for (let k = 0; k < seq.length; k++) { vals.push(E.rollDice(s).value); if (s.phase === 'move') E.moveToken(s, E.movableTokens(s)[0]); }
  assert.deepEqual(vals, [1, 2, 4, 6]);
  assert.throws(() => E.rollDice(E.createGame(2), 7));
  assert.throws(() => E.rollDice(E.createGame(2), 0));
});

// ---------- AC3: đá quân / ô an toàn ----------
test('AC3: đáp ô thường có quân đối thủ → đá về chuồng', () => {
  const s = E.createGame(4);
  // Đỏ ở tiến độ 2 (ô tuyệt đối 2); Xanh lá đặt ở ô tuyệt đối 5 = tiến độ (5-13+52)%52 = 44
  tokensOf(s, 'red')[0] = 2;
  tokensOf(s, 'green')[1] = 44;
  assert.equal(E.absolutePosition('green', 44), 5);
  E.rollDice(s, 3);
  const m = E.moveToken(s, 0);
  assert.deepEqual(m.captured, [{ color: 'green', token: 1 }]);
  assert.equal(tokensOf(s, 'green')[1], YARD);
  assert.equal(tokensOf(s, 'red')[0], 5);
});

test('AC3: đá cả chồng quân đối thủ trên cùng ô thường', () => {
  const s = E.createGame(4);
  tokensOf(s, 'red')[0] = 2;
  tokensOf(s, 'green')[0] = 44;
  tokensOf(s, 'green')[2] = 44;
  E.rollDice(s, 3);
  const m = E.moveToken(s, 0);
  assert.equal(m.captured.length, 2);
  assert.deepEqual(tokensOf(s, 'green'), [YARD, YARD, YARD, YARD]);
});

test('AC3: ô sao an toàn → không đá, hai quân cùng tồn tại', () => {
  const s = E.createGame(4);
  tokensOf(s, 'red')[0] = 5;
  // ô tuyệt đối 8 (ô sao) với Vàng: tiến độ (8-26+52)%52 = 34
  tokensOf(s, 'yellow')[0] = 34;
  assert.ok(E.isSafeSquare(8));
  E.rollDice(s, 3);
  const m = E.moveToken(s, 0);
  assert.deepEqual(m.captured, []);
  assert.equal(E.absolutePosition('red', tokensOf(s, 'red')[0]), 8);
  assert.equal(E.absolutePosition('yellow', tokensOf(s, 'yellow')[0]), 8);
});

test('AC3: ô xuất phát của đối thủ là ô an toàn → không đá', () => {
  const s = E.createGame(4);
  tokensOf(s, 'red')[0] = 10;
  tokensOf(s, 'green')[0] = 0; // Xanh lá đứng ở ô xuất phát của mình (tuyệt đối 13)
  E.rollDice(s, 3);
  const m = E.moveToken(s, 0);
  assert.deepEqual(m.captured, []);
  assert.equal(tokensOf(s, 'green')[0], 0);
});

test('AC3: xuất quân ra ô xuất phát có quân đối thủ → không đá', () => {
  const s = E.createGame(4);
  tokensOf(s, 'blue')[0] = 13; // Xanh dương ở tuyệt đối (39+13)%52 = 0 = ô xuất phát Đỏ
  E.rollDice(s, 6);
  const m = E.moveToken(s, 0);
  assert.deepEqual(m.captured, []);
  assert.equal(tokensOf(s, 'blue')[0], 13);
});

test('AC3: quân cùng màu chồng lên nhau, không tự đá', () => {
  const s = E.createGame(2);
  tokensOf(s, 'red')[0] = 2;
  tokensOf(s, 'red')[1] = 5;
  E.rollDice(s, 3);
  E.moveToken(s, 0);
  assert.deepEqual(tokensOf(s, 'red').slice(0, 2), [5, 5]);
});

test('AC3: quân trong đường đích không bị đá', () => {
  const s = E.createGame(4);
  tokensOf(s, 'red')[0] = 52; // đường đích của Đỏ
  tokensOf(s, 'blue')[0] = 10; // tuyệt đối 49
  // Xanh dương lượt 4; cho 3 người đầu qua lượt
  E.rollDice(s, 1); // đỏ đi được 52→53? có — đi luôn
  E.moveToken(s, 0);
  E.rollDice(s, 1); E.rollDice(s, 1);
  assert.equal(E.currentPlayer(s).color, 'blue');
  E.rollDice(s, 3);
  const m = E.moveToken(s, 0);
  assert.deepEqual(m.captured, []);
  assert.equal(tokensOf(s, 'red')[0], 53);
});

// ---------- AC4: ra 6 tung tiếp ----------
test('AC4: ra 6 và đi xong → cùng người tung tiếp', () => {
  const s = E.createGame(4);
  E.rollDice(s, 6);
  const m = E.moveToken(s, 0);
  assert.equal(m.extraTurn, true);
  assert.equal(s.current, 0);
  assert.equal(s.phase, 'roll');
  E.rollDice(s, 6);
  E.moveToken(s, 0);
  assert.equal(s.current, 0, 'ra 6 lần nữa vẫn tung tiếp');
  E.rollDice(s, 2);
  E.moveToken(s, 0);
  assert.equal(s.current, 1, 'không ra 6 → sang người kế');
  assert.equal(tokensOf(s, 'red')[0], 8);
});

test('AC4: ra 6 nhưng không có nước đi hợp lệ → qua lượt', () => {
  const s = E.createGame(2);
  s.players[0].tokens = [GOAL, GOAL, GOAL, 53];
  const r = E.rollDice(s, 6);
  assert.equal(r.passed, true);
  assert.equal(s.current, 1);
});

// ---------- AC5: vào đích, thắng ----------
test('AC5: từ ô vòng cuối rẽ vào đường đích của màu mình', () => {
  const s = E.createGame(2);
  tokensOf(s, 'red')[0] = 49;
  E.rollDice(s, 3);
  E.moveToken(s, 0);
  assert.equal(tokensOf(s, 'red')[0], 52);
  assert.equal(E.absolutePosition('red', 52), null, 'đã rời vòng ngoài');
});

test('AC5: vào đích cần đúng số bước; số lớn hơn thì quân đó không đi được', () => {
  assert.equal(E.canMoveToken(53, 3), true);
  assert.equal(E.canMoveToken(53, 4), false);
  assert.equal(E.canMoveToken(GOAL, 1), false);
  const s = E.createGame(2);
  s.players[0].tokens = [53, 10, YARD, YARD];
  E.rollDice(s, 4);
  assert.deepEqual(E.movableTokens(s), [1], 'chỉ quân đi hợp lệ được chọn');
  assert.throws(() => E.moveToken(s, 0));
});

test('AC5: chỉ còn nước vượt đích → tự qua lượt', () => {
  const s = E.createGame(2);
  s.players[0].tokens = [GOAL, GOAL, 54, GOAL];
  const r = E.rollDice(s, 5);
  assert.equal(r.passed, true);
  assert.equal(s.current, 1);
  assert.deepEqual(s.players[0].tokens, [GOAL, GOAL, 54, GOAL]);
});

test('AC5: đúng số bước → quân về đích', () => {
  const s = E.createGame(2);
  s.players[0].tokens = [54, YARD, YARD, YARD];
  E.rollDice(s, 2);
  const m = E.moveToken(s, 0);
  assert.equal(m.finished, true);
  assert.equal(s.players[0].tokens[0], GOAL);
  assert.equal(s.winner, null);
});

test('AC5: đủ 4 quân về đích → đúng người thắng, ván kết thúc', () => {
  const s = E.createGame(4);
  // Đỏ, Xanh lá qua lượt; Vàng có 3 quân về đích, quân cuối còn 2 bước
  s.players[2].tokens = [GOAL, GOAL, 54, GOAL];
  s.players[0].tokens = [GOAL, GOAL, GOAL, 50]; // Đỏ gần thắng nhưng tung trượt
  E.rollDice(s, 1); E.moveToken(s, 3); // Đỏ 50 → 51
  E.rollDice(s, 3); // Xanh lá qua lượt
  assert.equal(E.currentPlayer(s).color, 'yellow');
  E.rollDice(s, 2);
  const m = E.moveToken(s, 2);
  assert.equal(m.winner, 'yellow');
  assert.equal(s.winner, 'yellow');
  assert.equal(s.phase, 'over');
  assert.throws(() => E.rollDice(s, 3), 'ván đã kết thúc thì không tung nữa');
});

test('AC5: thắng bằng nước ra 6 vẫn kết thúc ván (không tung tiếp)', () => {
  const s = E.createGame(2);
  s.players[0].tokens = [GOAL, GOAL, GOAL, 50];
  E.rollDice(s, 6);
  const m = E.moveToken(s, 3);
  assert.equal(m.winner, 'red');
  assert.equal(m.extraTurn, false);
  assert.equal(s.phase, 'over');
});

test('AC5: chơi lại = tạo ván mới sạch', () => {
  const s = E.createGame(2);
  s.players[0].tokens = [GOAL, GOAL, GOAL, GOAL];
  const s2 = E.createGame(2);
  assert.deepEqual(s2.players[0].tokens, [YARD, YARD, YARD, YARD]);
  assert.equal(s2.winner, null);
});

// ---------- Mô phỏng nhiều ván với xúc xắc ngẫu nhiên có seed ----------
test('mô phỏng 200 ván ngẫu nhiên: luôn kết thúc, có đúng 1 người thắng, bất biến giữ đúng', () => {
  let seed = 12345;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let g = 0; g < 200; g++) {
    const n = 2 + (g % 3);
    const s = E.createGame(n, { rng });
    let steps = 0;
    while (s.phase !== 'over') {
      assert.ok(++steps < 20000, 'ván không kết thúc');
      const r = E.rollDice(s);
      if (!r.passed) E.moveToken(s, r.movable[Math.floor(rng() * r.movable.length)]);
      for (const p of s.players) for (const t of p.tokens) assert.ok(t >= YARD && t <= GOAL);
    }
    const w = s.players.find((p) => p.color === s.winner);
    assert.ok(w.tokens.every((t) => t === GOAL));
    assert.equal(s.players.filter((p) => p.tokens.every((t) => t === GOAL)).length, 1);
  }
});

// ---------- Hình học bàn cờ ----------
test('bàn cờ: 52 ô vòng ngoài không trùng, liền kề nhau, khép vòng', () => {
  assert.equal(B.RING.length, 52);
  assert.equal(new Set(B.RING.map((c) => c.join())).size, 52);
  for (let i = 0; i < 52; i++) {
    const [a, b] = [B.RING[i], B.RING[(i + 1) % 52]];
    const d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    assert.ok(d === 1 || (d === 2 && a[0] !== b[0] && a[1] !== b[1]), `ô ${i} → ${i + 1} không liền kề`);
  }
});

test('bàn cờ: đường đích mỗi màu 6 ô, nối tiếp ô vòng cuối, ô cuối ở tâm', () => {
  for (const c of E.COLORS) {
    assert.equal(B.HOME[c].length, 6);
    const last = B.RING[E.absolutePosition(c, E.LAST_RING)];
    const first = B.HOME[c][0];
    assert.equal(Math.abs(last[0] - first[0]) + Math.abs(last[1] - first[1]), 1, `${c}: đường đích không nối ô vòng cuối`);
    const g = B.HOME[c][5];
    assert.ok(g[0] >= 6 && g[0] <= 8 && g[1] >= 6 && g[1] <= 8, `${c}: ô đích không ở tâm`);
    assert.deepEqual(B.cellOf(E, c, GOAL, 0), g);
    assert.deepEqual(B.cellOf(E, c, YARD, 3), B.YARD_SLOTS[c][3]);
  }
});
