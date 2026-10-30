export type EngineerClass = 'rigger' | 'aerostat' | 'mistwright';
export type WeaponId = 'auto' | 'handcannon' | 'scout' | 'spectre' | 'shotgun' | 'sniper' | 'burst' | 'lmg';
export type GamePhase = 'menu' | 'playing' | 'paused' | 'ended';

export interface EngineerSpec {
  id: EngineerClass; name: string; role: string; color: string; ability: string;
  abilityDescription: string; health: number; speed: number; cooldown: number;
}
export interface WeaponSpec {
  id: WeaponId; name: string; type: string; damage: number; magazine: number;
  rate: number; reload: number; spread: number; pellets: number; range: number;
  automatic: boolean; color: string;
}
export interface Settings { volume: number; sensitivity: number; quality: 'high' | 'low'; reducedMotion: boolean; invertY: boolean; }
export interface NetPlayer {
  id: string; name: string; engineer: EngineerClass; weapon: WeaponId;
  x: number; y: number; z: number; yaw: number; hp: number; shield: number;
  kills: number; deaths: number; alive: boolean; respawn: number;
}
export interface KillEvent { id: number; killer: string; victim: string; weapon: WeaponId; headshot: boolean; }
export interface Snapshot { players: NetPlayer[]; remaining: number; leader: number; target: number; feed: KillEvent[]; }
export interface HUDState {
  phase: GamePhase; health: number; maxHealth: number; shield: number; ammo: number;
  magazine: number; reloading: boolean; reloadProgress: number; kills: number; deaths: number;
  remaining: number; abilityCooldown: number; grenadeCooldown: number; hit: number; damaged: number; hitDamage: number; hitCritical: boolean;
  aim: boolean; sprinting: boolean; position: { x: number; z: number }; connected: boolean;
  room: string; players: NetPlayer[]; feed: KillEvent[]; message: string; messageTime: number;
  pointerLocked: boolean; shots: number; hits: number; respawn: number; leader: number; target: number;
}
export interface EngineCallbacks { onReady: () => void; onHUD: (hud: HUDState) => void; onError: (message: string) => void; }
