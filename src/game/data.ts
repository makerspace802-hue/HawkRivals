import type { EngineerSpec, WeaponSpec, HUDState } from './types';

export const CREWS: EngineerSpec[] = [
  { id: 'rigger', name: 'Rigger', role: 'DUELIST', color: '#ffad78', ability: 'Updraft Dash', abilityDescription: 'Burst forward, reload instantly, and gain brief damage immunity.', health: 100, speed: 9.2, cooldown: 10 },
  { id: 'aerostat', name: 'Aerostat', role: 'ANCHOR', color: '#79e6e1', ability: 'Pressure Pulse', abilityDescription: 'Restore shields and blast nearby rivals away.', health: 125, speed: 8.1, cooldown: 14 },
  { id: 'mistwright', name: 'Mistwright', role: 'TACTICIAN', color: '#c5a7f2', ability: 'Mist Step', abilityDescription: 'Turn briefly untargetable and surge with renewed speed.', health: 100, speed: 8.8, cooldown: 12 },
];
export const WEAPONS: WeaponSpec[] = [
  { id: 'auto', name: 'Coil Nine', type: 'ASSAULT RIFLE', damage: 26, magazine: 30, rate: .1, reload: 1.65, spread: .006, pellets: 1, range: 120, automatic: true, color: '#87eee5' },
  { id: 'spectre', name: 'Vanta SMG', type: 'SUBMACHINE GUN', damage: 18, magazine: 36, rate: .068, reload: 1.45, spread: .011, pellets: 1, range: 65, automatic: true, color: '#ffc078' },
  { id: 'burst', name: 'Trident', type: 'BURST RIFLE', damage: 34, magazine: 24, rate: .16, reload: 1.75, spread: .004, pellets: 1, range: 135, automatic: true, color: '#b8a0ff' },
  { id: 'handcannon', name: 'Rainbell', type: 'HAND CANNON', damage: 62, magazine: 8, rate: .34, reload: 1.8, spread: .003, pellets: 1, range: 100, automatic: false, color: '#ffb072' },
  { id: 'scout', name: 'Longdraft', type: 'MARKSMAN RIFLE', damage: 48, magazine: 16, rate: .22, reload: 1.55, spread: .002, pellets: 1, range: 160, automatic: false, color: '#8fe1bd' },
  { id: 'shotgun', name: 'Gale-8', type: 'TACTICAL SHOTGUN', damage: 13, magazine: 7, rate: .72, reload: 2.1, spread: .052, pellets: 8, range: 35, automatic: false, color: '#ff8d78' },
  { id: 'sniper', name: 'Horizon', type: 'BOLT SNIPER', damage: 145, magazine: 5, rate: 1.15, reload: 2.5, spread: .0005, pellets: 1, range: 220, automatic: false, color: '#86c8ff' },
  { id: 'lmg', name: 'Storm Drum', type: 'LIGHT MACHINE GUN', damage: 23, magazine: 60, rate: .09, reload: 3.1, spread: .013, pellets: 1, range: 105, automatic: true, color: '#e6d787' },
];
export const DEFAULT_SETTINGS = { volume: .35, sensitivity: 1, quality: 'high' as const, reducedMotion: false, invertY: false };
export const EMPTY_HUD: HUDState = {
  phase: 'menu', health: 100, maxHealth: 100, shield: 50, ammo: 30, magazine: 30,
  reloading: false, reloadProgress: 0, kills: 0, deaths: 0, remaining: 300,
  abilityCooldown: 0, grenadeCooldown: 0, hit: 0, damaged: 0, hitDamage: 0, hitCritical: false, aim: false, sprinting: false,
  position: { x: 0, z: 25 }, connected: false, room: '', players: [], feed: [], message: '', messageTime: 0,
  pointerLocked: false, shots: 0, hits: 0, respawn: 0, leader: 0, target: 15,
};
