export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private drones: OscillatorNode[] = [];
  volume = 0.35;

  start() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
        this.ambience = this.context.createGain();
        this.ambience.gain.value = 0.12;
        this.ambience.connect(this.master);
        [55, 82.41, 110, 164.81].forEach((frequency, i) => {
          const osc = this.context!.createOscillator();
          const gain = this.context!.createGain();
          osc.type = 'sine'; osc.frequency.value = frequency;
          osc.detune.value = i * 2.7; gain.gain.value = i === 0 ? 0.17 : 0.06;
          osc.connect(gain); gain.connect(this.ambience!); osc.start(); this.drones.push(osc);
        });
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Sound is optional on browsers without Web Audio. */ }
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.master && this.context) this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.1);
  }

  tone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.12, endFrequency = frequency) {
    if (!this.context || !this.master || this.volume === 0) return;
    const ctx = this.context, osc = ctx.createOscillator(), envelope = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), ctx.currentTime + duration);
    envelope.gain.setValueAtTime(gain, ctx.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(envelope); envelope.connect(this.master); osc.start(); osc.stop(ctx.currentTime + duration);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }

  noise(duration: number, gain: number, frequency: number) {
    if (!this.context || !this.master || this.volume === 0) return;
    const ctx = this.context, buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = frequency; envelope.gain.value = gain;
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master); source.start();
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  shoot(heavy = false) { this.noise(0.15, heavy ? 0.7 : 0.36, 2500); this.tone(heavy ? 150 : 220, 0.15, 'sawtooth', 0.15, 35); }
  hit(critical: boolean) { this.tone(critical ? 1460 : 900, 0.09, 'sine', 0.13, 500); }
  kill() { this.tone(520, 0.16, 'triangle', 0.2, 1100); }
  reload() { this.noise(0.17, 0.25, 4000); this.tone(180, 0.08, 'square', 0.045); }
  ability() { this.tone(90, 0.65, 'sawtooth', 0.18, 450); this.noise(0.5, 0.28, 1500); }
  explosion() { this.noise(0.8, 0.8, 650); this.tone(100, 0.45, 'sine', 0.5, 25); }
  damage() { this.noise(0.15, 0.3, 900); }
  ui() { this.tone(700, 0.08, 'sine', 0.1, 1100); }
  win() { [330, 415, 494, 660].forEach((f, i) => this.tone(f, 1.2 + i * 0.12, 'sine', 0.12)); }
  dispose() { this.drones.forEach(o => o.stop()); this.drones = []; void this.context?.close().catch(() => {}); }
}
