/* 渲染器：混凝土地坪 + 铆接钢板圆盖，可 360° 环绕，每块钢板独立抬起 */
(function () {
  'use strict';
  var GC = (window.GC = window.GC || {});
  var TAU = Math.PI * 2;

  /* ---------------- 颜色工具 ---------------- */

  function parseHex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function css(c, a) {
    if (a === undefined) return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function mixRgb(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }
  function mixCss(ha, hb, t) {
    return css(mixRgb(parseHex(ha), parseHex(hb), t));
  }
  function shade(hex, f) {
    var c = parseHex(hex);
    return css([
      Math.min(255, Math.round(c[0] * f)),
      Math.min(255, Math.round(c[1] * f)),
      Math.min(255, Math.round(c[2] * f))
    ]);
  }

  /* ---------------- 钢板贴图 ---------------- */

  function makePlate(hex, seed) {
    var S = 64;
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    var base = parseHex(hex);
    var s = seed >>> 0;
    function rnd() {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    }

    g.fillStyle = css(base);
    g.fillRect(0, 0, S, S);

    var i;
    for (i = 0; i < 30; i++) {
      var x = rnd() * S;
      g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
      g.fillRect(x, 0, 1, S);
    }
    for (i = 0; i < 7; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (0.03 + rnd() * 0.05).toFixed(3) + ')';
      g.fillRect(rnd() * S, rnd() * S, 5 + rnd() * 16, 4 + rnd() * 12);
    }
    for (i = 0; i < 3; i++) {
      g.fillStyle = 'rgba(150,110,60,' + (0.05 + rnd() * 0.05).toFixed(3) + ')';
      g.fillRect(rnd() * S, rnd() * S, 4 + rnd() * 8, 3 + rnd() * 6);
    }

    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(0, 0, S, 2);
    g.fillRect(0, 0, 2, S);
    g.fillStyle = 'rgba(0,0,0,0.34)';
    g.fillRect(0, S - 2, S, 2);
    g.fillRect(S - 2, 0, 2, S);

    var riv = [[8, 8], [S - 8, 8], [8, S - 8], [S - 8, S - 8]];
    for (i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(riv[i][0], riv[i][1], 3.2, 0, TAU);
      g.fillStyle = 'rgba(12,14,12,0.55)';
      g.fill();
      g.beginPath();
      g.arc(riv[i][0] - 0.9, riv[i][1] - 0.9, 1.9, 0, TAU);
      g.fillStyle = 'rgba(225,230,225,0.2)';
      g.fill();
    }
    return c;
  }

  /* ---------------- 配色 ---------------- */

  var PALETTES = {
    steel: {
      label: '轧钢 · 军绿混排',
      floor0: '#514d45', floor1: '#3f3c36',
      deck: '#272a22',
      rim: '#6e7379', rimInner: '#585d63', rimLine: 'rgba(10,12,11,0.8)',
      bolt: 'rgba(22,25,23,0.75)',
      stencil: '#c3a747',
      hazard: '#b2912f',
      tones: ['#545a60', '#5b6167', '#666c72', '#71777d', '#7c8288', '#868c92', '#6a6055', '#4f5748'],
      marks: ['#b8912f', '#9c3a2a', '#d6d2c4', '#2a2c26', '#5f6b45']
    },
    olive: {
      label: '军绿漆',
      floor0: '#4b4740', floor1: '#3a3732',
      deck: '#23261f',
      rim: '#5f6459', rimInner: '#4b5047', rimLine: 'rgba(9,11,9,0.8)',
      bolt: 'rgba(20,23,19,0.75)',
      stencil: '#c8ab4c',
      hazard: '#b8963a',
      tones: ['#3f4638', '#474e3f', '#4e5544', '#565e4c', '#5e6653', '#666e5b', '#6d6450', '#5f6669'],
      marks: ['#c0a240', '#9a3c2b', '#cdc7b6', '#2b2d26', '#6f7a4c']
    },
    iron: {
      label: '铸铁',
      floor0: '#3f3d39', floor1: '#31302c',
      deck: '#20221e',
      rim: '#565a5e', rimInner: '#44484c', rimLine: 'rgba(8,9,8,0.85)',
      bolt: 'rgba(18,20,18,0.8)',
      stencil: '#b79b45',
      hazard: '#a8872c',
      tones: ['#3a3d41', '#414448', '#484b4f', '#4f5256', '#56595d', '#5d6064', '#63594e', '#4a4d51'],
      marks: ['#b09033', '#8d3529', '#c9c5b9', '#26282a', '#59634a']
    },
    oxide: {
      label: '氧化钢',
      floor0: '#51483f', floor1: '#403931',
      deck: '#282219',
      rim: '#6d6256', rimInner: '#574e44', rimLine: 'rgba(12,9,7,0.8)',
      bolt: 'rgba(28,22,17,0.75)',
      stencil: '#c09a45',
      hazard: '#ad8229',
      tones: ['#5d4a3d', '#665244', '#6f5a4b', '#786252', '#816a59', '#8a7260', '#4f4036', '#6a6b62'],
      marks: ['#b8912f', '#9c3a2a', '#d2c9b8', '#2c2620', '#6a6f4e']
    }
  };

  GC.PALETTE_LIST = [];
  for (var pk in PALETTES) GC.PALETTE_LIST.push({ key: pk, label: PALETTES[pk].label });

  /* ---------------- Renderer ---------------- */

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    this.dpr = 1;
    this.w = 1;
    this.h = 1;
    this.scale = 24;
    this.cx = 0;
    this.cy = 0;
    this.elev = 0.9;
    this.az = 0;
    this.R = 20;
    this.RO = 22;
    this.showMarks = true;

    this.pal = null;
    this.palKey = null;
    this.bgGrad = null;

    this.plates = [];

    this._sorted = [];
    this._lastAz = null;
    this._lastR = null;
    this._lastBlocks = null;

    this._sinE = 1;
    this._sinA = 0;
    this._cosA = 1;

    this.stains = [];
    this._initStains();
  }

  Renderer.prototype._initStains = function () {
    this.stains = [];
    var seed = 20260419;
    function rnd() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (var i = 0; i < 10; i++) {
      this.stains.push({
        x: (rnd() - 0.5) * 92,
        y: (rnd() - 0.5) * 62,
        r: 6 + rnd() * 17,
        a: 0.04 + rnd() * 0.08,
        dark: rnd() > 0.3
      });
    }
  };

  Renderer.prototype.setPalette = function (key) {
    if (this.palKey === key) return;
    var p = PALETTES[key] || PALETTES.steel;
    this.palKey = key;

    var front = [], right = [];
    for (var i = 0; i < p.tones.length; i++) {
      front.push(shade(p.tones[i], 0.84));
      right.push(shade(p.tones[i], 0.64));
    }

    this.plates = [];
    for (i = 0; i < p.tones.length; i++) {
      this.plates.push(makePlate(p.tones[i], i * 977 + 13));
    }
    this.socketTex = makePlate('#2c2f2b', 991);

    this.pal = {
      floor0: p.floor0,
      floor1: p.floor1,
      deck: p.deck,
      rim: p.rim,
      rimInner: p.rimInner,
      rimLine: p.rimLine,
      bolt: p.bolt,
      stencil: p.stencil,
      hazard: p.hazard,
      marks: p.marks,
      tones: p.tones,
      front: front,
      right: right
    };
    this.bgGrad = null;
  };

  Renderer.prototype.resize = function (w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bgGrad = null;
  };

  Renderer.prototype._camera = function (tiltDeg, size, zoom) {
    var e = (tiltDeg * Math.PI) / 180;
    if (e < 0.02) e = 0.02;
    if (e > 1.545) e = 1.545;
    this.elev = e;
    var sinE = Math.sin(e);

    var R = Math.max(1, GC.DECK_R);
    var RO = R + 2.3;
    this.RO = RO;
    this.cx = this.w / 2;
    this.cy = this.h / 2 + this.h * 0.035;

    /* 让「圆盘 + 钢环」始终装进视口，避免大尺寸时边缘被切掉 */
    var room = Math.min(this.cy, this.h - this.cy) - 8;
    var fit = Math.min((this.w * 0.47) / RO, room / (RO * sinE));
    var want = GC.deckD(this.w, this.h, size) / (2 * R);

    this.scale = Math.min(want, fit) * (zoom || 1);
  };

  /* 按相机方位重新排绘制顺序（只在转动 / 改半径时重建） */
  Renderer.prototype._rebuildSorted = function (blocks, az) {
    var sinA = Math.sin(az), cosA = Math.cos(az);
    var arr = this._sorted;
    var n = 0, i, b;
    for (i = 0; i < blocks.length; i++) {
      b = blocks[i];
      if (b.d > this.R + 0.72) continue;
      b.dep = b.x * sinA + b.y * cosA;
      arr[n++] = i;
    }
    arr.length = n;
    arr.sort(function (p, q) { return blocks[p].dep - blocks[q].dep; });
  };

  /* ---------------- 画面 ---------------- */

  Renderer.prototype.frame = function (st, blocks, order, audio, t, dt) {
    this.t = t;
    this.showMarks = st.marks !== false;
    this.R = GC.DECK_R;
    this.setPalette(st.palette);
    this.az = st.az || 0;
    this._camera(st.tilt, st.size, st.zoom);

    if (this.az !== this._lastAz || this.R !== this._lastR || blocks !== this._lastBlocks) {
      this._lastAz = this.az;
      this._lastR = this.R;
      this._lastBlocks = blocks;
      this._rebuildSorted(blocks, this.az);
    }

    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._floorBg(ctx);

    var s = this.scale;
    var sinE = Math.sin(this.elev);
    var sinA = Math.sin(this.az);
    var cosA = Math.cos(this.az);
    this._sinE = sinE;
    this._sinA = sinA;
    this._cosA = cosA;

    ctx.setTransform(
      this.dpr * s * cosA,
      this.dpr * s * sinA * sinE,
      -this.dpr * s * sinA,
      this.dpr * s * cosA * sinE,
      this.dpr * this.cx,
      this.dpr * this.cy
    );

    this._stains(ctx);
    this._floorMarks(ctx);
    this._deck(ctx);
    this._rim(ctx);
    this._blocks(ctx, blocks);
  };

  Renderer.prototype._floorBg = function (ctx) {
    if (!this.bgGrad) {
      this.bgGrad = ctx.createLinearGradient(0, 0, 0, this.h);
      this.bgGrad.addColorStop(0, this.pal.floor0);
      this.bgGrad.addColorStop(1, this.pal.floor1);
    }
    ctx.fillStyle = this.bgGrad;
    ctx.fillRect(0, 0, this.w, this.h);
  };

  Renderer.prototype._stains = function (ctx) {
    for (var i = 0; i < this.stains.length; i++) {
      var st = this.stains[i];
      var g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.r);
      if (st.dark) {
        g.addColorStop(0, 'rgba(26,24,19,' + st.a.toFixed(3) + ')');
        g.addColorStop(0.7, 'rgba(26,24,19,' + (st.a * 0.45).toFixed(3) + ')');
      } else {
        g.addColorStop(0, 'rgba(154,148,136,' + (st.a * 0.6).toFixed(3) + ')');
        g.addColorStop(0.7, 'rgba(154,148,136,' + (st.a * 0.27).toFixed(3) + ')');
      }
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(st.x - st.r, st.y - st.r, st.r * 2, st.r * 2);
    }
  };

  Renderer.prototype._floorMarks = function (ctx) {
    var R = this.R;
    var pal = this.pal;

    /* 黄色安全线 */
    ctx.beginPath();
    ctx.arc(0, 0, R + 4.2, 0, TAU);
    ctx.setLineDash([0.7, 0.6]);
    ctx.lineWidth = 0.14;
    ctx.strokeStyle = css(parseHex(pal.hazard), 0.22);
    ctx.stroke();
    ctx.setLineDash([]);

    /* 地坪钢印 */
    this._floorText(ctx, 'РБМК-1000', -R - 6, -R - 1, 2.2, -0.05, 0.14);
    this._floorText(ctx, 'ОПАСНАЯ ЗОНА', R + 6.5, R + 1, 1.7, 0.05, 0.12);
    this._floorText(ctx, '4-Й БЛОК', -R - 7, R - 2, 1.5, 0.03, 0.1);
  };

  Renderer.prototype._floorText = function (ctx, text, wx, wy, size, rot, alpha) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(rot || 0);
    ctx.font = '700 ' + size + 'px "Arial Narrow","Roboto Condensed",Impact,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css(parseHex(this.pal.stencil), alpha);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  Renderer.prototype._deck = function (ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, this.R + 1.0, 0, TAU);
    ctx.fillStyle = this.pal.deck;
    ctx.fill();
  };

  /* ---------------- 外圈钢环 ---------------- */

  Renderer.prototype._hazard = function (ctx, a0, a1, r1, r2) {
    var p0 = [Math.cos(a0) * r1, Math.sin(a0) * r1];
    var p1 = [Math.cos(a1) * r1, Math.sin(a1) * r1];
    var p2 = [Math.cos(a1) * r2, Math.sin(a1) * r2];
    var p3 = [Math.cos(a0) * r2, Math.sin(a0) * r2];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = css(parseHex(this.pal.hazard), 0.75);
    ctx.fill();

    var minX = Math.min(p0[0], p1[0], p2[0], p3[0]) - 1;
    var maxX = Math.max(p0[0], p1[0], p2[0], p3[0]) + 1;
    var minY = Math.min(p0[1], p1[1], p2[1], p3[1]) - 1;
    var maxY = Math.max(p0[1], p1[1], p2[1], p3[1]) + 1;
    var span = maxY - minY;
    ctx.fillStyle = 'rgba(22,22,18,0.8)';
    var step = 0.34;
    for (var x = minX; x < maxX + span; x += step * 2) {
      ctx.beginPath();
      ctx.moveTo(x, maxY);
      ctx.lineTo(x + step, maxY);
      ctx.lineTo(x + step + span, minY);
      ctx.lineTo(x + span, minY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype._rim = function (ctx) {
    var R = this.R;
    var RIN = R + 0.05;          /* 方块铺满圆盘后，钢环从盘边开始 */
    var RO = this.RO;
    var pal = this.pal;
    var i, a, x, y, r;

    ctx.beginPath();
    ctx.arc(0, 0, RO, 0, TAU);
    ctx.arc(0, 0, RIN, 0, TAU);
    var g = ctx.createLinearGradient(-RO, -RO, RO, RO);
    g.addColorStop(0, mixCss(pal.rim, '#ffffff', 0.08));
    g.addColorStop(0.55, pal.rim);
    g.addColorStop(1, mixCss(pal.rim, '#000000', 0.35));
    ctx.fillStyle = g;
    ctx.fill('evenodd');

    for (i = 0; i < 4; i++) {
      this._hazard(ctx, i * (Math.PI / 2) + 0.12, i * (Math.PI / 2) + 0.55, R + 1.62, RO - 0.12);
    }

    /* 内 / 外圈线 */
    ctx.lineWidth = 0.12;
    ctx.strokeStyle = pal.rimLine;
    ctx.beginPath();
    ctx.arc(0, 0, RIN, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, RO, 0, TAU);
    ctx.stroke();

    /* 径向拼缝 */
    ctx.strokeStyle = 'rgba(26,26,22,0.45)';
    ctx.lineWidth = 0.05;
    for (i = 0; i < 56; i++) {
      a = (i / 56) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * RIN, Math.sin(a) * RIN);
      ctx.lineTo(Math.cos(a) * RO, Math.sin(a) * RO);
      ctx.stroke();
    }

    /* 两圈铆钉 */
    var rings = [R + 1.5, R + 2.2];
    for (var j = 0; j < rings.length; j++) {
      r = rings[j];
      for (i = 0; i < 96; i++) {
        a = (i / 96) * TAU + (j === 1 ? 0.016 : 0);
        x = Math.cos(a) * r;
        y = Math.sin(a) * r;
        ctx.fillStyle = pal.bolt;
        ctx.beginPath();
        ctx.arc(x, y, 0.068, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(230,232,225,0.14)';
        ctx.beginPath();
        ctx.arc(x - 0.022, y - 0.022, 0.03, 0, TAU);
        ctx.fill();
      }
    }

    /* 整体压一层 */
    ctx.beginPath();
    ctx.arc(0, 0, RO, 0, TAU);
    ctx.arc(0, 0, RIN, 0, TAU);
    ctx.fillStyle = 'rgba(14,16,12,0.1)';
    ctx.fill('evenodd');
  };

  /* ---------------- 钢板 ---------------- */

  /* 每个格子的底座，保证格子下面永远有东西 */
  Renderer.prototype._sockets = function (ctx, blocks) {
    var arr = this._sorted;
    var BW = 0.985, HB = 0.4925;
    for (var j = 0; j < arr.length; j++) {
      var sb = blocks[arr[j]];
      ctx.drawImage(this.socketTex, sb.x - HB, sb.y - HB, BW, BW);
    }
  };

  Renderer.prototype._blocks = function (ctx, blocks) {
    var arr = this._sorted;
    var pal = this.pal;
    var plates = this.plates;
    var sinE = this._sinE, sinA = this._sinA, cosA = this._cosA;
    var BW = 0.985, HB = 0.4925;
    var kLift = 1 / Math.max(0.09, sinE);

    this._sockets(ctx, blocks);

    /* 可见侧面：屏幕朝下的那两个面 */
    var showYp = cosA > 0.001;
    var showYn = cosA < -0.001;
    var showXp = sinA > 0.001;
    var showXn = sinA < -0.001;

    for (var k = 0; k < arr.length; k++) {
      var b = blocks[arr[k]];
      var x = b.x, y = b.y;
      var Lz = b.z * 0.85;
      if (!(Lz > 0)) Lz = 0;
      var ox = -Lz * kLift * sinA;
      var oy = -Lz * kLift * cosA;
      var lifted = b.z > 0.03;

      if (lifted) {
        var fStyle = pal.front[b.tone];
        var rStyle = pal.right[b.tone];

        if (showYp) {
          ctx.fillStyle = fStyle;
          ctx.beginPath();
          ctx.moveTo(x - HB, y + HB);
          ctx.lineTo(x + HB, y + HB);
          ctx.lineTo(x + HB + ox, y + HB + oy);
          ctx.lineTo(x - HB + ox, y + HB + oy);
          ctx.closePath();
          ctx.fill();

          /* 长柱子根部压暗，别像一块平板 */
          if (Lz > 1.4) {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.moveTo(x - HB, y + HB);
            ctx.lineTo(x + HB, y + HB);
            ctx.lineTo(x + HB + ox * 0.32, y + HB + oy * 0.32);
            ctx.lineTo(x - HB + ox * 0.32, y + HB + oy * 0.32);
            ctx.closePath();
            ctx.fill();
          }

          /* 侧壁顶棱的高光，让柱子有金属转折 */
          ctx.strokeStyle = 'rgba(255,250,235,0.16)';
          ctx.lineWidth = 0.05;
          ctx.beginPath();
          ctx.moveTo(x - HB + ox, y + HB + oy);
          ctx.lineTo(x + HB + ox, y + HB + oy);
          ctx.stroke();
        }
        if (showYn) {
          ctx.fillStyle = fStyle;
          ctx.beginPath();
          ctx.moveTo(x + HB, y - HB);
          ctx.lineTo(x - HB, y - HB);
          ctx.lineTo(x - HB + ox, y - HB + oy);
          ctx.lineTo(x + HB + ox, y - HB + oy);
          ctx.closePath();
          ctx.fill();
        }
        if (showXp) {
          ctx.fillStyle = rStyle;
          ctx.beginPath();
          ctx.moveTo(x + HB, y - HB);
          ctx.lineTo(x + HB, y + HB);
          ctx.lineTo(x + HB + ox, y + HB + oy);
          ctx.lineTo(x + HB + ox, y - HB + oy);
          ctx.closePath();
          ctx.fill();
        }
        if (showXn) {
          ctx.fillStyle = rStyle;
          ctx.beginPath();
          ctx.moveTo(x - HB, y + HB);
          ctx.lineTo(x - HB, y - HB);
          ctx.lineTo(x - HB + ox, y - HB + oy);
          ctx.lineTo(x - HB + ox, y + HB + oy);
          ctx.closePath();
          ctx.fill();
        }
      }

      var tx = x - HB + ox;
      var ty = y - HB + oy;

      ctx.drawImage(plates[b.tone], tx, ty, BW, BW);

      if (lifted) {
        ctx.fillStyle = 'rgba(255,252,238,0.05)';
        ctx.fillRect(tx, ty, BW, BW);
      }

      ctx.fillStyle = 'rgba(24,26,22,0.5)';
      ctx.fillRect(x + ox - 0.075, y + oy - 0.075, 0.15, 0.15);
      if (b.mark >= 0 && this.showMarks) {
        ctx.fillStyle = pal.marks[b.mark];
        ctx.fillRect(x + ox + b.mx - 0.15, y + oy + b.my - 0.15, 0.3, 0.3);
      }
    }
  };

  GC.Renderer = Renderer;
  GC.colorUtils = { parseHex: parseHex, css: css, mixRgb: mixRgb, mixCss: mixCss, shade: shade };
})();
