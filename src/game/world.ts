import { fieldTexture } from './fieldTexture';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom, terrainHeight } from './math';
import { createEngineer, createSailHelper, part } from './models';
import { MAPS, type MapSpec } from './data';
import type { EngineerClass, MapId } from './types';

export interface Collider { x: number; z: number; radius: number; height: number; base?: number; }
type Surface = { x: number; z: number; w: number; d: number; y: number };
type Ramp = { x: number; z: number; w: number; d: number; y0: number; y1: number; axis: 'x' | 'z' };

const noiseGLSL = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p) { float v=0.; float a=.5; for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(13.1,7.7);a*=.5;}return v; }
`;

function makeSky(theme: MapSpec) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uLow: { value: new THREE.Color(theme.skyLow) }, uHigh: { value: new THREE.Color(theme.skyHigh) }, uCloud: { value: new THREE.Color(theme.cloud) } },
    vertexShader: `varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `${noiseGLSL}
      uniform float uTime; uniform vec3 uLow; uniform vec3 uHigh; uniform vec3 uCloud; varying vec3 vWorld;
      void main(){
        vec3 d=normalize(vWorld-cameraPosition);float h=max(d.y,0.);
        vec3 low=uLow, high=uHigh;
        vec3 sky=mix(low,high,pow(h,.53));
        vec3 sunDir=normalize(vec3(-.45,.31,-.72));float sun=max(dot(d,sunDir),0.);
        sky+=vec3(1.,.82,.5)*pow(sun,11.)*.32;
        sky+=vec3(1.,.91,.7)*pow(sun,16000.)*2.1;
        vec2 uv=d.xz/(max(d.y,.035)+.22)*1.8;
        #ifdef LOW_DETAIL
        float n=noise(uv+vec2(uTime*.0018,0.))*.65+noise(uv*2.03)*.25;
        #else
        float n=fbm(uv+vec2(uTime*.0018,0.));
        #endif
        float cloud=smoothstep(.46,.76,n)*smoothstep(-.03,.22,d.y);
        sky=mix(sky,uCloud,cloud*.7);
        sky=mix(sky,vec3(.6,.68,.62),1.-smoothstep(-.18,.08,d.y));
        gl_FragColor=vec4(sky,1.);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(650, 32, 20), material);
  sky.frustumCulled = false; sky.renderOrder = -10;
  return { sky, material };
}

function leafTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(991);
  for (let i = 0; i < 45; i++) {
    const x = 64 + (random() - 0.5) * 90, y = 64 + (random() - 0.5) * 92;
    ctx.save(); ctx.translate(x, y); ctx.rotate(random() * 6.28);
    ctx.fillStyle = `rgb(${140 + random() * 70},${155 + random() * 70},${95 + random() * 50})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 6 + random() * 8, 3 + random() * 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function radialTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,244,195,1)'); gradient.addColorStop(0.17, 'rgba(255,226,150,.6)'); gradient.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(canvas);
}

export class World {
  readonly assetsReady: Promise<void>;
  root = new THREE.Group();
  colliders: Collider[] = [];
  private walkables: Surface[] = [];
  private ramps: Ramp[] = [];
  engineer: THREE.Group;
  sailfin: THREE.Group;
  portal: THREE.Group;
  portalMaterial: THREE.ShaderMaterial;
  skyMaterial: THREE.ShaderMaterial;
  dust: THREE.Points;
  leaves: THREE.InstancedMesh;
  grass: THREE.InstancedMesh;
  private wind = { value: 0 };
  private random = seededRandom(7312);
  private stone: THREE.MeshStandardMaterial;
  private darkStone: THREE.MeshStandardMaterial;
  private paleStone: THREE.MeshStandardMaterial;
  private moss: THREE.MeshStandardMaterial;
  private gold: THREE.MeshStandardMaterial;
  private glow: THREE.MeshBasicMaterial;
  private portalRings: THREE.Object3D[] = [];
  private theme: MapSpec;
  readonly map: MapId;

  constructor(scene: THREE.Scene, quality: 'high' | 'low', map: MapId = 'turbine') {
    this.assetsReady = Promise.resolve();
    this.map = map;
    this.theme = MAPS.find(m => m.id === map) ?? MAPS[0];
    const theme = this.theme;
    scene.add(this.root);
    scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
    const stoneTexture = fieldTexture(`${theme.name} ceramic`); stoneTexture.colorSpace = THREE.SRGBColorSpace;
    stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping; stoneTexture.repeat.set(1.3, 1.3); stoneTexture.anisotropy = 4;
    this.stone = new THREE.MeshStandardMaterial({ color: theme.stone, map: stoneTexture, roughness: 0.97 });
    this.darkStone = new THREE.MeshStandardMaterial({ color: theme.darkStone, map: stoneTexture, roughness: 0.91 });
    this.paleStone = new THREE.MeshStandardMaterial({ color: theme.paleStone, map: stoneTexture, roughness: 0.84 });
    this.moss = new THREE.MeshStandardMaterial({ color: theme.moss, map: stoneTexture, roughness: 1 });
    this.gold = new THREE.MeshStandardMaterial({ color: theme.gold, metalness: 0.72, roughness: 0.39, map: stoneTexture });
    this.glow = new THREE.MeshBasicMaterial({ color: theme.glow });
    const { sky, material } = makeSky(theme); this.skyMaterial = material; this.root.add(sky);
    const hemi = new THREE.HemisphereLight(theme.skyLow, theme.darkStone, 2.2); this.root.add(hemi);
    const sun = new THREE.DirectionalLight(theme.cloud, 4.3);
    sun.position.set(-45, 64, -35); sun.castShadow = true;
    sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 180 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.055;
    sun.target.position.set(0, 0, -10); this.root.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(theme.glow, 0.7); rim.position.set(30, 14, 40); this.root.add(rim);
    this.addPlanet();
    this.addTerrain(stoneTexture);
    this.addMountains();
    this.addArchitecture();
    const portal = this.addPortal(); this.portal = portal.group; this.portalMaterial = portal.material;
    this.addRocks();
    this.leaves = this.addTrees(quality);
    this.grass = this.addGrass(quality);
    this.addFlowers();
    this.engineer = createEngineer('rigger'); this.engineer.position.set(12, terrainHeight(12, 25), 25); this.engineer.scale.setScalar(1.75); this.engineer.rotation.y = 0.65; this.root.add(this.engineer);
    this.sailfin = createSailHelper(); this.sailfin.position.set(13.8, 3.6, 23.9); this.sailfin.scale.setScalar(0.72); this.root.add(this.sailfin);
    this.dust = this.addDust();
    this.addContactShadows();
    this.batchStaticGeometry();
  }

  private batchStaticGeometry() {
    this.root.updateMatrixWorld(true);
    const batches = new Map<string, { material: THREE.Material; objects: THREE.Mesh[] }>();
    this.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material) || object.material instanceof THREE.ShaderMaterial) return;
      for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p === this.portal || p === this.engineer || p === this.sailfin) return;
      const key = object.material.uuid + ':' + Object.keys(object.geometry.attributes).sort().join(',');
      const batch = batches.get(key) ?? { material: object.material, objects: [] as THREE.Mesh[] }; batch.objects.push(object); batches.set(key, batch);
    });
    for (const { material, objects } of batches.values()) {
      if (objects.length < 3) continue;
      const geometries = objects.map(object => {
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld); return geometry;
      });
      const merged = mergeGeometries(geometries, false);
      geometries.forEach(g => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true;
      const originals = new Set(objects.map(o => o.geometry));
      objects.forEach(o => o.removeFromParent()); originals.forEach(g => g.dispose());
      this.root.add(mesh);
    }
  }

  private addContactShadows() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(12,24,16,.72)'); gradient.addColorStop(.3, 'rgba(12,24,16,.55)'); gradient.addColorStop(1, 'rgba(12,24,16,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const map = new THREE.CanvasTexture(canvas), geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const collider of this.colliders) {
      const shadow = new THREE.Mesh(geometry, material); shadow.rotation.x = -Math.PI / 2; shadow.position.set(collider.x, (collider.base ?? terrainHeight(collider.x, collider.z)) + .16, collider.z);
      shadow.scale.set(collider.radius * 4.2, collider.radius * 3.7, 1); this.root.add(shadow);
    }
  }

  private addPlanet() {
    const texture = fieldTexture('weather balloon'); texture.colorSpace = THREE.SRGBColorSpace;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(30, 40, 24), new THREE.MeshStandardMaterial({ map: texture, color: this.theme.paleStone, roughness: 1 }));
    planet.scale.set(1.7,.55,.65); planet.position.set(59, 80, -204); planet.rotation.set(0.15, -0.3, -0.2); this.root.add(planet);
    for(const dx of [-28,28]){
      const tether=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,24,8),this.darkStone);tether.position.set(59+dx,55,-204);this.root.add(tether);
    }
    part(this.root,this.gold,[58,4,10],[59,42,-204]);
    for(let i=0;i<6;i++)part(this.root,this.paleStone,[2,11,5],[39+i*8,34,-204]);
  }

  private addTerrain(_texture: THREE.Texture) {
    const geometry = new THREE.PlaneGeometry(360, 320, 160, 144); geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position, colors: number[] = [];
    const base = new THREE.Color(this.theme.terrainBase), light = new THREE.Color(this.theme.terrainLight), path = new THREE.Color(this.theme.terrainPath);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i) - 70;
      positions.setZ(i, z); positions.setY(i, terrainHeight(x, z));
      const blend = (Math.sin(x * 0.51) * Math.sin(z * 0.32) + 1) * 0.5;
      const color = base.clone().lerp(light, blend * 0.63);
      const pathX = Math.sin(z * 0.06) * 4;
      if (Math.abs(x - pathX) < 4.5 && z > -58) color.lerp(path, 0.55);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    const groundMap = fieldTexture('storm pavers'); groundMap.colorSpace = THREE.SRGBColorSpace; groundMap.wrapS = groundMap.wrapT = THREE.RepeatWrapping; groundMap.repeat.set(78, 66); groundMap.anisotropy = 4;
    const material = new THREE.MeshStandardMaterial({ map: groundMap, vertexColors: true, roughness: 1, color: this.theme.terrainTint });
    const terrain = new THREE.Mesh(geometry, material); terrain.receiveShadow = true; this.root.add(terrain);
    // Thin stone pavers trace a navigable route through the grass.
    for (let i = 0; i < 28; i++) {
      const z = 32 - i * 3, x = Math.sin(z * 0.06) * 3.2;
      const paver = part(this.root, i % 3 ? this.paleStone : this.stone, [3.2 + this.random() * 1.2, 0.14, 1.7 + this.random()], [x, terrainHeight(x, z) + 0.06, z], [0, (this.random() - 0.5) * 0.22, 0]);
      paver.castShadow = false;
      if (i % 4 === 0) part(this.root, this.gold, [0.06, 0.03, 1.5], [x + 1.1, terrainHeight(x, z) + 0.15, z]);
    }
  }

  private addMountains() {
    for (let row = 0; row < 3; row++) {
      const geometry = new THREE.PlaneGeometry(850, 180, 150, 24); geometry.rotateX(-Math.PI / 2);
      const p = geometry.attributes.position, colors: number[] = [];
      const col = new THREE.Color(this.theme.mountains[row]);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), depth = (p.getZ(i) + 90) / 180;
        const jagged = Math.abs(Math.sin(x * 0.023 + row * 8)) * 37 + Math.abs(Math.sin(x * 0.065)) * 14 + Math.abs(Math.sin(x * 0.31)) * 3;
        const height = Math.sin(depth * Math.PI) * (21 + jagged + row * 14) + Math.sin(x * 0.11 + depth * 8) * 3;
        p.setY(i, height - 10); p.setZ(i, p.getZ(i) - 185 - row * 105);
        const c = col.clone().multiplyScalar(0.7 + (1 - depth) * 0.35 + this.random() * 0.04); colors.push(c.r, c.g, c.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
      this.root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));
    }
  }

  private tower(x: number, z: number, height: number, width: number, broken = false) {
    const group = new THREE.Group(); group.position.set(x, terrainHeight(x, z), z); this.root.add(group);
    part(group, this.darkStone, [width * 1.65, 1.5, width * 1.55], [0, 0.6, 0]);
    part(group, this.stone, [width * 1.25, 1.1, width * 1.3], [0, 1.8, 0]);
    part(group, this.stone, [width, height, width], [0, height / 2 + 2, 0]);
    part(group, this.paleStone, [width * 0.74, height * 0.96, width * 1.025], [0, height / 2 + 2, 0]);
    part(group, this.darkStone, [width * 0.16, height * 0.7, width * 1.04], [0, height * 0.54 + 2, 0]);
    part(group, this.gold, [width * 0.1, height * 0.67, width * 1.05], [0, height * 0.54 + 2, 0]);
    for (let i = 0; i < 5; i++) part(group, this.darkStone, [width * 1.035, 0.11, width * 1.035], [0, 3 + i * height * 0.18, 0]);
    part(group, this.darkStone, [width * 1.3, 0.65, width * 1.3], [0, height + 2.1, 0], broken ? [0.12, 0.08, -0.1] : undefined);
    part(group, this.paleStone, [width * 1.45, 0.3, width * 1.45], [0, height + 2.55, 0]);
    if (!broken) part(group, this.gold, [width * 0.66, 0.18, width * 0.66], [0, height + 2.8, 0]);
    // A sloped growth line breaks the pristine edges of the ruins.
    for (let i = 0; i < 5; i++) {
      const patch = new THREE.Mesh(new THREE.IcosahedronGeometry(width * (0.18 + this.random() * 0.12), 1), this.moss);
      patch.position.set((this.random() - 0.5) * width, 2.4 + this.random() * height, width * 0.48); patch.scale.y = 1.9; group.add(patch);
    }
    if (Math.abs(x) < 42 && z > -55) this.colliders.push({ x, z, radius: width * 0.8, height: height + 2 });
    return group;
  }

  private addArchitecture() {
    const map = this.map;
    if (map === 'citadel') { this.addCitadel(); return; }
    const towers: [number, number, number, number, boolean?][] = map === 'ember' ? [
      [-20, -34, 30, 5.2], [22, -44, 38, 5.6], [-36, -6, 22, 5, true], [35, 4, 20, 4.8, true],
      [-16, -12, 8, 3, true], [18, -10, 6, 3, true], [-48, -92, 45, 6.5], [45, -98, 40, 6.8],
      [78, -76, 34, 6], [-84, -108, 30, 6, true],
    ] : map === 'verdant' ? [
      [-24, -38, 24, 4.6], [26, -42, 30, 4.9], [-30, -2, 18, 4.4, true], [33, 8, 22, 4.6, true],
      [-16, -10, 7, 2.8, true], [18, -8, 5.5, 2.7, true], [-44, -96, 38, 6], [46, -102, 44, 6.4],
      [82, -80, 32, 5.6], [-88, -112, 27, 5.8, true],
    ] : [
      [-22, -36, 26, 4.8], [24, -43, 34, 5.3], [-34, -4, 19, 4.7, true], [37, 5, 24, 5, true],
      [-17, -11, 7.4, 2.9, true], [19, -8, 5.5, 2.8, true], [-45, -95, 42, 6], [43, -100, 48, 7.5],
      [80, -78, 36, 6], [-86, -110, 29, 6, true],
    ];
    for (const [x, z, height, width, broken] of towers) this.tower(x, z, height, width, broken);
    part(this.root, this.darkStone, [49, 3.1, 5.8], [0, 28.4, -42]);
    part(this.root, this.paleStone, [50, 0.75, 6.2], [0, 30.3, -42]);
    for (let i = 0; i < 11; i++) part(this.root, this.gold, [0.1, 1.8, 6], [-21 + i * 4.2, 28.6, -42]);
    const bridgeX = map === 'verdant' ? -28 : -32;
    const brokenBridge = part(this.root, this.stone, [19, 2, 4.7], [bridgeX, 15, -5], [0, 0.15, -0.14]);
    brokenBridge.castShadow = true;
    // Arena cover is deliberately low enough to read and navigate while sprinting.
    const cover: [number, number][] = map === 'ember'
      ? [[-10, 15], [11, 7], [-24, -24], [26, -22], [7, -25], [-8, -3], [30, 20], [-19, 9], [19, 18], [-29, -7], [29, -6], [0, -18]]
      : map === 'verdant'
        ? [[-10, 15], [12, 7], [-24, -24], [26, -22], [7, -25], [-8, -3], [30, 20], [-20, -6], [22, -12]]
        : [[-10, 15], [12, 7], [-24, -24], [26, -22], [7, -25], [-8, -3], [30, 20]];
    cover.forEach(([x, z], i) => {
      const h = i % 3 === 0 ? 2.1 : 1.6;
      part(this.root, this.darkStone, [4, h, 2.5], [x, terrainHeight(x, z) + h / 2, z], [0, i * 0.23, 0]);
      part(this.root, this.stone, [4.2, 0.22, 2.7], [x, terrainHeight(x, z) + h, z], [0, i * 0.23, 0]);
      this.colliders.push({ x, z, radius: 2.4, height: h });
    });
    // Repeating rails and small emissive inlays give the old structure a technological language.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const z = -31 + i * 5;
        part(this.root, this.gold, [0.35, 1.1, 0.35], [side * 6.3, terrainHeight(side * 6.3, z) + 0.5, z]);
        part(this.root, this.glow, [0.18, 0.2, 0.18], [side * 6.3, terrainHeight(side * 6.3, z) + 1.06, z]);
      }
    }
    if (map === 'ember') {
      const forge = new THREE.Mesh(new THREE.TorusGeometry(13, 1.1, 6, 32), this.gold);
      forge.rotation.x = Math.PI / 2; forge.position.set(0, 9, -22); this.root.add(forge);
      for (let i = 0; i < 4; i++) {
        const x = i % 2 ? 29 : -29, z = -54 + Math.floor(i / 2) * 18;
        part(this.root, this.darkStone, [5, 13, 5], [x, terrainHeight(x, z) + 6.5, z]);
        part(this.root, this.glow, [5.2, 0.45, 5.2], [x, terrainHeight(x, z) + 10, z]);
        part(this.root, this.darkStone, [3, 1.4, 3], [x, terrainHeight(x, z) + 13.4, z]);
        this.colliders.push({ x, z, radius: 3, height: 13 });
      }
      const fire = new THREE.PointLight('#ff9a6a', 34, 58, 2); fire.position.set(0, 12, -22); this.root.add(fire);
    }
    if (map === 'verdant') {
      const canopy = new THREE.Mesh(new THREE.TorusGeometry(19, 0.85, 6, 40), this.moss);
      canopy.rotation.x = Math.PI / 2; canopy.position.set(0, 17, -20); canopy.castShadow = true; this.root.add(canopy);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, x = Math.cos(a) * 19, z = -20 + Math.sin(a) * 19;
        part(this.root, this.darkStone, [1.3, 14, 1.3], [x, terrainHeight(x, z) + 7, z], [0, a, 0.08]);
        part(this.root, this.moss, [1.6, 1.1, 1.6], [x, terrainHeight(x, z) + 14, z], [0, a, 0]);
        this.colliders.push({ x, z, radius: 1.5, height: 14 });
      }
      const glow = new THREE.PointLight('#9df5b8', 22, 48, 2); glow.position.set(0, 14, -20); this.root.add(glow);
    }
  }

  private floorDeck(x: number, z: number, w: number, d: number, y: number, material: THREE.Material = this.darkStone) {
    part(this.root, material, [w, .7, d], [x, y - .35, z]);
    part(this.root, this.paleStone, [w + .3, .14, d + .3], [x, y + .07, z]);
    const top = y + .14;
    this.walkables.push({ x, z, w, d, y: top });
    for (const px of [x - w / 2 + 1.1, x, x + w / 2 - 1.1]) {
      for (const pz of [z - d / 2 + 1.1, z + d / 2 - 1.1]) {
        const base = terrainHeight(px, pz), height = top - base;
        if (height < .9) continue;
        part(this.root, this.stone, [.52, height, .52], [px, base + height / 2, pz]);
        part(this.root, this.gold, [.74, .2, .74], [px, base + height - .1, pz]);
      }
    }
    return top;
  }

  private floorRamp(x: number, z: number, w: number, d: number, y0: number, y1: number, axis: 'x' | 'z') {
    const rise = y1 - y0, length = Math.hypot(d, rise);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? length : w, .55, axis === 'x' ? w : length), this.darkStone);
    mesh.position.set(x, (y0 + y1) / 2 - .275, z);
    if (axis === 'x') mesh.rotation.z = Math.atan2(rise, d); else mesh.rotation.x = -Math.atan2(rise, d);
    mesh.castShadow = true; mesh.receiveShadow = true; this.root.add(mesh);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? length : .14, .16, axis === 'x' ? .14 : length), this.gold);
      rail.position.set(x + (axis === 'z' ? side * w / 2 : 0), (y0 + y1) / 2 + .45, z + (axis === 'x' ? side * w / 2 : 0));
      rail.rotation.set(axis === 'z' ? -Math.atan2(rise, d) : 0, 0, axis === 'x' ? Math.atan2(rise, d) : 0); this.root.add(rail);
    }
    this.ramps.push({ x, z, w, d, y0, y1, axis });
  }

  private addCitadel() {
    const ground = terrainHeight;
    const west = this.floorDeck(-31, -14, 9, 44, 7.2);
    const east = this.floorDeck(31, -14, 9, 44, 7.2);
    const north = this.floorDeck(0, -38, 34, 8, 8.4);
    const south = this.floorDeck(0, 17, 30, 8, 6.2);
    this.floorDeck(0, -12, 52, 6, 13.5, this.paleStone);
    // Four ground-to-rampart ramps plus the two long skybridge approaches.
    this.floorRamp(0, -46, 7, 8, ground(0, -50), north, 'z');
    this.floorRamp(-22.5, -14, 8, 8, west, ground(-18.5, -14), 'x');
    this.floorRamp(22.5, -14, 8, 8, ground(18.5, -14), east, 'x');
    this.floorRamp(0, 8.5, 7, 9, ground(0, 4), south, 'z');
    this.floorRamp(0, -24.5, 7, 19, north, 13.5, 'z');
    this.floorRamp(0, 2, 7, 22, 13.5, south, 'z');
    // Low rampart walls make each tier readable without closing off the drop lanes.
    const walls: [number, number, number, number, number, number][] = [
      [west, 2, 4.2, 2.1, 1.15, -31], [west, -25, 4.2, 2.1, 1.15, -31],
      [east, 2, 4.2, 2.1, 1.15, 31], [east, -25, 4.2, 2.1, 1.15, 31],
      [north, -9, 4.2, 2.1, 1.2, 0], [north, 9, 4.2, 2.1, 1.2, 0],
      [south, -8, 4.2, 2.1, 1.2, 0], [south, 8, 4.2, 2.1, 1.2, 0],
    ];
    for (const [base, z, w, d, h, x] of walls) {
      part(this.root, this.darkStone, [w, h, d], [x, base + h / 2, z]);
      part(this.root, this.gold, [w + .12, .14, d + .12], [x, base + h, z]);
      this.colliders.push({ x, z, radius: Math.max(w, d) / 2 + .25, height: h, base });
    }
    // Spires, banners, and braziers frame the skybridge.
    for (const side of [-1, 1]) {
      for (const z of [-30, 2]) {
        const x = side * 33.5, base = terrainHeight(x, z), top = 19 + Math.abs(z) * .12;
        part(this.root, this.stone, [1.25, top, 1.25], [x, base + top / 2, z]);
        part(this.root, this.gold, [1.75, .32, 1.75], [x, base + top, z]);
        part(this.root, this.glow, [.34, .42, .34], [x, base + top + .3, z]);
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 8.2), new THREE.MeshStandardMaterial({ color: this.theme.gold, emissive: this.theme.glow, emissiveIntensity: .18, side: THREE.DoubleSide, roughness: .9 }));
        banner.position.set(x - side * 1.25, base + top * .62, z); banner.rotation.y = side * Math.PI / 2; this.root.add(banner);
      }
    }
    for (const x of [-21, 0, 21]) {
      part(this.root, this.stone, [.72, 13.1, .72], [x, terrainHeight(x, -12) + 6.55, -12]);
      this.colliders.push({ x, z: -12, radius: .85, height: 12.6 });
    }
    for (const side of [-1, 1]) {
      const x = side * 24.2;
      part(this.root, this.darkStone, [1.1, 1.9, 1.1], [x, 15.35, -12]);
      part(this.root, this.glow, [.55, .55, .55], [x, 16.2, -12]);
      const light = new THREE.PointLight(this.theme.glow, 16, 26, 2); light.position.set(x, 16.4, -12); this.root.add(light);
    }
    for (let i = 0; i < 7; i++) {
      const x = -18 + i * 6;
      part(this.root, this.gold, [2.6, .08, .1], [x, 14.32, -9.1]);
      part(this.root, this.gold, [2.6, .08, .1], [x, 14.32, -14.9]);
    }
  }

  floorAt(x: number, z: number, feetY = Infinity) {
    let height = terrainHeight(x, z);
    const reach = feetY + .85;
    for (const s of this.walkables) if (s.y <= reach && s.y > height && Math.abs(x - s.x) <= s.w / 2 && Math.abs(z - s.z) <= s.d / 2) height = s.y;
    for (const r of this.ramps) {
      const along = r.axis === 'x' ? x : z, cross = r.axis === 'x' ? z : x;
      const min = (r.axis === 'x' ? r.x : r.z) - r.d / 2;
      if (along < min || along > min + r.d || Math.abs(cross - (r.axis === 'x' ? r.z : r.x)) > r.w / 2) continue;
      const h = r.y0 + (r.y1 - r.y0) * (along - min) / r.d;
      if (h <= reach && h > height) height = h;
    }
    return height;
  }

  private addPortal() {
    const group = new THREE.Group(); group.position.set(0, this.map === 'citadel' ? 18 : 9.5, this.map === 'citadel' ? -47 : -43); this.root.add(group);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.5, 1.05, 5, 64), this.gold); group.add(ring);
    const darkRing = new THREE.Mesh(new THREE.TorusGeometry(9.7, 0.4, 4, 48), this.darkStone); group.add(darkRing);
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const block = part(group, i % 2 === 0 ? this.paleStone : this.stone, [2.8, 1.2, 2.4], [Math.sin(angle) * 9.6, Math.cos(angle) * 9.6, 0], [0, 0, -angle]);
      part(block, this.gold, [2.9, 0.15, 2.45], [0, 0, 0]);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.57, 0.05), this.glow);
      light.position.set(Math.sin(angle) * 8.8, Math.cos(angle) * 8.8, 1.25); light.rotation.z = -angle; group.add(light);
    }
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uActive: { value: 0.58 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `${noiseGLSL} uniform float uTime;uniform float uActive;varying vec2 vUv;
        void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=atan(p.y,p.x);
        float n=fbm(vec2(a*2.+uTime*.09,r*7.-uTime*.3));
        float rim=pow(smoothstep(.5,1.,r),2.);float swirl=sin(r*40.-uTime*1.6+n*5.)*.5+.5;
        vec3 col=mix(vec3(.32,.38,.26),vec3(1.9,1.3,.5),rim*.88+swirl*.11);
        float alpha=(.16+rim*.67+n*.17)*uActive;
        gl_FragColor=vec4(col,alpha*(1.-smoothstep(.97,1.,r))); }`,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(7.7, 100), material); disc.position.z = 0.3; group.add(disc);
    for (let i = 0; i < 2; i++) {
      const inner = new THREE.Mesh(new THREE.TorusGeometry(7.5 - i * 0.2, 0.035, 4, 120, Math.PI * 1.8), new THREE.MeshBasicMaterial({ color: '#91a0c6', transparent: true, opacity: 0.8 }));
      inner.position.z = 0.7 + i * 0.05; group.add(inner); this.portalRings.push(inner);
    }
    if (this.map !== 'citadel') for (let i = 0; i < 6; i++) part(this.root, this.stone, [15 + i * 1.7, 0.5, 1.5], [0, 0.55 + (5 - i) * 0.4, -40 + i * 1.35]);
    const portalLight = new THREE.PointLight(this.theme.glow, 35, 32, 2); portalLight.position.set(0, 8, -38); this.root.add(portalLight);
    return { group, material };
  }

  private addRocks() {
    const random = this.random;
    const geometry = new THREE.DodecahedronGeometry(1, 1);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const offset = 1 + Math.sin(x * 5.9 + y * 6.2 + z * 3.7) * 0.11;
      p.setXYZ(i, x * offset, y * offset, z * offset);
    }
    geometry.computeVertexNormals();
    const stones = new THREE.InstancedMesh(geometry, this.stone, 235);
    const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), color = new THREE.Color();
    for (let i = 0; i < 235; i++) {
      let x = (random() - 0.5) * 240, z = random() * 180 - 135;
      if (Math.abs(x) < 7 && z > -50) x += 13;
      const scale = i < 45 ? 3 + random() * 6 : 0.2 + random() * 1.2;
      if (i < 45 && Math.abs(x) < 40 && z > -60) x += Math.sign(x || 1) * 37;
      quat.setFromEuler(new THREE.Euler(random() * 0.4, random() * 6, random() * 0.4));
      matrix.compose(new THREE.Vector3(x, terrainHeight(x, z) + scale * 0.15, z), quat, new THREE.Vector3(scale * 1.5, scale * (0.6 + random() * 0.7), scale));
      stones.setMatrixAt(i, matrix); stones.setColorAt(i, color.setHSL(this.theme.rockHue + random() * 0.04, 0.1 + random() * 0.14, 0.54 + random() * 0.2));
    }
    stones.castShadow = true; stones.receiveShadow = true; this.root.add(stones);
  }

  private addTrees(quality: 'high' | 'low') {
    const count = Math.round((quality === 'high' ? 2400 : 1250) * this.theme.treeDensity);
    const leafMaterial = new THREE.MeshStandardMaterial({ map: leafTexture(), color: this.theme.leaf, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1 });
    const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.5, 4.5), leafMaterial, count);
    const random = this.random, dummy = new THREE.Object3D(), color = new THREE.Color();
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: this.theme.darkStone, roughness: 1, map: this.stone.map });
    const trees: { x: number; z: number; height: number; spread: number }[] = [];
    for (let i = 0; i < 43; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (37 + random() * 74), z = random() * 155 - 110;
      const height = 12 + random() * 15, base = terrainHeight(x, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.3, height, 8, 4), trunkMaterial);
      trunk.position.set(x, base + height / 2, z); trunk.rotation.z = side * (random() - 0.4) * 0.2; trunk.castShadow = true; this.root.add(trunk);
      trees.push({ x: x - side * 1.2, z, height: height + base, spread: 5 + random() * 4 });
      for (let j = 0; j < 4; j++) {
        const a = j * Math.PI / 2 + random(), length = 4 + random() * 5;
        const start = new THREE.Vector3(x, base + height * 0.65, z), end = new THREE.Vector3(x + Math.cos(a) * length, base + height, z + Math.sin(a) * length);
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.38, start.distanceTo(end), 6), trunkMaterial);
        branch.position.copy(start).add(end).multiplyScalar(0.5); branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); this.root.add(branch);
      }
    }
    for (let i = 0; i < count; i++) {
      const t = trees[i % trees.length], angle = random() * Math.PI * 2, radius = random() ** 0.5 * t.spread;
      dummy.position.set(t.x + Math.cos(angle) * radius, t.height + random() * 4 - radius * 0.15, t.z + Math.sin(angle) * radius);
      dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      const scale = 0.65 + random() * 0.7; dummy.scale.setScalar(scale); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
      leaves.setColorAt(i, color.setHSL(this.theme.leafHue + random() * 0.04, 0.25 + random() * 0.15, 0.48 + random() * 0.22));
    }
    leaves.castShadow = true; leaves.receiveShadow = true; this.root.add(leaves); return leaves;
  }

  private addGrass(quality: 'high' | 'low') {
    const count = quality === 'high' ? 24000 : 10000;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.05,0,0,.05,0,0,-.035,.35,.015,.035,.35,.015,-.02,.65,.06,.02,.65,.06,0,1,.15], 3));
    geometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]); geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: this.theme.grass, roughness: 1, side: THREE.DoubleSide });
    material.onBeforeCompile = shader => {
      shader.uniforms.uWind = this.wind;
      shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uWind*1.3+instanceMatrix[3].x*.19+instanceMatrix[3].z*.13)*pow(position.y,2.)*.22;');
    };
    const grass = new THREE.InstancedMesh(geometry, material, count), dummy = new THREE.Object3D(), color = new THREE.Color(), random = this.random;
    let index = 0;
    while (index < count) {
      const x = (random() - 0.5) * 136, z = random() * 160 - 95;
      const pathX = Math.sin(z * 0.06) * 3.2;
      if (Math.abs(x - pathX) < 3.5 && z > -45 && random() < 0.97) continue;
      if (this.colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.radius + 0.15)) continue;
      dummy.position.set(x, terrainHeight(x, z), z); dummy.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.15);
      const h = 0.23 + random() ** 2 * 1.1;
      dummy.scale.set(0.7 + random() * 1.2, h, 1); dummy.updateMatrix(); grass.setMatrixAt(index, dummy.matrix);
      grass.setColorAt(index, color.setHSL(0.17 + random() * 0.08, 0.26 + random() * 0.16, 0.4 + random() * 0.3)); index++;
    }
    grass.receiveShadow = true; this.root.add(grass); return grass;
  }

  private addFlowers() {
    const count = 850, geometry = new THREE.IcosahedronGeometry(0.08, 0);
    const flowers = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: this.theme.flowerA, emissive: this.theme.flowerB, emissiveIntensity: 0.14, roughness: 0.8 }), count);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const x = (this.random() - 0.5) * 91, z = this.random() * 100 - 56;
      dummy.position.set(x, terrainHeight(x, z) + 0.35 + this.random() * 0.33, z); dummy.scale.set(1, 0.5, 1); dummy.rotation.set(this.random(), this.random(), 0); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix);
      flowers.setColorAt(i, color.set(i % 4 ? this.theme.flowerA : this.theme.flowerB));
    }
    this.root.add(flowers);
  }

  private addDust() {
    const positions: number[] = [], random = this.random;
    for (let i = 0; i < 260; i++) positions.push((random() - 0.5) * 120, 0.5 + random() * 23, (random() - 0.5) * 120);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const tint = this.map === 'ember' ? '#ffb27a' : this.map === 'verdant' ? '#b6ffd0' : this.map === 'citadel' ? '#ffd9a0' : '#c3cadc';
    const dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: tint, size: this.map === 'ember' ? 0.21 : this.map === 'citadel' ? 0.24 : 0.27, map: radialTexture(), transparent: true, opacity: this.map === 'verdant' ? 0.62 : 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(dust); return dust;
  }

  setEngineer(engineerClass: EngineerClass) {
    const old = this.engineer; this.root.remove(old);
    this.engineer = createEngineer(engineerClass); this.engineer.position.copy(old.position); this.engineer.rotation.copy(old.rotation); this.engineer.scale.copy(old.scale); this.engineer.visible = old.visible; this.root.add(this.engineer);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    old.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  }

  update(time: number, reducedMotion: boolean) {
    const t = reducedMotion ? 0 : time;
    this.wind.value = t; this.skyMaterial.uniforms.uTime.value = t; this.portalMaterial.uniforms.uTime.value = t;
    this.portalRings.forEach((r, i) => { r.rotation.z = t * (i ? -0.06 : 0.035); });
    this.sailfin.position.y = 3.6 + Math.sin(t * 1.4) * 0.17; this.sailfin.rotation.y = t * 0.2;
    this.dust.rotation.y = t * 0.005;
    if (this.map === 'ember') this.dust.position.y = Math.sin(t * 0.35) * 1.8;
    else if (this.map === 'verdant') this.dust.position.x = Math.sin(t * 0.2) * 2;
    else if (this.map === 'citadel') this.dust.position.y = Math.sin(t * 0.45) * 1.2;
    this.engineer.rotation.z = Math.sin(t * 0.6) * 0.008;
  }
}
