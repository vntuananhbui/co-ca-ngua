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

function loadPage() {
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
  const win = { document: doc, console: { log() {}, warn: (...a) => errors.push(a.join(' ')), error: (...a) => errors.push(a.join(' ')) }, Math, Number, Array, Object };
  win.window = win; win.self = win;
  const ctx = vm.createContext(win);
  for (const src of scripts) vm.runInContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), ctx, { filename: src });
  return { doc, win, errors, scripts };
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
    const { doc, errors } = loadPage();
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
      if (!roll.disabled) { roll.click(); continue; }
      const movable = board.querySelectorAll('.movable');
      assert.ok(movable.length > 0, 'nút tung bị khoá mà không có quân để chọn');
      movable.forEach((t) => assert.equal(t.disabled, false));
      movable[0].click();
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
