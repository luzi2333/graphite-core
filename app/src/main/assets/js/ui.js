/* 控制面板 · 拖放 · 快捷键 · 波形概览 */
(function () {
  'use strict';
  var GC = (window.GC = window.GC || {});
  var $ = function (id) { return document.getElementById(id); };

  var UI = {
    _app: null,
    _el: null,
    _ovw: 0,
    _ovh: 0,
    _acc: 0
  };

  UI.init = function (app) {
    var state = app.state;
    var audio = app.audio;

    var el = {
      panel: $('panel'),
      body: $('panelBody'),
      collapse: $('collapseBtn'),
      file: $('fileInput'),
      demo: $('demoBtn'),
      mic: $('micBtn'),
      track: $('trackName'),
      overview: $('overview'),
      play: $('playBtn'),
      time: $('timeLabel'),
      vol: $('vol'), volVal: $('volVal'),
      amp: $('amp'), ampVal: $('ampVal'),
      contrast: $('contrast'), contrastVal: $('contrastVal'),
      pattern: $('pattern'),
      sens: $('sens'), sensVal: $('sensVal'),
      speed: $('speed'), speedVal: $('speedVal'),
      inertia: $('inertia'), inertiaVal: $('inertiaVal'),
      size: $('size'), sizeVal: $('sizeVal'),
      bandMode: $('bandMode'),
      palette: $('palette'),
      capture: $('captureBtn'),
      srcLabel: $('srcLabel'),
      full: $('fullBtn'),
      hint: $('hint'),
      err: $('err'),
      hud: $('hud')
    };
    UI._el = el;
    UI._app = app;

    /* ---------- 下拉 ---------- */

    var i, k, opt;
    for (i = 0; i < GC.PATTERN_ORDER.length; i++) {
      k = GC.PATTERN_ORDER[i];
      opt = document.createElement('option');
      opt.value = k;
      opt.textContent = (i + 1) + ' · ' + GC.Patterns[k].label;
      el.pattern.appendChild(opt);
    }
    el.pattern.value = state.pattern;
    el.pattern.addEventListener('change', function () {
      state.pattern = el.pattern.value;
      app.save();
      hideHint();
    });

    for (i = 0; i < GC.PALETTE_LIST.length; i++) {
      opt = document.createElement('option');
      opt.value = GC.PALETTE_LIST[i].key;
      opt.textContent = GC.PALETTE_LIST[i].label;
      el.palette.appendChild(opt);
    }
    el.palette.value = state.palette;
    el.palette.addEventListener('change', function () {
      state.palette = el.palette.value;
      app.save();
    });

    el.bandMode.value = state.bandMode;
    el.bandMode.addEventListener('change', function () {
      state.bandMode = el.bandMode.value;
      app.save();
    });

    /* ---------- 滑块 ---------- */

    function bindRange(input, out, getter, setter, fmt) {
      input.value = getter();
      if (out) out.textContent = fmt(getter());
      input.addEventListener('input', function () {
        setter(parseFloat(input.value));
        if (out) out.textContent = fmt(getter());
        app.save();
        hideHint();
      });
    }

    bindRange(el.amp, el.ampVal,
      function () { return state.amplitude * 100; },
      function (v) { state.amplitude = v / 100; },
      function (v) { return Math.round(v) + '%'; });

    bindRange(el.contrast, el.contrastVal,
      function () { return state.contrast * 100; },
      function (v) { state.contrast = v / 100; },
      function (v) { return Math.round(v) + '%'; });

    bindRange(el.sens, el.sensVal,
      function () { return state.sensitivity; },
      function (v) { state.sensitivity = v; },
      function (v) { return v.toFixed(2) + '×'; });

    bindRange(el.speed, el.speedVal,
      function () { return state.waveSpeed; },
      function (v) { state.waveSpeed = v; },
      function (v) { return v.toFixed(2); });

    bindRange(el.inertia, el.inertiaVal,
      function () { return state.inertia; },
      function (v) { state.inertia = v; },
      function (v) { return v.toFixed(1); });

    bindRange(el.size, el.sizeVal,
      function () { return state.size * 100; },
      function (v) { state.size = v / 100; },
      function (v) { return Math.round(v) + '%'; });

    bindRange(el.vol, el.volVal,
      function () { return state.volume * 100; },
      function (v) { state.volume = v / 100; audio.setVolume(state.volume); },
      function (v) { return Math.round(v); });

    /* ---------- 开关 ---------- */

    var checks = [
      ['chkMarks', 'marks'],
      ['chkHud', 'hud']
    ];
    for (i = 0; i < checks.length; i++) {
      (function (input, key) {
        input.checked = !!state[key];
        input.addEventListener('change', function () {
          state[key] = input.checked;
          if (key === 'hud') el.hud.classList.toggle('off', !state.hud);
          app.save();
        });
      })($(checks[i][0]), checks[i][1]);
    }
    el.hud.classList.toggle('off', !state.hud);

    /* ---------- 音频 ---------- */

    el.file.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f) app.loadFile(f);
      this.value = '';
    });

    el.demo.addEventListener('click', function () {
      app.useDemo();
    });

    el.mic.addEventListener('click', function () {
      app.mic();
    });

    el.capture.addEventListener('click', function () {
      app.capture();
    });

    el.play.addEventListener('click', function () {
      app.togglePlay();
    });

    el.overview.addEventListener('click', function (ev) {
      var r = el.overview.getBoundingClientRect();
      app.seek((ev.clientX - r.left) / Math.max(1, r.width));
    });

    el.full.addEventListener('click', toggleFullscreen);

    el.collapse.addEventListener('click', function () {
      el.panel.classList.toggle('collapsed');
    });

    /* ---------- 拖放 ---------- */

    var dragDepth = 0;
    window.addEventListener('dragenter', function (ev) {
      ev.preventDefault();
      dragDepth++;
      document.body.classList.add('dragging');
    });
    window.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    window.addEventListener('dragleave', function (ev) {
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        document.body.classList.remove('dragging');
      }
    });
    window.addEventListener('drop', function (ev) {
      ev.preventDefault();
      dragDepth = 0;
      document.body.classList.remove('dragging');
      var files = ev.dataTransfer && ev.dataTransfer.files;
      if (!files || !files.length) return;
      for (var j = 0; j < files.length; j++) {
        if (/^audio\//.test(files[j].type) || /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(files[j].name)) {
          app.loadFile(files[j]);
          return;
        }
      }
      UI.error('这不是音频文件：' + files[0].name);
    });

    /* ---------- 拖动环绕 / 双指缩放 ---------- */

    var stage = $('stage');
    var drag = null;
    var pointers = {};
    var pinchDist = 0;

    function pointerCount() {
      var n = 0;
      for (var k in pointers) {
        if (Object.prototype.hasOwnProperty.call(pointers, k)) n++;
      }
      return n;
    }

    function pinchLength() {
      var pts = [], k;
      for (k in pointers) {
        if (Object.prototype.hasOwnProperty.call(pointers, k)) pts.push(pointers[k]);
      }
      if (pts.length < 2) return 0;
      var dx = pts[0].x - pts[1].x;
      var dy = pts[0].y - pts[1].y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    stage.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      try { stage.setPointerCapture(ev.pointerId); } catch (e) {}

      if (pointerCount() >= 2) {
        drag = null;
        pinchDist = pinchLength();
        stage.classList.add('grabbing');
      } else {
        drag = { x: ev.clientX, y: ev.clientY };
        stage.classList.add('grabbing');
      }
      hideHint();
    });

    window.addEventListener('pointermove', function (ev) {
      if (!pointers[ev.pointerId]) return;
      pointers[ev.pointerId].x = ev.clientX;
      pointers[ev.pointerId].y = ev.clientY;

      if (pointerCount() >= 2) {
        var d = pinchLength();
        if (pinchDist > 0 && d > 0) app.pinch(d / pinchDist);
        pinchDist = d;
        return;
      }

      if (!drag) return;
      var dx = ev.clientX - drag.x;
      var dy = ev.clientY - drag.y;
      drag.x = ev.clientX;
      drag.y = ev.clientY;
      app.orbit(dx, dy);
    });

    function endPointer(ev) {
      if (pointers[ev.pointerId]) delete pointers[ev.pointerId];
      if (pointerCount() < 2) pinchDist = 0;

      if (pointerCount() === 1) {
        var only = null, k;
        for (k in pointers) {
          if (Object.prototype.hasOwnProperty.call(pointers, k)) only = pointers[k];
        }
        drag = only ? { x: only.x, y: only.y } : null;
      } else if (pointerCount() === 0) {
        drag = null;
        stage.classList.remove('grabbing');
        app.save();
      }
    }
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    /* 滚轮缩放 */
    stage.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      app.zoomBy(ev.deltaY);
      hideHint();
    }, { passive: false });

    /* ---------- 快捷键 ---------- */

    window.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;

      var key = ev.key;
      if (key === ' ') {
        ev.preventDefault();
        app.togglePlay();
      } else if (key === 'ArrowLeft') {
        ev.preventDefault();
        app.nudge(-5);
      } else if (key === 'ArrowRight') {
        ev.preventDefault();
        app.nudge(5);
      } else if (key === 'ArrowUp') {
        ev.preventDefault();
        state.amplitude = Math.min(3, state.amplitude + 0.1);
        syncAmp();
      } else if (key === 'ArrowDown') {
        ev.preventDefault();
        state.amplitude = Math.max(0, state.amplitude - 0.1);
        syncAmp();
      } else if (key === 'f' || key === 'F') {
        toggleFullscreen();
      } else if (key === 'h' || key === 'H') {
        el.panel.classList.toggle('hidden');
      } else if (/^[1-8]$/.test(key)) {
        var idx = parseInt(key, 10) - 1;
        if (GC.PATTERN_ORDER[idx]) {
          state.pattern = GC.PATTERN_ORDER[idx];
          el.pattern.value = state.pattern;
          app.save();
        }
      }
    });

    function syncAmp() {
      el.amp.value = state.amplitude * 100;
      el.ampVal.textContent = Math.round(state.amplitude * 100) + '%';
      app.save();
    }

    /* ---------- 概览画布 ---------- */

    var ov = el.overview;
    var ovc = ov.getContext('2d');
    function sizeOverview() {
      var r = ov.getBoundingClientRect();
      if (r.width < 2) return;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      UI._ovw = r.width;
      UI._ovh = r.height;
      ov.width = Math.max(1, Math.round(r.width * dpr));
      ov.height = Math.max(1, Math.round(r.height * dpr));
      ovc.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawOverview();
    }
    UI._sizeOverview = sizeOverview;
    sizeOverview();

    function drawOverview() {
      var w = UI._ovw, h = UI._ovh;
      if (!w) return;
      ovc.clearRect(0, 0, w, h);
      var mid = h / 2;
      var peaks = audio.peaks;
      if (peaks && peaks.length) {
        var n = peaks.length, bw = w / n;
        ovc.fillStyle = 'rgba(150,175,185,0.4)';
        for (var j = 0; j < n; j++) {
          var hh = Math.max(0.7, peaks[j] * mid * 0.92);
          ovc.fillRect(j * bw, mid - hh, Math.max(0.7, bw * 0.72), hh * 2);
        }
        var dur = audio.duration || 1;
        var px = (audio.currentTime() / dur) * w;
        ovc.fillStyle = 'rgba(255,138,60,0.9)';
        ovc.fillRect(Math.max(0, px - 0.5), 0, 1, h);
      } else {
        ovc.strokeStyle = 'rgba(120,140,150,0.22)';
        ovc.lineWidth = 1;
        ovc.beginPath();
        ovc.moveTo(0, mid + 0.5);
        ovc.lineTo(w, mid + 0.5);
        ovc.stroke();
      }
    }
    UI._drawOverview = drawOverview;

    window.addEventListener('resize', function () {
      sizeOverview();
    });

    /* ---------- 首次提示 ---------- */

    var hideHint = function () {
      if (el.hint) el.hint.classList.add('gone');
    };
    UI._hideHint = hideHint;
    setTimeout(hideHint, 9000);
  };

  /* 主循环里调用：更新时间和播放状态 */
  UI.tick = function (dt) {
    var app = UI._app;
    if (!app) return;
    var el = UI._el;
    var audio = app.audio;

    var mode = audio.mode;
    if (UI._mode !== mode) {
      UI._mode = mode;
      el.play.disabled = mode !== 'file';

      var sysOn = mode === 'system';
      el.capture.classList.toggle('on', sysOn);
      el.capture.textContent = sysOn ? '停止捕捉' : '捕捉电脑声音';

      var micOn = mode === 'mic';
      el.mic.classList.toggle('on', micOn);
      el.mic.textContent = micOn ? '停止监听' : '麦克风';

      if (el.srcLabel) {
        el.srcLabel.textContent = sysOn ? '系统声音'
          : (micOn ? '麦克风' : (mode === 'file' ? '本地文件' : '演示中'));
      }
    }

    var paused = mode === 'demo' || (mode === 'file' && audio.isPaused());
    var label = (mode === 'system' || mode === 'mic') ? '直播中' : (paused ? '播放' : '暂停');
    if (label !== UI._playLabel) {
      UI._playLabel = label;
      el.play.textContent = label;
    }

    var cur = audio.currentTime();
    var dur = audio.duration || 0;
    if (el.time) {
      var ts = fmtTime(cur) + ' / ' + fmtTime(dur);
      if (ts !== UI._timeText) {
        UI._timeText = ts;
        el.time.textContent = ts;
      }
    }

    UI._acc += dt;
    if (UI._acc > 0.08) {
      UI._acc = 0;
      if (UI._drawOverview) UI._drawOverview();
    }
  };

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60);
    var ss = Math.floor(s % 60);
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      var p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      if (p && p.catch) p.catch(function () {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  UI.error = function (msg) {
    var el = $('err');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(UI._errTimer);
    UI._errTimer = setTimeout(function () { el.classList.remove('on'); }, 6500);
  };

  UI.trackName = function (text) {
    if (UI._el) UI._el.track.textContent = text;
  };

  /* Android App 里隐藏网页的声源选择，只显示「系统音频」 */
  UI.setNative = function (on) {
    var note = $('nativeNote');
    var controls = $('srcControls');
    var hint = $('hint');
    if (controls) controls.style.display = on ? 'none' : '';
    if (note) note.style.display = on ? 'block' : 'none';
    if (hint && on) hint.classList.add('gone');
  };

  GC.UI = UI;
})();
