import type { MapId, WeaponId } from './types';

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private ambientFilter?: BiquadFilterNode;
  private ambientNoise?: AudioBufferSourceNode;
  private drones: { osc: OscillatorNode; gain: GainNode; base: number }[] = [];
  private map: MapId = 'turbine';
  volume = 0.35;

  start() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -14; compressor.knee.value = 18; compressor.ratio.value = 7; compressor.attack.value = .004; compressor.release.value = .18;
        this.master = this.context.createGain(); this.master.gain.value = this.volume;
        this.master.connect(compressor); compressor.connect(this.context.destination);
        this.ambience = this.context.createGain(); this.ambience.gain.value = .16; this.ambience.connect(this.master);
        [55, 82.41, 110, 164.81].forEach((frequency, i) => {
          const osc = this.context!.createOscillator(), gain = this.context!.createGain();
          osc.type = 'sine'; osc.frequency.value = frequency; osc.detune.value = i * 2.7;
          gain.gain.value = i === 0 ? .13 : .045;
          osc.connect(gain); gain.connect(this.ambience!); osc.start(); this.drones.push({ osc, gain, base: frequency });
        });
        const length = this.context.sampleRate * 2, buffer = this.context.createBuffer(1, length, this.context.sampleRate), data = buffer.getChannelData(0);
        let last = 0; for (let i = 0; i < length; i++) { const white = Math.random() * 2 - 1; last = last * .97 + white * .03; data[i] = last * 3.2; }
        this.ambientFilter = this.context.createBiquadFilter(); this.ambientFilter.type = 'bandpass'; this.ambientFilter.Q.value = .62;
        this.ambientNoise = this.context.createBufferSource(); this.ambientNoise.buffer = buffer; this.ambientNoise.loop = true;
        this.ambientNoise.connect(this.ambientFilter); this.ambientFilter.connect(this.ambience!); this.ambientNoise.start();
        this.applyAmbience();
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Sound is optional on browsers without Web Audio. */ }
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.master && this.context) this.master.gain.setTargetAtTime(volume, this.context.currentTime, .1);
  }

  setAmbience(map: MapId) {
    this.map = map; this.applyAmbience();
  }

  private applyAmbience() {
    if (!this.context || !this.ambientFilter || !this.ambience) return;
    const settings: Record<MapId, [number, number, number]> = {
      turbine: [980, .13, 1], ember: [180, .22, .72], verdant: [620, .17, 1.06], citadel: [430, .14, .88],
    };
    const [frequency, gain, drone] = settings[this.map], now = this.context.currentTime;
    this.ambientFilter.frequency.setTargetAtTime(frequency, now, 1.2); this.ambience.gain.setTargetAtTime(gain, now, 1.2);
    this.drones.forEach(({ osc, gain: g, base }) => { osc.frequency.setTargetAtTime(base * drone, now, 1.4); g.gain.setTargetAtTime(this.map === 'ember' ? .075 : .045, now, 1.2); });
  }

  tone(frequency: number, duration: number, type: OscillatorType = 'sine', gain = .12, endFrequency = frequency, delay = 0) {
    if (!this.context || !this.master || this.volume === 0) return;
    const ctx = this.context, osc = ctx.createOscillator(), envelope = ctx.createGain(), start = ctx.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    envelope.gain.setValueAtTime(.0001, start); envelope.gain.exponentialRampToValueAtTime(gain, start + .008); envelope.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(envelope); envelope.connect(this.master); osc.start(start); osc.stop(start + duration + .02);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }

  noise(duration: number, gain: number, frequency: number, type: BiquadFilterType = 'lowpass') {
    if (!this.context || !this.master || this.volume === 0) return;
    const ctx = this.context, buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
    source.buffer = buffer; filter.type = type; filter.frequency.value = frequency; envelope.gain.value = gain;
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master); source.start();
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }

  shoot(id: WeaponId) {
    const specs: Record<WeaponId, [number, number, number, number, number]> = {
      auto: [.12, .34, 2600, 190, .12], spectre: [.085, .25, 3200, 280, .075], burst: [.16, .42, 1900, 150, .16],
      handcannon: [.24, .62, 1350, 105, .26], scout: [.19, .4, 1800, 135, .17], shotgun: [.3, .72, 1150, 82, .32],
      sniper: [.34, .82, 850, 62, .4], lmg: [.11, .35, 2100, 165, .13],
    };
    const [duration, gain, filter, body, bodyGain] = specs[id];
    this.noise(duration, gain, filter); this.tone(body, duration * 1.15, 'sawtooth', bodyGain, body * .22);
    if (id === 'sniper' || id === 'handcannon' || id === 'shotgun') this.tone(1600, .06, 'square', .045, 700, .01);
    if (id === 'sniper') this.tone(58, .6, 'sine', .12, 28, .04);
  }

  hit(critical: boolean) { this.tone(critical ? 1460 : 900, .09, 'sine', .13, 500); if (critical) this.tone(2100, .08, 'triangle', .07, 1500); }
  kill() { this.tone(520, .16, 'triangle', .2, 1100); this.tone(780, .22, 'sine', .1, 1560, .05); }
  reloadStart() { this.noise(.08, .18, 2400); this.tone(220, .07, 'square', .045, 150); }
  magOut() { this.noise(.16, .22, 3200); this.tone(150, .12, 'square', .06, 90); }
  magIn() { this.noise(.1, .28, 2600); this.tone(340, .07, 'square', .08, 210); this.tone(760, .06, 'triangle', .05, 500, .04); }
  bolt() { this.noise(.14, .3, 4200, 'highpass'); this.tone(900, .09, 'square', .06, 420); this.tone(260, .08, 'triangle', .05, 160, .05); }
  reloadDone() { this.tone(480, .08, 'square', .04, 650); }
  equip() { this.noise(.06, .14, 3200); this.tone(520, .06, 'square', .035, 760); }
  aim(active: boolean, scope: boolean) {
    if (active) { if (scope) { this.noise(.07, .16, 4200, 'highpass'); this.tone(1280, .06, 'sine', .06, 980); } else { this.noise(.09, .1, 800); this.tone(300, .08, 'sine', .04, 420); } }
    else if (scope) this.tone(920, .05, 'sine', .045, 1180);
  }
  footstep(sprint: boolean) { this.noise(sprint ? .1 : .075, sprint ? .18 : .1, sprint ? 430 : 520); this.tone(sprint ? 62 : 72, .07, 'sine', .028, 40); }
  jump() { this.noise(.08, .12, 700); this.tone(160, .12, 'sine', .06, 90); }
  land() { this.noise(.13, .26, 480); this.tone(78, .13, 'sine', .1, 38); }
  heartbeat() { this.tone(58, .13, 'sine', .2, 32); this.tone(52, .12, 'sine', .15, 30, .16); }
  ability() { this.tone(90, .65, 'sawtooth', .18, 450); this.noise(.5, .28, 1500); }
  explosion() { this.noise(.8, .8, 650); this.tone(100, .45, 'sine', .5, 25); }
  damage() { this.noise(.15, .3, 900); this.tone(120, .12, 'sawtooth', .08, 55); }
  ui() { this.tone(700, .08, 'sine', .1, 1100); }
  win() { [330, 415, 494, 660].forEach((f, i) => this.tone(f, 1.2 + i * .12, 'sine', .12, f, i * .07)); }
  dispose() { this.drones.forEach(({ osc }) => osc.stop()); this.ambientNoise?.stop(); this.drones = []; void this.context?.close().catch(() => {}); }
}
