import * as THREE from 'three';

export function seededRandom(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function terrainHeight(x: number, z: number) {
  const basin = Math.max(0, Math.abs(x) - 38) * 0.22 + Math.max(0, -z - 62) * 0.12;
  return Math.sin(x * 0.084) * Math.cos(z * 0.07) * 0.85 + Math.sin(z * 0.19 + x * 0.05) * 0.24 + basin - 0.4;
}

export const clamp = THREE.MathUtils.clamp;
export const damp = (a: number, b: number, speed: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-speed * dt));

export function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list) {
        materials.add(m);
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v);
      }
    }
  });
  geometries.forEach(x => x.dispose()); materials.forEach(x => x.dispose()); textures.forEach(x => x.dispose());
}
