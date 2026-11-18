// Placeholder press parts built from simple shapes.
// To use real models later, replace buildModule / buildUnwinder / buildRewinder
// so they return a clone of the matching object from your GLB (origin at the entry point).
import * as THREE from 'three';
import { CATALOG, WIDTH, HEIGHT, ENDS } from './config.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...o });
export const mats = {
  main: std(0xeef1f3),
  accent: std(0x66798a),
  metal: std(0xc3c9ce, { metalness: 0.85, roughness: 0.32 }),
  dark: std(0x30353b, { roughness: 0.6 }),
  paper: std(0xeaf2f0, { roughness: 0.9 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x7fd3e6, emissive: 0x2a8fa8, emissiveIntensity: 0.6, roughness: 0.3 }),
};
const FINISH = { matte: 0.85, satin: 0.5, gloss: 0.2 };
export function setPalette({ main, accent, finish }) {
  mats.main.color.set(main);
  mats.accent.color.set(accent);
  mats.main.roughness = mats.accent.roughness = FINISH[finish];
}

const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const tintMat = (c) => memo('t' + c, () => std(c, { roughness: 0.55 }));
const box = (w, h, d, m, x, y, z) => {
  const o = new THREE.Mesh(memo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d)), m);
  o.position.set(x, y, z); return o;
};
// cylinder whose axis runs along z (across the web)
const cyl = (r, len, m, x, y, z) => {
  const o = new THREE.Mesh(memo(`c${r}_${len}`, () => new THREE.CylinderGeometry(r, r, len, 32).rotateX(Math.PI / 2)), m);
  o.position.set(x, y, z); return o;
};

function shell(L) {
  const g = new THREE.Group();
  g.add(box(L, 0.78, WIDTH * 0.94, mats.main, L / 2, 0.39, 0));
  g.add(box(L, HEIGHT - 0.78, 0.1, mats.accent, L / 2, 0.78 + (HEIGHT - 0.78) / 2, -WIDTH / 2 + 0.05));
  return g;
}
function head(g, x, w, z, tm) {
  g.add(box(w, 0.55, 0.55, mats.dark, x, 1.115, z));
  g.add(box(w * 0.4, 0.14, 0.02, mats.screen, x, 1.05, z + 0.285));
  g.add(box(w, 0.07, 0.6, tm, x, 1.425, z));
}

export function buildModule(type) {
  const { len: L, kit, tint } = CATALOG[type];
  const tm = tintMat(tint), g = shell(L), cx = L / 2;
  g.add(box(L * 0.94, 0.05, WIDTH * 0.9, tm, cx, 0.805, 0));
  if (kit === 'print') {
    head(g, cx, L * 0.72, 0.1, tm);
    g.add(cyl(0.17, 0.5, mats.metal, cx, 1.62, 0.1), cyl(0.12, 0.5, mats.metal, cx, 2.0, 0.1));
  } else if (kit === 'twin') {
    for (const s of [-1, 1]) {
      head(g, cx + s * L * 0.25, L * 0.4, 0.1, tm);
      g.add(cyl(0.15, 0.5, mats.metal, cx + s * L * 0.25, 1.62, 0.1));
    }
  } else if (kit === 'rolls') {
    g.add(cyl(0.3, 0.5, mats.paper, cx, 1.25, 0.15), cyl(0.3, 0.5, mats.paper, cx, 1.95, 0.15));
    g.add(cyl(0.06, 0.7, mats.metal, cx, 1.25, 0.15), cyl(0.06, 0.7, mats.metal, cx, 1.95, 0.15));
    g.add(cyl(0.1, 0.6, mats.metal, cx, 1.6, 0.15));
  } else if (kit === 'foil') {
    head(g, cx, L * 0.6, 0.1, tm);
    g.add(cyl(0.14, 0.5, mats.metal, cx, 1.6, 0.1), cyl(0.3, 0.45, tm, cx, 2.05, 0.1));
  } else if (kit === 'bed') {
    g.add(box(L * 0.9, 0.1, WIDTH * 0.6, mats.metal, cx, 1.15, 0.05));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.08, 0.8, 0.08, mats.dark, cx + sx * L * 0.4, 1.6, 0.05 + sz * 0.45));
    g.add(box(L * 0.9, 0.1, 1.0, mats.dark, cx, 2.05, 0.05), box(L * 0.3, 0.14, 0.02, mats.screen, cx, 1.8, 0.56));
  }
  return g;
}

export function buildUnwinder() {
  const L = ENDS.unwinder, g = shell(L);
  g.add(cyl(0.75, 0.5, mats.paper, L * 0.5, 1.6, 0.2), cyl(0.14, 0.66, mats.metal, L * 0.5, 1.6, 0.2));
  g.add(cyl(0.08, 0.6, mats.metal, L * 0.92, 1.3, 0.2), cyl(0.08, 0.6, mats.metal, L * 0.92, 2.1, 0.2));
  return g;
}
export function buildRewinder() {
  const L = ENDS.rewinder, g = shell(L);
  g.add(cyl(0.6, 0.5, mats.paper, L * 0.5, 1.4, 0.2), cyl(0.14, 0.66, mats.metal, L * 0.5, 1.4, 0.2));
  g.add(cyl(0.08, 0.6, mats.metal, L * 0.08, 1.3, 0.2), cyl(0.08, 0.6, mats.metal, L * 0.08, 2.1, 0.2));
  g.add(box(0.5, 0.7, 0.3, mats.dark, L * 0.85, 1.2, 0.6), box(0.3, 0.2, 0.02, mats.screen, L * 0.85, 1.3, 0.76));
  return g;
}
