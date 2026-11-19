// Smoke test giao diện không cần trình duyệt: DOM giả tối thiểu, nạp đúng index.html + 3 script như trình duyệt,
// rồi bấm nút như người chơi đến khi có người thắng. Chạy: node --test test/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

class El {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.children = []; this.parent = null; this.listeners = {};
    this.dataset = {}; this.style = {}; this.attrs = {};
    this.className = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.id = '';
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') this.className = v;
      else if (k === 'id') this.id = v;
      else if (k === 'hidden') this.hidden = true;
      else if (k.startsWith('data-')) this.dataset[k.slice(5)] = v;
      else this.attrs[k] = v;
    }
  }
  set innerHTML(v) { this.children.forEach((c) => (c.parent = null)); this.children = []; this._html = v; }
  get innerHTML() { return this._html || ''; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } }
  setAttribute(k, v) { this.attrs[k] = v; }
  get offsetWidth() { return 10; }
  get classList() {
    const el = this;
    const list = () => el.className.split(/\s+/).filter(Boolean);
    return {
      add: (...c) => { el.className = [...new Set([...list(), ...c])].join(' '); },
      remove: (...c) => { el.className = list().filter((x) => !c.includes(x)).join(' '); },
      contains: (c) => list().includes(c)
    };
  }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  click() { if (this.disabled) return; (this.listeners.click || []).forEach((f) => f({ target: this })); }
  *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
  matches(sel) {
    if (sel.startsWith('.')) return sel.slice(1).split('.').every((c) => this.className.split(/\s+/).includes(c));
    const m = sel.match(/^\[data-([\w-]+)\]$/);
    if (m) return this.dataset[m[1]] !== undefined;
    return this.tagName === sel.toUpperCase();
  }
  querySelectorAll(sel) { return [...this.walk()].filter((e) => e.matches(sel)); }
}

// Đồng hồ giả: setTimeout chỉ chạy khi test gọi tick/runAll.
function fakeClock() {
  let now = 0, seq = 0; const q = [];
  return {
    setTimeout(fn, ms) { q.push({ at: now + (ms || 0), seq: seq++, fn }); },
    pending: () => q.length,
    tick() {
      if (!q.length) return false;
      q.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const t = q.shift(); now = t.at; t.fn(); return true;
    },
    runAll(limit = 10000) { let n = 0; while (this.tick()) assert.ok(++n < limit, 'timer không dừng'); return n; },
    get now() { return now; }
  };
}

// opts.anim: undefined = tắt animation (không có setTimeout), 'on' = bật với đồng hồ giả, 'reduced' = prefers-reduced-motion
function loadPage(opts = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const body = new El('body');
  // Dựng cây phẳng từ các thẻ mở có id/class/data-* trong index.html (đủ cho ui.js tìm theo id/selector)
  const tagRe = /<(\w+)([^>]*)>/g; let m;
  const scripts = [];
  while ((m = tagRe.exec(html))) {
    const attrs = {};
    m[2].replace(/([\w-]+)(?:="([^"]*)")?/g, (_, k, v) => { attrs[k] = v === undefined ? '' : v; });
    if (m[1] === 'script') { scripts.push(attrs.src); continue; }
    if (['html', 'head', 'meta', 'link', 'title', 'body'].includes(m[1])) continue;
    body.appendChild(new El(m[1], attrs));
  }
  const errors = [];
  const doc = {
    body, activeElement: body, listeners: {},
    getElementById: (id) => [...body.walk()].find((e) => e.id === id) || null,
    querySelectorAll: (s) => body.querySelectorAll(s),
    createElement: (t) => new El(t),
    addEventListener() {}
  };
  const clock = fakeClock();
  const win = { document: doc, console: { log() {}, warn: (...a) => errors.push(a.join(' ')), error: (...a) => errors.push(a.join(' ')) }, Math, Number, Array, Object };
  win.window = win; win.self = win;
  if (opts.anim) {
    win.setTimeout = clock.setTimeout;
    win.matchMedia = (q) => ({ matches: opts.anim === 'reduced' && /reduce/.test(q) });
  }
  const ctx = vm.createContext(win);
  for (const src of scripts) vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), ctx, { filename: src });
  return { doc, win, errors, scripts, clock };
}

test('UI: index.html nạp đúng 3 script, không lỗi khi khởi chạy; màn chọn số người hiện', () => {
  const { doc, errors, scripts } = loadPage();
  assert.deepEqual(scripts, ['js/game.js', 'js/board.js', 'js/ui.js']);
  assert.equal(doc.getElementById('setup').hidden, false);
  assert.equal(doc.getElementById('game').hidden, true);
  assert.equal(doc.querySelectorAll('[data-players]').length, 3);
  assert.deepEqual(errors, []);
});

for (const n of [2, 3, 4]) {
  test(`UI (AC1): chọn ${n} người → đủ bàn, chuồng 4 màu, ${n * 4} quân, nút tung; chơi đến khi thắng`, () => {
    const { doc, errors, clock, win } = loadPage({ anim: 'on' });
    doc.querySelectorAll('[data-players]').find((b) => b.dataset.players === String(n)).click();
    const board = doc.getElementById('board');
    assert.equal(doc.getElementById('game').hidden, false);
    assert.equal(board.querySelectorAll('.yard').length, 4);
    assert.equal(board.querySelectorAll('.ring').length, 52);
    assert.equal(board.querySelectorAll('.home').length, 20);
    assert.equal(board.querySelectorAll('.center').length, 1);
    assert.equal(board.querySelectorAll('.token').length, n * 4);
    assert.equal(board.querySelectorAll('.safe').length + board.querySelectorAll('.start').length, 8);
    const roll = doc.getElementById('roll-btn');
    assert.equal(roll.disabled, false);
    assert.ok(doc.getElementById('turn').textContent.length > 0);

    let clicks = 0;
    while (doc.getElementById('winner').hidden) {
      assert.ok(++clicks < 50000, 'ván không kết thúc');
      if (!roll.disabled) {
        roll.click();
      } else {
        const movable = board.querySelectorAll('.movable');
        assert.ok(movable.length > 0, 'nút tung bị khoá mà không có quân để chọn');
        movable.forEach((t) => assert.equal(t.disabled, false));
        movable[0].click();
      }
      if (clock.pending()) {
        // đang animation: mọi thứ bị khoá, người thắng chưa hiện
        assert.equal(roll.disabled, true);
        assert.equal(board.querySelectorAll('.movable').length, 0);
        assert.equal(doc.getElementById('winner').hidden, true);
        clock.runAll();
      }
      assert.equal(win.LudoUI.isBusy(), false);
    }
    assert.match(doc.getElementById('winner-text').textContent, /thắng!$/);
    assert.equal(board.querySelectorAll('.token').length, n * 4);

    doc.getElementById('replay-btn').click();
    assert.equal(doc.getElementById('winner').hidden, true);
    assert.equal(board.querySelectorAll('.token').length, n * 4);
    assert.equal(board.querySelectorAll('.movable').length, 0);
    assert.equal(roll.disabled, false);
    assert.deepEqual(errors, []);
  });
}

// ---------- Animation (SPEC R1–R6) ----------
function start(n, anim) {
  const page = loadPage({ anim });
  page.doc.querySelectorAll('[data-players]').find((b) => b.dataset.players === String(n)).click();
  page.state = page.win.LudoUI.getState();
  page.board = page.doc.getElementById('board');
  page.roll = page.doc.getElementById('roll-btn');
  page.dice = page.doc.getElementById('dice');
  return page;
}
const force = (state, v) => { state.rng = () => (v - 1) / 6 + 0.01; };
const cellOfEl = (el) => [parseInt(el.style.gridRow, 10) - 1, parseInt(el.style.gridColumn, 10) - 1];
const tokenBtn = (board, color, i) => board.querySelectorAll('.token-' + color).find((t) => String(t.dataset.token) === String(i));

test('ANIM AC1: xúc xắc lắc ≥3 mặt khác nhau trong ~0.7s, dừng đúng giá trị engine; lúc lắc mọi thứ bị khoá', () => {
  for (const v of [1, 3, 6]) {
    const p = start(4, 'on');
    force(p.state, v);
    p.roll.click();
    assert.equal(p.state.dice, v, 'engine cập nhật ngay');
    assert.ok(p.dice.classList.contains('shaking'));
    const faces = [];
    while (p.clock.pending()) {
      faces.push(p.dice.textContent);
      assert.equal(p.roll.disabled, true);
      assert.equal(p.board.querySelectorAll('.movable').length, 0);
      p.clock.tick();
    }
    assert.ok(new Set(faces).size >= 3, 'mặt xuất hiện: ' + faces.join(''));
    assert.ok(p.clock.now >= 600 && p.clock.now <= 800, 'thời gian lắc ' + p.clock.now + 'ms');
    assert.equal(p.dice.textContent, ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][v]);
    assert.equal(Number(p.dice.dataset.value), v);
    assert.equal(p.dice.classList.contains('shaking'), false);
    assert.deepEqual(p.errors, []);
  }
});

test('ANIM AC3: lắc xong không có nước đi → qua lượt chỉ SAU animation', () => {
  const p = start(4, 'on');
  force(p.state, 3);
  p.roll.click();
  assert.equal(p.state.current, 1, 'engine đã qua lượt');
  assert.equal(p.doc.getElementById('turn').textContent, 'Đỏ', 'hiển thị chưa đổi lượt khi đang lắc');
  p.roll.click(); // bấm thêm trong lúc lắc: bị bỏ qua
  assert.equal(p.state.current, 1);
  p.clock.runAll();
  assert.equal(p.doc.getElementById('turn').textContent, 'Xanh lá');
  assert.equal(p.roll.disabled, false);
  assert.match(p.doc.getElementById('message').textContent, /qua lượt/);
});

function moveAndRecord(p, color, ti, roll) {
  force(p.state, roll);
  p.roll.click(); p.clock.runAll();
  const btn = tokenBtn(p.board, color, ti);
  assert.ok(btn.classList.contains('movable'));
  btn.click();
  const seen = [];
  const el = tokenBtn(p.board, color, ti);
  let last = null;
  while (p.clock.pending()) {
    const c = cellOfEl(el).join();
    if (c !== last && el.classList.contains('moving')) seen.push(cellOfEl(el));
    last = c;
    assert.equal(p.roll.disabled, true);
    p.board.querySelectorAll('.token').forEach((t) => assert.equal(t.disabled, true));
    p.clock.tick();
  }
  return seen;
}

test('ANIM AC2: quân nhảy đúng N ô liên tiếp theo board.js — vòng ngoài, qua góc, rẽ vào đường đích', () => {
  const B = require('../js/board.js');
  const p = start(4, 'on');
  p.state.players[0].tokens[0] = 3; // ô 3 → 7: qua góc (6,5)→(5,6)
  let seen = moveAndRecord(p, 'red', 0, 4);
  assert.deepEqual(seen, [4, 5, 6, 7].map((i) => B.RING[i]));
  assert.equal(p.state.players[0].tokens[0], 7);

  const q = start(4, 'on');
  q.state.players[0].tokens[1] = 48; // 48 → 52: hai ô cuối vòng rồi rẽ vào đường đích
  seen = moveAndRecord(q, 'red', 1, 4);
  assert.deepEqual(seen, [B.RING[49], B.RING[50], B.HOME.red[0], B.HOME.red[1]]);
  assert.equal(seen.length, 4);
  assert.deepEqual(cellOfEl(tokenBtn(q.board, 'red', 1)), B.HOME.red[1], 'sau render vẫn ở đúng ô');
});

test('ANIM AC2: xuất quân = 1 bước nhảy ra ô xuất phát; ra 6 mở lại cho cùng người tung', () => {
  const B = require('../js/board.js');
  const p = start(2, 'on');
  const seen = moveAndRecord(p, 'red', 2, 6);
  assert.deepEqual(seen, [B.RING[0]]);
  assert.equal(p.roll.disabled, false);
  assert.equal(p.doc.getElementById('turn').textContent, 'Đỏ');
});

test('ANIM R3: quân bị đá rung/mờ tại chỗ sau khi quân đi xong, rồi mới về chuồng', () => {
  const B = require('../js/board.js');
  const p = start(4, 'on');
  p.state.players[0].tokens[0] = 2;
  p.state.players[1].tokens[1] = 44; // tuyệt đối ô 5
  force(p.state, 3);
  p.roll.click(); p.clock.runAll();
  tokenBtn(p.board, 'red', 0).click();
  const victim = tokenBtn(p.board, 'green', 1);
  let sawCaptured = false;
  while (p.clock.pending()) {
    if (victim.classList.contains('captured')) {
      sawCaptured = true;
      assert.deepEqual(cellOfEl(victim), B.RING[5], 'rung tại ô bị đá');
      assert.equal(tokenBtn(p.board, 'red', 0).classList.contains('moving'), false, 'quân đi đã xong');
    }
    p.clock.tick();
  }
  assert.ok(sawCaptured);
  assert.equal(p.state.players[1].tokens[1], -1);
  assert.deepEqual(cellOfEl(tokenBtn(p.board, 'green', 1)), B.YARD_SLOTS.green[1]);
  assert.match(p.doc.getElementById('message').textContent, /Đá Xanh lá quân 2/);
});

test('ANIM R4: người thắng chỉ hiện sau khi animation xong', () => {
  const p = start(2, 'on');
  p.state.players[0].tokens = [56, 56, 56, 53];
  force(p.state, 3);
  p.roll.click(); p.clock.runAll();
  tokenBtn(p.board, 'red', 3).click();
  assert.equal(p.state.winner, 'red', 'engine đã chốt người thắng');
  assert.equal(p.doc.getElementById('winner').hidden, true);
  p.clock.runAll();
  assert.equal(p.doc.getElementById('winner').hidden, false);
  assert.equal(p.doc.getElementById('winner-text').textContent, 'Đỏ thắng!');
});

test('ANIM: bấm Ván mới giữa animation → huỷ animation cũ, ván mới không bị khoá', () => {
  const p = start(4, 'on');
  force(p.state, 6);
  p.roll.click();
  p.doc.getElementById('new-btn').click();
  p.doc.querySelectorAll('[data-players]')[0].click();
  p.clock.runAll();
  assert.equal(p.win.LudoUI.isBusy(), false);
  assert.equal(p.roll.disabled, false);
  assert.equal(p.win.LudoUI.getState().dice, null);
  assert.deepEqual(p.errors, []);
});

test('ANIM R5: prefers-reduced-motion → không animation, cập nhật ngay như cũ', () => {
  const p = start(4, 'reduced');
  force(p.state, 6);
  p.roll.click();
  assert.equal(p.clock.pending(), 0);
  assert.equal(p.dice.classList.contains('shaking'), false);
  assert.equal(p.dice.textContent, '⚅');
  tokenBtn(p.board, 'red', 0).click();
  assert.equal(p.clock.pending(), 0);
  assert.equal(p.roll.disabled, false);
  assert.equal(p.state.players[0].tokens[0], 0);
});
