// Original art for Solmar Heat — every sprite and tile is drawn procedurally
// on canvas at boot (no image files, no borrowed assets). One palette, one
// sun-soaked look: warm asphalt, pale sidewalks, turquoise water, pastel roofs.
import { T } from './city.js';

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function add(scene, key, canvas) {
  scene.textures.addCanvas(key, canvas);
}
function speckle(g, x, y, w, h, n, colors, r = 1.5) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    g.globalAlpha = 0.25 + Math.random() * 0.3;
    g.fillRect(x + Math.random() * w, y + Math.random() * h, r, r);
  }
  g.globalAlpha = 1;
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---- Tileset: 16 tiles of 32px, index matches city.js T ----
export function generateTileset(scene) {
  const c = cv(512, 32);
  const g = c.getContext('2d');
  const tile = (i, fn) => { g.save(); g.translate(i * 32, 0); fn(g); g.restore(); };
  tile(T.GRASS, g => { g.fillStyle = '#6fae4e'; g.fillRect(0, 0, 32, 32); speckle(g, 0, 0, 32, 32, 22, ['#5d9c40', '#7fbe5c', '#86c768']); });
  tile(T.ROAD, g => { g.fillStyle = '#3a3d46'; g.fillRect(0, 0, 32, 32); speckle(g, 0, 0, 32, 32, 14, ['#2e3138', '#484c58']); });
  tile(T.ROAD_H, g => { g.fillStyle = '#3a3d46'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#e8c33a'; g.fillRect(4, 15, 10, 2); g.fillRect(18, 15, 10, 2); });
  tile(T.ROAD_V, g => { g.fillStyle = '#3a3d46'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#e8c33a'; g.fillRect(15, 4, 2, 10); g.fillRect(15, 18, 2, 10); });
  tile(T.CROSS, g => { g.fillStyle = '#41444e'; g.fillRect(0, 0, 32, 32); speckle(g, 0, 0, 32, 32, 10, ['#34373f']); });
  tile(T.WALK, g => { g.fillStyle = '#b9b3a4'; g.fillRect(0, 0, 32, 32); g.strokeStyle = '#9a9484'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 31, 31); g.beginPath(); g.moveTo(16, 0); g.lineTo(16, 32); g.stroke(); });
  tile(T.SAND, g => { g.fillStyle = '#e3cd96'; g.fillRect(0, 0, 32, 32); speckle(g, 0, 0, 32, 32, 18, ['#d4b978', '#f0dcab']); });
  tile(T.WATER, g => { g.fillStyle = '#2f8fc9'; g.fillRect(0, 0, 32, 32); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, 10); g.quadraticCurveTo(10, 6, 16, 10); g.quadraticCurveTo(22, 14, 28, 10); g.moveTo(4, 22); g.quadraticCurveTo(10, 18, 16, 22); g.quadraticCurveTo(22, 26, 28, 22); g.stroke(); });
  tile(T.PARK, g => { g.fillStyle = '#4e8f3c'; g.fillRect(0, 0, 32, 32); speckle(g, 0, 0, 32, 32, 16, ['#3f7d31', '#5da347']); g.fillStyle = '#2f6b24'; g.beginPath(); g.arc(9, 9, 4, 0, 7); g.arc(23, 21, 5, 0, 7); g.fill(); });
  tile(T.PARKING, g => { g.fillStyle = '#43464f'; g.fillRect(0, 0, 32, 32); g.strokeStyle = '#d8d8d8'; g.lineWidth = 1; g.beginPath(); g.moveTo(4, 4); g.lineTo(4, 28); g.moveTo(16, 4); g.lineTo(16, 28); g.moveTo(28, 4); g.lineTo(28, 28); g.stroke(); });
  tile(T.CROSS_H, g => { g.fillStyle = '#3a3d46'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#e8e8e8'; for (let x = 2; x < 32; x += 6) g.fillRect(x, 4, 3, 24); });
  tile(T.CROSS_V, g => { g.fillStyle = '#3a3d46'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#e8e8e8'; for (let y = 2; y < 32; y += 6) g.fillRect(4, y, 24, 3); });
  tile(T.PLAZA, g => { g.fillStyle = '#c9b18a'; g.fillRect(0, 0, 32, 32); g.strokeStyle = '#a98f66'; g.lineWidth = 1; for (let i = 0; i <= 32; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 32); g.moveTo(0, i); g.lineTo(32, i); g.stroke(); } g.fillStyle = '#7fb3d5'; g.beginPath(); g.arc(16, 16, 5, 0, 7); g.fill(); });
  add(scene, 'tiles', c);
}

// ---- Building roofs (128x128, stretched to the building rect) ----
function roofBase(kind) {
  const c = cv(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#8a7f70'; g.fillRect(0, 0, 128, 128);
  if (kind === 'flat') {
    g.fillStyle = '#7d7468'; g.fillRect(6, 6, 116, 116);
    g.fillStyle = '#6b6257'; g.fillRect(0, 0, 128, 8); g.fillRect(0, 120, 128, 8); g.fillRect(0, 0, 8, 128); g.fillRect(120, 0, 8, 128);
    g.fillStyle = '#9aa0a8'; g.fillRect(20, 20, 26, 18); g.fillRect(80, 70, 22, 16);
    g.fillStyle = '#5d564c'; g.fillRect(88, 22, 12, 12); g.fillRect(24, 84, 14, 10);
  } else if (kind === 'house') {
    g.fillStyle = '#b5653a'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#9c4f2c'; for (let y = 0; y < 128; y += 12) g.fillRect(0, y, 128, 3);
    g.fillStyle = '#d8c49a'; g.fillRect(54, 0, 20, 128);
    g.fillStyle = '#6b3d22'; g.fillRect(58, 44, 12, 40);
  } else if (kind === 'tower') {
    g.fillStyle = '#3d6f96'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#a8d4ea'; for (let y = 10; y < 128; y += 16) for (let x = 10; x < 128; x += 16) g.fillRect(x, y, 8, 6);
    g.fillStyle = '#2b4f6e'; g.fillRect(0, 0, 128, 6); g.fillRect(0, 122, 128, 6);
  } else if (kind === 'shop') {
    g.fillStyle = '#c95f5f'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#f2e3c9'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 8, 14);
    g.fillStyle = '#7d3a3a'; g.fillRect(10, 30, 108, 88);
    g.fillStyle = '#e8d8b0'; g.fillRect(20, 44, 88, 60);
  } else { // warehouse
    g.fillStyle = '#8b8f96'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#6e7278'; g.lineWidth = 2; for (let x = 8; x < 128; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    g.fillStyle = '#5d6167'; g.fillRect(16, 16, 40, 10); g.fillRect(72, 96, 40, 10);
  }
  return c;
}
export function generateBuildings(scene) {
  for (const kind of ['flat', 'house', 'tower', 'shop', 'warehouse']) {
    add(scene, 'roof-' + kind, roofBase(kind));
  }
}

// ---- Cars (top-down, facing right = +x) ----
function drawCar(g, w, h, body, roof) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#14141a';
  g.fillRect(4, 1, 10, 5); g.fillRect(4, h - 6, 10, 5); g.fillRect(w - 14, 1, 10, 5); g.fillRect(w - 14, h - 6, 10, 5);
  rr(g, 2, 3, w - 4, h - 6, 7); g.fillStyle = body; g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.stroke();
  rr(g, w * 0.38, 6, w * 0.3, h - 12, 4); g.fillStyle = roof; g.fill();
  g.fillStyle = 'rgba(180,220,255,0.85)';
  g.fillRect(w * 0.62, 7, 4, h - 14); g.fillRect(w * 0.30, 7, 4, h - 14);
  g.fillStyle = '#fff7b0'; g.fillRect(w - 3, 6, 2, 5); g.fillRect(w - 3, h - 11, 2, 5);
  g.fillStyle = '#ff3b30'; g.fillRect(2, 6, 2, 5); g.fillRect(2, h - 11, 2, 5);
}
function carCanvas(w, h, body, roof, extra) {
  const c = cv(w, h);
  const g = c.getContext('2d');
  drawCar(g, w, h, body, roof);
  if (extra) extra(g, w, h);
  return c;
}
export function generateCars(scene) {
  const defs = {
    'car-red': ['#d23b2e', '#7d1f18'], 'car-blue': ['#2e6fd2', '#1c417d'],
    'car-green': ['#2e9e4f', '#1c5c30'], 'car-orange': ['#e07b1f', '#7d4410'],
    'car-purple': ['#7d4fc9', '#472a7d'], 'car-silver': ['#b9bec7', '#6e747e'],
    'car-sport': ['#e8c33a', '#8a6d10'],
    'car-taxi': ['#f2c200', '#8a6d10'],
    'car-police': ['#e8e8e8', '#1c1c22'],
  };
  for (const [key, [body, roof]] of Object.entries(defs)) {
    let extra = null;
    if (key === 'car-taxi') extra = (g, w, h) => { g.fillStyle = '#111'; for (let x = 10; x < w - 10; x += 8) { g.fillRect(x, 3, 4, 3); g.fillRect(x + 4, h - 6, 4, 3); } };
    if (key === 'car-police') extra = (g, w, h) => {
      g.fillStyle = '#111'; g.fillRect(w * 0.30, 3, w * 0.4, h - 6);
      g.fillStyle = '#ff3b30'; g.fillRect(w * 0.42, 1, 6, 4);
      g.fillStyle = '#2e6fd2'; g.fillRect(w * 0.42, h - 5, 6, 4);
      g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.fillText('SBPD', w * 0.36, h / 2 + 2);
    };
    if (key === 'car-sport') extra = (g, w, h) => { g.fillStyle = '#111'; g.fillRect(4, h / 2 - 2, 8, 4); };
    add(scene, key, carCanvas(52, 26, body, roof, extra));
  }
  // Box truck: cab + cargo.
  const t = cv(72, 28);
  const g = t.getContext('2d');
  drawCar(g, 30, 28, '#3a6fd2', '#274a8a');
  g.fillStyle = '#e8e2d4'; rr(g, 30, 2, 40, 24, 3); g.fill();
  g.strokeStyle = '#9a9484'; g.stroke();
  add(scene, 'car-truck', t);
}

// ---- People (top-down, facing down) ----
function personCanvas(shirt, skin, opts = {}) {
  const c = cv(26, 30);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.ellipse(13, 25, 9, 4, 0, 0, 7); g.fill();
  g.fillStyle = shirt;
  rr(g, 6, 10, 14, 14, 6); g.fill();
  g.fillStyle = skin;
  g.beginPath(); g.arc(13, 8, 6, 0, 7); g.fill();
  g.fillStyle = opts.hair || '#2b1d12';
  g.beginPath(); g.arc(13, 6, 6, Math.PI, 0); g.fill();
  if (opts.cap) { g.fillStyle = opts.cap; g.fillRect(6, 2, 14, 4); g.fillRect(6, 5, 14, 2); }
  if (opts.badge) { g.fillStyle = '#ffd23e'; g.fillRect(10, 16, 3, 3); }
  return c;
}
export function generatePeople(scene) {
  add(scene, 'person-player', personCanvas('#2e9e4f', '#e8b98a', { hair: '#1c1c22' }));
  add(scene, 'person-cop', personCanvas('#1c2f6e', '#d8a97e', { cap: '#101c46', badge: true }));
  add(scene, 'person-rival', personCanvas('#c92e2e', '#c98f66', { hair: '#3a1c10' }));
  const shirts = ['#d2a23b', '#7d4fc9', '#2e6fd2', '#c95f8a', '#4fa8c9', '#8a6d3b'];
  const skins = ['#e8b98a', '#c98f66', '#8a5a3b', '#f0c8a0'];
  for (let i = 0; i < 6; i++) {
    add(scene, 'person-ped-' + i, personCanvas(shirts[i], skins[i % skins.length], { hair: ['#2b1d12', '#6b4a1c', '#111', '#8a8a8a'][i % 4] }));
  }
}

// ---- FX ----
export function generateFx(scene) {
  const bullet = cv(10, 4);
  let g = bullet.getContext('2d');
  g.fillStyle = '#ffe66d'; g.fillRect(0, 1, 10, 2); g.fillStyle = '#fff'; g.fillRect(0, 1, 4, 2);
  add(scene, 'bullet', bullet);
  const dot = cv(10, 10);
  g = dot.getContext('2d');
  g.fillStyle = '#fff'; g.beginPath(); g.arc(5, 5, 4, 0, 7); g.fill();
  add(scene, 'dot', dot);
  const marker = cv(36, 36);
  g = marker.getContext('2d');
  g.fillStyle = '#ffd23e'; g.strokeStyle = '#7a5a00'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(18, 2); g.lineTo(32, 18); g.lineTo(18, 34); g.lineTo(4, 18); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#7a5a00'; g.beginPath(); g.arc(18, 18, 4, 0, 7); g.fill();
  add(scene, 'marker', marker);
  const ring = cv(72, 72);
  g = ring.getContext('2d');
  g.strokeStyle = '#ffd23e'; g.lineWidth = 4; g.beginPath(); g.arc(36, 36, 30, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(255,210,62,0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(36, 36, 22, 0, 7); g.stroke();
  add(scene, 'ring', ring);
  const muzzle = cv(20, 20);
  g = muzzle.getContext('2d');
  g.fillStyle = '#fff2a8'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const r = i % 2 ? 3 : 10; g.lineTo(10 + Math.cos(a) * r, 10 + Math.sin(a) * r); }
  g.closePath(); g.fill();
  add(scene, 'muzzle', muzzle);
}

export function generateAll(scene) {
  generateTileset(scene);
  generateBuildings(scene);
  generateCars(scene);
  generatePeople(scene);
  generateFx(scene);
}
