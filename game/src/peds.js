// Pedestrians for Solmar Heat — sidewalk walkers with a tiny FSM:
// walk (pick a nearby sidewalk point, stroll to it) -> flee (run from a crime
// or a speeding car) -> idle. They are kinematic (no physics bodies); cars
// and the player push through them by overlap checks in the scene.
import { isWalkable, randomRoadPoint, TILE } from './city.js';

export class Peds {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.list = [];
    this.group = scene.add.group();
    this.fleeX = null; this.fleeY = null; this.fleeUntil = 0;
  }

  spawn(n, nearX, nearY) {
    for (let i = 0; i < n; i++) {
      const key = 'person-ped-' + this.rng.below(6);
      const p = this.findSidewalk(nearX + this.rng.range(-500, 500), nearY + this.rng.range(-500, 500));
      const s = this.scene.add.image(p.x, p.y, key);
      s.setDepth(4);
      const ped = { sprite: s, state: 'walk', tx: p.x, ty: p.y, speed: 42 + this.rng.range(0, 26), wait: 0, down: 0 };
      this.group.add(s);
      this.list.push(ped);
      this.retarget(ped);
    }
  }

  findSidewalk(x, y) {
    for (let tries = 0; tries < 12; tries++) {
      const px = x + this.rng.range(-160, 160), py = y + this.rng.range(-160, 160);
      const t = this.scene.cityTileAt ? this.scene.cityTileAt(px, py) : 0;
      if (isWalkable(this.city, px, py)) return { x: px, y: py };
    }
    return { x, y };
  }

  retarget(ped) {
    const p = this.findSidewalk(ped.sprite.x, ped.sprite.y);
    ped.tx = p.x; ped.ty = p.y;
  }

  // Something scary happened at (x, y): nearby peds flee.
  scare(x, y) {
    this.fleeX = x; this.fleeY = y; this.fleeUntil = this.scene.time.now + 4000;
    for (const ped of this.list) {
      if (Math.hypot(ped.sprite.x - x, ped.sprite.y - y) < 320) ped.state = 'flee';
    }
  }

  update(dt, now) {
    for (const ped of this.list) {
      const s = ped.sprite;
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) { s.setAlpha(1); s.setAngle(0); ped.state = 'walk'; this.retarget(ped); }
        continue;
      }
      if (ped.state === 'flee') {
        const dx = s.x - this.fleeX, dy = s.y - this.fleeY;
        const d = Math.hypot(dx, dy) || 1;
        s.x += (dx / d) * 150 * dt; s.y += (dy / d) * 150 * dt;
        s.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
        if (now > this.fleeUntil || d > 420) ped.state = 'walk';
        continue;
      }
      if (ped.wait > 0) { ped.wait -= dt; if (ped.wait <= 0) this.retarget(ped); continue; }
      const dx = ped.tx - s.x, dy = ped.ty - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) { ped.wait = 1 + this.rng.next() * 3; continue; }
      const step = Math.min(ped.speed * dt, d);
      const nx = s.x + (dx / d) * step, ny = s.y + (dy / d) * step;
      if (isWalkable(this.city, nx, ny)) { s.x = nx; s.y = ny; }
      else this.retarget(ped);
      s.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    }
  }

  // A car hit this ped: knock down, add wanted heat (handled by the scene).
  knockDown(ped) {
    if (ped.down > 0) return false;
    ped.down = 5;
    ped.sprite.setAngle(90);
    ped.sprite.setAlpha(0.85);
    return true;
  }

  nearest(x, y, maxDist) {
    let best = null, bd = maxDist;
    for (const ped of this.list) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.sprite.x - x, ped.sprite.y - y);
      if (d < bd) { bd = d; best = ped; }
    }
    return best;
  }

  maintain(playerX, playerY, want = 22) {
    this.list = this.list.filter(p => {
      const d = Math.hypot(p.sprite.x - playerX, p.sprite.y - playerY);
      if (d > 1300) { p.sprite.destroy(); return false; }
      return true;
    });
    while (this.list.length < want) this.spawn(1, playerX, playerY);
  }
}
