import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CATALOG, GROUPS, MAX_ADDONS, DEFAULT_FLEXO, WIDTH, HEIGHT, ENDS } from './config.js';
import { buildModule, buildUnwinder, buildRewinder, setPalette } from './parts.js';

const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULT_DIR = new THREE.Vector3(0.3, 0.26, 1).normalize();
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/* ---------------- state ---------------- */
let uid = 0;
const state = { order: [], main: '#eef1f3', accent: '#66798a', finish: 'satin' };
for (let i = 0; i < DEFAULT_FLEXO; i++) state.order.push({ id: ++uid, type: 'flexo' });
const count = (t) => state.order.filter((m) => m.type === t).length;
const addonTotal = () => state.order.filter((m) => m.type !== 'flexo').length;
const lastIndexOf = (t) => state.order.map((m) => m.type).lastIndexOf(t);

function add(t) {
  const c = CATALOG[t];
  if (c.max != null && count(t) >= c.max) return;
  if (t !== 'flexo' && addonTotal() >= MAX_ADDONS) return;
  const item = { id: ++uid, type: t };
  if (t === 'flexo') state.order.splice(lastIndexOf('flexo') + 1, 0, item);
  else state.order.push(item);
  layout();
}
function remove(t) {
  if (count(t) <= (CATALOG[t].min ?? 0)) return;
  state.order.splice(lastIndexOf(t), 1);
  layout();
}
function move(from, to) {
  if (to < 0 || to >= state.order.length || from === to) return;
  const [it] = state.order.splice(from, 1);
  state.order.splice(to, 0, it);
  layout({ frame: false });
}

/* ---------------- scene ---------------- */
const stage = $('#stage'), canvas = $('#view');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#nogl').hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(4, 8, 6);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.52;
controls.minDistance = 2;
controls.maxDistance = 40;
// Keep page scrolling working inside a Framer embed: zoom only after the person clicks the view.
controls.enableZoom = false;
canvas.addEventListener('pointerdown', () => { controls.enableZoom = true; });
canvas.addEventListener('pointerleave', () => { controls.enableZoom = false; });

const press = new THREE.Group();
scene.add(press);
const unwinder = buildUnwinder(), rewinder = buildRewinder();
press.add(unwinder, rewinder);
const mods = new Map();

// soft ground shadow (one textured plane, very cheap)
const sc = document.createElement('canvas');
sc.width = sc.height = 128;
const sx = sc.getContext('2d');
const grad = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
grad.addColorStop(0, 'rgba(0,0,0,.38)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
sx.fillStyle = grad; sx.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.002;
scene.add(shadow);

// highlight box used while rearranging
const hl = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xd4141c, transparent: true, opacity: 0.22, depthWrite: false })
);
hl.visible = false;
scene.add(hl);

/* ---------------- render on demand ---------------- */
let raf = 0, goal = null, ready = false, total = 0;
const req = () => { if (!raf) raf = requestAnimationFrame(tick); };
controls.addEventListener('change', req);
controls.addEventListener('start', () => { goal = null; });

function stepTweens() {
  const k = reduce ? 1 : 0.2;
  let busy = false;
  for (const g of [unwinder, rewinder, ...mods.values()]) {
    const dx = g.userData.tx - g.position.x;
    if (Math.abs(dx) > 0.0005) { g.position.x += dx * k; busy = true; } else g.position.x = g.userData.tx;
    const ds = 1 - g.scale.y;
    if (Math.abs(ds) > 0.002) { g.scale.y += ds * k; busy = true; } else g.scale.y = 1;
  }
  if (goal) {
    camera.position.lerp(goal.pos, k);
    controls.target.lerp(goal.target, k);
    if (camera.position.distanceTo(goal.pos) < 0.002 && controls.target.distanceTo(goal.target) < 0.002) {
      camera.position.copy(goal.pos); controls.target.copy(goal.target); goal = null;
    } else busy = true;
  }
  return busy;
}
function tick() {
  raf = 0;
  const busy = stepTweens();
  const moved = controls.update();
  renderer.render(scene, camera);
  if (busy || moved) req();
}

/* ---------------- framing ---------------- */
const pressBox = () => new THREE.Box3(new THREE.Vector3(-total / 2, 0, -WIDTH / 2), new THREE.Vector3(total / 2, HEIGHT, WIDTH / 2));
function frameFor(cam, dir, box, aspect, pad = 1.12) {
  const c = box.getCenter(new THREE.Vector3());
  const fwd = dir.clone().normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
  const up = fwd.clone().cross(right).normalize();
  let hw = 0, hh = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).sub(c);
    hw = Math.max(hw, Math.abs(p.dot(right)));
    hh = Math.max(hh, Math.abs(p.dot(up)));
  }
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const d = Math.max(hh / t, hw / (t * aspect)) * pad + (box.max.z - box.min.z) / 2;
  return { target: c, pos: c.clone().addScaledVector(fwd, d) };
}
function reframe() {
  if (!stage.clientWidth || !total) return;
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1e-6) dir.copy(DEFAULT_DIR);
  goal = frameFor(camera, dir, pressBox(), camera.aspect);
  if (!ready || reduce) { camera.position.copy(goal.pos); controls.target.copy(goal.target); goal = null; ready = true; }
  req();
}
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  reframe();
  req();
}).observe(stage);

/* ---------------- layout ---------------- */
function layout({ frame = true } = {}) {
  const ids = new Set(state.order.map((m) => m.id));
  for (const [id, g] of mods) if (!ids.has(id)) { press.remove(g); mods.delete(id); }
  for (const m of state.order) {
    if (mods.has(m.id)) continue;
    const g = buildModule(m.type);
    g.userData.fresh = true;
    g.scale.y = 0.01;
    press.add(g);
    mods.set(m.id, g);
  }
  const len = ENDS.unwinder + state.order.reduce((s, m) => s + CATALOG[m.type].len, 0) + ENDS.rewinder;
  const off = -len / 2;
  let x = ENDS.unwinder;
  unwinder.userData.tx = off;
  for (const m of state.order) {
    const g = mods.get(m.id);
    g.userData.tx = off + x;
    if (g.userData.fresh) { g.position.x = g.userData.tx; g.userData.fresh = false; }
    x += CATALOG[m.type].len;
  }
  rewinder.userData.tx = off + x;
  total = len;
  shadow.scale.set(total + 2, WIDTH + 1.4, 1);
  sync();
  if (frame) reframe();
  req();
}

/* ---------------- options panel ---------------- */
const opts = $('#options');
GROUPS.forEach((grp, gi) => {
  const s = document.createElement('section');
  s.innerHTML = `<h2>${grp.title}</h2>`;
  if (gi === 1) s.insertAdjacentHTML('beforeend', '<p id="cap" class="cap"></p>');
  for (const t of grp.types) {
    const c = CATALOG[t];
    const r = document.createElement('div');
    r.className = 'row';
    r.dataset.type = t;
    r.innerHTML = `<span class="name">${c.label}</span><span class="stepper">
      <button data-act="dec" aria-label="Remove ${c.label}">&minus;</button>
      <output aria-live="polite">0</output>
      <button data-act="inc" aria-label="Add ${c.label}">+</button></span>`;
    s.append(r);
  }
  opts.append(s);
});
opts.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const t = b.closest('.row').dataset.type;
  b.dataset.act === 'inc' ? add(t) : remove(t);
});

function sync() {
  document.querySelectorAll('.row').forEach((r) => {
    const t = r.dataset.type, c = CATALOG[t], n = count(t);
    r.querySelector('output').textContent = n;
    r.querySelector('[data-act=dec]').disabled = n <= (c.min ?? 0);
    r.querySelector('[data-act=inc]').disabled = (c.max != null && n >= c.max) || (t !== 'flexo' && addonTotal() >= MAX_ADDONS);
  });
  $('#cap').textContent = `Add-ons used: ${addonTotal()} of ${MAX_ADDONS}`;
  $('#d-len').textContent = `${total.toFixed(2)} m`;
  $('#d-len-ft').textContent = `${(total * 3.28084).toFixed(1)} ft`;
  if (!$('#tray').hidden) renderTray();
}

/* colours and finish */
const BODY = ['#eef1f3', '#d4d8dc', '#3a4048', '#c8102e', '#1f5fa8', '#2f7d5b'];
const ACCENT = ['#66798a', '#2b3138', '#a3b1be', '#b7312c', '#2c6aa0', '#c9852b'];
function swatches(el, list, key) {
  for (const c of list) {
    const b = document.createElement('button');
    b.className = 'sw'; b.style.background = c; b.dataset.c = c; b.setAttribute('aria-label', c);
    b.onclick = () => { state[key] = c; look(); };
    el.append(b);
  }
  const inp = document.createElement('input');
  inp.type = 'color'; inp.value = state[key]; inp.setAttribute('aria-label', 'Custom colour'); inp.dataset.key = key;
  inp.oninput = () => { state[key] = inp.value; look(); };
  el.append(inp);
}
swatches($('#sw-main'), BODY, 'main');
swatches($('#sw-accent'), ACCENT, 'accent');
document.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { state.finish = b.dataset.f; look(); }; });
function look() {
  setPalette(state);
  for (const [id, key] of [['#sw-main', 'main'], ['#sw-accent', 'accent']]) {
    $(id).querySelectorAll('.sw').forEach((b) => b.classList.toggle('on', b.dataset.c === state[key]));
    $(id).querySelector('input').value = state[key];
  }
  document.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === state.finish));
  req();
}

/* ---------------- rearrange tray ---------------- */
const tray = $('#tray'), chips = $('#chips');
$('#rearrange').onclick = (e) => {
  tray.hidden = !tray.hidden;
  e.currentTarget.setAttribute('aria-pressed', String(!tray.hidden));
  if (tray.hidden) showHl(null); else renderTray();
};
function showHl(i) {
  const m = i == null ? null : state.order[i];
  const g = m && mods.get(m.id);
  hl.visible = !!g;
  if (g) {
    const L = CATALOG[m.type].len;
    hl.scale.set(L, HEIGHT, WIDTH);
    hl.position.set(g.userData.tx + L / 2, HEIGHT / 2, 0);
  }
  req();
}
function renderTray() {
  chips.innerHTML = '';
  state.order.forEach((m, i) => {
    const c = CATALOG[m.type];
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.i = i;
    li.innerHTML = `<span class="dot" style="background:${hex(c.tint)}"></span><span class="lbl">${c.label}</span>
      <button data-mv="-1" aria-label="Move ${c.label} left" ${i === 0 ? 'disabled' : ''}>&#8249;</button>
      <button data-mv="1" aria-label="Move ${c.label} right" ${i === state.order.length - 1 ? 'disabled' : ''}>&#8250;</button>`;
    chips.append(li);
  });
}
chips.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mv]');
  if (!b) return;
  const i = +b.closest('li').dataset.i, d = +b.dataset.mv;
  move(i, i + d);
  const next = chips.children[i + d];
  (next?.querySelector(`[data-mv="${d}"]:not(:disabled)`) || next?.querySelector('button:not(:disabled)'))?.focus();
  showHl(i + d);
});
chips.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', e.target.dataset.i); e.target.classList.add('drag'); });
chips.addEventListener('dragend', (e) => e.target.classList.remove('drag'));
chips.addEventListener('dragover', (e) => e.preventDefault());
chips.addEventListener('drop', (e) => {
  e.preventDefault();
  const li = e.target.closest('li');
  if (li) move(+e.dataTransfer.getData('text/plain'), +li.dataset.i);
});
chips.addEventListener('mouseover', (e) => { const li = e.target.closest('li'); if (li) showHl(+li.dataset.i); });
chips.addEventListener('focusin', (e) => { const li = e.target.closest('li'); if (li) showHl(+li.dataset.i); });
chips.addEventListener('mouseleave', () => showHl(null));
chips.addEventListener('focusout', () => showHl(null));

/* ---------------- reset view ---------------- */
$('#reset').onclick = () => {
  const dir = DEFAULT_DIR.clone().multiplyScalar(10).add(controls.target);
  camera.position.copy(dir);
  reframe();
};

/* ---------------- export ---------------- */
function sequence() {
  const runs = [];
  for (const m of state.order) {
    const l = CATALOG[m.type].label, last = runs[runs.length - 1];
    last && last.l === l ? last.n++ : runs.push({ l, n: 1 });
  }
  return runs.map((r) => (r.n > 1 ? `${r.l} x${r.n}` : r.l)).join(', ');
}
function wrap(ctx, text, maxW) {
  const lines = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function withSummary(shot) {
  const W = shot.width, s = W / 3000, pad = 120 * s;
  const font = (px, wt = 400) => `${wt} ${px * s}px Archivo, system-ui, sans-serif`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font(40);
  const lines = wrap(probe, `Order of units: ${sequence()}`, W - 2 * pad);
  const lineH = 58 * s;
  const footH = pad * 0.6 + 70 * s + lineH * (lines.length + 1) + pad * 0.5;
  const out = document.createElement('canvas');
  out.width = W; out.height = Math.round(shot.height + footH);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(shot, 0, 0);
  ctx.fillStyle = '#d4141c'; ctx.fillRect(pad, shot.height + pad * 0.3, 90 * s, 8 * s);
  ctx.fillStyle = '#1d2329'; ctx.textBaseline = 'top';
  let y = shot.height + pad * 0.6;
  ctx.font = font(56, 700); ctx.fillText('Custom press configuration', pad, y); y += 70 * s;
  ctx.font = font(40);
  ctx.fillText(`Length ${total.toFixed(2)} m (${(total * 3.28084).toFixed(1)} ft), height ${HEIGHT.toFixed(2)} m, width ${WIDTH.toFixed(2)} m`, pad, y); y += lineH;
  for (const l of lines) { ctx.fillText(l, pad, y); y += lineH; }
  return out;
}
async function exportImage() {
  const btn = $('#export'), label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Preparing image';
  await new Promise((r) => setTimeout(r, 40));
  const prevW = stage.clientWidth, prevH = stage.clientHeight, prevPR = renderer.getPixelRatio(), prevHl = hl.visible;
  try {
    const gl = renderer.getContext();
    const W = Math.min(3000, gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0], gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    const H = Math.round(W / 2);
    const white = $('#bg').value === 'white';
    const cam = new THREE.PerspectiveCamera(camera.fov, W / H, 0.1, 200);
    const f = frameFor(cam, camera.position.clone().sub(controls.target), pressBox(), W / H, 1.12);
    cam.position.copy(f.pos); cam.lookAt(f.target);
    hl.visible = false;
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0xffffff, white ? 1 : 0);
    renderer.render(scene, cam);
    const shot = document.createElement('canvas');
    shot.width = W; shot.height = H;
    shot.getContext('2d').drawImage(canvas, 0, 0);
    const out = white ? withSummary(shot) : shot;
    await new Promise((res) => out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'press-configuration.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      res();
    }, 'image/png'));
  } finally {
    renderer.setPixelRatio(prevPR);
    renderer.setSize(prevW, prevH, false);
    renderer.setClearColor(0x000000, 0);
    hl.visible = prevHl;
    btn.disabled = false; btn.textContent = label;
    req();
  }
}
$('#export').onclick = exportImage;

/* ---------------- go ---------------- */
$('#d-h').textContent = `${HEIGHT.toFixed(2)} m`;
$('#d-h-ft').textContent = `${(HEIGHT * 3.28084).toFixed(1)} ft`;
$('#d-w').textContent = `${WIDTH.toFixed(2)} m`;
$('#d-w-ft').textContent = `${(WIDTH * 3.28084).toFixed(1)} ft`;
if (stage.clientWidth) {
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
}
look();
layout();
