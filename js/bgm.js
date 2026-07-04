class TechnoChiptuneEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.bpm = 140;
    this.energy = 50; // 0-100, affects octave jumps and filter
    this.volume = 0.5;
    
    this.nextNoteTime = 0;
    this.currentStep = 0;
    this.lookahead = 25; // ms
    this.scheduleAheadTime = 0.1; // s
    this.timerID = null;
    
    this.totalSteps = 0; // Track absolute steps for progression
    
    // Japanese Hirajoshi Scale (relative to base root A)
    this.scale = [0, 2, 3, 7, 8]; 
    this.baseRoot = 45; // A2
    this.currentChordOffset = 0;
    
    // Nodes
    this.masterGain = null;
    this.masterCompressor = null;
    this.musicBus = null;
    this.sidechainGain = null;
    this.kickBus = null;
    
    // Callbacks for visualizer
    this.onBeat = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      
      // Master Compressor to glue it all together
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.value = -15;
      this.masterCompressor.knee.value = 30;
      this.masterCompressor.ratio.value = 8;
      this.masterCompressor.attack.value = 0.005;
      this.masterCompressor.release.value = 0.1;
      
      // Busses for internal sidechaining
      this.musicBus = this.ctx.createGain();
      this.sidechainGain = this.ctx.createGain();
      this.sidechainGain.gain.value = 1.0;
      
      this.kickBus = this.ctx.createGain();
      
      // Routing: Music -> Sidechain -> Compressor -> Master -> Dest
      this.musicBus.connect(this.sidechainGain);
      this.sidechainGain.connect(this.masterCompressor);
      
      // Kick bypasses sidechain ducking
      this.kickBus.connect(this.masterCompressor);
      
      this.masterCompressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.masterGain) {
      // Smooth volume transition
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  playKick(time) {
    // Punchy Techno Kick
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    
    // Snappy pitch drop
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.1);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    // Volume envelope
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    
    osc.connect(gain);
    gain.connect(this.kickBus);
    
    // Click transient for attack
    const clickOsc = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(1000, time);
    clickOsc.frequency.exponentialRampToValueAtTime(100, time + 0.05);
    clickGain.gain.setValueAtTime(0.4, time);
    clickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    clickOsc.connect(clickGain);
    clickGain.connect(this.kickBus);
    
    osc.start(time);
    osc.stop(time + 0.5);
    clickOsc.start(time);
    clickOsc.stop(time + 0.05);
    
    // Internal Sidechain Ducking on Music Bus
    this.sidechainGain.gain.cancelScheduledValues(time);
    this.sidechainGain.gain.setValueAtTime(0.2, time); // Duck
    this.sidechainGain.gain.setTargetAtTime(1.0, time + 0.05, 0.1); // Recover smoothly
  }

  playHat(time, isOpen = false) {
    // Simple white noise burst for hi-hat
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + (isOpen ? 0.3 : 0.05));
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus); // Route to music bus for sidechaining
    
    noise.start(time);
  }

  playBass(time, noteIndex) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square'; // Chiptune vibe
    
    // Calculate note: Base Root + Current Chord Offset + Octave
    const octaves = [0, 0, -1, 0];
    const octaveOffset = octaves[noteIndex % octaves.length] * 12;
    const note = this.baseRoot - 12 + this.currentChordOffset + octaveOffset; 
    osc.frequency.value = this.midiToFreq(note);
    
    // Filter for acid-ish sound
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400 + (this.energy * 20), time);
    filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);
    
    // Envelope
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.setTargetAtTime(0, time, 0.1);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus); // Route to music bus for sidechaining
    
    osc.start(time);
    osc.stop(time + 0.3);
  }

  playLead(time) {
    // Random arpeggiator based on Hirajoshi scale and Energy
    if (Math.random() > 0.8) return; // Sometimes rest
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = this.energy > 70 ? 'sawtooth' : 'square'; // Techno vs Chiptune
    
    // ALWAYS stay in the global scale (relative to baseRoot)
    const scaleNote = this.scale[Math.floor(Math.random() * this.scale.length)];
    let octaveOffset = 12 * Math.floor(Math.random() * (this.energy / 33 + 1)); 
    // Higher energy = more octaves
    
    osc.frequency.value = this.midiToFreq(this.baseRoot + 12 + scaleNote + octaveOffset);
    
    // Delay/Echo effect simulation by playing a softer note right after
    const delayOsc = this.ctx.createOscillator();
    const delayGain = this.ctx.createGain();
    delayOsc.type = osc.type;
    delayOsc.frequency.value = osc.frequency.value;
    
    // Envelope Main
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
    
    // Envelope Delay
    const delayTime = time + (60.0 / this.bpm) * 0.5; // 8th note delay
    delayGain.gain.setValueAtTime(0.15, delayTime);
    delayGain.gain.exponentialRampToValueAtTime(0.01, delayTime + 0.15);
    
    osc.connect(gain);
    delayOsc.connect(delayGain);
    gain.connect(this.musicBus); // Route to music bus for sidechaining
    delayGain.connect(this.musicBus); // Route to music bus for sidechaining
    
    osc.start(time);
    osc.stop(time + 0.2);
    delayOsc.start(delayTime);
    delayOsc.stop(delayTime + 0.2);
  }

  scheduleNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    const time = this.nextNoteTime;
    
    // Trigger visualizer
    if (this.onBeat) {
      // Use setTimeout to sync visual roughly with audio
      const delay = (time - this.ctx.currentTime) * 1000;
      setTimeout(() => this.onBeat(this.currentStep, this.energy), Math.max(0, delay));
    }

    // --- SEQUENCER LOGIC ---
    // 16-step sequence (4/4 time, 16th notes)
    
    // Kick: 4 on the floor + occasionally syncopated based on energy
    if (this.currentStep % 4 === 0) {
      this.playKick(time);
    } else if (this.energy > 60 && this.currentStep === 14) {
      this.playKick(time);
    }

    // Hi-Hats
    if (this.currentStep % 2 !== 0) {
      this.playHat(time, this.currentStep % 4 === 2); // Open hat on off-beats
    } else if (this.energy > 80) {
       this.playHat(time, false); // Trance 16th hats
    }

    // Bass: 8th notes
    if (this.currentStep % 2 === 0) {
      this.playBass(time, this.currentStep);
    }

    // Lead Arp: 16th notes
    this.playLead(time);
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    // 16th notes = 0.25 of a beat
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.currentStep = (this.currentStep + 1) % 16;
    this.totalSteps++;
    
    // Chord Progression (Shifts every 64 steps / 4 measures)
    // Progressions: i (0), VI (8), III (3), v (7) - All notes exist in the A Hirajoshi scale!
    const progressions = [0, 8, 3, 7]; 
    const chordIndex = Math.floor((this.totalSteps / 64) % 4);
    this.currentChordOffset = progressions[chordIndex];
  }

  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote();
      this.nextNote();
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  start() {
    if (this.isPlaying) return;
    this.init();
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isPlaying = true;
    this.currentStep = 0;
    this.totalSteps = 0; // Reset absolute sequence
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerID);
  }
}
