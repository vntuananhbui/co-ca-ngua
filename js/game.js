/*
 * Cờ cá ngựa — engine luật chơi (không phụ thuộc DOM).
 * Dùng được trong trình duyệt (window.LudoEngine) và trong Node (require).
 *
 * Mô hình vị trí của một quân (tính theo "tiến độ" riêng của màu đó):
 *   -1        : trong chuồng
 *   0 .. 50   : trên vòng ngoài (0 = ô xuất phát của màu)
 *   51 .. 55  : 5 ô đầu của đường đích
 *   56        : ô đích cuối (ô thứ 6 của đường đích) — quân đã về
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LudoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RING_SIZE = 52;
  var LAST_RING = 50;      // ô vòng ngoài cuối cùng trước khi rẽ vào đường đích
  var GOAL = 56;           // ô đích cuối
  var YARD = -1;
  var TOKENS_PER_PLAYER = 4;

  var COLORS = ['red', 'green', 'yellow', 'blue'];
  var COLOR_NAMES = { red: 'Đỏ', green: 'Xanh lá', yellow: 'Vàng', blue: 'Xanh dương' };
  var START = { red: 0, green: 13, yellow: 26, blue: 39 };
  // Ô an toàn: 4 ô xuất phát + 4 ô sao (cách ô xuất phát 8 ô).
  var SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];
  var SEATS = {
    2: ['red', 'yellow'],
    3: ['red', 'green', 'yellow'],
    4: ['red', 'green', 'yellow', 'blue']
  };

  function createGame(numPlayers, opts) {
    opts = opts || {};
    var seats = SEATS[numPlayers];
    if (!seats) throw new Error('Số người chơi phải là 2, 3 hoặc 4');
    return {
      players: seats.map(function (c) {
        return { color: c, tokens: [YARD, YARD, YARD, YARD] };
      }),
      current: 0,
      dice: null,
      phase: 'roll',      // 'roll' | 'move' | 'over'
      winner: null,       // màu người thắng
      rng: typeof opts.rng === 'function' ? opts.rng : Math.random
    };
  }

  function absolutePosition(color, progress) {
    if (progress < 0 || progress > LAST_RING) return null;
    return (START[color] + progress) % RING_SIZE;
  }

  function isSafeSquare(abs) {
    return SAFE_SQUARES.indexOf(abs) !== -1;
  }

  function canMoveToken(progress, roll) {
    if (progress === YARD) return roll === 6;
    if (progress === GOAL) return false;
    return progress + roll <= GOAL; // phải đúng số bước, không được vượt ô đích
  }

  function targetOf(progress, roll) {
    return progress === YARD ? 0 : progress + roll;
  }

  function currentPlayer(state) {
    return state.players[state.current];
  }

  function movableTokens(state, roll) {
    if (roll === undefined) {
      if (state.phase !== 'move') return [];
      roll = state.dice;
    }
    var p = currentPlayer(state);
    var out = [];
    for (var i = 0; i < p.tokens.length; i++) {
      if (canMoveToken(p.tokens[i], roll)) out.push(i);
    }
    return out;
  }

  function nextTurn(state) {
    state.current = (state.current + 1) % state.players.length;
    state.phase = 'roll';
  }

  function rollDie(rng) {
    var v = Math.floor(rng() * 6) + 1;
    return Math.min(6, Math.max(1, v));
  }

  /**
   * Tung xúc xắc cho người chơi hiện tại.
   * forcedValue (1..6) dùng để inject giá trị (test); bỏ trống thì dùng state.rng.
   * Không có nước đi hợp lệ thì tự qua lượt (kể cả khi ra 6).
   */
  function rollDice(state, forcedValue) {
    if (state.phase !== 'roll') throw new Error('Chưa đến lúc tung xúc xắc');
    var value = forcedValue !== undefined ? forcedValue : rollDie(state.rng);
    if (!(value >= 1 && value <= 6) || value !== Math.floor(value)) {
      throw new Error('Giá trị xúc xắc không hợp lệ: ' + value);
    }
    var player = currentPlayer(state);
    state.dice = value;
    var movable = movableTokens(state, value);
    if (movable.length === 0) {
      nextTurn(state);
      return { value: value, color: player.color, movable: [], passed: true };
    }
    state.phase = 'move';
    return { value: value, color: player.color, movable: movable, passed: false };
  }

  /** Đi quân tokenIndex của người chơi hiện tại theo giá trị xúc xắc vừa tung. */
  function moveToken(state, tokenIndex) {
    if (state.phase !== 'move') throw new Error('Chưa tung xúc xắc');
    var player = currentPlayer(state);
    var from = player.tokens[tokenIndex];
    if (from === undefined) throw new Error('Quân không tồn tại');
    if (!canMoveToken(from, state.dice)) throw new Error('Nước đi không hợp lệ');

    var to = targetOf(from, state.dice);
    player.tokens[tokenIndex] = to;

    var captured = [];
    var abs = absolutePosition(player.color, to);
    if (abs !== null && !isSafeSquare(abs)) {
      state.players.forEach(function (other) {
        if (other === player) return;
        other.tokens.forEach(function (t, i) {
          if (absolutePosition(other.color, t) === abs) {
            other.tokens[i] = YARD;
            captured.push({ color: other.color, token: i });
          }
        });
      });
    }

    var result = {
      color: player.color, token: tokenIndex, from: from, to: to,
      captured: captured, finished: to === GOAL, extraTurn: false, winner: null
    };

    if (player.tokens.every(function (t) { return t === GOAL; })) {
      state.phase = 'over';
      state.winner = player.color;
      result.winner = player.color;
      return result;
    }
    if (state.dice === 6) {
      state.phase = 'roll';          // ra 6: được tung tiếp
      result.extraTurn = true;
    } else {
      nextTurn(state);
    }
    return result;
  }

  return {
    RING_SIZE: RING_SIZE, LAST_RING: LAST_RING, GOAL: GOAL, YARD: YARD,
    TOKENS_PER_PLAYER: TOKENS_PER_PLAYER, COLORS: COLORS, COLOR_NAMES: COLOR_NAMES,
    START: START, SAFE_SQUARES: SAFE_SQUARES, SEATS: SEATS,
    createGame: createGame, rollDice: rollDice, moveToken: moveToken,
    movableTokens: movableTokens, canMoveToken: canMoveToken,
    absolutePosition: absolutePosition, isSafeSquare: isSafeSquare,
    currentPlayer: currentPlayer
  };
});
