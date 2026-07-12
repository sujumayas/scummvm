/* Grog Engine — audio: WebAudio chiptune synth. Pattern music + procedural SFX.
   No audio files required. Music format:
   { "bpm": 112, "steps": 2, "tracks": [ { "wave":"square", "vol":0.2,
     "notes": "C4 E4 G4 - . C5 | ..." } ] }   ('.' rest, '-' hold, '|' cosmetic) */
(function () {
  'use strict';
  const Grog = window.Grog;

  const NOTE_RE = /^([A-Ga-g])(#|b)?(-?\d)$/;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(tok) {
    const m = NOTE_RE.exec(tok);
    if (!m) return null;
    let s = SEMI[m[1].toUpperCase()];
    if (m[2] === '#') s++; if (m[2] === 'b') s--;
    const oct = parseInt(m[3], 10);
    const midi = (oct + 1) * 12 + s;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  Grog.Audio = class {
    constructor() {
      this.ctx = null;
      this.musicOn = true;
      this.soundOn = true;
      this.music = null;      // {def, id, step, nextTime, timer}
      this._noiseBuf = null;
    }
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    unlock() { this.ensure(); if (this.music && !this.music.timer) this._startSequencer(); }

    noiseBuffer() {
      if (!this._noiseBuf) {
        const len = this.ctx.sampleRate * 0.5;
        this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this._noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return this._noiseBuf;
    }

    // ---------- music ----------
    playMusic(def, id) {
      if (this.music && this.music.id === id) return;
      this.stopMusic();
      if (!def) return;
      // parse tracks
      const tracks = (def.tracks || []).map((tr) => ({
        wave: tr.wave || 'square',
        vol: tr.vol !== undefined ? tr.vol : 0.15,
        toks: String(tr.notes || '').split(/\s+/).filter((t) => t && t !== '|'),
      }));
      const len = Math.max(1, ...tracks.map((t) => t.toks.length));
      this.music = { def, id, tracks, len, step: 0, nextTime: 0, timer: null };
      if (this.ctx && this.ctx.state === 'running') this._startSequencer();
    }
    _startSequencer() {
      if (!this.ensure() || !this.music) return;
      const m = this.music;
      m.nextTime = this.ctx.currentTime + 0.1;
      const stepDur = () => 60 / (m.def.bpm || 110) / (m.def.steps || 2);
      const tick = () => {
        if (!this.music || this.music !== m) return;
        while (m.nextTime < this.ctx.currentTime + 0.35) {
          if (this.musicOn) this._scheduleStep(m, m.step % m.len, m.nextTime, stepDur());
          m.step++;
          m.nextTime += stepDur();
        }
      };
      tick();
      m.timer = setInterval(tick, 120);
    }
    _scheduleStep(m, step, when, dur) {
      for (const tr of m.tracks) {
        const tok = tr.toks[step % tr.toks.length];
        if (!tok || tok === '.' || tok === '-') continue;
        // hold detection: extend duration while following tokens are '-'
        let hold = 1;
        for (let i = step + 1; i < step + 16; i++) {
          if (tr.toks[i % tr.toks.length] === '-' && i < tr.toks.length) hold++;
          else break;
        }
        if (tr.wave === 'noise' || tok === 'x' || tok === 'X') {
          this._noiseHit(when, tok === 'X' ? 0.6 : 0.3, tr.vol, dur);
          continue;
        }
        const f = noteFreq(tok);
        if (!f) continue;
        this._tone(f, when, dur * hold * 0.92, tr.wave, tr.vol);
      }
    }
    _tone(freq, when, dur, wave, vol) {
      const o = this.ctx.createOscillator();
      o.type = wave === 'square' ? 'square' : wave;
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vol, when + 0.012);
      g.gain.setValueAtTime(vol, when + Math.max(0.012, dur - 0.04));
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(this.master);
      o.start(when); o.stop(when + dur + 0.05);
    }
    _noiseHit(when, decay, vol, dur) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + decay * dur * 4);
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 800;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(when); src.stop(when + decay);
    }
    stopMusic() {
      if (this.music && this.music.timer) clearInterval(this.music.timer);
      this.music = null;
    }

    // ---------- sfx ----------
    sfx(id, custom) {
      if (!this.soundOn || !this.ensure()) return;
      const t = this.ctx.currentTime;
      const def = custom;
      if (def && def.type === 'sweep') { this._sweep(t, def.from, def.to, def.dur || 0.2, def.wave || 'square', def.vol || 0.25); return; }
      switch (id) {
        case 'pickup': this._sweep(t, 500, 950, 0.1, 'square', 0.2); this._sweep(t + 0.09, 950, 1400, 0.08, 'square', 0.16); break;
        case 'open': this._sweep(t, 180, 90, 0.16, 'sawtooth', 0.22); break;
        case 'close': this._sweep(t, 120, 60, 0.12, 'sawtooth', 0.25); this._noiseAt(t + 0.1, 0.06, 0.2); break;
        case 'error': this._sweep(t, 220, 110, 0.22, 'square', 0.22); break;
        case 'ding': this._sweep(t, 1200, 1200, 0.3, 'triangle', 0.2); break;
        case 'splash': this._noiseAt(t, 0.35, 0.3, 400); break;
        case 'thunk': this._sweep(t, 90, 45, 0.1, 'triangle', 0.4); this._noiseAt(t, 0.07, 0.2); break;
        case 'teleport': for (let i = 0; i < 6; i++) this._sweep(t + i * 0.05, 300 + i * 200, 500 + i * 250, 0.05, 'square', 0.12); break;
        case 'step': this._noiseAt(t, 0.03, 0.08, 300); break;
        case 'laugh': for (let i = 0; i < 4; i++) this._sweep(t + i * 0.09, 400 - i * 40, 300 - i * 40, 0.07, 'square', 0.15); break;
        case 'fanfare': { const seq = [523, 659, 784, 1047]; seq.forEach((f, i) => this._sweep(t + i * 0.12, f, f, i === 3 ? 0.5 : 0.11, 'square', 0.2)); break; }
        default: this._sweep(t, 440, 440, 0.1, 'square', 0.2);
      }
    }
    _sweep(when, f1, f2, dur, wave, vol) {
      const o = this.ctx.createOscillator();
      o.type = wave;
      o.frequency.setValueAtTime(f1, when);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), when + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(this.master);
      o.start(when); o.stop(when + dur + 0.05);
    }
    _noiseAt(when, dur, vol, hp) {
      if (!this.ensure()) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = hp || 700;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(when); src.stop(when + dur + 0.02);
    }
  };
})();
