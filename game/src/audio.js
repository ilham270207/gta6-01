// Procedural WebAudio: no audio files, no network. Engine hum, siren, gunshots,
// pickups, a mission jingle and a simple sun-baked bassline loop.
// Everything is a no-op until unlock() runs from a user gesture.
function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let musicOn = true;
  let muted = false;
  let nextNoteTime = 0;
  let noteIndex = 0;
  // A minor-ish bassline over a lazy groove, 112 BPM, 16 steps.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  const STEP_TIME = 60 / 112 / 2;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: two-tone triangle.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      nextNoteTime = ctx.currentTime + 0.1;
    } catch { return false; }
    return true;
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function tone(freq, duration, type, volume, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    setMusic(on) { musicOn = on; },
    engine(speed01, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 90, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
    },
    update(dt) {
      if (!ctx || !musicOn || muted) return;
      // Two-tone siren wail.
      sirenTimer += dt;
      if (sirenGain && sirenGain.gain.value > 0.005) {
        sirenOsc.frequency.value = (Math.floor(sirenTimer * 2) % 2 === 0) ? 720 : 540;
      }
      // Bassline scheduler.
      while (nextNoteTime < ctx.currentTime + 0.15) {
        const freq = BASS[noteIndex % BASS.length];
        if (freq > 0) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.16, nextNoteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + STEP_TIME * 0.9);
          osc.connect(gain);
          gain.connect(master);
          osc.start(nextNoteTime);
          osc.stop(nextNoteTime + STEP_TIME);
        }
        // Soft hat tick on off-beats.
        if (noteIndex % 4 === 2) {
          const len = Math.floor(ctx.sampleRate * 0.03);
          const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.4;
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          const gain = ctx.createGain();
          gain.gain.value = 0.12;
          src.connect(gain);
          gain.connect(master);
          src.start(nextNoteTime);
        }
        nextNoteTime += STEP_TIME;
        noteIndex += 1;
      }
    },
    shot() { noiseBurst(0.12, 0.5, 1800); tone(160, 0.08, 'square', 0.15); },
    enemyShot() { noiseBurst(0.1, 0.25, 1200); },
    punch() { noiseBurst(0.08, 0.35, 700); },
    crash() { noiseBurst(0.3, 0.5, 500); tone(70, 0.25, 'sine', 0.4); },
    pickup() { tone(660, 0.1, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25, 0.08); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.25, i * 0.11)); },
    fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, i * 0.14)); },
    busted() { tone(220, 0.4, 'sawtooth', 0.2); tone(165, 0.5, 'sawtooth', 0.2, 0.3); },
  };
}
