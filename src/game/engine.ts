import * as THREE from 'three';
import { World } from './world';
import { createEngineer, createWeapon, part } from './models';
import { GameAudio } from './audio';
import { CREWS, WEAPONS, EMPTY_HUD } from './data';
import { clamp, damp, terrainHeight, disposeObject, seededRandom } from './math';
import type { EngineCallbacks, HUDState, EngineerClass, WeaponId, Settings, Snapshot, NetPlayer } from './types';

type Remote = { mesh: THREE.Group; label: THREE.Sprite; target: THREE.Vector3; last: NetPlayer };
type Trace = { line: THREE.Line; life: number };

export class GameEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(68, 1, .05, 700);
  readonly world: World;
  readonly audio = new GameAudio();
  readonly canvas: HTMLCanvasElement;
  hud: HUDState = structuredClone(EMPTY_HUD);
  weapon = WEAPONS[0];
  engineer = CREWS[0];
  private settings: Settings;
  private callbacks: EngineCallbacks;
  private cleanup: (() => void)[] = [];
  private keys = new Set<string>();
  private remotes = new Map<string, Remote>();
  private traces: Trace[] = [];
  private particles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private weaponGroup = new THREE.Group();
  private gun: THREE.Group;
  private muzzle: THREE.Mesh;
  private ws: WebSocket | null = null;
  private playerId = '';
  private needsSpawn = true;
  private serverAlive = false;
  private disposed = false;
  private raf = 0;
  private previous = 0;
  private worldTime = 0;
  private hudClock = 0;
  private netClock = 0;
  private yaw = 0;
  private pitch = 0;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private verticalVelocity = 0;
  private grounded = true;
  private firing = false;
  private triggerReady = true;
  private aiming = false;
  private fireTimer = 0;
  private reloadTimer = 0;
  private recoil = 0;
  private invincible = 0;
  private dashTime = 0;
  private walkTime = 0;
  private feedSeen = 0;
  private random = seededRandom(8432);
  private resizeObserver: ResizeObserver;
  private softwareGPU = false;

  constructor(container: HTMLElement, settings: Settings, callbacks: EngineCallbacks) {
    this.settings = { ...settings }; this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    const gl = this.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    this.softwareGPU = !!debug && /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.softwareGPU ? .7 : settings.quality === 'high' ? 1.4 : 1));
    this.renderer.shadowMap.enabled = !this.softwareGPU; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement; this.canvas.setAttribute('aria-label', 'Nimbus Rivals multiplayer arena'); container.appendChild(this.canvas);
    this.scene.add(this.camera); this.camera.position.set(28, 10, 46); this.camera.lookAt(0, 8, -30);
    this.world = new World(this.scene, this.softwareGPU ? 'low' : settings.quality);
    this.gun = createWeapon('auto'); this.weaponGroup.add(this.gun); this.weaponGroup.position.set(.34, -.31, -.85); this.weaponGroup.scale.setScalar(.72); this.weaponGroup.visible = false; this.camera.add(this.weaponGroup);
    const glove = new THREE.MeshStandardMaterial({ color: '#24383d', roughness: .75 });
    part(this.weaponGroup, glove, [.17, .18, .42], [.08, -.23, .4], [-.55, 0, 0], .04);
    this.muzzle = new THREE.Mesh(new THREE.OctahedronGeometry(.15), new THREE.MeshBasicMaterial({ color: '#b8fff4' })); this.muzzle.position.set(0, .03, -1.1); this.muzzle.visible = false; this.weaponGroup.add(this.muzzle);
    this.audio.setVolume(settings.volume); this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize(container)); this.resizeObserver.observe(container); this.resize(container);
    this.callbacks.onReady(); this.loop(performance.now());
  }
  private resize(container: HTMLElement) { const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  private listen(target: EventTarget, name: string, fn: EventListener) { target.addEventListener(name, fn); this.cleanup.push(() => target.removeEventListener(name, fn)); }
  private bindInput() {
    this.listen(window, 'keydown', ((e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (this.hud.phase !== 'playing') return;
      if (['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); if (e.repeat) return;
      if (e.code === 'KeyR') this.reload(); if (e.code === 'KeyQ') this.ability(); if (e.code === 'KeyE') this.grenade();
      if (e.code === 'Space') this.jump(); if (e.code === 'KeyP') this.pause();
      const index = Number(e.code.replace('Digit','')) - 1; if (e.code.startsWith('Digit') && WEAPONS[index]) this.setWeapon(WEAPONS[index].id);
    }) as EventListener);
    this.listen(window, 'keyup', ((e: KeyboardEvent) => { this.keys.delete(e.code); }) as EventListener);
    this.listen(document, 'mousemove', ((e: MouseEvent) => { if (this.hud.phase === 'playing' && document.pointerLockElement === this.canvas) this.look(e.movementX, e.movementY); }) as EventListener);
    this.listen(this.canvas, 'pointerdown', ((e: PointerEvent) => { if (this.hud.phase !== 'playing') return; this.audio.start(); if (e.button === 0) { this.firing = true; this.triggerReady = true; this.requestPointerLock(); } if (e.button === 2) this.aiming = true; }) as EventListener);
    this.listen(window, 'pointerup', ((e: PointerEvent) => { if (e.button === 0) { this.firing = false; this.triggerReady = true; } if (e.button === 2) this.aiming = false; }) as EventListener);
    this.listen(this.canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    this.listen(document, 'pointerlockchange', (() => { this.hud.pointerLocked = document.pointerLockElement === this.canvas; }) as EventListener);
    this.listen(window, 'blur', (() => { this.keys.clear(); this.firing = false; this.aiming = false; }) as EventListener);
  }
  requestPointerLock() { if (this.hud.phase === 'playing' && !matchMedia('(pointer:coarse)').matches) void this.canvas.requestPointerLock?.().catch(() => {}); }
  private look(x: number, y: number) { const s = .0021 * this.settings.sensitivity * (this.aiming ? .6 : 1); this.yaw -= x * s; this.pitch = clamp(this.pitch - y * s * (this.settings.invertY ? -1 : 1), -1.45, 1.45); }
  configure(settings: Settings) { this.settings = { ...settings }; this.audio.setVolume(settings.volume); this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.softwareGPU ? .7 : settings.quality === 'high' ? 1.4 : 1)); }
  setEngineer(id: EngineerClass) { this.engineer = CREWS.find(c => c.id === id)!; this.world.setEngineer(id); }
  setWeapon(id: WeaponId) { if (this.weapon.id === id) return; this.weapon = WEAPONS.find(w => w.id === id)!; this.weaponGroup.remove(this.gun); disposeObject(this.gun); this.gun = createWeapon(id); this.weaponGroup.add(this.gun); this.hud.ammo = this.hud.magazine = this.weapon.magazine; this.hud.reloading = false; this.fireTimer = .18; }
  start(name: string, room: string, engineer: EngineerClass, weapon: WeaponId) {
    this.returnToMenu(); this.needsSpawn = true; this.serverAlive = false; this.setEngineer(engineer); this.weapon = WEAPONS[0]; this.setWeapon(weapon);
    this.hud = structuredClone(EMPTY_HUD); this.hud.phase = 'playing'; this.hud.health = this.hud.maxHealth = this.engineer.health; this.hud.ammo = this.hud.magazine = this.weapon.magazine; this.hud.room = room || 'SKY-01'; this.hud.message = 'CONNECTING TO CIRRUS REACH'; this.hud.messageTime = 5;
    this.world.engineer.visible = false; this.world.sailfin.visible = false; this.weaponGroup.visible = true; this.camera.position.set(0, terrainHeight(0, 27) + 1.75, 27); this.yaw = 0; this.pitch = 0;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; this.ws = new WebSocket(`${protocol}//${location.host}/ws`);
    this.ws.onopen = () => { this.hud.connected = true; this.ws?.send(JSON.stringify({ type: 'join', name, room, engineer, weapon })); this.announce('FREE-FOR-ALL', 'First to 15 eliminations. Wind frames fill open slots.', 4); };
    this.ws.onmessage = e => this.onMessage(JSON.parse(e.data));
    this.ws.onerror = () => this.callbacks.onError('Could not reach the arena server. Check your connection and retry.');
    this.ws.onclose = () => { this.hud.connected = false; if (this.hud.phase === 'playing') this.announce('CONNECTION LOST', 'Return to the lobby and reconnect.', 8); };
    this.audio.start(); this.publish(); this.requestPointerLock();
  }
  private onMessage(msg: { type: string; id?: string; room?: string; damage?: number; headshot?: boolean; killer?: string; message?: string } & Partial<Snapshot>) {
    if (msg.type === 'joined') { this.playerId = msg.id!; this.hud.room = msg.room!; }
    if (msg.type === 'hit') { this.hud.hit = 1; this.hud.hits++; this.audio.hit(!!msg.headshot); }
    if (msg.type === 'death') { this.hud.deaths++; this.hud.health = 0; this.hud.shield = 0; this.hud.respawn = 3; this.firing = false; this.announce('ELIMINATED', `${msg.killer} took the duel. Redeploying…`, 3); }
    if (msg.type === 'error') this.announce('ARENA NOTICE', msg.message || 'Network error', 4);
    if (msg.type === 'snapshot') this.applySnapshot(msg as Snapshot);
  }
  private applySnapshot(s: Snapshot) {
    this.hud.players = s.players; this.hud.remaining = s.remaining; this.hud.leader = s.leader; this.hud.target = s.target; this.hud.feed = s.feed;
    const me = s.players.find(p => p.id === this.playerId);
    if (me) {
      if (me.alive && (this.needsSpawn || !this.serverAlive)) { this.camera.position.set(me.x, me.y, me.z); this.velocity.set(0,0,0); this.verticalVelocity = 0; this.needsSpawn = false; this.invincible = 2; }
      this.serverAlive = me.alive; this.hud.kills = me.kills; this.hud.deaths = me.deaths; this.hud.health = me.hp; this.hud.shield = me.shield; this.hud.respawn = me.respawn;
    }
    const alive = new Set(s.players.filter(p => p.id !== this.playerId && p.alive).map(p => p.id));
    for (const [id, remote] of this.remotes) if (!alive.has(id)) { this.scene.remove(remote.mesh); this.scene.remove(remote.label); disposeObject(remote.mesh); remote.label.material.map?.dispose(); remote.label.material.dispose(); this.remotes.delete(id); }
    for (const p of s.players) {
      if (p.id === this.playerId || !p.alive) continue;
      let remote = this.remotes.get(p.id);
      if (!remote) { const mesh = createEngineer(p.engineer); mesh.scale.setScalar(.82); const label = this.makeLabel(p); this.scene.add(mesh, label); remote = { mesh, label, target: new THREE.Vector3(p.x, p.y - 1.75, p.z), last: p }; this.remotes.set(p.id, remote); }
      remote.target.set(p.x, p.y - 1.75, p.z); remote.last = p; remote.mesh.rotation.y = p.yaw; remote.label.position.set(p.x, p.y + .65, p.z);
    }
    for (const feed of s.feed) if (feed.id > this.feedSeen) { this.feedSeen = feed.id; if (feed.killer !== 'VEX-7' && feed.killer !== 'KITE' && feed.killer !== 'ROOK') this.audio.kill(); }
    if ((s.remaining <= 0 || s.leader >= s.target) && this.hud.phase === 'playing') { this.hud.phase = 'ended'; this.weaponGroup.visible = false; if (document.pointerLockElement === this.canvas) document.exitPointerLock(); this.audio.win(); }
  }
  private makeLabel(p: NetPlayer) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const ctx = c.getContext('2d')!; ctx.fillStyle = 'rgba(8,20,25,.75)'; ctx.fillRect(20, 4, 216, 46); ctx.fillStyle = '#e8fff9'; ctx.font = '600 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.name, 128, 35); const map = new THREE.CanvasTexture(c); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false })); sprite.scale.set(1.85, .46, 1); return sprite; }
  pause() { if (this.hud.phase !== 'playing') return; this.hud.phase = 'paused'; this.firing = false; this.keys.clear(); if (document.pointerLockElement === this.canvas) document.exitPointerLock(); this.publish(); }
  resume() { if (this.hud.phase !== 'paused') return; this.hud.phase = 'playing'; this.previous = performance.now(); this.requestPointerLock(); this.publish(); }
  returnToMenu() { this.ws?.close(); this.ws = null; this.playerId = ''; for (const r of this.remotes.values()) { this.scene.remove(r.mesh, r.label); disposeObject(r.mesh); } this.remotes.clear(); this.hud = structuredClone(EMPTY_HUD); this.world.engineer.visible = true; this.world.sailfin.visible = true; this.weaponGroup.visible = false; this.camera.position.set(28, 10, 46); this.camera.lookAt(0, 8, -30); this.publish(); }
  private announce(message: string, sub = '', time = 3) { this.hud.message = sub ? `${message}|${sub}` : message; this.hud.messageTime = time; }
  private loop = (now: number) => { if (this.disposed) return; const dt = Math.min(this.previous ? (now - this.previous) / 1000 : .016, .05); this.previous = now; this.worldTime += dt; this.world.update(this.worldTime, this.settings.reducedMotion); if (this.hud.phase === 'playing') this.update(dt); else if (this.hud.phase === 'menu') { this.camera.position.x = 28 + Math.sin(this.worldTime * .08) * 2; this.camera.lookAt(0, 8, -30); } this.updateRemotes(dt); this.updateEffects(dt); this.renderer.render(this.scene, this.camera); this.hudClock += dt; if (this.hudClock > .08) { this.hudClock = 0; this.publish(); } this.raf = requestAnimationFrame(this.loop); };
  private update(dt: number) {
    this.fireTimer = Math.max(0, this.fireTimer - dt); this.invincible = Math.max(0, this.invincible - dt); this.dashTime = Math.max(0, this.dashTime - dt); this.hud.abilityCooldown = Math.max(0, this.hud.abilityCooldown - dt); this.hud.grenadeCooldown = Math.max(0, this.hud.grenadeCooldown - dt); this.hud.hit = Math.max(0, this.hud.hit - dt * 5); this.hud.damaged = Math.max(0, this.hud.damaged - dt * 2); this.hud.messageTime = Math.max(0, this.hud.messageTime - dt);
    if (this.hud.reloading) { this.reloadTimer -= dt; this.hud.reloadProgress = 1 - this.reloadTimer / this.weapon.reload; if (this.reloadTimer <= 0) { this.hud.reloading = false; this.hud.ammo = this.weapon.magazine; this.audio.tone(480, .08, 'square', .04, 650); } }
    if (this.hud.respawn <= 0 && this.hud.health > 0) this.move(dt);
    if (this.firing && this.fireTimer <= 0 && !this.hud.reloading && this.hud.respawn <= 0 && (this.weapon.automatic || this.triggerReady)) { this.triggerReady = false; this.shoot(); }
    this.recoil = damp(this.recoil, 0, 12, dt); const reload = this.hud.reloading ? Math.sin(this.hud.reloadProgress * Math.PI) : 0;
    this.weaponGroup.position.x = damp(this.weaponGroup.position.x, this.aiming ? .01 : .34, 12, dt); this.weaponGroup.position.y = damp(this.weaponGroup.position.y, (this.aiming ? -.25 : -.31) - reload * .3, 12, dt); this.weaponGroup.position.z = -.85 + this.recoil * .08; this.weaponGroup.rotation.x = this.recoil * .08 - reload * .4;
    this.camera.fov = damp(this.camera.fov, this.aiming ? (this.weapon.id === 'sniper' ? 35 : 58) : 74, 12, dt); this.camera.updateProjectionMatrix(); this.muzzle.visible = this.fireTimer > this.weapon.rate - .035;
    this.camera.rotation.set(this.pitch - this.recoil * .006, this.yaw, 0, 'YXZ'); this.hud.aim = this.aiming; this.hud.position = { x: this.camera.position.x, z: this.camera.position.z };
    this.netClock += dt; if (this.netClock > .066 && this.ws?.readyState === WebSocket.OPEN) { this.netClock = 0; this.ws.send(JSON.stringify({ type: 'state', position: this.camera.position.toArray(), yaw: this.yaw, weapon: this.weapon.id })); }
  }
  private move(dt: number) {
    const forward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0), side = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const sprint = this.keys.has('ShiftLeft') && forward > 0 && !this.aiming; this.hud.sprinting = sprint;
    const speed = this.engineer.speed * (sprint ? 1.45 : 1) * (this.dashTime > 0 ? 2.1 : 1); const length = Math.hypot(forward, side) || 1;
    const dx = (Math.cos(this.yaw) * side - Math.sin(this.yaw) * forward) / length, dz = (-Math.sin(this.yaw) * side - Math.cos(this.yaw) * forward) / length;
    this.velocity.x = damp(this.velocity.x, dx * speed, this.grounded ? 15 : 4, dt); this.velocity.z = damp(this.velocity.z, dz * speed, this.grounded ? 15 : 4, dt);
    this.camera.position.x += this.velocity.x * dt; this.camera.position.z += this.velocity.z * dt; this.resolveCollision(this.camera.position);
    this.camera.position.x = clamp(this.camera.position.x, -38, 38); this.camera.position.z = clamp(this.camera.position.z, -50, 31);
    this.verticalVelocity -= 21 * dt; this.camera.position.y += this.verticalVelocity * dt; const floor = terrainHeight(this.camera.position.x, this.camera.position.z) + 1.75;
    if (this.camera.position.y <= floor) { this.camera.position.y = floor; this.verticalVelocity = 0; this.grounded = true; } else this.grounded = false;
    if (Math.abs(forward) + Math.abs(side) > 0) this.walkTime += dt * (sprint ? 13 : 9); if (this.keys.has('ArrowLeft')) this.yaw += dt * 1.8; if (this.keys.has('ArrowRight')) this.yaw -= dt * 1.8; if (this.keys.has('ArrowUp')) this.pitch = clamp(this.pitch + dt, -1.4, 1.4); if (this.keys.has('ArrowDown')) this.pitch = clamp(this.pitch - dt, -1.4, 1.4);
  }
  private resolveCollision(pos: THREE.Vector3) { for (const c of this.world.colliders) { const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = c.radius + .42; if (d < min && d > .001) { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; } } }
  private updateRemotes(dt: number) { for (const r of this.remotes.values()) { const moving = r.mesh.position.distanceToSquared(r.target) > .01; r.mesh.position.lerp(r.target, 1 - Math.exp(-12 * dt)); r.label.position.lerp(new THREE.Vector3(r.target.x, r.target.y + 2.45, r.target.z), 1 - Math.exp(-12 * dt)); const cloth = r.mesh.userData.cloth as THREE.Mesh | undefined; if (cloth) cloth.rotation.x = Math.sin(this.worldTime * 4 + r.target.x) * .08; r.mesh.position.y += moving ? Math.sin(this.worldTime * 10) * .002 : 0; } }
  private jump() { if (this.grounded && this.hud.respawn <= 0) { this.verticalVelocity = 8.2; this.grounded = false; this.audio.tone(100, .1, 'sine', .05, 160); } }
  reload() { if (this.hud.phase !== 'playing' || this.hud.reloading || this.hud.ammo === this.weapon.magazine) return; this.hud.reloading = true; this.hud.reloadProgress = 0; this.reloadTimer = this.weapon.reload; this.audio.reload(); }
  ability() { if (this.hud.abilityCooldown > 0 || this.hud.respawn > 0) return; this.hud.abilityCooldown = this.engineer.cooldown; this.invincible = 1.4; this.dashTime = this.engineer.id === 'rigger' ? .45 : 0; this.hud.ammo = this.weapon.magazine; this.hud.reloading = false; this.ws?.send(JSON.stringify({ type: 'ability' })); this.ring(this.camera.position, this.engineer.color); this.audio.ability(); this.announce(this.engineer.ability.toUpperCase(), this.engineer.abilityDescription, 2); }
  grenade() { if (this.hud.grenadeCooldown > 0 || this.hud.respawn > 0) return; this.hud.grenadeCooldown = 9; this.camera.getWorldDirection(this.direction); const target = this.camera.position.clone().addScaledVector(this.direction, 16); target.y = terrainHeight(target.x, target.z) + .2; this.ws?.send(JSON.stringify({ type: 'grenade', position: target.toArray() })); this.ring(target, '#8ff5df'); this.burst(target, '#8ff5df'); this.audio.explosion(); }
  private shoot() {
    if (this.hud.ammo <= 0) { this.reload(); return; } this.hud.ammo--; this.hud.shots++; this.fireTimer = this.weapon.rate; this.recoil = this.weapon.id === 'sniper' || this.weapon.id === 'handcannon' ? 1.7 : .75; this.audio.shoot(this.weapon.id === 'handcannon' || this.weapon.id === 'sniper');
    this.camera.getWorldDirection(this.direction); this.direction.x += (this.random() - .5) * this.weapon.spread * (this.aiming ? .35 : 1); this.direction.y += (this.random() - .5) * this.weapon.spread * (this.aiming ? .35 : 1); this.direction.normalize();
    this.ws?.send(JSON.stringify({ type: 'shoot', dir: this.direction.toArray() })); const from = this.muzzle.getWorldPosition(new THREE.Vector3()), to = this.camera.position.clone().addScaledVector(this.direction, Math.min(this.weapon.range, 80)); this.trace(from, to);
  }
  private trace(from: THREE.Vector3, to: THREE.Vector3) { const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color: this.weapon.color, transparent: true, opacity: .8 })); this.scene.add(line); this.traces.push({ line, life: .07 }); }
  private ring(position: THREE.Vector3, color: string) { const mesh = new THREE.Mesh(new THREE.RingGeometry(.7, .85, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide })); mesh.position.copy(position); mesh.position.y = terrainHeight(position.x, position.z) + .15; mesh.rotation.x = -Math.PI / 2; mesh.scale.setScalar(.2); this.scene.add(mesh); const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()); this.traces.push({ line, life: 0 }); const particle = { mesh, velocity: new THREE.Vector3(), life: .7 }; this.particles.push(particle); }
  private burst(position: THREE.Vector3, color: string) { for (let i = 0; i < 18; i++) { const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.07), new THREE.MeshBasicMaterial({ color, transparent: true })); mesh.position.copy(position); this.scene.add(mesh); this.particles.push({ mesh, velocity: new THREE.Vector3((this.random() - .5) * 10, this.random() * 8, (this.random() - .5) * 10), life: .5 + this.random() * .4 }); } }
  private updateEffects(dt: number) { for (let i = this.traces.length - 1; i >= 0; i--) { const t = this.traces[i]; t.life -= dt; if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); (t.line.material as THREE.Material).dispose(); this.traces.splice(i, 1); } } for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * 8; p.mesh.scale.addScalar(dt * 5); (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life * 1.6); if (p.life <= 0) { this.scene.remove(p.mesh); disposeObject(p.mesh); this.particles.splice(i, 1); } } }
  private publish() { this.callbacks.onHUD({ ...this.hud, players: [...this.hud.players], feed: [...this.hud.feed] }); }
  dispose() { this.disposed = true; cancelAnimationFrame(this.raf); this.ws?.close(); this.cleanup.forEach(fn => fn()); this.resizeObserver.disconnect(); for (const r of this.remotes.values()) disposeObject(r.mesh); disposeObject(this.scene); this.renderer.dispose(); this.canvas.remove(); this.audio.dispose(); }
}
