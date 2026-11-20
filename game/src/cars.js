// Cars for Solmar Heat — player car handling (arcade physics, car-like
// steering) and traffic AI (waypoint following on the road graph).
// Car sprites face +x; angle is the sprite rotation.
import { findPath, isDriveable, randomRoadPoint, TILE } from './city.js';

const CAR_KEYS = ['car-red', 'car-blue', 'car-green', 'car-orange', 'car-purple', 'car-silver', 'car-sport'];

export class Car {
  constructor(scene, x, y, key, opts = {}) {
    this.scene = scene;
    this.key = key;
    this.sprite = scene.physics.add.sprite(x, y, key);
    this.sprite.setDepth(5);
    this.sprite.body.setSize(46, 22);
    this.sprite.setDrag(120, 120);
    this.sprite.setMaxVelocity(520, 520);
    this.speed = 0; // signed forward speed (px/s)
    this.maxSpeed = opts.maxSpeed ?? 420;
    this.accel = opts.accel ?? 260;
    this.isPlayer = false;
    this.kind = opts.kind ?? 'traffic';
    this.health = 100;
    this.path = null;
    this.pathI = 0;
    this.wait = 0;
    this.stuckT = 0;
    this.lastX = x; this.lastY = y;
    this.dead = false;
  }

  // Player-style driving: throttle -1..1, steer -1..1.
  drive(throttle, steer, dt) {
    const body = this.sprite.body;
    const angle = this.sprite.rotation;
    this.speed += throttle * this.accel * dt;
    this.speed -= this.speed * 0.9 * dt; // rolling drag
    if (Math.abs(this.speed) < 4 && throttle === 0) this.speed = 0;
    const maxReverse = this.maxSpeed * 0.45;
    this.speed = Math.max(-maxReverse, Math.min(this.maxSpeed, this.speed));
    const turn = steer * 2.4 * Math.min(1, Math.abs(this.speed) / 120) * Math.sign(this.speed || 1);
    this.sprite.setRotation(angle + turn * dt);
    body.setVelocity(Math.cos(this.sprite.rotation) * this.speed, Math.sin(this.sprite.rotation) * this.speed);
  }

  // Traffic: follow a waypoint path; stop when blocked ahead.
  followPath(dt, blockers) {
    if (!this.path || this.pathI >= this.path.length) return;
    const target = this.path[this.pathI];
    const dx = target.x - this.sprite.x, dy = target.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) { this.pathI++; return; }
    const want = Math.atan2(dy, dx);
    let diff = want - this.sprite.rotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const blocked = blockers && blockers(this);
    const throttle = blocked ? -0.6 : 0.55;
    this.drive(throttle, steer, dt);
    // Stuck guard: no progress for 2s -> pick a new path.
    const moved = Math.hypot(this.sprite.x - this.lastX, this.sprite.y - this.lastY);
    if (moved < 2) this.stuckT += dt; else this.stuckT = 0;
    this.lastX = this.sprite.x; this.lastY = this.sprite.y;
    if (this.stuckT > 2) { this.path = null; this.stuckT = 0; }
  }

  setPath(path) { this.path = path; this.pathI = 0; }
  stop() { this.speed = 0; this.sprite.body.setVelocity(0, 0); }
  destroy() { this.dead = true; this.sprite.destroy(); }
}

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.group = scene.physics.add.group();
  }

  spawn(n, nearX, nearY) {
    for (let i = 0; i < n; i++) {
      const p = randomRoadPoint(this.city, this.rng);
      const key = this.rng.chance(0.08) ? 'car-truck' : this.rng.pick(CAR_KEYS);
      const car = new Car(this.scene, p.x, p.y, key, { maxSpeed: 170 + this.rng.range(0, 60) });
      this.group.add(car.sprite);
      car.sprite.setRotation(this.rng.below(4) * Math.PI / 2);
      this.cars.push(car);
      this.retarget(car);
    }
  }

  spawnParked(x, y, key) {
    const car = new Car(this.scene, x, y, key, { maxSpeed: 380 });
    car.parked = true;
    this.group.add(car.sprite);
    this.cars.push(car);
    return car;
  }

  retarget(car) {
    const dest = randomRoadPoint(this.city, this.rng);
    car.setPath(findPath(this.city, car.sprite.x, car.sprite.y, dest.x, dest.y));
  }

  // Keep traffic near the player: respawn cars that drifted far away.
  maintain(playerX, playerY, want = 14) {
    for (const car of this.cars) {
      if (car.parked) continue;
      const d = Math.hypot(car.sprite.x - playerX, car.sprite.y - playerY);
      if (d > 1400) {
        const p = randomRoadPoint(this.city, this.rng);
        const a = Math.atan2(playerY - p.y, playerX - p.x);
        car.sprite.setPosition(playerX + Math.cos(a + Math.PI) * 900 + this.rng.range(-200, 200), playerY + Math.sin(a + Math.PI) * 900 + this.rng.range(-200, 200));
        this.retarget(car);
      }
    }
    while (this.cars.length < want) this.spawn(1, playerX, playerY);
  }

  update(dt, playerX, playerY) {
    for (const car of this.cars) {
      if (car.dead || car.isPlayer || car.parked) continue;
      if (!car.path) this.retarget(car);
      car.followPath(dt, other => this.blockedAhead(car));
    }
    this.maintain(playerX, playerY);
  }

  blockedAhead(car) {
    const fx = Math.cos(car.sprite.rotation), fy = Math.sin(car.sprite.rotation);
    for (const o of this.cars) {
      if (o === car || o.dead) continue;
      const dx = o.sprite.x - car.sprite.x, dy = o.sprite.y - car.sprite.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (ahead > 0 && ahead < 70 && side < 26) return true;
    }
    return false;
  }

  nearestCar(x, y, maxDist) {
    let best = null, bd = maxDist;
    for (const car of this.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.sprite.x - x, car.sprite.y - y);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  remove(car) {
    this.cars = this.cars.filter(c => c !== car);
    this.group.remove(car.sprite);
    car.destroy();
  }
}
