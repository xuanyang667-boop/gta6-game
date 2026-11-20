// Wanted level and police for Solmar Heat — SBPD officers who patrol, chase
// and search (game-ai FSM: perceive -> decide -> path -> steer), plus the heat
// model that turns crimes into stars and stars into response.
// Stars: 1 at heat 10, 2 at 30, 3 at 50, 4 at 70, 5 at 90.
import { findPath, randomRoadPoint, TILE, isWalkable } from './city.js';

export const STAR_HEAT = [0, 10, 30, 50, 70, 90];

export function heatToStars(heat) {
  let s = 0;
  for (let i = 1; i <= 5; i++) if (heat >= STAR_HEAT[i]) s = i;
  return s;
}

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.units = []; // {kind:'car'|'foot', sprite|car, state, lastKnown, loseT, repathT, path, pathI}
    this.heat = 0;
    this.lastCrimeT = 0;
    this.searchT = 0;
  }

  get stars() { return heatToStars(this.heat); }

  addHeat(amount, now) {
    this.heat = Math.min(100, this.heat + amount);
    this.lastCrimeT = now;
  }

  // How many units the current stars field.
  wantCount() {
    return [0, 2, 3, 4, 5, 6][this.stars];
  }

  spawnUnit(playerX, playerY, kind) {
    const a = this.rng.next() * Math.PI * 2;
    const x = playerX + Math.cos(a) * 700, y = playerY + Math.sin(a) * 700;
    if (kind === 'car') {
      const car = new Police.Car(this.scene, x, y, 'car-police', { maxSpeed: 420, accel: 320, kind: 'police' });
      this.scene.trafficGroup.add(car.sprite);
      const u = { kind: 'car', car, state: 'patrol', lastKnown: { x: playerX, y: playerY }, loseT: 0, repathT: 0, path: null, pathI: 0 };
      this.units.push(u);
      return u;
    }
    const s = this.scene.physics.add.sprite(x, y, 'person-cop');
    s.setDepth(5);
    s.body.setSize(18, 22);
    const u = { kind: 'foot', sprite: s, state: 'patrol', lastKnown: { x: playerX, y: playerY }, loseT: 0, repathT: 0, path: null, pathI: 0 };
    this.units.push(u);
    return u;
  }

  // Keep the field at the wanted count; despawn extras when stars drop.
  maintain(playerX, playerY) {
    const want = this.wantCount();
    while (this.units.length < want) {
      this.spawnUnit(playerX, playerY, this.stars >= 2 && this.rng.chance(0.6) ? 'car' : 'foot');
    }
    while (this.units.length > want) {
      const u = this.units.pop();
      if (u.kind === 'car') { this.scene.trafficGroup.remove(u.car.sprite); u.car.destroy(); }
      else u.sprite.destroy();
    }
  }

  // Perception: a unit sees the player within 520px (cops) / 640px (cars)
  // with a clear line of sight — buildings block vision, so turning a corner
  // is how the player breaks a chase.
  canSee(u, px, py) {
    const p = u.kind === 'car' ? u.car.sprite : u.sprite;
    const range = u.kind === 'car' ? 640 : 520;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d >= range) return false;
    // Raycast in ~24px steps; a building tile (or water) blocks sight.
    const steps = Math.max(1, Math.ceil(d / 24));
    for (let i = 1; i < steps; i++) {
      const x = p.x + ((px - p.x) * i) / steps;
      const y = p.y + ((py - p.y) * i) / steps;
      if (!isWalkable(this.city, x, y)) return false;
    }
    return true;
  }

  update(dt, now, px, py, playerSpeed, playerInCar) {
    // Heat decays only when no unit sees the player and no recent crime.
    let seen = false;
    for (const u of this.units) if (this.canSee(u, px, py)) { seen = true; break; }
    if (!seen && now - this.lastCrimeT > 8000 && this.heat > 0) {
      this.heat = Math.max(0, this.heat - 5 * dt);
    }
    this.maintain(px, py);

    for (const u of this.units) {
      const p = u.kind === 'car' ? u.car.sprite : u.sprite;
      const sees = this.canSee(u, px, py);
      if (sees) { u.lastKnown = { x: px, y: py }; u.loseT = 0; }
      else u.loseT += dt;

      // FSM: patrol -> chase (sees) -> search (lost 5s) -> patrol (searched 8s).
      if (u.state === 'patrol' && sees) u.state = 'chase';
      else if (u.state === 'chase' && u.loseT > 5) { u.state = 'search'; u.searchT = 0; }
      else if (u.state === 'search') {
        u.searchT += dt;
        if (sees) u.state = 'chase';
        else if (u.searchT > 8) { u.state = 'patrol'; u.path = null; }
      }

      if (u.state === 'chase') this.chase(u, px, py, dt, playerInCar);
      else if (u.state === 'search') this.goTo(u, u.lastKnown.x, u.lastKnown.y, dt);
      else this.patrol(u, dt);
    }
  }

  // Chase: steer straight at the player (cars) or run at them (foot).
  chase(u, px, py, dt, playerInCar) {
    if (u.kind === 'car') {
      const car = u.car;
      const dx = px - car.sprite.x, dy = py - car.sprite.y;
      const want = Math.atan2(dy, dx);
      let diff = want - car.sprite.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.drive(1, Math.max(-1, Math.min(1, diff * 2.5)), dt);
    } else {
      const s = u.sprite;
      const dx = px - s.x, dy = py - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = 210;
      s.body.setVelocity((dx / d) * speed, (dy / d) * speed);
      s.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    }
  }

  // Follow the road graph toward a point (used for search and patrol).
  goTo(u, tx, ty, dt) {
    u.repathT -= dt;
    if (!u.path || u.repathT <= 0) {
      const p = u.kind === 'car' ? u.car.sprite : u.sprite;
      u.path = findPath(this.city, p.x, p.y, tx, ty);
      u.pathI = 0;
      u.repathT = 2;
    }
    this.follow(u, dt);
  }

  patrol(u, dt) {
    if (!u.path) {
      const dest = randomRoadPoint(this.city, this.rng);
      const p = u.kind === 'car' ? u.car.sprite : u.sprite;
      u.path = findPath(this.city, p.x, p.y, dest.x, dest.y);
      u.pathI = 0;
    }
    this.follow(u, dt);
  }

  follow(u, dt) {
    if (!u.path || u.pathI >= u.path.length) { u.path = null; return; }
    const p = u.kind === 'car' ? u.car.sprite : u.sprite;
    const target = u.path[u.pathI];
    const dx = target.x - p.x, dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30) { u.pathI++; return; }
    const want = Math.atan2(dy, dx);
    if (u.kind === 'car') {
      let diff = want - p.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.car.drive(0.5, Math.max(-1, Math.min(1, diff * 2)), dt);
    } else {
      let diff = want - (p.rotation - Math.PI / 2);
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const speed = 150;
      p.body.setVelocity(Math.cos(want) * speed, Math.sin(want) * speed);
      p.setRotation(want + Math.PI / 2);
    }
  }

  // Nearest police unit to a point (for busted checks and sirens).
  nearest(px, py) {
    let best = null, bd = Infinity;
    for (const u of this.units) {
      const p = u.kind === 'car' ? u.car.sprite : u.sprite;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bd) { bd = d; best = u; }
    }
    return { unit: best, dist: bd };
  }

  clear() {
    for (const u of this.units) {
      if (u.kind === 'car') { this.scene.trafficGroup.remove(u.car.sprite); u.car.destroy(); }
      else u.sprite.destroy();
    }
    this.units = [];
    this.heat = 0;
  }
}
// The scene sets Police.Car = Car (cars.js) after import to avoid a cycle.
Police.Car = null;
