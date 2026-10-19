/* 音频引擎：本地文件 / 捕捉电脑声音 / 演示信号 · 频谱分带 · 包络 */
(function () {
  'use strict';
  var GC = (window.GC = window.GC || {});

  var BANDS = 24;
  var FMIN = 38;
  var FMAX = 16500;

  function computePeaks(ab, n) {
    var ch = ab.numberOfChannels;
    var len = ab.length;
    var out = new Float32Array(n);
    var data = [];
    for (var c = 0; c < ch; c++) data.push(ab.getChannelData(c));
    var per = Math.max(1, Math.floor(len / n));
    for (var i = 0; i < n; i++) {
      var s = i * per;
      var e = Math.min(len, s + per);
      var m = 0;
      for (var j = s; j < e; j += 2) {
        for (var c2 = 0; c2 < ch; c2++) {
          var v = data[c2][j];
          if (v < 0) v = -v;
          if (v > m) m = v;
        }
      }
      out[i] = m;
    }
    var mx = 0;
    for (var k = 0; k < n; k++) if (out[k] > mx) mx = out[k];
    if (mx > 0) for (var k2 = 0; k2 < n; k2++) out[k2] /= mx;
    return out;
  }

  function AudioEngine() {
    this.ctx = null;
    this.el = null;
    this.srcNode = null;
    this.gain = null;
    this.mute = null;
    this.fileAnalyser = null;
    this.sysAnalyser = null;
    this.analyser = null;
    this.freq = null;
    this.timeData = null;
    this.bandRanges = null;

    this.raw = new Float32Array(BANDS);
    this.env = new Float32Array(BANDS);
    this.peak = new Float32Array(BANDS);
    for (var i = 0; i < BANDS; i++) this.peak[i] = 0.14;

    this.waveOut = new Float32Array(256);

    this.rms = 0;
    this.low = 0;
    this.lowSmooth = 0;
    this.hist = [];
    this.histLen = 42;
    this.lastBeatAt = -9;
    this.beatNow = false;
    this.beatStrength = 0;

    this.t = 0;
    this.mode = 'demo';          /* demo | file | system */
    this.hasFile = false;
    this.playing = false;
    this.duration = 0;
    this.peaks = null;
    this.volume = 0.85;
    this.inertia = 1;
    this.onPeaks = null;

    this.displayStream = null;
    this.micStream = null;
    this.systemSrc = null;
    this.streamActive = false;
    this._stopping = false;
  }

  /* ---------------- context ---------------- */

  AudioEngine.prototype._makeAnalyser = function () {
    var a = this.ctx.createAnalyser();
    a.fftSize = 2048;
    a.smoothingTimeConstant = 0.55;
    return a;
  };

  AudioEngine.prototype._ensureCtx = function () {
    if (this.ctx) return this.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('这个浏览器不支持 Web Audio');
    var ctx = new AC();
    this.ctx = ctx;

    /* 文件：gain → fileAnalyser → destination（能听见） */
    this.gain = ctx.createGain();
    this.gain.gain.value = this.volume;
    this.fileAnalyser = this._makeAnalyser();
    this.gain.connect(this.fileAnalyser);
    this.fileAnalyser.connect(ctx.destination);

    /* 系统声：sysAnalyser → 0 增益 → destination（只为让图有效，不出声） */
    this.mute = ctx.createGain();
    this.mute.gain.value = 0;
    this.mute.connect(ctx.destination);
    this.sysAnalyser = this._makeAnalyser();
    this.sysAnalyser.connect(this.mute);

    this.analyser = this.fileAnalyser;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this._buildBands();
    return ctx;
  };

  AudioEngine.prototype._buildBands = function () {
    var nyq = this.ctx.sampleRate / 2;
    var n = this.analyser.frequencyBinCount;
    var ranges = [];
    for (var b = 0; b < BANDS; b++) {
      var f0 = FMIN * Math.pow(FMAX / FMIN, b / BANDS);
      var f1 = FMIN * Math.pow(FMAX / FMIN, (b + 1) / BANDS);
      var i0 = Math.round((f0 / nyq) * n);
      var i1 = Math.round((f1 / nyq) * n);
      if (i0 < 1) i0 = 1;
      if (i1 > n - 1) i1 = n - 1;
      if (i1 <= i0) i1 = i0 + 1;
      ranges.push([i0, i1]);
    }
    this.bandRanges = ranges;
  };

  /* ---------------- 文件 ---------------- */

  AudioEngine.prototype.loadFile = function (file) {
    var self = this;
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stopSystem(true);

    return new Promise(function (resolve, reject) {
      var el = new Audio();
      el.preload = 'auto';
      el.src = URL.createObjectURL(file);
      var settled = false;

      el.addEventListener('loadedmetadata', function () {
        if (settled) return;
        settled = true;
        try {
          if (self.srcNode) self.srcNode.disconnect();
          if (self.el && self.el !== el) self.el.pause();
        } catch (e) {}
        try {
          self.srcNode = self.ctx.createMediaElementSource(el);
          self.srcNode.connect(self.gain);
        } catch (e2) {
          reject(new Error('音频节点创建失败：' + e2.message));
          return;
        }
        self.el = el;
        self.mode = 'file';
        self.hasFile = true;
        self.duration = el.duration || 0;
        self.peaks = null;
        self.analyser = self.fileAnalyser;
        self.gain.gain.value = self.volume;
        resolve(el);
      });

      el.addEventListener('error', function () {
        if (settled) return;
        settled = true;
        reject(new Error('无法解码这个音频，试试 mp3 / wav / ogg / flac / m4a'));
      });

      file.arrayBuffer().then(function (buf) {
        return self.ctx.decodeAudioData(buf);
      }).then(function (ab) {
        self.peaks = computePeaks(ab, 320);
        if (self.onPeaks) self.onPeaks(self.peaks, ab.duration);
      }).catch(function () {});
    });
  };

  AudioEngine.prototype.stopFile = function () {
    if (this.el) {
      try { this.el.pause(); } catch (e) {}
    }
    this.hasFile = false;
    this.duration = 0;
  };

  /* ---------------- 系统声音 ---------------- */

  AudioEngine.prototype.startSystem = function () {
    var self = this;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      return Promise.reject(new Error(mobile
        ? '手机浏览器不支持抓系统声音，可以点「麦克风」让它听周围的声音'
        : '这个浏览器不支持捕捉系统声音，请用 Chrome 或 Edge'));
    }
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    var req;
    try {
      /* 尽量把弹窗预置成「整个屏幕 + 分享系统音频」 */
      req = navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: { systemAudio: 'include', suppressLocalAudioPlayback: true },
        systemAudio: 'include',
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        monitorTypeSurfaces: 'include',
        preferCurrentTab: false
      });
    } catch (e0) {
      return Promise.reject(e0);
    }

    return req.then(function (stream) {
      var tracks = stream.getAudioTracks();
      if (!tracks.length) {
        try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        throw new Error('没拿到声音：弹窗里请选「整个屏幕」，并勾选底部的「分享系统音频」');
      }

      if (self.displayStream) {
        try { self.displayStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {}
      }
      self.displayStream = stream;
      if (self.micStream) {
        try { self.micStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {}
        self.micStream = null;
      }
      self.stopFile();

      var audioOnly = new MediaStream();
      audioOnly.addTrack(tracks[0]);
      try {
        if (self.systemSrc) self.systemSrc.disconnect();
        self.systemSrc = self.ctx.createMediaStreamSource(audioOnly);
        self.systemSrc.connect(self.sysAnalyser);
      } catch (e3) {
        throw new Error('建立音频源失败：' + e3.message);
      }

      self.analyser = self.sysAnalyser;
      self.mode = 'system';
      self.hasFile = false;
      self.streamActive = true;
      self.peaks = null;
      if (self.onPeaks) self.onPeaks(null, 0);

      tracks[0].addEventListener('ended', function () {
        if (self._stopping) return;
        self.stopSystem(false);
      });
      return true;
    });
  };

  /* 麦克风：手机 / 桌面都能用，听周围的声音（包括外放的歌） */
  AudioEngine.prototype.startMic = function () {
    var self = this;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('这个浏览器不支持麦克风'));
    }
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    }).then(function (stream) {
      if (self.displayStream) {
        try { self.displayStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        self.displayStream = null;
      }
      if (self.micStream) {
        try { self.micStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e2) {}
      }
      self.micStream = stream;
      self.stopFile();

      try {
        if (self.systemSrc) self.systemSrc.disconnect();
        self.systemSrc = self.ctx.createMediaStreamSource(stream);
        self.systemSrc.connect(self.sysAnalyser);
      } catch (e3) {
        throw new Error('麦克风建立失败：' + e3.message);
      }

      self.analyser = self.sysAnalyser;
      self.mode = 'mic';
      self.hasFile = false;
      self.streamActive = true;
      self.peaks = null;
      if (self.onPeaks) self.onPeaks(null, 0);

      var track = stream.getAudioTracks()[0];
      if (track) {
        track.addEventListener('ended', function () {
          if (self._stopping) return;
          self.stopSystem(false);
        });
      }
      return true;
    });
  };

  AudioEngine.prototype.stopSystem = function (silent) {
    this._stopping = true;
    if (this.displayStream) {
      try {
        this.displayStream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {}
      this.displayStream = null;
    }
    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach(function (t) { t.stop(); });
      } catch (em) {}
      this.micStream = null;
    }
    if (this.systemSrc) {
      try { this.systemSrc.disconnect(); } catch (e2) {}
      this.systemSrc = null;
    }
    var was = this.mode === 'system' || this.mode === 'mic';
    this.streamActive = false;
    this._stopping = false;

    if (was) {
      this.mode = 'demo';
      this.analyser = this.fileAnalyser;
      this.peaks = null;
      if (this.onPeaks) this.onPeaks(null, 0);
    }
    if (!silent && was && this.onEnded) this.onEnded();
  };

  AudioEngine.prototype.useDemo = function () {
    this.stopSystem(true);
    this.stopFile();
    this.mode = 'demo';
    this.peaks = null;
    this.duration = 0;
    this.analyser = this.fileAnalyser;
    if (this.onPeaks) this.onPeaks(null, 0);
  };

  /* ---------------- 传输 ---------------- */

  AudioEngine.prototype.play = function () {
    this._ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.el || this.mode !== 'file') return;
    var p = this.el.play();
    if (p && p.catch) p.catch(function () {});
  };

  AudioEngine.prototype.pause = function () {
    if (this.el) this.el.pause();
  };

  AudioEngine.prototype.toggle = function () {
    if (!this.el || this.mode !== 'file') return;
    if (this.el.paused) this.play();
    else this.pause();
  };

  AudioEngine.prototype.seek = function (frac) {
    if (!this.el || this.mode !== 'file' || !this.duration) return;
    var t = Math.max(0, Math.min(this.duration - 0.05, frac * this.duration));
    try { this.el.currentTime = t; } catch (e) {}
  };

  AudioEngine.prototype.currentTime = function () {
    return this.el ? this.el.currentTime : 0;
  };

  AudioEngine.prototype.isPaused = function () {
    if (!this.el || this.mode !== 'file') return false;
    return this.el.paused;
  };

  AudioEngine.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.gain) this.gain.gain.value = v;
  };

  /* ---------------- 分析 ---------------- */

  AudioEngine.prototype._read = function () {
    var an = this.analyser;
    an.getByteFrequencyData(this.freq);
    an.getByteTimeDomainData(this.timeData);

    var r = this.bandRanges, i, b, cnt;
    for (b = 0; b < BANDS; b++) {
      var rg = r[b], s = 0;
      cnt = 0;
      for (i = rg[0]; i < rg[1]; i++) { s += this.freq[i]; cnt++; }
      this.raw[b] = (cnt ? s / cnt : 0) / 255;
    }

    var td = this.timeData, n = td.length, acc = 0;
    for (i = 0; i < n; i += 2) { var v = (td[i] - 128) / 128; acc += v * v; }
    this.rms = Math.sqrt(acc / (n / 2));

    var W = this.waveOut.length;
    for (i = 0; i < W; i++) {
      this.waveOut[i] = (td[Math.floor((i * n) / W)] - 128) / 128;
    }
  };

  AudioEngine.prototype._silence = function (dt) {
    var k = Math.exp(-dt / 0.25);
    for (var b = 0; b < BANDS; b++) {
      this.raw[b] *= k;
      this.env[b] *= k;
    }
    this.rms *= k;
    for (var i = 0; i < this.waveOut.length; i++) this.waveOut[i] *= k;
  };

  /* 程序化演示信号：124 BPM */
  AudioEngine.prototype._synth = function () {
    var t = this.t;
    var beatDur = 60 / 124;
    var bp = (t % beatDur) / beatDur;
    var bar = Math.floor(t / beatDur);
    var phrase = 0.55 + 0.45 * Math.sin(t * 0.17 + 1.2);
    var kick = Math.exp(-bp * 7) * (bar % 32 < 8 ? 0.6 : 1.0);
    var hp = (t % (beatDur / 2)) / (beatDur / 2);
    var hat = Math.exp(-hp * 26) * (bar % 2 === 1 ? 0.62 : 0.34);
    var snare = bar % 4 === 2 ? Math.exp(-bp * 12) * 0.85 : 0;
    var b, f, v;

    for (b = 0; b < BANDS; b++) {
      f = b / (BANDS - 1);
      v = kick * Math.pow(1 - f, 1.7) * 1.15
        + snare * Math.pow(1 - f, 1.1) * 0.7
        + hat * Math.pow(f, 1.35) * 0.9
        + 0.055
        + 0.045 * Math.sin(t * 0.9 + b * 0.7)
        + 0.025 * Math.sin(t * 4.1 + b * 1.7);
      if (v < 0) v = 0;
      this.raw[b] = v * phrase;
    }

    this.rms = 0.18 + 0.42 * kick;

    var W = this.waveOut.length;
    for (var i = 0; i < W; i++) {
      var ph = (i / W) * Math.PI * 2;
      this.waveOut[i] = (Math.sin(ph * 3 + t * 11) * 0.5
        + Math.sin(ph * 7 - t * 7) * 0.3
        + Math.sin(ph * 17 + t * 3) * 0.2) * (0.22 + 0.55 * kick);
    }
  };

  AudioEngine.prototype._envelope = function (dt) {
    var inr = this.inertia;
    var atkT = 0.035 + 0.10 * inr;
    var relT = 0.16 + 0.55 * inr;
    var ka = 1 - Math.exp(-dt / atkT);
    var kr = 1 - Math.exp(-dt / relT);
    var low = 0, wsum = 0, b, wb;

    for (b = 0; b < BANDS; b++) {
      var v = this.raw[b];
      if (v > this.peak[b]) this.peak[b] = v;
      else this.peak[b] *= Math.exp(-dt * 0.35);
      if (this.peak[b] < 0.08) this.peak[b] = 0.08;

      var norm = v / (this.peak[b] * 0.92 + 0.025);
      if (norm > 1.5) norm = 1.5;

      var k = norm > this.env[b] ? ka : kr;
      this.env[b] += (norm - this.env[b]) * k;

      wb = 1 - b / 6;
      if (wb < 0) wb = 0;
      low += this.env[b] * wb;
      wsum += wb;
    }
    this.low = wsum > 0 ? low / wsum : 0;
  };

  AudioEngine.prototype._beats = function (dt) {
    var low = this.low;
    var ks = 1 - Math.exp(-dt / 0.18);
    this.lowSmooth += (low - this.lowSmooth) * ks;

    this.hist.push(low);
    if (this.hist.length > this.histLen) this.hist.shift();

    var sum = 0, i, avg;
    for (i = 0; i < this.hist.length; i++) sum += this.hist[i];
    avg = sum / Math.max(1, this.hist.length);

    if (low > avg * 1.22 && low > 0.16 && this.t - this.lastBeatAt > 0.11) {
      this.lastBeatAt = this.t;
      this.beatNow = true;
      this.beatStrength = Math.min(1, (low - avg) * 2.2 + 0.35);
    }
  };

  AudioEngine.prototype.update = function (dt) {
    this.t += dt;
    this.beatNow = false;

    var fileLive = this.mode === 'file' && this.el && !this.el.paused && !this.el.ended;
    var sysLive = (this.mode === 'system' || this.mode === 'mic') && this.streamActive;
    this.playing = !!(fileLive || sysLive);

    if (this.mode === 'demo') this._synth();
    else if (this.playing) this._read();
    else this._silence(dt);

    this._envelope(dt);
    this._beats(dt);
  };

  GC.AudioEngine = AudioEngine;
})();
