// Synthesized audio for Solmar Heat — WebAudio only, no audio files.
// Buses: master -> music / sfx. Music is a step sequencer with calm and chase
// layers; SFX are short synthesized bursts. Everything starts after a user
// gesture (the start button), which is when the AudioContext is unlocked.
const NOTE = { C2: 65.41, D2: 73.42, Eb2: 77.78, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54, C3: 130.81, Eb3: 155.56, G3: 196.0, Bb3: 233.08, C4: 261.63, Eb4: 311.13, G4: 392.0 };

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.intensity = 0; // 0 calm, 1 chase
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVol * this.musicVol;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVol * this.sfxVol;
    this.sfxBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }
  setMusicVol(v) { this.musicVol = v; if (this.musicBus) this.musicBus.gain.value = v * v; }
  setSfxVol(v) { this.sfxVol = v; if (this.sfxBus) this.sfxBus.gain.value = v * v; }

  // ---- primitives ----
  tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, filterFreq, when = 0, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // ---- SFX ----
  shoot() { this.noise(0.09, 0.5, 2400, 0, 'highpass'); this.tone(180, 0.08, 'square', 0.25, 0, 60); }
  punch() { this.noise(0.08, 0.4, 500); this.tone(120, 0.08, 'sine', 0.4, 0, 50); }
  pickup() { this.tone(660, 0.07, 'sine', 0.3); this.tone(990, 0.1, 'sine', 0.3, 0.07); }
  cash() { [880, 1108, 1318].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.3, i * 0.07)); }
  crash() { this.noise(0.25, 0.6, 900); this.tone(90, 0.2, 'sine', 0.4, 0, 40); }
  horn() { this.tone(370, 0.18, 'square', 0.15); this.tone(466, 0.18, 'square', 0.15); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.3, i * 0.09)); }
  busted() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.2, i * 0.16)); }
  click() { this.tone(1200, 0.04, 'sine', 0.2); }
  sirenStart() {
    if (!this.ctx || this.sirenOsc) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.6;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
    this.sirenOsc.frequency.value = 880;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.sfxBus);
    this.sirenOsc.start(); lfo.start();
    this.sirenGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.5);
  }
  sirenStop() {
    if (!this.sirenOsc) return;
    const o = this.sirenOsc, g = this.sirenGain;
    g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    setTimeout(() => { try { o.stop(); } catch (e) {} }, 400);
    this.sirenOsc = null; this.sirenGain = null;
  }
  engineStart() {
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.sfxBus);
    this.engineOsc.start();
    this.engineGain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.3);
  }
  engineSet(speed01) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.05, this.ctx.currentTime, 0.1);
  }
  engineStop() {
    if (!this.engineOsc) return;
    const o = this.engineOsc, g = this.engineGain;
    g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
    setTimeout(() => { try { o.stop(); } catch (e) {} }, 300);
    this.engineOsc = null; this.engineGain = null;
  }

  // ---- Music: 16-step loop, 104 BPM, calm vs chase layers ----
  startMusic() {
    if (!this.ctx || this.timer) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    const stepDur = 60 / 104 / 4;
    const bass = [NOTE.C2, 0, NOTE.C2, 0, NOTE.Eb2, 0, NOTE.C2, 0, NOTE.G2, 0, NOTE.G2, 0, NOTE.Bb2, 0, NOTE.G2, 0];
    const lead = [0, 0, NOTE.Eb4, 0, 0, NOTE.G4, 0, 0, 0, NOTE.Bb3, 0, NOTE.C4, 0, 0, NOTE.G3, 0];
    this.timer = setInterval(() => {
      while (this.nextTime < this.ctx.currentTime + 0.12) {
        const s = this.step % 16;
        const when = this.nextTime - this.ctx.currentTime;
        if (bass[s]) this.musicTone(bass[s], stepDur * 1.8, 'sawtooth', 0.16, when);
        if (s % 4 === 0) this.musicKick(when);
        if (s % 2 === 1) this.musicHat(when);
        if (this.intensity > 0 && lead[s]) this.musicTone(lead[s], stepDur, 'square', 0.07, when);
        this.step++;
        this.nextTime += stepDur;
      }
    }, 40);
  }
  musicTone(freq, dur, type, vol, when) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  musicKick(when) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + 0.16);
  }
  musicHat(when) {
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(this.musicBus);
    s.start(t); s.stop(t + 0.05);
  }
}
