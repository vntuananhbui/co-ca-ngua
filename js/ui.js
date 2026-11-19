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
        if (pi === state.current && movable.indexOf(ti) !== -1) {
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
    $('roll-btn').disabled = state.phase !== 'roll';
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
    if (!state || state.phase !== 'roll') return;
    var who = E.COLOR_NAMES[E.currentPlayer(state).color];
    var r = E.rollDice(state);
    if (r.passed) {
      say(who + ' tung ' + r.value + ': không có nước đi hợp lệ, qua lượt.');
    } else {
      say(who + ' tung ' + r.value + ': chọn quân để đi (quân sáng viền).');
    }
    render();
  }

  function onMove(ti) {
    if (state.phase !== 'move') return;
    var r = E.moveToken(state, ti);
    var who = E.COLOR_NAMES[r.color];
    var msg = who + ' đi quân ' + (ti + 1) + (r.from === E.YARD ? ' ra khỏi chuồng' : '') + '.';
    if (r.captured.length) {
      msg += ' Đá ' + r.captured.map(function (c) { return E.COLOR_NAMES[c.color] + ' quân ' + (c.token + 1); }).join(', ') + ' về chuồng!';
    }
    if (r.finished) msg += ' Quân về đích!';
    if (r.extraTurn) msg += ' Ra 6, được tung tiếp.';
    say(msg);
    render();
    if (r.winner) {
      $('winner-text').textContent = E.COLOR_NAMES[r.winner] + ' thắng!';
      $('winner-text').className = 'winner-' + r.winner;
      $('winner').hidden = false;
    }
  }

  function startGame() {
    state = E.createGame(numPlayers);
    $('setup').hidden = true;
    $('winner').hidden = true;
    $('game').hidden = false;
    buildBoard();
    say('Bắt đầu! ' + E.COLOR_NAMES[E.currentPlayer(state).color] + ' tung trước. Cần ra 6 để xuất quân.');
    render();
  }

  function showSetup() {
    $('winner').hidden = true;
    $('game').hidden = true;
    $('setup').hidden = false;
  }

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
