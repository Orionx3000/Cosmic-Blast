// Anime Chiptune Generator — harmonic 4-chord progression engine
// Each track has a fixed root key, scale, and 4-chord progression.
// 60s cycle refreshes tempo/energy/osc type only; harmony stays locked.

const SCALES = {
  hirajoshi: [0, 2, 3, 7, 8],
  minor:     [0, 2, 3, 5, 7, 8, 10],
  major:     [0, 2, 4, 5, 7, 9, 11],
  dorian:    [0, 2, 3, 5, 7, 9, 10],
  phrygian:  [0, 1, 3, 5, 7, 8, 10],
  pentatonic:[0, 2, 4, 7, 9],
  harmonic:  [0, 2, 3, 5, 7, 8, 11],
  lydian:    [0, 2, 4, 6, 7, 9, 11],
  blues:     [0, 3, 5, 6, 7, 10],
  hungarian: [0, 2, 3, 6, 7, 8, 11]
};
const SCALE_NAMES = Object.keys(SCALES);

class TechnoChiptuneEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.volume = 0.5;
    this.nextNoteTime = 0;
    this.currentStep = 0;
    this.lookahead = 25;
    this.scheduleAheadTime = 0.1;
    this.timerID = null;
    this.totalSteps = 0;
    this.currentTrack = 0;
    this.energy = 50;
    this.fadeStart = 0; this.fadeEnd = 0; this.fading = false;
    this.trackStartTime = 0;
    this.fadeRamp = null;
    this._chordToneCache = {};

    // Each track defines: root key (MIDI), scale name, 4-chord progression (scale-degree indices)
    this.moods = [
      { name:'menu',   bpmRange:[80,100],  energyRange:[25,40], leadStyle:'ambient',   oscTypes:['sine','triangle'], hatDensity:0.3, kickDensity:0.25, root:45, scale:'minor',     progression:[0,5,3,4] },
      { name:'combat', bpmRange:[140,160], energyRange:[55,75], leadStyle:'arp',       oscTypes:['square','sawtooth'], hatDensity:0.7, kickDensity:0.9, root:43, scale:'hirajoshi', progression:[0,6,3,4] },
      { name:'boss',   bpmRange:[160,180], energyRange:[80,95], leadStyle:'aggressive',oscTypes:['sawtooth'],        hatDensity:1.0, kickDensity:1.0, root:40, scale:'phrygian', progression:[0,1,3,1] },
      { name:'victory',bpmRange:[110,130], energyRange:[40,60], leadStyle:'fanfare',  oscTypes:['triangle','sine'], hatDensity:0.5, kickDensity:0.3, root:48, scale:'major', progression:[0,4,5,0] },
      { name:'combat', bpmRange:[130,150], energyRange:[50,70], leadStyle:'arp',       oscTypes:['square'],          hatDensity:0.65,kickDensity:0.85,root:38, scale:'phrygian', progression:[0,3,7,5] },
      { name:'combat', bpmRange:[145,165], energyRange:[60,80], leadStyle:'arp',       oscTypes:['sawtooth','square'],hatDensity:0.75,kickDensity:0.95,root:47, scale:'harmonic', progression:[0,5,4,3] },
      { name:'boss',   bpmRange:[155,175], energyRange:[75,90], leadStyle:'aggressive',oscTypes:['sawtooth','square'],hatDensity:0.9, kickDensity:1.0, root:37, scale:'hungarian', progression:[0,4,1,5] },
    ];

    this.masterGain = null;
    this.masterCompressor = null;
    this.musicBus = null;
    this.sidechainGain = null;
    this.kickBus = null;
    this.onBeat = null;
    this.smoothEnergy = 50;
    this.regenerateTrack();
  }

  get mood() { return this.moods[this.currentTrack]; }

  // Build chord tones (stacked thirds in scale) for a given scale degree
  chordTones(degree) {
    const key = degree + ',' + this.scale.length;
    if (this._chordToneCache[key]) return this._chordToneCache[key];
    const sl = this.scale.length;
    const tones = [
      this.scale[degree % sl] + Math.floor(degree / sl) * 12,
      this.scale[(degree + 2) % sl] + Math.floor((degree + 2) / sl) * 12,
      this.scale[(degree + 4) % sl] + Math.floor((degree + 4) / sl) * 12,
      this.scale[(degree + 6) % sl] + Math.floor((degree + 6) / sl) * 12
    ];
    this._chordToneCache[key] = tones;
    return tones;
  }

  regenerateTrack() {
    // Fixed harmonic identity per track — never changes between 60s cycles
    const cfg = this.moods[this.currentTrack];
    this.baseRoot = cfg.root;
    this.scale = SCALES[cfg.scale];
    this.progression = cfg.progression;

    // Variable parameters refresh each cycle for variety
    this.bpm = cfg.bpmRange[0] + Math.floor(Math.random() * (cfg.bpmRange[1] - cfg.bpmRange[0]));
    this.energy = cfg.energyRange[0] + Math.random() * (cfg.energyRange[1] - cfg.energyRange[0]);
    this.oscType = cfg.oscTypes[Math.floor(Math.random() * cfg.oscTypes.length)];
    this.progLength = this.currentTrack === 2 ? 32 + Math.floor(Math.random() * 3) * 16 : Math.random() < 0.7 ? 64 : 32;
    this.octaveShift = Math.floor(Math.random() * 3) - 1;
    this._chordToneCache = {};  // flush cache on regeneration
    this.currentChordOffset = this.progression[0];
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -15;
    this.masterCompressor.knee.value = 30;
    this.masterCompressor.ratio.value = 8;
    this.masterCompressor.attack.value = 0.005;
    this.masterCompressor.release.value = 0.1;
    this.musicBus = this.ctx.createGain();
    this.sidechainGain = this.ctx.createGain();
    this.sidechainGain.gain.value = 1.0;
    this.kickBus = this.ctx.createGain();
    this.musicBus.connect(this.sidechainGain);
    this.sidechainGain.connect(this.masterCompressor);
    this.kickBus.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.masterGain && !this.fading) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  get currentFadeMul() {
    if (!this.fading || !this.ctx) return 1;
    const t = this.ctx.currentTime;
    if (t >= this.fadeEnd) return 0;
    const p = (t - this.fadeStart) / Math.max(0.001, this.fadeEnd - this.fadeStart);
    return Math.max(0, 1 - p);
  }

  get chordIndex() {
    return Math.floor(this.totalSteps / this.progLength) % this.progression.length;
  }

  get currentDegree() {
    return this.progression[this.chordIndex];
  }

  playKick(time) {
    const m = this.mood;
    if (Math.random() > m.kickDensity) return;
    if (this.currentStep % 4 !== 0 && Math.random() > 0.3) return;
    const fm = this.currentFadeMul;
    if (fm <= 0) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.1);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    gain.gain.setValueAtTime(fm, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    osc.connect(gain);
    gain.connect(this.kickBus);

    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(1000, time);
    clickOsc.frequency.exponentialRampToValueAtTime(100, time + 0.05);
    clickGain.gain.setValueAtTime(0.4 * fm, time);
    clickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    clickOsc.connect(clickGain);
    clickGain.connect(this.kickBus);
    osc.start(time); osc.stop(time + 0.5);
    clickOsc.start(time); clickOsc.stop(time + 0.05);

    this.sidechainGain.gain.cancelScheduledValues(time);
    this.sidechainGain.gain.setValueAtTime(0.2, time);
    this.sidechainGain.gain.setTargetAtTime(1.0, time + 0.05, 0.1);
  }

  playHat(time) {
    const m = this.mood;
    if (Math.random() > m.hatDensity) return;
    const fm = this.currentFadeMul;
    if (fm <= 0) return;

    const isOpen = this.currentStep % 4 === 2;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3 * fm, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + (isOpen ? 0.3 : 0.05));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    noise.start(time);
  }

  playBass(time, noteIndex) {
    const fm = this.currentFadeMul;
    if (fm <= 0) return;
    const degree = this.currentDegree;
    const tones = this.chordTones(degree);
    const root = tones[0];
    const fifth = tones[2];

    // Root on downbeats, occasional 5th on upbeats
    let note;
    if (noteIndex % 4 === 0) {
      note = this.baseRoot - 12 + root;              // Root (strong)
    } else if (noteIndex % 2 === 0) {
      note = this.baseRoot - 12 + root;              // Root (medium)
    } else {
      if (Math.random() < 0.25) {
        note = this.baseRoot - 12 + fifth;            // 5th (passing)
      } else {
        return;
      }
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = this.mood.leadStyle === 'aggressive' ? 'sawtooth' : 'square';
    osc.frequency.value = this.midiToFreq(note);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400 + (this.energy * 20), time);
    filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);
    gain.gain.setValueAtTime(0.6 * fm, time);
    gain.gain.setTargetAtTime(0, time, 0.1);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(time); osc.stop(time + 0.3);
  }

  playLead(time) {
    const m = this.mood;
    const fm = this.currentFadeMul;
    if (fm <= 0) return;

    const degree = this.currentDegree;
    const tones = this.chordTones(degree);
    const step = this.currentStep;

    switch (m.leadStyle) {
      case 'ambient': {
        // Sparse, sustained pads — chord tones, slow attack
        if (Math.random() < 0.7) return;
        if (step % 4 !== 0 && Math.random() < 0.5) return;
        const idx = Math.floor(Math.random() * 3);
        const note = this.baseRoot + 12 + tones[idx] + (Math.random() < 0.3 ? 12 : 0);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = this.midiToFreq(note);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.25 * fm, time + 0.05);
        gain.gain.setTargetAtTime(0, time + 0.3, 0.4);
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time); osc.stop(time + 0.8);
        break;
      }
      case 'arp': {
        // Rapid arpeggiated chord tones, sequenced in order
        if (Math.random() < 0.1) return;
        const arpIdx = Math.floor(step / 2) % tones.length;
        const oct = 24 + Math.floor(step / 8) % 2 * 12;
        const note = this.baseRoot + oct + tones[arpIdx];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = this.midiToFreq(note);
        gain.gain.setValueAtTime(0.2 * fm, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.06);
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time); osc.stop(time + 0.08);
        break;
      }
      case 'aggressive': {
        // Dense runs with wide leaps and filter sweeps
        if (Math.random() < 0.05) return;
        const pickChord = Math.random() < 0.6;
        const semitone = pickChord
          ? tones[Math.floor(Math.random() * tones.length)]
          : this.scale[Math.floor(Math.random() * this.scale.length)];
        const octBase = Math.random() < 0.3 ? 36 : 24;
        const note = this.baseRoot + octBase + semitone;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.value = this.midiToFreq(note);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4000, time);
        filter.frequency.exponentialRampToValueAtTime(200, time + 0.1);
        gain.gain.setValueAtTime(0.35 * fm, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time); osc.stop(time + 0.12);
        break;
      }
      case 'fanfare': {
        // Bold interval leaps — root/fifth on strong beats
        if (step % 4 !== 0 && Math.random() < 0.7) return;
        if (step % 4 === 0 && Math.random() < 0.2) return;
        const semitone = tones[Math.floor(Math.random() * 2) * 2];
        const note = this.baseRoot + 24 + semitone;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = this.midiToFreq(note);
        gain.gain.setValueAtTime(0.5 * fm, time);
        gain.gain.setTargetAtTime(0, time + 0.2);
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time); osc.stop(time + 0.35);

        // Occasional fifth doubling
        if (Math.random() < 0.3) {
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.value = this.midiToFreq(note + 7);
          gain2.gain.setValueAtTime(0.25 * fm, time);
          gain2.gain.setTargetAtTime(0, time + 0.2);
          osc2.connect(gain2);
          gain2.connect(this.musicBus);
          osc2.start(time); osc2.stop(time + 0.35);
        }
        break;
      }
      default: {
        const semitone = tones[Math.floor(Math.random() * tones.length)];
        const note = this.baseRoot + 36 + semitone;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = this.oscType;
        osc.frequency.value = this.midiToFreq(note);
        gain.gain.setValueAtTime(0.4 * fm, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(time); osc.stop(time + 0.2);
      }
    }
  }

  playOverture() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.05;
    const cfg = this.moods[this.currentTrack];
    const spb = 60.0 / this.bpm;
    const stepTime = spb * 0.25;
    // ~10 second overture: 3 phrases across the chord progression
    const phraseLen = 8;
    const totalPhrases = 3;

    const sched = (time, midi, oscType, vol, dur, filterFreq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = oscType;
      osc.frequency.value = this.midiToFreq(midi);
      gain.gain.setValueAtTime(vol, time);
      if (dur < 0.15) {
        gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
      } else {
        gain.gain.setTargetAtTime(0, time + dur * 0.3, dur * 0.3);
      }
      if (filterFreq) {
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(filterFreq, time);
        filt.frequency.exponentialRampToValueAtTime(100, time + dur);
        osc.connect(filt);
        filt.connect(gain);
      } else {
        osc.connect(gain);
      }
      gain.connect(this.musicBus);
      osc.start(time); osc.stop(time + dur + 0.05);
    };

    const playPhrase = (phraseIdx) => {
      const progIdx = phraseIdx % this.progression.length;
      const degree = this.progression[progIdx];
      const tones = this.chordTones(degree);
      const baseT = now + phraseIdx * phraseLen * stepTime;

      switch (cfg.leadStyle) {
        case 'ambient': {
          // Slow chord build — each chord rings in, stacking tones
          for (let j = 0; j < 4; j++) {
            const t = baseT + j * stepTime * 2;
            const note = this.baseRoot + 12 + tones[j];
            sched(t, note, 'sine', 0.18, 2.5);
            // Soft fifth
            sched(t + 0.1, note + 7, 'sine', 0.08, 2.2);
          }
          break;
        }
        case 'arp': {
          // Rapid sequenced arpeggio across chord, rising in octaves
          const notes = [];
          for (let j = 0; j < 4; j++) notes.push(this.baseRoot + 24 + tones[j]);
          for (let j = 0; j < 4; j++) notes.push(this.baseRoot + 36 + tones[3 - j]);
          for (let j = 0; j < 4; j++) notes.push(this.baseRoot + 24 + tones[j]);
          for (let j = 0; j < 4; j++) notes.push(this.baseRoot + 36 + tones[3 - j]);
          for (let j = 0; j < notes.length; j++) {
            const t = baseT + j * stepTime * 0.5;
            sched(t, notes[j], 'square', 0.2, 0.07);
          }
          break;
        }
        case 'aggressive': {
          // Low growl into wide-leaping runs
          const rootNote = this.baseRoot - 12 + tones[0];
          for (let j = 0; j < 3; j++) {
            const t = baseT + j * stepTime * 2;
            const n = rootNote - 12 + Math.floor(Math.random() * 3) * 7;
            sched(t, n, 'sawtooth', 0.35, 0.15, 1200 + j * 400);
          }
          // Ascending stab run
          for (let j = 0; j < 6; j++) {
            const t = baseT + stepTime * 3 + j * stepTime * 0.6;
            const idx = j % tones.length;
            const oct = Math.floor(j / tones.length) * 12;
            const n = this.baseRoot + 24 + tones[idx] + oct;
            sched(t, n, 'square', 0.2, 0.08, 3000);
          }
          break;
        }
        case 'fanfare': {
          // Bold ascending fanfare on chord root with lower doubling, then descending scale run
          const intervals = [0, 4, 7, 12];
          for (let j = 0; j < intervals.length; j++) {
            const t = baseT + j * stepTime * 2;
            const n = this.baseRoot + 24 + tones[0] + intervals[j];
            sched(t, n, 'triangle', 0.5, 0.45);
            sched(t + 0.05, n - 12, 'triangle', 0.25, 0.4);
          }
          // Descending scale tail
          for (let j = 0; j < 5; j++) {
            const t = baseT + stepTime * 8 + j * stepTime * 0.8;
            const n = this.baseRoot + 24 + this.scale[this.scale.length - 1 - j];
            sched(t, n, 'triangle', 0.3, 0.2);
          }
          break;
        }
      }
    };

    for (let p = 0; p < totalPhrases; p++) playPhrase(p);

    // Bass stab under the overture
    for (let p = 0; p < totalPhrases; p++) {
      const progIdx = p % this.progression.length;
      const degree = this.progression[progIdx];
      const tones = this.chordTones(degree);
      const t = now + p * phraseLen * stepTime;
      const note = this.baseRoot - 12 + tones[0];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = this.midiToFreq(note);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.setTargetAtTime(0, t + 0.3);
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(300, t);
      filt.frequency.exponentialRampToValueAtTime(60, t + 0.4);
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this.musicBus);
      osc.start(t); osc.stop(t + 0.5);
    }

    // Kick pattern: strong beat at start of each phrase
    for (let p = 0; p < totalPhrases; p++) {
      const t = now + p * phraseLen * stepTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain);
      gain.connect(this.kickBus);
      osc.start(t); osc.stop(t + 0.3);

      // Sidechain pump
      this.sidechainGain.gain.cancelScheduledValues(t);
      this.sidechainGain.gain.setValueAtTime(0.15, t);
      this.sidechainGain.gain.setTargetAtTime(1.0, t + 0.05, 0.1);
    }
  }

  scheduleNote() {
    const time = this.nextNoteTime;
    if (this.onBeat) {
      const delay = (time - this.ctx.currentTime) * 1000;
      setTimeout(() => this.onBeat(this.currentStep, this.energy), Math.max(0, delay));
    }
    this.playKick(time);
    this.playHat(time);
    this.playBass(time, this.currentStep);
    this.playLead(time);
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.currentStep = (this.currentStep + 1) % 16;
    this.totalSteps++;
    this.currentChordOffset = this.progression[this.chordIndex];
    this.smoothEnergy += (this.energy - this.smoothEnergy) * 0.02;

    // 60-second regeneration: only melody params change, NOT key/scale/progression
    if (this.ctx && !this.fading) {
      const elapsed = this.ctx.currentTime - this.trackStartTime;
      if (elapsed >= 55) {
        this.startFade();
      }
    }
    if (this.fading && this.ctx && this.ctx.currentTime >= this.fadeEnd) {
      this.fading = false;
      // Refresh BPM/energy/osc type but keep harmonic identity
      const cfg = this.moods[this.currentTrack];
      this.bpm = cfg.bpmRange[0] + Math.floor(Math.random() * (cfg.bpmRange[1] - cfg.bpmRange[0]));
      this.energy = cfg.energyRange[0] + Math.random() * (cfg.energyRange[1] - cfg.energyRange[0]);
      this.oscType = cfg.oscTypes[Math.floor(Math.random() * cfg.oscTypes.length)];
      this.progLength = this.currentTrack === 2 ? 32 + Math.floor(Math.random() * 3) * 16 : Math.random() < 0.7 ? 64 : 32;
      this.octaveShift = Math.floor(Math.random() * 3) - 1;
      this.trackStartTime = this.ctx.currentTime;
      if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  startFade() {
    if (!this.ctx) return;
    this.fading = true;
    this.fadeStart = this.ctx.currentTime;
    this.fadeEnd = this.fadeStart + 3.0;
  }

  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote();
      this.nextNote();
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  // Map logical track indices to available mood slots (randomly selected)
  trackMoodMap() {
    return { 0: [0], 1: [1,4,5], 2: [2,6], 3: [3] };
  }

  switchTrack(index) {
    const moodMap = this.trackMoodMap();
    const options = moodMap[index] || [index];
    const moodIdx = options[Math.floor(Math.random() * options.length)];
    if (moodIdx < 0 || moodIdx >= this.moods.length) return;
    this.currentTrack = moodIdx;
    this.currentStep = 0;
    this.totalSteps = 0;
    this.fading = false;
    this.regenerateTrack();
    if (this.ctx) {
      this.trackStartTime = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
      try { this.playOverture(); } catch(e) { /* non-critical */ }
    }
  }

  start() {
    if (this.isPlaying) return;
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isPlaying = true;
    this.currentStep = 0;
    this.totalSteps = 0;
    this.trackStartTime = this.ctx.currentTime + 0.1;
    this.fading = false;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerID);
  }
}

window.bgmEngine = null;

window.initAdvancedAudio = function() {
  if (window.bgmEngine) {
    try { window.bgmEngine.stop(); } catch(e) {}
    window.bgmEngine = null;
  }
  window.bgmEngine = new TechnoChiptuneEngine();
  window.bgmEngine.init();
  let vol = 1.0;
  if (localStorage.getItem('cosmicBlastMusicVolume') !== null) {
    vol = parseFloat(localStorage.getItem('cosmicBlastMusicVolume'));
  }
  window.bgmEngine.setVolume(vol * 0.08);
  window.bgmEngine.start();
};

window.setMusicVolume = function(vol) {
  if (window.bgmEngine) {
    window.bgmEngine.setVolume(vol * 0.08);
    localStorage.setItem('cosmicBlastMusicVolume', vol);
  }
};
