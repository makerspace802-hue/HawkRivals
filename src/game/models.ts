import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EngineerClass, WeaponId } from './types';

const armor = (color: THREE.ColorRepresentation, metalness = 0.55, roughness = 0.44) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
const glow = (color: THREE.ColorRepresentation, intensity = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.2 });

function mergeModel(group: THREE.Group, excluded: THREE.Object3D[] = []) {
  group.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  group.traverse(o => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (excluded.includes(p)) return;
    const meshes = batches.get(o.material) ?? []; meshes.push(o); batches.set(o.material, meshes);
  });
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(m => {
      const geometry = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); geometry.applyMatrix4(m.matrixWorld); return geometry;
    });
    const merged = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
    if (!merged) continue;
    const originals = new Set(meshes.map(m => m.geometry));
    meshes.forEach(m => m.removeFromParent()); originals.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
}

export function part(parent: THREE.Object3D, material: THREE.Material, size: [number, number, number], position: [number, number, number], rotation?: [number, number, number], round = 0) {
  const geometry = round > 0 ? new RoundedBoxGeometry(...size, 2, round) : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function limb(parent: THREE.Object3D, material: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
  const delta = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.87, radius, delta.length(), 8), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true; parent.add(mesh); return mesh;
}

export function createEngineer(engineerClass: EngineerClass = 'rigger') {
  const group = new THREE.Group();
  const palette = engineerClass === 'aerostat'
    ? { suit: '#2b4a52', plate: '#7fb6bf', trim: '#5fd6cf', glow: '#8adeef' }
    : engineerClass === 'mistwright'
    ? { suit: '#383050', plate: '#8a7bb5', trim: '#b795e6', glow: '#c8adf0' }
    : { suit: '#2f4560', plate: '#5079a8', trim: '#e0896f', glow: '#ffad78' };
  const under = armor(palette.suit, 0.4, 0.6);
  const black = armor('#141d20', 0.18, 0.82);
  const bone = armor('#e1e7ee', 0.6, 0.4);
  const trim = armor(palette.trim, 0.68, 0.34);
  const plate = armor(palette.plate, 0.72, 0.32);
  const accent = glow(palette.glow, 1.7);
  const thick = engineerClass === 'aerostat' ? 1.16 : 1;

  part(group, under, [0.5, 0.26, 0.34], [0, 1.07, 0], undefined, 0.05);
  part(group, trim, [0.56, 0.1, 0.38], [0, 1.16, 0], undefined, 0.015);
  part(group, accent, [0.11, 0.07, 0.02], [0, 1.16, 0.2], undefined, 0.012);
  for (const side of [-1, 1]) part(group, black, [0.13, 0.14, 0.17], [side * 0.24, 1.04, 0.16], undefined, 0.03);

  part(group, under, [0.72 * thick, 0.5, 0.36], [0, 1.49, 0], [0.03, 0, 0], 0.1);
  part(group, plate, [0.62 * thick, 0.42, 0.16], [0, 1.54, 0.2], [0.05, 0, 0], 0.06);
  part(group, bone, [0.4 * thick, 0.26, 0.08], [0, 1.62, 0.28], [0.07, 0, 0], 0.035);
  part(group, accent, [0.13, 0.05, 0.02], [0, 1.57, 0.328]);
  part(group, trim, [0.21, 0.04, 0.03], [0, 1.41, 0.316]);
  part(group, black, [0.44, 0.13, 0.31], [0, 1.77, 0], undefined, 0.04);
  part(group, trim, [0.5, 0.06, 0.33], [0, 1.82, 0], undefined, 0.02);

  for (const side of [-1, 1]) {
    const shoulderX = side * 0.44 * thick;
    part(group, plate, [0.34 * thick, 0.2, 0.4], [shoulderX, 1.85, 0], [0, 0, side * 0.18], 0.07);
    part(group, trim, [0.37 * thick, 0.05, 0.42], [shoulderX, 1.93, 0], [0, 0, side * 0.18], 0.02);
    if (side === 1) {
      limb(group, black, new THREE.Vector3(shoulderX, 1.82, 0), new THREE.Vector3(side * 0.57, 1.5, 0.22), 0.13);
      limb(group, under, new THREE.Vector3(side * 0.57, 1.5, 0.22), new THREE.Vector3(side * 0.48, 1.14, 0.5), 0.105);
      part(group, bone, [0.23, 0.27, 0.31], [side * 0.53, 1.34, 0.36], [0.42, 0, side * 0.05], 0.05);
      part(group, black, [0.2, 0.18, 0.2], [side * 0.46, 1.12, 0.54], undefined, 0.04);
    } else {
      limb(group, black, new THREE.Vector3(shoulderX, 1.82, 0), new THREE.Vector3(side * 0.55, 1.45, 0.06), 0.135);
      limb(group, under, new THREE.Vector3(side * 0.55, 1.45, 0.06), new THREE.Vector3(side * 0.47, 1.12, 0.18), 0.11);
      part(group, bone, [0.25, 0.23, 0.25], [side * 0.5, 1.32, 0.12], undefined, 0.05);
      part(group, black, [0.2, 0.2, 0.22], [side * 0.46, 1.08, 0.2], [0.08, 0, 0], 0.04);
    }
  }

  for (const side of [-1, 1]) {
    limb(group, black, new THREE.Vector3(side * 0.22, 1.04, 0), new THREE.Vector3(side * 0.25, 0.66, 0.05), 0.145);
    part(group, plate, [0.29, 0.39, 0.28], [side * 0.24, 0.85, 0.11], [0.05, 0, side * 0.03], 0.05);
    part(group, trim, [0.31, 0.07, 0.3], [side * 0.24, 0.67, 0.11], undefined, 0.02);
    limb(group, under, new THREE.Vector3(side * 0.25, 0.64, 0.05), new THREE.Vector3(side * 0.28, 0.22, -0.02), 0.105);
    part(group, bone, [0.24, 0.31, 0.19], [side * 0.27, 0.44, 0.03], [0.12, 0, 0], 0.05);
    part(group, black, [0.27, 0.16, 0.42], [side * 0.29, 0.11, 0.08], undefined, 0.035);
    part(group, trim, [0.28, 0.05, 0.44], [side * 0.29, 0.035, 0.08], undefined, 0.01);
  }

  const helmet = new THREE.Group(); helmet.position.set(0, 2.16, 0); group.add(helmet);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), under); bowl.scale.set(1.04, 1.08, 1); helmet.add(bowl);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.29, 10, 1, true), bone); canopy.position.y = 0.14; helmet.add(canopy);
  for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; limb(helmet, trim, new THREE.Vector3(0, 0.27, 0), new THREE.Vector3(Math.cos(a) * 0.44, -0.02, Math.sin(a) * 0.44), 0.013); }
  part(helmet, black, [0.38, 0.13, 0.16], [0, -0.01, 0.2], undefined, 0.035);
  part(helmet, accent, [0.3, 0.035, 0.02], [0, -0.01, 0.29], undefined, 0.012);
  for (const side of [-1, 1]) {
    part(helmet, trim, [0.09, 0.15, 0.18], [side * 0.23, -0.02, 0.02], undefined, 0.03);
    part(helmet, accent, [0.03, 0.04, 0.02], [side * 0.275, -0.02, 0.055]);
  }
  part(helmet, trim, [0.06, 0.19, 0.24], [0, 0.33, -0.03], [-0.22, 0, 0], 0.02);
  limb(helmet, black, new THREE.Vector3(0.18, 0.05, -0.08), new THREE.Vector3(0.27, 0.38, -0.18), 0.012);
  part(helmet, accent, [0.035, 0.035, 0.035], [0.27, 0.4, -0.18], undefined, 0.01);

  part(group, under, [0.46, 0.52, 0.25], [0, 1.5, -0.3], [0.05, 0, 0], 0.05);
  part(group, black, [0.3, 0.34, 0.14], [0, 1.48, -0.44], undefined, 0.03);
  for (const side of [-1, 1]) {
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), side < 0 ? bone : trim);
    balloon.scale.set(1, 1.45, 0.85); balloon.position.set(side * 0.31, 1.9, -0.4); balloon.castShadow = true; group.add(balloon);
    limb(group, black, new THREE.Vector3(side * 0.31, 1.68, -0.4), new THREE.Vector3(side * 0.29, 1.2, -0.35), 0.026);
    part(group, accent, [0.05, 0.08, 0.05], [side * 0.31, 2.19, -0.4], undefined, 0.02);
  }
  const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 8, 20), accent); rotor.position.set(0, 1.72, -0.48); group.add(rotor);

  const clothGeometry = new THREE.PlaneGeometry(1.28, 0.5, 12, 6); clothGeometry.rotateZ(Math.PI * 0.06);
  const cloth = new THREE.Mesh(clothGeometry, new THREE.MeshStandardMaterial({ color: palette.trim, emissive: palette.glow, emissiveIntensity: 0.14, roughness: 0.93, side: THREE.DoubleSide }));
  cloth.position.set(0, 1.62, -0.52); cloth.castShadow = true; group.add(cloth);

  const hand = new THREE.Group(); hand.position.set(0.46, 1.12, 0.5); group.add(hand);
  const defaultWeapon = createWeapon('auto'); defaultWeapon.scale.setScalar(0.6); defaultWeapon.rotation.set(0, Math.PI, 0); defaultWeapon.position.set(0, 0, 0.38); hand.add(defaultWeapon);
  group.userData.cloth = cloth; group.userData.hand = hand; group.userData.weapon = defaultWeapon; group.userData.weaponId = 'auto';
  mergeModel(group, [cloth, hand]);
  return group;
}

export function createWeapon(id: WeaponId) {
  const group = new THREE.Group();
  const steel = armor('#27383b', 0.82, 0.3), gunmetal = armor('#111b1e', 0.65, 0.4), ivory = armor('#acb2c2', 0.55, 0.42), bronze = armor('#687cb1', 0.7, 0.34);
  const blue = glow('#7ee6ea', 2.4), orange = glow('#8898c1', 1.8);
  if (id === 'handcannon') {
    part(group, gunmetal, [0.16, 0.23, 0.26], [0, -0.14, 0.23], [-0.2, 0, 0], 0.025);
    part(group, bronze, [0.2, 0.21, 0.56], [0, 0.03, -0.05], undefined, 0.035);
    part(group, ivory, [0.18, 0.09, 0.49], [0, 0.18, -0.1], undefined, 0.015);
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12), steel);
    cylinder.rotation.x = Math.PI / 2; cylinder.position.z = 0.06; group.add(cylinder);
    part(group, gunmetal, [0.11, 0.14, 0.2], [0, 0.05, -0.41], undefined, 0.015);
    part(group, orange, [0.015, 0.055, 0.31], [0.106, 0.05, -0.1]);
    part(group, orange, [0.033, 0.07, 0.026], [0, 0.26, -0.29]);
  } else {
    const long = id === 'sniper' ? 1.52 : id === 'scout' ? 1.22 : id === 'spectre' ? .68 : id === 'shotgun' ? 1.08 : 1;
    part(group, steel, [0.23, 0.26, 0.82 * long], [0, 0.015, -0.14], undefined, 0.035);
    part(group, ivory, [0.245, 0.11, 0.55], [0, 0.14, -0.08], undefined, 0.028);
    part(group, gunmetal, [0.21, 0.28, 0.23], [0, -0.19, 0.045], [0.15, 0, 0], 0.025);
    part(group, bronze, [0.22, 0.09, 0.25], [0, -0.33, 0.045], [0.15, 0, 0], 0.012);
    part(group, gunmetal, [0.145, 0.22, 0.22], [0, -0.16, 0.37], [-0.25, 0, 0], 0.02);
    part(group, steel, [0.18, 0.2, 0.4], [0, 0.015, 0.5], undefined, 0.03);
    part(group, gunmetal, [0.2, 0.3, 0.08], [0, -0.02, 0.74], undefined, 0.02);
    part(group, bronze, [0.255, 0.045, 0.39], [0, 0.03, -0.18]);
    for (let i = 0; i < 5; i++) part(group, gunmetal, [0.015, 0.115, 0.035], [0.133, 0.08, -0.29 + i * 0.064], [0.15, 0, 0]);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.059, 0.064, 0.42, 12), steel);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.75 * long); group.add(barrel);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.081, 0.082, 0.13, 8), gunmetal);
    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.03, -0.97 * long); group.add(muzzle);
    part(group, gunmetal, [0.13, 0.09, 0.3], [0, 0.235, -0.02]);
    if (id === 'scout' || id === 'sniper') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.31, 12), gunmetal);
      scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.325, -0.09); group.add(scope);
      part(group, blue, [0.09, 0.09, 0.01], [0, 0.325, 0.07], undefined, 0.025);
    } else {
      part(group, bronze, [0.15, 0.16, 0.03], [0, 0.285, -0.115], undefined, 0.025);
      part(group, gunmetal, [0.112, 0.106, 0.039], [0, 0.29, -0.114], undefined, 0.015);
      part(group, blue, [0.018, 0.018, 0.015], [0, 0.283, -0.09]);
    }
    part(group, blue, [0.013, 0.024, 0.24], [0.13, 0.11, 0.02]);
    part(group, bronze, [0.04, 0.2, 0.11], [0.13, 0.01, 0.245]);
  }
  if (id === 'shotgun') {
    part(group, steel, [.32, .2, .78], [0, -.02, -.55], undefined, .04);
    for (const side of [-1, 1]) { const tube = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .8, 10), gunmetal); tube.rotation.x = Math.PI / 2; tube.position.set(side * .09, -.09, -.68); group.add(tube); }
    part(group, orange, [.34, .035, .18], [0, .13, -.3]);
  }
  if (id === 'lmg') {
    part(group, bronze, [.38, .42, .42], [0, -.3, .05], undefined, .06);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .24, 16), steel); drum.rotation.z = Math.PI / 2; drum.position.set(0, -.27, -.12); group.add(drum);
    part(group, blue, [.03, .18, .26], [.205, -.27, .05]);
  }
  if (id === 'spectre') {
    part(group, gunmetal, [.12, .45, .16], [0, -.36, .1], [.18, 0, 0], .025);
    part(group, orange, [.26, .04, .22], [0, .16, -.15]);
  }
  if (id === 'burst') for (const side of [-1, 1]) part(group, bronze, [.035, .2, .58], [side * .16, .02, -.2], [0, 0, side * .18], .01);
  if (id === 'sniper') {
    part(group, ivory, [.08, .3, .18], [0, -.22, .35], [-.4, 0, 0], .02);
    part(group, blue, [.04, .04, .7], [0, .18, -.5]);
  }
  mergeModel(group);
  return group;
}

export function createEnemy(boss = false, arena = false) {
  const group = new THREE.Group();
  const brass = armor(arena ? '#8b5144' : '#4e5e87', 0.74, 0.4), dark = armor('#303e3c', 0.8), light = armor('#9aa2b6', 0.68), red = glow(arena ? '#ffa879' : '#ff5c32', 3), core = glow('#c4cbdd', 2.2);
  part(group, brass, [0.61, 0.58, 0.35], [0, 1.48, 0], [0.05, 0, 0], 0.025);
  part(group, dark, [0.32, 0.34, 0.26], [0, 1.08, 0]);
  part(group, dark, [0.16, 0.25, 0.19], [0, 1.86, 0]);
  const rotor=new THREE.Group();rotor.position.set(0,2.02,0);group.add(rotor);
  const casing=new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.3,18),light);casing.rotation.x=Math.PI/2;rotor.add(casing);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.3,.045,8,24),brass);wheel.position.z=.18;rotor.add(wheel);
  for(let n=0;n<6;n++){const a=n*Math.PI/3;part(rotor,n%2?dark:red,[.07,.23,.045],[Math.sin(a)*.16,Math.cos(a)*.16,.185],[0,0,-a-.35]);}
  for(let n=0;n<4;n++)part(group,light,[.65,.07,.39],[0,1.19+n*.13,0],undefined,.02);
  const belly=new THREE.Mesh(new THREE.TorusGeometry(.18,.04,8,18),core);belly.position.set(0,1.4,.26);group.add(belly);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * 0.21, 1.07, 0); group.add(leg);
    limb(leg, dark, new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.06, -0.44, -0.03), 0.092);
    part(leg, brass, [0.16, 0.3, 0.17], [side * 0.02, -0.23, 0.065], [-0.08, 0, 0]);
    limb(leg, light, new THREE.Vector3(side * 0.06, -0.44, -0.03), new THREE.Vector3(side * 0.09, -0.83, 0.035), 0.075);
    part(leg, dark, [0.22, 0.14, 0.37], [side * 0.09, -0.96, 0.115]);
    group.userData[side === -1 ? 'leftLeg' : 'rightLeg'] = leg;
    const arm = new THREE.Group(); arm.position.set(side * 0.41, 1.69, 0); group.add(arm);
    part(arm, brass, [0.29, 0.26, 0.32], [0, 0, 0], [0, 0, side * 0.2]);
    limb(arm, dark, new THREE.Vector3(0, -0.08, 0), new THREE.Vector3(side * 0.07, -0.39, 0.08), 0.09);
    limb(arm, light, new THREE.Vector3(side * 0.07, -0.39, 0.08), new THREE.Vector3(side * 0.02, -0.5, 0.4), 0.07);
    part(arm, brass, [0.16, 0.16, 0.39], [side * 0.02, -0.47, 0.41]);
    if (side === 1) part(arm, red, [0.05, 0.05, 0.07], [0.02, -0.46, 0.64]);
  }
  if (boss) {
    group.scale.setScalar(2.35);
    part(group, light, [0.91, 0.24, 0.4], [0, 1.84, -0.05]);
    for(let i=0;i<3;i++){const vane=new THREE.Mesh(new THREE.TorusGeometry(.51+i*.13,.025,6,24),light);vane.position.set(0,1.85,-.2);group.add(vane);}
  }
  group.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; } });
  // Preserve animated legs while merging the static body and weapon geometry.
  const scale = group.scale.x; group.scale.setScalar(1);
  mergeModel(group, [group.userData.leftLeg, group.userData.rightLeg]);
  group.scale.setScalar(scale);
  return group;
}

export function createSailHelper(color = '#9bdddc') {
  const group = new THREE.Group();
  const material=armor('#dadee8',.35),dark=armor('#3865a3',.6),blue=glow(color,1.5);
  const sail=new THREE.Shape();sail.moveTo(-.72,.14);sail.lineTo(.59,.36);sail.lineTo(.39,-.22);sail.lineTo(-.58,-.29);sail.closePath();
  const fabric=new THREE.Mesh(new THREE.ShapeGeometry(sail),new THREE.MeshStandardMaterial({color:'#f0a38a',roughness:.85,side:THREE.DoubleSide}));group.add(fabric);
  for(const y of [-.14,.11])limb(group,material,new THREE.Vector3(-.61,y,.03),new THREE.Vector3(.52,y+.12,.03),.025);
  limb(group,dark,new THREE.Vector3(-.12,-.24,.04),new THREE.Vector3(.12,.27,.04),.04);
  part(group,dark,[.3,.11,.17],[-.25,-.12,.07],undefined,.04);
  for(const x of [-.48,.39])part(group,blue,[.06,.035,.027],[x,.16,.05]);
  return group;
}
