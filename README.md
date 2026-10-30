# Nimbus Rivals

A real-time multiplayer first-person arena game set in the floating ruins of Cirrus Reach. Built from the Nimbus Salvagers visual template with an original weapon roster, combat-frame abilities, and server-resolved hits.

## Objective

Sky Clash is free-for-all: the first combatant to 15 eliminations wins, or the highest scorer wins when the five-minute match ends. Quick Play joins the shared `SKY-01` room. Private rooms use shareable six-character codes and support up to eight human players; practice combat frames fill otherwise empty rooms.

## Controls

- **W A S D** — move
- **Mouse** — look
- **Left click** — fire
- **Right click** — aim down sights
- **Shift** — sprint
- **Space** — jump
- **R** — reload
- **1–8** — switch weapons
- **Q** — combat-frame ability
- **E** — wind grenade
- **P** — match menu

## Weapons

Coil Nine assault rifle, Vanta SMG, Trident burst rifle, Rainbell hand cannon, Longdraft marksman rifle, Gale-8 shotgun, Horizon bolt sniper, and Storm Drum LMG. Each has its own damage, cadence, magazine, reload, spread, range, and model attachments.

## Run

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. The Vite development server and production Hono server both attach the WebSocket arena at `/ws`.

## Production

```sh
npm run check
npm run build
npm start
```

The production server serves `dist/public` and bundles to `dist/boot.js`.

## Implementation

React + TypeScript, Three.js, Hono, and WebSockets. The server owns rooms, health, shields, eliminations, respawns, match timing, and hit detection. Clients send movement snapshots and fire directions; remote transforms are interpolated. The world reuses the selected template's procedural terrain, turbine ruins, cloud shaders, character geometry, and audio foundation. Third-party notices and font licenses are included in `public/licenses` and `public/fonts`.
