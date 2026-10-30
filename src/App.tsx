import { useEffect, useRef, useState } from 'react';
import { Crosshair, Gear, Lightning, Shield, Users, X, Play, ArrowLeft, Copy, Check, WifiHigh } from '@phosphor-icons/react';
import { GameEngine } from './game/engine';
import { CREWS, WEAPONS, EMPTY_HUD, DEFAULT_SETTINGS } from './game/data';
import type { EngineerClass, WeaponId, Settings, HUDState } from './game/types';

type Tab = 'play' | 'loadout' | 'guide';
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function App() {
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HUDState>(structuredClone(EMPTY_HUD));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('play');
  const [name, setName] = useState(() => localStorage.getItem('nimbus-name') || `Engineer${Math.floor(Math.random() * 900 + 100)}`);
  const [room, setRoom] = useState('');
  const [privateRoom, setPrivateRoom] = useState(false);
  const [weapon, setWeapon] = useState<WeaponId>('auto');
  const [engineer, setEngineer] = useState<EngineerClass>('rigger');
  const [settings, setSettings] = useState<Settings>(() => { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('nimbus-settings') || '{}') }; } catch { return DEFAULT_SETTINGS; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const initial = useRef(settings);
  useEffect(() => {
    try {
      const game = new GameEngine(mount.current!, initial.current, { onReady: () => setReady(true), onHUD: setHud, onError: setError });
      engine.current = game;
      Object.defineProperty(window, '__NIMBUS_STATE__', { configurable: true, get: () => ({ phase: game.hud.phase, connected: game.hud.connected, room: game.hud.room, health: game.hud.health, ammo: game.hud.ammo, weapon: game.weapon.id, players: game.hud.players.length, kills: game.hud.kills, shots: game.hud.shots, hits: game.hud.hits, position: game.hud.position, render: { calls: game.renderer.info.render.calls, triangles: game.renderer.info.render.triangles } }) });
      return () => { game.dispose(); delete (window as unknown as Record<string, unknown>).__NIMBUS_STATE__; };
    } catch (e) { setError(`WebGL could not start. ${e instanceof Error ? e.message : ''}`); }
  }, []);
  useEffect(() => { engine.current?.configure(settings); localStorage.setItem('nimbus-settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('nimbus-name', name); }, [name]);
  const deploy = () => { if (!name.trim()) return; setError(''); engine.current?.start(name, privateRoom ? room.trim().toUpperCase() : '', engineer, weapon); };
  const createRoom = () => { const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('').slice(0, 6); setRoom(code); setPrivateRoom(true); };
  const copyRoom = async () => { await navigator.clipboard.writeText(hud.room); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const activeWeapon = WEAPONS.find(w => w.id === weapon)!;
  const activeCrew = CREWS.find(c => c.id === engineer)!;
  const sortedPlayers = [...hud.players].sort((a, b) => b.kills - a.kills);
  return <main className={`game-shell ${settings.reducedMotion ? 'reduce-motion' : ''}`}>
    <div className="world" ref={mount} />
    <div className="vignette" />
    {hud.phase === 'menu' && <section className="lobby">
      <header className="topbar">
        <button className="brand" onClick={() => setTab('play')} aria-label="Nimbus Rivals home"><span className="brand-mark">N</span><span>NIMBUS <b>RIVALS</b></span></button>
        <nav aria-label="Lobby navigation">{(['play','loadout','guide'] as Tab[]).map(item => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item === 'play' ? 'PLAY' : item === 'loadout' ? 'LOADOUT' : 'FIELD MANUAL'}</button>)}</nav>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Gear size={21} /></button>
      </header>
      {tab === 'play' && <div className="play-layout">
        <div className="hero-copy"><div className="live-tag"><span /> ONLINE ARENA · SEASON 01</div><h1>OWN THE<br /><em>UPPER SKY.</em></h1><p>Fast tactical combat above the clouds. Outshoot rivals, master the wind, and make every elimination count.</p><div className="mode-line"><Crosshair size={20} /><div><strong>SKY CLASH</strong><span>Free-for-all · First to 15 · 5 minutes</span></div></div></div>
        <div className="deploy-panel">
          <div className="panel-heading"><span>DEPLOYMENT</span><small><WifiHigh size={15} /> REAL-TIME MULTIPLAYER</small></div>
          <label>CALLSIGN<input value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Your callsign" /></label>
          {privateRoom && <label>ROOM CODE<input value={room} maxLength={10} onChange={e => setRoom(e.target.value.toUpperCase())} placeholder="ENTER CODE" /></label>}
          <div className="selected-kit"><button onClick={() => setTab('loadout')}><span style={{ background: activeCrew.color }} /><div><small>{activeCrew.role}</small><strong>{activeCrew.name}</strong></div><span>CHANGE</span></button><button onClick={() => setTab('loadout')}><Crosshair size={19} /><div><small>{activeWeapon.type}</small><strong>{activeWeapon.name}</strong></div><span>CHANGE</span></button></div>
          <button className="deploy" disabled={!ready || !name.trim() || (privateRoom && !room.trim())} onClick={deploy}><Play size={20} weight="fill" /><span>{privateRoom ? 'JOIN PRIVATE ARENA' : 'QUICK PLAY'}<small>{ready ? 'CIRRUS REACH · 8 PLAYERS MAX' : 'PREPARING ARENA…'}</small></span></button>
          <div className="room-actions"><button onClick={() => setPrivateRoom(v => !v)}>{privateRoom ? 'USE QUICK PLAY' : 'JOIN WITH CODE'}</button><button onClick={createRoom}>CREATE PRIVATE ROOM</button></div>
          <p className="network-note"><span /> Live server combat · Practice frames fill empty slots</p>
        </div>
      </div>}
      {tab === 'loadout' && <div className="loadout-page"><div className="section-title"><span>FIELD KIT</span><h2>CHOOSE YOUR EDGE.</h2><p>Every weapon changes your range, rhythm, and approach.</p></div><div className="kit-grid"><section><h3>01 / COMBAT FRAME</h3><div className="crew-list">{CREWS.map(c => <button key={c.id} className={engineer === c.id ? 'selected' : ''} onClick={() => { setEngineer(c.id); engine.current?.setEngineer(c.id); }}><span className="crew-swatch" style={{ background: c.color }} /><div><strong>{c.name}</strong><small>{c.role} · {c.health} HP</small><p>{c.abilityDescription}</p></div><b>Q · {c.ability}</b></button>)}</div></section><section><h3>02 / WEAPON RACK <span>8 AVAILABLE</span></h3><div className="weapon-list">{WEAPONS.map((w, i) => <button key={w.id} className={weapon === w.id ? 'selected' : ''} onClick={() => { setWeapon(w.id); engine.current?.setWeapon(w.id); }}><kbd>{i + 1}</kbd><div><strong>{w.name}</strong><small>{w.type}</small></div><span>{w.damage}{w.pellets > 1 ? `×${w.pellets}` : ''} DMG</span><span>{w.magazine} MAG</span></button>)}</div></section></div><button className="back-action" onClick={() => setTab('play')}><ArrowLeft size={17} /> READY FOR DEPLOYMENT</button></div>}
      {tab === 'guide' && <div className="guide-page"><div className="section-title"><span>FIELD MANUAL</span><h2>MOVE FAST. HIT FIRST.</h2></div><div className="guide-grid"><article><h3>CORE CONTROLS</h3>{[['W A S D','Move'],['MOUSE','Look'],['LEFT CLICK','Fire'],['RIGHT CLICK','Aim'],['SHIFT','Sprint'],['SPACE','Jump'],['R','Reload'],['1 — 8','Switch weapon'],['Q','Class ability'],['E','Wind grenade'],['P','Match menu']].map(([k,v]) => <div className="key-row" key={k}><span>{v}</span><kbd>{k}</kbd></div>)}</article><article><h3>COMBAT RULES</h3><p>First to 15 eliminations wins, or the highest score when the five-minute turbine cycle ends.</p><p>Shields regenerate after avoiding damage. Headshots deal 1.65× damage. Shotguns fire eight pellets; snipers reward a steady scoped shot.</p><p>Q triggers your combat-frame ability. E detonates a wind grenade at your aim point. Empty rooms contain live practice frames; human players can join the same arena at any time.</p><h3>PLAY WITH FRIENDS</h3><p>Create a private room, share its six-character code, and deploy with the same code. Quick Play joins the shared SKY-01 arena.</p></article></div><button className="back-action" onClick={() => setTab('play')}><ArrowLeft size={17} /> BACK TO DEPLOYMENT</button></div>}
      <footer className="lobby-footer"><span>CIRRUS REACH / TURBINE DISTRICT</span><span>BUILD 2.0 · MULTIPLAYER</span></footer>
    </section>}
    {(hud.phase === 'playing' || hud.phase === 'paused') && <section className="hud">
      <div className="match-top"><div><small>SKY CLASH</small><strong>{hud.room}<button onClick={copyRoom} aria-label="Copy room code">{copied ? <Check size={14} /> : <Copy size={14} />}</button></strong></div><div className="match-score"><span>YOU <b>{hud.kills}</b></span><strong>{time(hud.remaining)}</strong><span><b>{hud.leader}</b> LEADER</span></div><div className="online-count"><span className={hud.connected ? 'online' : ''} />{hud.connected ? 'LIVE' : 'OFFLINE'} · {hud.players.length} COMBATANTS</div></div>
      <div className="killfeed">{hud.feed.slice(0,4).map(f => <div key={f.id}><b>{f.killer}</b><span>{f.headshot ? 'PRECISION' : WEAPONS.find(w => w.id === f.weapon)?.name}</span><b>{f.victim}</b></div>)}</div>
      <div className="scoreboard">{sortedPlayers.slice(0,5).map((p,i) => <div key={p.id}><span>{i+1}</span><b>{p.name}</b><strong>{p.kills}</strong><small>{p.deaths}</small></div>)}</div>
      <div className={`crosshair ${hud.hit > 0 ? 'hit' : ''}`}><i /><i /><i /><i /><b /></div>
      {hud.messageTime > 0 && <div className="announcement"><strong>{hud.message.split('|')[0]}</strong><span>{hud.message.split('|')[1]}</span></div>}
      {hud.respawn > 0 && <div className="respawn"><span>REDEPLOYING</span><strong>{Math.ceil(hud.respawn)}</strong></div>}
      <div className="hud-bottom"><div className="vitals"><Shield size={24} /><div><span><b>{Math.ceil(hud.health)}</b> HP <i>+{Math.ceil(hud.shield)} SHIELD</i></span><div className="health-track"><i style={{ width: `${Math.max(0,hud.health/hud.maxHealth*100)}%` }} /><b style={{ width: `${Math.max(0,hud.shield/50*100)}%` }} /></div></div></div><div className="abilities"><div className={hud.abilityCooldown <= 0 ? 'ready' : ''}><kbd>Q</kbd><Lightning size={20} /><span>{hud.abilityCooldown > 0 ? Math.ceil(hud.abilityCooldown) : activeCrew.ability}</span></div><div className={hud.grenadeCooldown <= 0 ? 'ready' : ''}><kbd>E</kbd><span>WIND</span><b>{hud.grenadeCooldown > 0 ? Math.ceil(hud.grenadeCooldown) : 'READY'}</b></div></div><div className="ammo"><small>{engine.current?.weapon.type}</small><strong>{engine.current?.weapon.name}</strong><div><b>{hud.ammo}</b><span>/ {engine.current?.weapon.magazine}</span></div>{hud.reloading && <i style={{ width: `${hud.reloadProgress*100}%` }} />}</div></div>
      <div className="damage-flash" style={{ opacity: hud.damaged }} />
    </section>}
    {hud.phase === 'paused' && <div className="overlay"><div className="pause-card"><span>MATCH MENU · ARENA REMAINS LIVE</span><h2>HOLD YOUR POSITION.</h2><button className="deploy" onClick={() => engine.current?.resume()}><Play size={18} weight="fill" /> RESUME MATCH</button><button onClick={() => setSettingsOpen(true)}><Gear size={18} /> SETTINGS</button><button onClick={() => engine.current?.returnToMenu()}><ArrowLeft size={18} /> LEAVE ARENA</button></div></div>}
    {hud.phase === 'ended' && <div className="overlay"><div className="result-card"><span>TURBINE CYCLE COMPLETE</span><h2>{hud.kills >= hud.leader && hud.kills > 0 ? 'SKY CHAMPION.' : 'MATCH COMPLETE.'}</h2><p>{hud.kills} eliminations · {hud.deaths} deaths · {hud.shots ? Math.round(hud.hits / hud.shots * 100) : 0}% hit confirmation</p><div className="final-table">{sortedPlayers.map((p,i) => <div key={p.id}><span>#{i+1}</span><b>{p.name}</b><strong>{p.kills} / {p.deaths}</strong></div>)}</div><button className="deploy" onClick={deploy}>PLAY AGAIN</button><button onClick={() => engine.current?.returnToMenu()}>RETURN TO LOBBY</button></div></div>}
    {settingsOpen && <div className="overlay" role="dialog" aria-modal="true" aria-label="Settings"><div className="settings-card"><button className="close" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={20} /></button><span>SYSTEM / SETTINGS</span><h2>TUNE YOUR KIT.</h2><label>MASTER VOLUME <output>{Math.round(settings.volume*100)}%</output><input type="range" min="0" max="1" step=".05" value={settings.volume} onChange={e => setSettings(s => ({...s,volume:Number(e.target.value)}))} /></label><label>LOOK SENSITIVITY <output>{settings.sensitivity.toFixed(2)}×</output><input type="range" min=".25" max="2.5" step=".05" value={settings.sensitivity} onChange={e => setSettings(s => ({...s,sensitivity:Number(e.target.value)}))} /></label><label className="toggle-row">PERFORMANCE MODE<input type="checkbox" checked={settings.quality === 'low'} onChange={e => setSettings(s => ({...s,quality:e.target.checked?'low':'high'}))} /></label><label className="toggle-row">REDUCE CAMERA MOTION<input type="checkbox" checked={settings.reducedMotion} onChange={e => setSettings(s => ({...s,reducedMotion:e.target.checked}))} /></label><label className="toggle-row">INVERT VERTICAL LOOK<input type="checkbox" checked={settings.invertY} onChange={e => setSettings(s => ({...s,invertY:e.target.checked}))} /></label><button className="back-action" onClick={() => setSettingsOpen(false)}>APPLY & CLOSE</button></div></div>}
    {error && <div className="overlay error"><div><Users size={36} /><h2>CONNECTION INTERRUPTED</h2><p>{error}</p><button className="deploy" onClick={() => { setError(''); engine.current?.returnToMenu(); }}>RETURN TO LOBBY</button></div></div>}
  </main>;
}
