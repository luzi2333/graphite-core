/* 堆芯栅格：方形钢板阵列（按最大半径一次建好，实际用多少由半径决定） */
(function () {
  'use strict';
  var GC = (window.GC = window.GC || {});

  var R_MAX = 31;
  var R_USE = 30;
  var STEP = 1.0;

  GC.R_MAX = R_MAX;
  GC.R_USE = R_USE;
  GC.STEP = STEP;
  GC.MAX_LIFT = 20;
  GC.BAND_COUNT = 24;

  /* 半径 → 频段索引查表（0..255 → 0..21，避开最上面两段常常没内容的高频） */
  GC.bandLUT = new Uint8Array(256);
  (function () {
    for (var i = 0; i < 256; i++) {
      var b = Math.floor(Math.pow(i / 255, 0.72) * 22);
      if (b > 21) b = 21;
      if (b < 0) b = 0;
      GC.bandLUT[i] = b;
    }
  })();

  function hash2(x, y) {
    var s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  /* 直径：随窗口与「大小」滑杆变化 */
  GC.deckD = function (w, h, size) {
    return Math.min(w * 0.84, h * 0.92) * (size || 1);
  };

  /* 由直径反推半径（格数），块大小基本恒定，所以圈越大块越多 */
  GC.deckRFor = function (w, h, size) {
    var D = GC.deckD(w, h, size);
    var bp = Math.max(11, Math.min(30, Math.min(w, h) * 0.024));
    var R = Math.round(D / (2 * bp));
    if (R < 7) R = 7;
    if (R > R_USE) R = R_USE;
    return R;
  };

  GC.buildLattice = function () {
    var blocks = [];
    var n = Math.ceil(R_MAX / STEP);
    var i, j, x, y, d, th, bandS, a;

    for (j = -n; j <= n; j++) {
      for (i = -n; i <= n; i++) {
        x = i * STEP;
        y = j * STEP;
        d = Math.sqrt(x * x + y * y);
        if (d > R_MAX) continue;

        th = Math.atan2(y, x);

        /* 环向：左右镜像分频 */
        a = Math.atan2(y, Math.abs(x));
        bandS = Math.floor(((a + Math.PI / 2) / Math.PI) * GC.BAND_COUNT);
        if (bandS > GC.BAND_COUNT - 1) bandS = GC.BAND_COUNT - 1;
        if (bandS < 0) bandS = 0;

        var h1 = hash2(i * 1.13 + 0.7, j * 2.71 + 0.3);
        var h2 = hash2(i * 3.17 + 1.1, j * 0.93 + 2.2);
        var h3 = hash2(i * 0.61 + 4.4, j * 1.97 + 1.9);

        var tone = Math.floor(h1 * 8);
        if (tone > 7) tone = 7;
        if (tone < 0) tone = 0;

        blocks.push({
          x: x,
          y: y,
          d: d,
          th: th,
          rn: d / R_MAX,
          bandS: bandS,
          seed: h1,
          tone: tone,
          dark: h2 < 0.045,
          mark: h3 < 0.2 ? (Math.floor(h2 * 5) % 5) : -1,
          mx: (h2 - 0.5) * 0.34,
          my: (h3 - 0.5) * 0.3,
          e: 0,
          z: 0
        });
      }
    }
    return blocks;
  };

  GC.sortByDepth = function (blocks) {
    var order = new Array(blocks.length);
    for (var i = 0; i < blocks.length; i++) order[i] = i;
    order.sort(function (a, b) { return blocks[a].y - blocks[b].y; });
    return order;
  };
})();
