/* 主循环：状态 · 每帧驱动 · 钢板抬升 */
(function () {
  'use strict';
  var GC = window.GC;

  var DEFAULTS = {
    amplitude: 1,
    contrast: 1,
    sensitivity: 1,
    waveSpeed: 1,
    inertia: 1,
    pattern: 'radial',
    tilt: 54,
    az: 0,
    zoom: 1,
    size: 1,
    bandMode: 'radial',
    palette: 'steel',
    marks: true,
    hud: true,
    volume: 0.85
  };

  var state = {};
  for (var dk in DEFAULTS) state[dk] = DEFAULTS[dk];

  try {
    var raw = localStorage.getItem('graphite-core.v3');
    if (raw) {
      var saved = JSON.parse(raw);
      for (var sk in saved) {
        if (Object.prototype.hasOwnProperty.call(DEFAULTS, sk)) state[sk] = saved[sk];
      }
    }
  } catch (e) { /* 隐私模式下忽略 */ }

  var canvas = document.getElementById('stage');
  var renderer = new GC.Renderer(canvas);
  var audio = new GC.AudioEngine();
  var blocks = GC.buildLattice();
  var order = GC.sortByDepth(blocks);

  audio.inertia = state.inertia;
  audio.setVolume(state.volume);

  var saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem('graphite-core.v3', JSON.stringify(state)); } catch (e) {}
    }, 260);
  }

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var dpr = Math.min(1.5, window.devicePixelRatio || 1);
    renderer.resize(w, h, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- 应用接口 ---------------- */

  var app = {
    state: state,
    audio: audio,
    save: save,
    loadFile: function (file) {
      audio.loadFile(file).then(function () {
        GC.UI.trackName(file.name);
        audio.play();
        if (GC.UI._hideHint) GC.UI._hideHint();
      }).catch(function (err) {
        GC.UI.error(err && err.message ? err.message : '载入失败');
      });
    },
    capture: function () {
      if (audio.mode === 'system') {
        audio.stopSystem(true);
        GC.UI.trackName('演示信号 · 124 BPM');
        return;
      }
      if (audio.mode === 'mic') audio.stopSystem(true);
      audio.startSystem().then(function () {
        GC.UI.trackName('电脑声音 · 正在捕捉');
        if (GC.UI._hideHint) GC.UI._hideHint();
      }).catch(function (err) {
        var msg;
        if (err && err.name === 'NotAllowedError') {
          msg = '已取消授权。要跟系统声音跳，得在弹窗里选「整个屏幕」，并勾选底部的「分享系统音频」';
        } else {
          msg = err && err.message ? err.message : '捕捉失败';
        }
        GC.UI.error(msg);
      });
    },
    useDemo: function () {
      audio.useDemo();
      GC.UI.trackName('演示信号 · 124 BPM');
    },
    mic: function () {
      if (audio.mode === 'mic') {
        audio.stopSystem(false);
        return;
      }
      if (audio.mode === 'system') audio.stopSystem(true);
      audio.startMic().then(function () {
        GC.UI.trackName('麦克风 · 正在监听');
        if (GC.UI._hideHint) GC.UI._hideHint();
      }).catch(function (err) {
        var msg;
        if (err && err.name === 'NotAllowedError') {
          msg = '麦克风权限被拒绝，到浏览器地址栏的站点设置里允许麦克风';
        } else {
          msg = err && err.message ? err.message : '麦克风打不开';
        }
        GC.UI.error(msg);
      });
    },
    pinch: function (f) {
      if (!(f > 0)) return;
      var z = state.zoom * f;
      if (z < 0.45) z = 0.45;
      if (z > 2.8) z = 2.8;
      state.zoom = z;
    },
    togglePlay: function () {
      if (audio.mode === 'demo') {
        GC.UI.error('先载入音频，或点「捕捉电脑声音」直接听电脑里正在放的歌');
        return;
      }
      if (audio.mode === 'system') return;
      audio.toggle();
    },
    seek: function (frac) {
      if (audio.mode !== 'file' || !audio.duration) return;
      audio.seek(Math.max(0, Math.min(1, frac)));
    },
    nudge: function (sec) {
      if (audio.mode !== 'file' || !audio.duration) return;
      audio.seek((audio.currentTime() + sec) / audio.duration);
    },
    /* 拖动环绕：左右转方位，上下抬/压俯角，压到水平面就停住 */
    orbit: function (dx, dy) {      state.az -= dx * 0.008;
      if (state.az > Math.PI * 2) state.az -= Math.PI * 2;
      if (state.az < -Math.PI * 2) state.az += Math.PI * 2;
      var t = state.tilt + dy * 0.11;
      if (t < 6) t = 6;
      if (t > 86) t = 86;
      state.tilt = t;
    },
    /* 滚轮缩放 */
    zoomBy: function (deltaY) {
      var z = state.zoom * Math.exp(-deltaY * 0.0012);
      if (z < 0.45) z = 0.45;
      if (z > 2.8) z = 2.8;
      state.zoom = z;
      save();
    }
  };

  audio.onPeaks = function () {
    if (GC.UI._drawOverview) GC.UI._drawOverview();
  };

  audio.onEnded = function () {
    GC.UI.trackName('演示信号 · 124 BPM');
    GC.UI.error('系统声音捕捉已结束，需要的话再点一次「捕捉电脑声音」');
  };

  GC.UI.init(app);

  /* ---------------- 每帧 ---------------- */

  var time = 0;
  var last = performance.now();
  var hudAcc = 0;
  var fpsSm = 60;
  var activeCount = 0;
  var hudEl = document.getElementById('hud');

  function updateBlocks(dt) {
    var pattern = GC.Patterns[state.pattern] || GC.Patterns.radial;
    var gain = pattern.gain || 1;
    var amp = state.amplitude;
    var sens = state.sensitivity;
    var kA = 1 - Math.exp(-dt / 0.05);
    var kR = 1 - Math.exp(-dt / 0.16);
    var sector = state.bandMode === 'sector';
    var R = GC.DECK_R;
    var lscope = R + 0.72;
    var lut = GC.bandLUT;
    var active = 0;
    var maxE = 0;
    var i, b, band, E, f, target, k;

    /* 第一遍：算目标能量、平滑、找这一帧的最大值 */
    for (i = 0; i < blocks.length; i++) {
      b = blocks[i];
      if (b.d > lscope) {
        b.e = 0;
        b.z = 0;
        continue;
      }
      active++;

      var rn = b.d / R;
      if (rn > 1) rn = 1;          /* 外圈格子的中心会超出半径，必须夹住，否则查表越界变 NaN */
      if (rn < 0) rn = 0;
      b.rn = rn;
      band = sector ? b.bandS : lut[(rn * 255) | 0];
      E = audio.env[band];

      f = pattern.fn(b, time, state.waveSpeed);
      target = E * (0.22 + 0.95 * f) * gain;
      if (target > 6) target = 6;
      if (target < 0) target = 0;

      k = target > b.e ? kA : kR;
      b.e += (target - b.e) * k;
      if (b.e > maxE) maxE = b.e;
    }

    /* 第二遍：按本帧最大值归一化，再用落差曲线分配高度 */
    var base = maxE > 1.2 ? maxE : 1.2;
    var gamma = 0.35 + state.contrast * 1.2;

    /* 堆芯越大，抬得越高：高度直接跟「大小」滑杆走 */
    var sizeK = state.size;
    if (sizeK < 0.55) sizeK = 0.55;
    if (sizeK > 1.3) sizeK = 1.3;

    /* 灵敏度直接作用在高度上（归一化之后它才有意义） */
    var sensK = 0.55 + sens * 0.45;
    var ampK = amp * 7.0 * sizeK * sensK;

    for (i = 0; i < blocks.length; i++) {
      b = blocks[i];
      if (b.d > lscope) continue;
      var n = b.e / base;
      if (n > 1) n = 1;
      if (n < 0) n = 0;
      /* 死区：低于峰值 34% 的块完全贴平，只有真正强的位置才起来 */
      var nn = (n - 0.34) / 0.66;
      if (nn < 0) nn = 0;
      var z = Math.pow(nn, gamma) * ampK;
      b.z = z > GC.MAX_LIFT ? GC.MAX_LIFT : z;
    }
    return active;
  }

  function hudTick(dt) {
    fpsSm += (1 / Math.max(dt, 0.001) - fpsSm) * 0.04;
    hudAcc += dt;
    if (hudAcc < 0.25) return;
    hudAcc = 0;
    if (!state.hud || !hudEl) return;
    var p = GC.Patterns[state.pattern];
    var src = audio.mode === 'system' ? 'SYS' : (audio.mode === 'file' ? 'FILE' : 'DEMO');
    var azDeg = Math.round(((state.az * 180) / Math.PI) % 360);
    if (azDeg < 0) azDeg += 360;
    hudEl.textContent =
      'FPS ' + fpsSm.toFixed(0) + '   RMS ' + audio.rms.toFixed(2) + '   LOW ' + audio.lowSmooth.toFixed(2) +
      '\n' + (p ? p.label : '—') + '   幅度 ' + Math.round(state.amplitude * 100) + '%   落差 ' + Math.round(state.contrast * 100) + '%   大小 ' + Math.round(state.size * 100) + '%' +
      '\n' + src + '   俯角 ' + Math.round(state.tilt) + '°   方位 ' + azDeg + '°   缩放 ' + Math.round(state.zoom * 100) + '%   ' + activeCount + ' 块';
  }

  function frame(now) {
    requestAnimationFrame(frame);

    var dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt) || dt <= 0) dt = 0.016;
    if (dt > 0.05) dt = 0.05;
    time += dt;

    audio.inertia = state.inertia;
    audio.update(dt);

    GC.DECK_R = GC.deckRFor(renderer.w, renderer.h, state.size);
    activeCount = updateBlocks(dt);

    renderer.frame(state, blocks, order, audio, time, dt);

    GC.UI.tick(dt);
    hudTick(dt);
  }

  window.addEventListener('error', function (ev) {
    if (GC.UI && GC.UI.error) {
      GC.UI.error('脚本错误：' + (ev.message || '未知') + ' @ ' + (ev.lineno || '?'));
    }
  });

  requestAnimationFrame(frame);
})();
