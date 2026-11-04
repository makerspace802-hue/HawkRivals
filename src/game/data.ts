import type { EngineerSpec, WeaponSpec, HUDState, MapId } from './types';

export const CREWS: EngineerSpec[] = [
  { id: 'rigger', name: 'Rigger', role: 'DUELIST', color: '#ffad78', ability: 'Updraft Dash', abilityDescription: 'Burst forward, reload instantly, and gain brief damage immunity.', health: 100, speed: 9.2, cooldown: 10 },
  { id: 'aerostat', name: 'Aerostat', role: 'ANCHOR', color: '#79e6e1', ability: 'Pressure Pulse', abilityDescription: 'Restore shields and blast nearby rivals away.', health: 125, speed: 8.1, cooldown: 14 },
  { id: 'mistwright', name: 'Mistwright', role: 'TACTICIAN', color: '#c5a7f2', ability: 'Mist Step', abilityDescription: 'Turn briefly untargetable and surge with renewed speed.', health: 100, speed: 8.8, cooldown: 12 },
];
export const WEAPONS: WeaponSpec[] = [
  { id: 'auto', name: 'Coil Nine', type: 'ASSAULT RIFLE', damage: 23, magazine: 30, rate: .105, reload: 1.7, spread: .0055, pellets: 1, range: 110, automatic: true, color: '#87eee5', weight: .02, falloffStart: 55, minDamage: .72 },
  { id: 'spectre', name: 'Vanta SMG', type: 'SUBMACHINE GUN', damage: 16, magazine: 36, rate: .075, reload: 1.4, spread: .012, pellets: 1, range: 60, automatic: true, color: '#ffc078', weight: 0, falloffStart: 22, minDamage: .58 },
  { id: 'burst', name: 'Trident', type: 'BURST RIFLE', damage: 31, magazine: 24, rate: .17, reload: 1.7, spread: .0035, pellets: 1, range: 135, automatic: true, color: '#b8a0ff', weight: .03, falloffStart: 75, minDamage: .85 },
  { id: 'handcannon', name: 'Rainbell', type: 'HAND CANNON', damage: 58, magazine: 8, rate: .38, reload: 1.8, spread: .0025, pellets: 1, range: 90, automatic: false, color: '#ffb072', weight: .01, falloffStart: 45, minDamage: .7 },
  { id: 'scout', name: 'Longdraft', type: 'MARKSMAN RIFLE', damage: 44, magazine: 16, rate: .25, reload: 1.55, spread: .0018, pellets: 1, range: 160, automatic: false, color: '#8fe1bd', weight: .04, falloffStart: 90, minDamage: .88 },
  { id: 'shotgun', name: 'Gale-8', type: 'TACTICAL SHOTGUN', damage: 15, magazine: 7, rate: .78, reload: 2.1, spread: .05, pellets: 8, range: 32, automatic: false, color: '#ff8d78', weight: .02, falloffStart: 9, minDamage: .32 },
  { id: 'sniper', name: 'Horizon', type: 'BOLT SNIPER', damage: 135, magazine: 5, rate: 1.15, reload: 2.5, spread: .0005, pellets: 1, range: 220, automatic: false, color: '#86c8ff', weight: .08, falloffStart: 130, minDamage: .95 },
  { id: 'lmg', name: 'Storm Drum', type: 'LIGHT MACHINE GUN', damage: 19, magazine: 60, rate: .085, reload: 3.2, spread: .015, pellets: 1, range: 100, automatic: true, color: '#e6d787', weight: .1, falloffStart: 48, minDamage: .68 },
];
export interface MapSpec {
  id: MapId; name: string; district: string; tagline: string; accent: string;
  skyLow: string; skyHigh: string; cloud: string; fog: string; fogDensity: number;
  mountains: [string, string, string];
  terrainBase: string; terrainLight: string; terrainPath: string; terrainTint: string;
  stone: string; darkStone: string; paleStone: string; moss: string; gold: string; glow: string;
  leaf: string; leafHue: number; grass: string; treeDensity: number; flowerA: string; flowerB: string; rockHue: number;
}
export const MAPS: MapSpec[] = [
  { id: 'turbine', name: 'Turbine District', district: 'CIRRUS REACH', tagline: 'Ruined sky-temples and open wind lanes.', accent: '#91f1dc',
    skyLow: '#bfc4a3', skyHigh: '#244547', cloud: '#d1d1b8', fog: '#9298a7', fogDensity: .0057,
    mountains: ['#545967', '#7a8091', '#a0a6b4'],
    terrainBase: '#48577d', terrainLight: '#7885a6', terrainPath: '#8c97b5', terrainTint: '#a1acc8',
    stone: '#646b7c', darkStone: '#43464e', paleStone: '#a0a6b5', moss: '#3f4f79', gold: '#6577a6', glow: '#acb5ce',
    leaf: '#5a6b96', leafHue: .2, grass: '#5b6c99', treeDensity: 1, flowerA: '#bdc4d8', flowerB: '#bcb8d4', rockHue: .13 },
  { id: 'ember', name: 'Cinder Foundry', district: 'ASH BELT', tagline: 'Close-quarters furnace yards under a burning sky.', accent: '#ff9a6a',
    skyLow: '#c08a63', skyHigh: '#3a1f2a', cloud: '#e0b090', fog: '#8a6a62', fogDensity: .0072,
    mountains: ['#4d3835', '#75564b', '#a17d66'],
    terrainBase: '#5a3f36', terrainLight: '#8f6a54', terrainPath: '#b08a68', terrainTint: '#c2a184',
    stone: '#6e5a54', darkStone: '#463832', paleStone: '#a88f80', moss: '#78483a', gold: '#c97945', glow: '#ffb27a',
    leaf: '#8f6a4f', leafHue: .06, grass: '#7b5e45', treeDensity: .62, flowerA: '#ffd0a8', flowerB: '#ff9a6a', rockHue: .05 },
  { id: 'verdant', name: 'Canopy Reach', district: 'GALE FOREST', tagline: 'Root bridges and dense cover in a teal forest.', accent: '#9df5b8',
    skyLow: '#b8d7c4', skyHigh: '#1f4a44', cloud: '#d0e8d4', fog: '#7f9c91', fogDensity: .0064,
    mountains: ['#3f5a4f', '#648272', '#8fa996'],
    terrainBase: '#3f6654', terrainLight: '#6e9a77', terrainPath: '#9ab88e', terrainTint: '#a8c8ad',
    stone: '#5c6d69', darkStone: '#3c4e48', paleStone: '#94a89c', moss: '#3f7a52', gold: '#84b57a', glow: '#b6ffd0',
    leaf: '#4f8a64', leafHue: .32, grass: '#4f7c5c', treeDensity: 1.35, flowerA: '#d8ffd0', flowerB: '#9df5b8', rockHue: .3 },
  { id: 'citadel', name: 'Aurora Citadel', district: 'SUNSET SPAN', tagline: 'Tiered ramparts, drop lanes, and a skybridge.', accent: '#ffd36a',
    skyLow: '#e2c08a', skyHigh: '#243b63', cloud: '#f0d9b0', fog: '#8899b5', fogDensity: .0054,
    mountains: ['#4e5573', '#727b98', '#9ba6bb'],
    terrainBase: '#566b7a', terrainLight: '#8296a3', terrainPath: '#c1a77c', terrainTint: '#b6c4cc',
    stone: '#7a7d84', darkStone: '#4b4f59', paleStone: '#b7b5a8', moss: '#5d735f', gold: '#d9ae5f', glow: '#ffd98a',
    leaf: '#6f8f6a', leafHue: .18, grass: '#5f7f6d', treeDensity: .8, flowerA: '#ffe6a8', flowerB: '#d9ae5f', rockHue: .1 },
];
export const DEFAULT_SETTINGS = { volume: .35, sensitivity: 1, quality: 'high' as const, reducedMotion: false, invertY: false };
export const EMPTY_HUD: HUDState = {
  phase: 'menu', health: 100, maxHealth: 100, shield: 50, ammo: 30, magazine: 30,
  reloading: false, reloadProgress: 0, kills: 0, deaths: 0, remaining: 300,
  abilityCooldown: 0, grenadeCooldown: 0, hit: 0, damaged: 0, hitDamage: 0, hitCritical: false, damageAngle: 0, damageDir: 0, killTime: 0, killVictim: '', killHeadshot: false, killLabel: '', aim: false, sprinting: false, scoped: false, map: 'turbine', heading: 0,
  position: { x: 0, y: 0, z: 25 }, connected: false, room: '', players: [], feed: [], message: '', messageTime: 0,
  pointerLocked: false, shots: 0, hits: 0, respawn: 0, leader: 0, target: 15,
};
