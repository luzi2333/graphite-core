/* 跳动规律：每种返回 0~1.2 的场强，决定能量落在哪些柱子上 */
(function () {
  'use strict';
  var GC = (window.GC = window.GC || {});

  function hash(n) {
    var s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  /* 中心扩散：一圈圈向外推的冲击波 */
  function rings(rod, t, sp, inward) {
    var f = 0.08;
    var speed = 0.36 * (0.35 + sp);
    for (var i = 0; i < 3; i++) {
      var front = (t * speed + i * 0.34) % 1;
      if (inward) front = 1 - front;
      var d = (rod.rn - front) / 0.12;
      var val = Math.exp(-d * d);
      if (val > f) f = val;
    }
    return f;
  }

  GC.Patterns = {
    radial: {
      label: '中心扩散',
      gain: 1.55,
      fn: function (rod, t, sp) { return rings(rod, t, sp, false); }
    },
    implode: {
      label: '向心收缩',
      gain: 1.55,
      fn: function (rod, t, sp) { return rings(rod, t, sp, true); }
    },
    ocean: {
      label: '海浪',
      gain: 1.15,
      fn: function (rod, t, sp) {
        var w = 1.5 * (0.28 + sp);
        var a = rod.x * 0.55 + rod.y * 0.28;
        var b = rod.x * 0.22 - rod.y * 0.61;
        var v = Math.sin(a - t * w) * 0.62
              + Math.sin(b * 1.7 - t * w * 1.27 + 2.1) * 0.38;
        return 0.5 + 0.5 * v;
      }
    },
    random: {
      label: '随机',
      gain: 1.35,
      fn: function (rod, t, sp) {
        var rate = 5.2 * (0.3 + sp);
        var ph = t * rate + rod.seed * 13.7;
        var slot = Math.floor(ph);
        var frac = ph - slot;
        var h = hash(slot * 1.37 + rod.seed * 91.7);
        var val = h > 0.6 ? (h - 0.6) / 0.4 : 0;
        return 0.1 + val * Math.exp(-frac * 3.2) * 1.05;
      }
    },
    center: {
      label: '以中心为准',
      gain: 1.2,
      fn: function (rod, t, sp) {
        var d = 1 - rod.rn;
        if (d < 0) d = 0;
        /* 留一条底：外圈也有半高左右的起伏，不会完全不动 */
        var base = 0.42 + 0.58 * Math.pow(d, 1.55);
        return base * (1.0 + 0.22 * Math.sin(t * (1.6 + sp * 0.8) + rod.rn * 2.4));
      }
    },
    mirror: {
      label: '对称镜像',
      gain: 1.15,
      fn: function (rod, t, sp) {
        var w = 2.0 * (0.28 + sp);
        var ax = Math.abs(rod.x);
        var v = Math.sin(ax * 0.9 - t * w) * 0.7
              + Math.sin(rod.y * 0.35 + t * w * 0.5) * 0.3;
        return 0.5 + 0.5 * v;
      }
    },
    spiral: {
      label: '螺旋',
      gain: 1.2,
      fn: function (rod, t, sp) {
        var w = 2.6 * (0.25 + sp);
        return 0.5 + 0.5 * Math.sin(rod.th * 2.4 + rod.rn * 7.0 - t * w);
      }
    },
    breathe: {
      label: '呼吸',
      gain: 1.0,
      fn: function () { return 1; }
    }
  };

  GC.PATTERN_ORDER = ['radial', 'ocean', 'random', 'center', 'implode', 'mirror', 'spiral', 'breathe'];
})();
