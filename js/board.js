/*
 * Hình học bàn cờ 15x15: toạ độ [hàng, cột] của 52 ô vòng ngoài, đường đích, chuồng.
 * Đỏ: góc trên-trái, Xanh lá: trên-phải, Vàng: dưới-phải, Xanh dương: dưới-trái; đi theo chiều kim đồng hồ.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LudoBoard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SIZE = 15;

  function seg(cells, r0, c0, dr, dc, n) {
    for (var i = 0; i < n; i++) cells.push([r0 + dr * i, c0 + dc * i]);
  }

  // 52 ô vòng ngoài, chỉ số 0 = ô xuất phát của Đỏ.
  var RING = [];
  seg(RING, 6, 1, 0, 1, 5);   // 0-4   hàng 6 sang phải
  seg(RING, 5, 6, -1, 0, 6);  // 5-10  cột 6 đi lên
  seg(RING, 0, 7, 0, 1, 2);   // 11-12 đỉnh
  seg(RING, 1, 8, 1, 0, 5);   // 13-17 cột 8 đi xuống (13 = xuất phát Xanh lá)
  seg(RING, 6, 9, 0, 1, 6);   // 18-23 hàng 6 sang phải
  seg(RING, 7, 14, 1, 0, 2);  // 24-25 cạnh phải
  seg(RING, 8, 13, 0, -1, 5); // 26-30 hàng 8 sang trái (26 = xuất phát Vàng)
  seg(RING, 9, 8, 1, 0, 6);   // 31-36 cột 8 đi xuống
  seg(RING, 14, 7, 0, -1, 2); // 37-38 đáy
  seg(RING, 13, 6, -1, 0, 5); // 39-43 cột 6 đi lên (39 = xuất phát Xanh dương)
  seg(RING, 8, 5, 0, -1, 6);  // 44-49 hàng 8 sang trái
  seg(RING, 7, 0, -1, 0, 2);  // 50-51 cạnh trái

  // Đường đích: 5 ô trong cột/hàng giữa + ô đích cuối (ô thứ 6) ở tâm bàn.
  var HOME = { red: [], green: [], yellow: [], blue: [] };
  seg(HOME.red, 7, 1, 0, 1, 6);
  seg(HOME.green, 1, 7, 1, 0, 6);
  seg(HOME.yellow, 7, 13, 0, -1, 6);
  seg(HOME.blue, 13, 7, -1, 0, 6);

  // Góc chuồng (hàng, cột trên-trái của khối 6x6) và 4 chỗ đặt quân.
  var YARD_ORIGIN = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };
  var YARD_SLOTS = {};
  Object.keys(YARD_ORIGIN).forEach(function (c) {
    var o = YARD_ORIGIN[c];
    YARD_SLOTS[c] = [[o[0] + 2, o[1] + 2], [o[0] + 2, o[1] + 3], [o[0] + 3, o[1] + 2], [o[0] + 3, o[1] + 3]];
  });

  /** Toạ độ ô của một quân theo tiến độ (xem js/game.js). */
  function cellOf(engine, color, progress, tokenIndex) {
    if (progress === engine.YARD) return YARD_SLOTS[color][tokenIndex];
    if (progress <= engine.LAST_RING) return RING[engine.absolutePosition(color, progress)];
    return HOME[color][progress - engine.LAST_RING - 1];
  }

  /**
   * Các ô quân lần lượt nhảy qua khi đi từ tiến độ `from` tới `to` (không gồm ô đứng ban đầu).
   * Xuất quân từ chuồng: 1 bước tới ô xuất phát. Ngược lại: mỗi bước 1 ô, qua vòng ngoài rồi rẽ vào đường đích.
   */
  function pathCells(engine, color, from, to, tokenIndex) {
    if (from === engine.YARD) return [cellOf(engine, color, to, tokenIndex)];
    var out = [];
    for (var p = from + 1; p <= to; p++) out.push(cellOf(engine, color, p, tokenIndex));
    return out;
  }

  return { SIZE: SIZE, RING: RING, HOME: HOME, YARD_ORIGIN: YARD_ORIGIN, YARD_SLOTS: YARD_SLOTS, cellOf: cellOf, pathCells: pathCells };
});
