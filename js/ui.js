/* Giao diện: vẽ bàn cờ, quân, xúc xắc; nối sự kiện với engine (js/game.js). */
(function () {
  'use strict';
  var E = window.LudoEngine;
  var B = window.LudoBoard;
  var DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board');
  var state = null;
  var numPlayers = 4;
  var busy = false;   // đang chạy animation: khoá nút tung và quân
  var game = 0;       // tăng mỗi ván mới, để huỷ animation của ván cũ

  // Thời lượng animation (ms). Ghi đè được qua window.LUDO_ANIM = { diceMs, diceTickMs, stepMs, captureMs }
  // hoặc tắt hẳn bằng window.LUDO_ANIM = false. prefers-reduced-motion: reduce cũng tắt.
  var ANIM = { diceMs: 700, diceTickMs: 70, stepMs: 180, captureMs: 400 };
  function animEnabled() {
    if (window.LUDO_ANIM === false) return false;
    if (typeof window.setTimeout !== 'function') return false;
    var mm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    return !(mm && mm.matches);
  }
  function anim(k) {
    var o = window.LUDO_ANIM;
    return o && typeof o === 'object' && typeof o[k] === 'number' ? o[k] : ANIM[k];
  }
  // setTimeout gắn với ván hiện tại: bấm Ván mới/Chơi lại giữa chừng thì callback cũ bị bỏ.
  function later(ms, fn) {
    var g = game;
    window.setTimeout(function () { if (g === game) fn(); }, ms);
  }
  function restartClass(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // ép reflow để animation CSS chạy lại
    el.classList.add(cls);
  }
  function tokenEl(color, ti) {
    return Array.prototype.slice.call(boardEl.querySelectorAll('.token-' + color)).filter(function (t) { return Number(t.dataset.token) === ti; })[0];
  }
  function lockUI() {
    busy = true;
    $('roll-btn').disabled = true;
    Array.prototype.slice.call(boardEl.querySelectorAll('.token')).forEach(function (t) {
      t.disabled = true;
      t.classList.remove('movable');
    });
  }

  function key(rc) { return rc[0] + ',' + rc[1]; }
  function place(el, rc, rowSpan, colSpan) {
    el.style.gridRow = (rc[0] + 1) + ' / span ' + (rowSpan || 1);
    el.style.gridColumn = (rc[1] + 1) + ' / span ' + (colSpan || 1);
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    // Chuồng 4 màu
    Object.keys(B.YARD_ORIGIN).forEach(function (c) {
      var y = document.createElement('div');
      y.className = 'yard yard-' + c;
      y.dataset.color = c;
      place(y, B.YARD_ORIGIN[c], 6, 6);
      var inner = document.createElement('div');
      inner.className = 'yard-inner';
      y.appendChild(inner);
      boardEl.appendChild(y);
      B.YARD_SLOTS[c].forEach(function (rc) {
        var s = document.createElement('div');
        s.className = 'slot slot-' + c;
        place(s, rc);
        boardEl.appendChild(s);
      });
    });
    // Vòng ngoài
    var startColor = {};
    E.COLORS.forEach(function (c) { startColor[E.START[c]] = c; });
    B.RING.forEach(function (rc, i) {
      var cell = document.createElement('div');
      cell.className = 'cell ring';
      cell.dataset.index = i;
      if (startColor[i]) cell.className += ' start start-' + startColor[i];
      else if (E.isSafeSquare(i)) cell.className += ' safe';
      place(cell, rc);
      boardEl.appendChild(cell);
    });
    // Đường đích (5 ô; ô thứ 6 là tâm)
    E.COLORS.forEach(function (c) {
      B.HOME[c].slice(0, 5).forEach(function (rc) {
        var cell = document.createElement('div');
        cell.className = 'cell home home-' + c;
        place(cell, rc);
        boardEl.appendChild(cell);
      });
    });
    var center = document.createElement('div');
    center.className = 'center';
    place(center, [6, 6], 3, 3);
    boardEl.appendChild(center);
  }

  function renderTokens() {
    Array.prototype.slice.call(boardEl.querySelectorAll('.token')).forEach(function (t) { t.remove(); });
    var movable = state.phase === 'move' ? E.movableTokens(state) : [];
    var stacks = {};
    state.players.forEach(function (p, pi) {
      p.tokens.forEach(function (prog, ti) {
        var rc = B.cellOf(E, p.color, prog, ti);
        var k = key(rc);
        var n = stacks[k] = (stacks[k] || 0) + 1;
        var t = document.createElement('button');
        t.type = 'button';
        t.className = 'token token-' + p.color;
        t.dataset.color = p.color;
        t.dataset.token = ti;
        t.textContent = ti + 1;
        t.setAttribute('aria-label', E.COLOR_NAMES[p.color] + ' quân ' + (ti + 1));
        place(t, rc);
        if (n > 1) t.style.transform = 'translate(' + ((n - 1) * 18) + '%, ' + (-(n - 1) * 18) + '%) scale(0.8)';
        if (!busy && pi === state.current && movable.indexOf(ti) !== -1) {
          t.className += ' movable';
          t.addEventListener('click', function () { onMove(ti); });
        } else {
          t.disabled = true;
        }
        boardEl.appendChild(t);
      });
    });
  }

  function renderStatus() {
    var p = E.currentPlayer(state);
    var turn = $('turn');
    turn.textContent = E.COLOR_NAMES[p.color];
    turn.className = 'turn-badge badge-' + p.color;
    $('dice').textContent = state.dice ? DICE_FACES[state.dice] : '🎲';
    $('dice').dataset.value = state.dice || '';
    $('roll-btn').disabled = busy || state.phase !== 'roll';
    var score = $('score');
    score.innerHTML = '';
    state.players.forEach(function (pl) {
      var li = document.createElement('li');
      var home = pl.tokens.filter(function (t) { return t === E.GOAL; }).length;
      li.innerHTML = '<span class="dot dot-' + pl.color + '"></span>' + E.COLOR_NAMES[pl.color] + ': ' + home + '/4 về đích';
      score.appendChild(li);
    });
  }

  function say(msg) { $('message').textContent = msg; }

  function render() { renderTokens(); renderStatus(); }

  function onRoll() {
    if (!state || busy || state.phase !== 'roll') return;
    var who = E.COLOR_NAMES[E.currentPlayer(state).color];
    var r = E.rollDice(state); // engine cập nhật ngay; phần dưới chỉ là hiển thị
    function done() {
      busy = false;
      var dice = $('dice');
      dice.classList.remove('shaking');
      if (r.passed) say(who + ' tung ' + r.value + ': không có nước đi hợp lệ, qua lượt.');
      else say(who + ' tung ' + r.value + ': chọn quân để đi (quân sáng viền).');
      render();
    }
    if (!animEnabled()) return done();
    lockUI();
    say(who + ' đang lắc xúc xắc...');
    var dice = $('dice');
    restartClass(dice, 'shaking');
    var total = anim('diceMs'), tick = Math.max(1, anim('diceTickMs')), t = 0, face = 0;
    (function shake() {
      if (t >= total) return done();
      var f;
      do { f = 1 + Math.floor(Math.random() * 6); } while (f === face);
      face = f;
      dice.textContent = DICE_FACES[f];
      dice.dataset.value = f;
      t += tick;
      later(tick, shake);
    })();
  }

  function onMove(ti) {
    if (!state || busy || state.phase !== 'move') return;
    var before = state.players.map(function (p) { return p.tokens.slice(); });
    var r = E.moveToken(state, ti); // engine cập nhật ngay
    var who = E.COLOR_NAMES[r.color];
    var msg = who + ' đi quân ' + (ti + 1) + (r.from === E.YARD ? ' ra khỏi chuồng' : '') + '.';
    if (r.captured.length) {
      msg += ' Đá ' + r.captured.map(function (c) { return E.COLOR_NAMES[c.color] + ' quân ' + (c.token + 1); }).join(', ') + ' về chuồng!';
    }
    if (r.finished) msg += ' Quân về đích!';
    if (r.extraTurn) msg += ' Ra 6, được tung tiếp.';

    function done() {
      busy = false;
      say(msg);
      render();
      if (r.winner) {
        $('winner-text').textContent = E.COLOR_NAMES[r.winner] + ' thắng!';
        $('winner-text').className = 'winner-' + r.winner;
        $('winner').hidden = false;
      }
    }
    if (!animEnabled()) return done();

    lockUI();
    var el = tokenEl(r.color, ti);
    var path = B.pathCells(E, r.color, r.from, r.to, ti);
    el.style.transform = '';
    el.classList.add('moving');
    var i = 0;
    (function step() {
      if (i >= path.length) {
        el.classList.remove('moving', 'hop');
        return afterMove();
      }
      place(el, path[i++]);
      restartClass(el, 'hop');
      later(anim('stepMs'), step);
    })();

    function afterMove() {
      if (!r.captured.length) return done();
      r.captured.forEach(function (c) {
        var pi = state.players.findIndex(function (p) { return p.color === c.color; });
        var victim = tokenEl(c.color, c.token);
        if (!victim) return;
        // vẫn đang đứng ở ô cũ (chưa render lại) — rung/mờ rồi mới về chuồng
        place(victim, B.cellOf(E, c.color, before[pi][c.token], c.token));
        victim.classList.add('captured');
      });
      later(anim('captureMs'), done);
    }
  }

  function startGame() {
    game++;
    busy = false;
    $('dice').classList.remove('shaking');
    state = E.createGame(numPlayers);
    $('setup').hidden = true;
    $('winner').hidden = true;
    $('game').hidden = false;
    buildBoard();
    say('Bắt đầu! ' + E.COLOR_NAMES[E.currentPlayer(state).color] + ' tung trước. Cần ra 6 để xuất quân.');
    render();
  }

  function showSetup() {
    game++;
    busy = false;
    $('winner').hidden = true;
    $('game').hidden = true;
    $('setup').hidden = false;
  }

  // Cho test/debug đọc trạng thái (không dùng trong game).
  window.LudoUI = { getState: function () { return state; }, isBusy: function () { return busy; } };

  Array.prototype.slice.call(document.querySelectorAll('[data-players]')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      numPlayers = Number(btn.dataset.players);
      startGame();
    });
  });
  $('roll-btn').addEventListener('click', onRoll);
  $('replay-btn').addEventListener('click', startGame);
  $('menu-btn').addEventListener('click', showSetup);
  $('new-btn').addEventListener('click', showSetup);
  document.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && state && !$('game').hidden && document.activeElement.tagName !== 'BUTTON') {
      e.preventDefault();
      onRoll();
    }
  });
})();
