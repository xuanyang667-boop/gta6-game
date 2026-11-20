// Combat for Solmar Heat — pooled bullets, player shooting (mouse aim) and
// melee, plus simple enemy shooters (rival gang, and police at 3+ stars).
// Enemies are kinematic sprites with health; bullets are physics bodies so
// they collide with buildings through the scene's collider.
import { isWalkable } from './city.js';

export class Combat {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.bullets = scene.physics.add.group({ defaultKey: 'bullet', maxSize: 48 });
    this.enemies = []; // {sprite, hp, kind, shootT, speed, target}
    this.lastShot = 0;
    this.lastMelee = 0;
    this.onKill = null; // set by the scene: (enemy) => void
  }

  fire(x, y, angle, speed, owner, damage = 25) {
    const b = this.bullets.get(x, y);
    if (!b) return;
    b.enableBody(true, x, y, true, true);
    b.setRotation(angle);
    b.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    b.setData('owner', owner);
    b.setData('damage', damage);
    b.setDepth(6);
    this.scene.time.delayedCall(900, () => { if (b.active) b.disableBody(true, true); });
  }

  // Player pistol: rate-limited, aimed at the mouse.
  playerShoot(x, y, angle, now) {
    if (now - this.lastShot < 170) return false;
    this.lastShot = now;
    this.fire(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, angle, 640, 'player', 25);
    return true;
  }

  // Player punch: short arc in front, hits enemies and peds.
  playerMelee(x, y, angle, now) {
    if (now - this.lastMelee < 380) return false;
    this.lastMelee = now;
    const fx = Math.cos(angle), fy = Math.sin(angle);
    let hit = false;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.sprite.x - x, dy = e.sprite.y - y;
      const d = Math.hypot(dx, dy);
      if (d < 46 && (dx * fx + dy * fy) / (d || 1) > 0.3) {
        this.damageEnemy(e, 22, x, y);
        hit = true;
      }
    }
    return hit;
  }

  spawnEnemy(x, y, kind = 'rival') {
    const key = kind === 'cop' ? 'person-cop' : 'person-rival';
    const s = this.scene.physics.add.sprite(x, y, key);
    s.setDepth(5);
    s.body.setSize(18, 22);
    const e = { sprite: s, hp: 60, kind, shootT: 800 + Math.random() * 800, speed: 150 };
    this.enemies.push(e);
    return e;
  }

  damageEnemy(e, dmg, fromX, fromY) {
    e.hp -= dmg;
    const dx = e.sprite.x - fromX, dy = e.sprite.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    e.sprite.x += (dx / d) * 10; e.sprite.y += (dy / d) * 10;
    e.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => e.sprite.clearTint());
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.sprite.setTint(0x888888);
    e.sprite.setAngle(90);
    e.hp = 0;
    if (this.onKill) this.onKill(e);
    this.scene.time.delayedCall(1200, () => {
      e.sprite.destroy();
      this.enemies = this.enemies.filter(x => x !== e);
    });
  }

  // Enemies walk toward the player and shoot in range.
  update(dt, now, px, py, playerAlive) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const s = e.sprite;
      const dx = px - s.x, dy = py - s.y;
      const d = Math.hypot(dx, dy);
      if (d > 420) {
        s.body.setVelocity((dx / d) * e.speed, (dy / d) * e.speed);
      } else if (d > 240) {
        s.body.setVelocity((dx / d) * e.speed * 0.5, (dy / d) * e.speed * 0.5);
      } else {
        s.body.setVelocity(0, 0);
        e.shootT -= dt * 1000;
        if (e.shootT <= 0 && playerAlive) {
          e.shootT = 1100 + Math.random() * 600;
          const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.22;
          this.fire(s.x, s.y, a, 420, 'enemy', 8);
        }
      }
      s.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    }
    // Bullets die on walls.
    for (const b of this.bullets.getChildren()) {
      if (!b.active) continue;
      if (!isWalkable(this.city, b.x, b.y)) {
        this.scene.fxSpark?.(b.x, b.y);
        b.disableBody(true, true);
      }
    }
  }

  clear() {
    for (const e of this.enemies) e.sprite.destroy();
    this.enemies = [];
    this.bullets.clear(true, true);
  }
}
