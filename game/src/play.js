// PlayScene for Solmar Heat — the open world: city, player, cars, traffic,
// pedestrians, police, combat, missions, HUD, camera, save, and shot modes.
// Simulation state lives in plain objects (this.game); Phaser only draws it
// and runs the physics bodies. DOM handles the HUD and menus.
import { TILE, WORLD_PX, generateCity, isWalkable, tileAt } from './city.js';
import { Rng } from './rng.js';
import { Input } from './input.js';
import { Traffic, Car } from './cars.js';
import { Peds } from './peds.js';
import { Police, heatToStars } from './police.js';
import { Combat } from './combat.js';
import { MissionEngine } from './missions.js';
import { Hud } from './hud.js';
import { writeSave, readSave } from './save.js';
import { applyShot } from './shots.js';

const PLAYER_SPEED = 230;
const PLAYER_SPRINT = 320;

export class PlayScene extends Phaser.Scene {
  constructor() { super('play'); }

  init(data) { this.startData = data; }

  create() {
    this.rng = new Rng(this.registry.get('seed'));
    this.city = this.registry.get('city');
    this.audio = this.registry.get('audio');
    this.hud = this.registry.get('hud');
    this.input2 = new Input(this);
    this.game = this.freshGame();
    if (!this.startData.fresh) this.loadGame();

    this.buildWorld();
    this.traffic = new Traffic(this, this.city, this.rng);
    this.trafficGroup = this.traffic.group;
    this.peds = new Peds(this, this.city, this.rng);
    this.buildPlayer();
    Police.Car = Car;
    this.police = new Police(this, this.city, this.rng);
    this.combat = new Combat(this, this.city);
    this.combat.onKill = e => this.onEnemyKilled(e);
    this.missions = new MissionEngine({
      onDialogue: line => this.hud.showDialogue(line),
      onStep: (m, s) => this.setupMissionStep(m, s),
      onMissionComplete: m => this.onMissionComplete(m),
      onMissionFailed: (m, reason) => { this.hud.toast(reason); this.audio.busted(); },
      onTailProgress: () => {},
    });
    this.setupColliders();
    this.setupCamera();
    this.setupMarkers();
    this.hud.show();
    this.hud.update(this.game, this.playerView(), this.missions, 0);
    // Start the first mission only after markers exist (setupMissionStep
    // positions them).
    this.missions.start(this.game.missionIndex);

    // Shot mode (for the entry screenshots): stage a scene, then signal ready.
    const params = new URLSearchParams(window.location.search);
    this.shotMode = params.get('shot');
    if (this.shotMode) {
      applyShot(this, this.shotMode);
      this.time.delayedCall(1200, () => { window.__shotReady = true; });
    }
    window.__game = this;
    this.lastSaveT = 0;
  }

  freshGame() {
    return {
      seed: this.registry.get('seed'), money: 200, health: 100,
      missionIndex: 0, completedMissions: [],
      playerX: 0, playerY: 0, stats: { carsStolen: 0, kills: 0, cashEarned: 0, missionsDone: 0 },
      settings: { music: 0.5, sfx: 0.8, muted: false },
      missionTarget: null, policeDots: [], enemyDots: [], wantedStars: 0,
    };
  }

  loadGame() {
    const s = readSave();
    if (!s) return;
    this.game.money = s.money;
    this.game.health = s.health;
    this.game.missionIndex = s.missionIndex;
    this.game.completedMissions = s.completedMissions ?? [];
    this.game.playerX = s.player?.x ?? 0;
    this.game.playerY = s.player?.y ?? 0;
    this.game.stats = { ...this.game.stats, ...(s.stats ?? {}) };
    this.game.settings = { ...this.game.settings, ...(s.settings ?? {}) };
  }

  // ---- World ----
  buildWorld() {
    const rows = [];
    for (let y = 0; y < 96; y++) {
      const row = [];
      for (let x = 0; x < 96; x++) row.push(this.city.grid[y * 96 + x] + 1);
      rows.push(row);
    }
    const map = this.make.tilemap({ data: rows, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles');
    map.createLayer(0, tileset, 0, 0).setDepth(0);

    this.buildingGroup = this.physics.add.staticGroup();
    for (const b of this.city.buildings) {
      const img = this.buildingGroup.create(b.x + b.w / 2, b.y + b.h / 2, 'roof-' + b.roof);
      img.setDisplaySize(b.w, b.h);
      img.setTint(b.tint);
      img.refreshBody();
    }
    // Landmark signs (drawn above roofs).
    this.landmarkTexts = [];
    for (const [key, lm] of Object.entries(this.city.landmarks)) {
      const t = this.add.text(lm.x, lm.y, lm.label, { fontSize: '13px', color: '#fff', backgroundColor: 'rgba(8,10,24,0.75)', padding: { x: 5, y: 3 } });
      t.setOrigin(0.5).setDepth(3);
      this.landmarkTexts.push(t);
    }
    this.worldBounds = { w: WORLD_PX, h: WORLD_PX };
  }

  buildPlayer() {
    const g = this.city.landmarks.garage;
    const sx = this.game.playerX || g.x, sy = this.game.playerY || g.y + 60;
    this.playerSprite = this.physics.add.sprite(sx, sy, 'person-player');
    this.playerSprite.setDepth(5);
    this.playerSprite.body.setSize(18, 22);
    this.playerSprite.setCollideWorldBounds(true);
    this.player = { x: sx, y: sy, angle: Math.PI / 2, inCar: false, car: null, carSpeed: 0, speed: 0 };
    this.physics.world.setBounds(0, 0, WORLD_PX, WORLD_PX);
    this.traffic.spawn(12, sx, sy);
    this.peds.spawn(18, sx, sy);
  }

  setupColliders() {
    this.physics.add.collider(this.playerSprite, this.buildingGroup);
    this.physics.add.collider(this.trafficGroup, this.buildingGroup);
    this.physics.add.collider(this.trafficGroup, this.trafficGroup);
    this.physics.add.collider(this.playerSprite, this.trafficGroup);
    // Bullets vs enemies and vs the player.
    this.physics.add.overlap(this.combat.bullets, this.combatEnemyGroup(), (bullet, enemy) => {
      if (bullet.getData('owner') !== 'player') return;
      bullet.disableBody(true, true);
      const e = this.combat.enemies.find(x => x.sprite === enemy);
      if (e) this.combat.damageEnemy(e, bullet.getData('damage'), this.player.x, this.player.y);
    });
    this.physics.add.overlap(this.combat.bullets, this.playerSprite, bullet => {
      if (bullet.getData('owner') !== 'enemy') return;
      bullet.disableBody(true, true);
      this.damagePlayer(bullet.getData('damage'));
    });
  }

  combatEnemyGroup() {
    if (!this.enemyGroup) this.enemyGroup = this.physics.add.group();
    return this.enemyGroup;
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_PX, WORLD_PX);
    this.focus = this.add.image(this.player.x, this.player.y, 'dot').setVisible(false);
    cam.startFollow(this.focus, false, 0.12, 0.12);
    cam.setDeadzone(70, 50);
    cam.setZoom(1);
  }

  setupMarkers() {
    this.marker = this.add.image(0, 0, 'marker').setDepth(7).setVisible(false);
    this.ring = this.add.image(0, 0, 'ring').setDepth(2).setVisible(false);
    this.tweens.add({ targets: this.marker, y: '-=10', duration: 700, yoyo: true, repeat: -1 });
    this.arrow = this.add.image(640, 60, 'marker').setDepth(8).setVisible(false).setScrollFactor(0);
    this.arrow.setScale(0.7);
  }

  // ---- Missions ----
  setupMissionStep(mission, step) {
    if (!step) return;
    const lm = step.at ? this.city.landmarks[step.at] : null;
    this.game.missionTarget = lm ? { x: lm.x, y: lm.y } : null;
    if (lm) {
      this.marker.setPosition(lm.x, lm.y - 30).setVisible(true);
      this.ring.setPosition(lm.x, lm.y).setVisible(true);
    } else {
      this.marker.setVisible(false);
      this.ring.setVisible(false);
    }
    // Mission-specific staging.
    if (mission.id === 'first-wheels' && step.type === 'goto') {
      const plaza = this.city.landmarks.plaza;
      this.parkedCar = this.traffic.spawnParked(plaza.x + 40, plaza.y + 40, 'car-blue');
      this.game.missionTarget = { x: plaza.x + 40, y: plaza.y + 40 };
      this.marker.setPosition(plaza.x + 40, plaza.y + 10).setVisible(true);
      this.ring.setPosition(plaza.x + 40, plaza.y + 40).setVisible(true);
    }
    if (mission.id === 'getaway' && step.type === 'escape') {
      this.police.addHeat(35, this.time.now);
    }
    if (mission.id === 'the-big-score' && step.type === 'escape') {
      this.police.addHeat(55, this.time.now);
    }
    if (mission.id === 'tail-the-viper' && step.type === 'tail') {
      this.tailCar = this.spawnTailCar();
    }
    if (mission.id === 'king-of-the-bay' && step.type === 'defend') {
      this.spawnWave(4);
    }
    if (mission.id === 'king-of-the-bay' && step.type === 'kill') {
      this.spawnBoss();
    }
  }

  spawnTailCar() {
    const g = this.city.landmarks.bank;
    const car = new Car(this, g.x + 120, g.y, 'car-sport', { maxSpeed: 200, accel: 200, kind: 'tail' });
    this.trafficGroup.add(car.sprite);
    this.traffic.cars.push(car);
    car.setPath(this.loopPath(car.sprite.x, car.sprite.y));
    return car;
  }

  loopPath(x, y) {
    // A loop around downtown: four corners, then back.
    const pts = [
      { x: 40 * TILE, y: 40 * TILE }, { x: 60 * TILE, y: 40 * TILE },
      { x: 60 * TILE, y: 56 * TILE }, { x: 40 * TILE, y: 56 * TILE },
    ];
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
    const path = [];
    for (let i = 0; i < 4; i++) path.push(pts[(best + i) % 4]);
    return path;
  }

  spawnWave(n) {
    const g = this.city.landmarks.garage;
    for (let i = 0; i < n; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const x = g.x + Math.cos(a) * (200 + this.rng.range(0, 200));
      const y = g.y + Math.sin(a) * (200 + this.rng.range(0, 200));
      const e = this.combat.spawnEnemy(x, y, 'rival');
      this.combatEnemyGroup().add(e.sprite);
    }
  }

  spawnBoss() {
    const g = this.city.landmarks.garage;
    const e = this.combat.spawnEnemy(g.x + 160, g.y - 80, 'rival');
    e.hp = 220; e.speed = 175; e.boss = true;
    e.sprite.setTint(0xffd23e);
    this.combatEnemyGroup().add(e.sprite);
    this.hud.banner('DARIO VOSS', 'Take him down!', 3000);
  }

  onEnemyKilled(e) {
    this.missions.registerKill();
    this.game.stats.kills++;
    this.game.money += 25;
    this.audio.cash();
    if (e.boss) this.hud.banner('DARIO IS DOWN', '', 3000);
    if (this.missions.step?.type === 'defend' && this.missions.kills < 8) {
      this.spawnWave(2);
    }
  }

  onMissionComplete(mission) {
    this.game.money += mission.reward;
    this.game.stats.cashEarned += mission.reward;
    this.game.stats.missionsDone++;
    this.game.completedMissions.push(mission.id);
    this.game.missionIndex++;
    this.audio.mission();
    this.hud.banner('MISSION COMPLETE', `${mission.title}  ·  +$${mission.reward}`, 3200);
    writeSave(this.game);
    if (this.missions.done) {
      this.hud.showMenu(this.hud.endScreen());
      document.getElementById('btn-freeroam')?.addEventListener('click', () => { this.audio.click(); this.hud.hideMenu(); });
      document.getElementById('btn-title')?.addEventListener('click', () => { this.audio.click(); this.scene.start('menu'); });
      return;
    }
    this.missions.start(this.game.missionIndex);
  }

  // ---- Player ----
  damagePlayer(dmg) {
    if (this.player.inCar) return;
    this.game.health = Math.max(0, this.game.health - dmg);
    this.cameras.main.shake(120, 0.01);
    if (this.game.health <= 0) this.wasted();
  }

  wasted() { this.gameOver('wasted'); }
  busted() { this.gameOver('busted'); }

  gameOver(kind) {
    const lost = Math.max(50, Math.floor(this.game.money * 0.15));
    this.game.money -= lost;
    this.game.health = 100;
    this.police.clear();
    this.combat.clear();
    this.missions.start(this.game.missionIndex); // restart current mission
    const h = this.city.landmarks.hospital;
    this.exitCar(true);
    this.playerSprite.setPosition(h.x, h.y + 60);
    this.player.x = h.x; this.player.y = h.y + 60;
    this.audio.busted();
    this.hud.showMenu(this.hud.overScreen(kind, lost));
    document.getElementById('btn-respawn')?.addEventListener('click', () => {
      this.audio.click();
      this.hud.hideMenu();
      writeSave(this.game);
    });
  }

  enterCar(car) {
    this.player.inCar = true;
    this.player.car = car;
    car.isPlayer = true;
    car.parked = false;
    this.playerSprite.setVisible(false);
    this.playerSprite.body.enable = false;
    this.audio.engineStart();
    if (car.kind === 'traffic' || car.kind === 'parked') {
      this.police.addHeat(15, this.time.now);
      this.game.stats.carsStolen++;
      this.hud.toast('Car stolen! The owner called the police.');
      this.peds.scare(this.player.x, this.player.y);
    }
  }

  exitCar(silent = false) {
    const car = this.player.car;
    if (!car) return;
    car.isPlayer = false;
    car.stop();
    const a = car.sprite.rotation + Math.PI / 2;
    const x = car.sprite.x + Math.cos(a) * 34, y = car.sprite.y + Math.sin(a) * 34;
    this.playerSprite.setPosition(x, y);
    this.playerSprite.setVisible(true);
    this.playerSprite.body.enable = true;
    this.player.x = x; this.player.y = y;
    this.player.inCar = false;
    this.player.car = null;
    this.audio.engineStop();
  }

  playerView() {
    return { x: this.player.x, y: this.player.y, angle: this.player.angle, inCar: this.player.inCar, carSpeed: this.player.carSpeed };
  }

  // ---- Update ----
  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    const now = time;
    if (this.paused) return;

    // Pause toggle.
    if (this.input2.justPressed('pause')) { this.togglePause(); return; }
    if (this.input2.justPressed('mute')) {
      this.audio.setMuted(!this.audio.muted);
      this.hud.toast(this.audio.muted ? 'Sound muted' : 'Sound on');
    }

    // Dialogue blocks play.
    if (this.missions.inDialogue) {
      if (this.input2.justPressed('interact') || this.input2.shootPressed()) {
        this.audio.click();
        this.missions.advanceDialogue();
      }
      return;
    }

    this.updatePlayer(dt, now);
    this.traffic.update(dt, this.player.x, this.player.y);
    this.peds.update(dt, now);
    this.peds.maintain(this.player.x, this.player.y);
    this.police.update(dt, now, this.player.x, this.player.y, this.player.carSpeed, this.player.inCar);
    this.combat.update(dt, now, this.player.x, this.player.y, !this.player.inCar);
    this.updateCrime(dt, now);
    this.updateMission(dt, now);
    this.updateCamera(dt);
    this.updateHudDots();
    this.game.wantedStars = this.police.stars;
    this.audio.intensity = this.police.stars >= 2 ? 1 : 0;
    if (this.police.stars >= 2) this.audio.sirenStart(); else this.audio.sirenStop();
    this.hud.update(this.game, this.playerView(), this.missions, dt);
    this.input2.endFrame();
  }

  updatePlayer(dt, now) {
    const mv = this.input2.moveVec();
    const aim = this.input2.aimWorld(this.cameras.main);
    if (this.player.inCar) {
      const car = this.player.car;
      let throttle = mv.y < 0 ? 1 : mv.y > 0 ? -0.7 : 0;
      let steer = mv.x;
      // In shot mode the car drives itself so staged shots show motion.
      if (this.shotMode) { throttle = 1; steer = 0; }
      car.drive(throttle, steer, dt);
      this.player.x = car.sprite.x; this.player.y = car.sprite.y;
      this.player.angle = car.sprite.rotation;
      this.player.carSpeed = car.speed;
      this.audio.engineSet(Math.abs(car.speed) / car.maxSpeed);
      if (this.input2.justPressed('interact')) this.exitCar();
      if (this.input2.justPressed('horn')) this.audio.horn();
      if (this.input2.justPressed('attack')) this.audio.horn();
      // Skid marks at hard turns.
      if (Math.abs(steer) > 0.7 && Math.abs(car.speed) > 260 && Math.random() < 0.4) {
        this.skid(car.sprite.x, car.sprite.y, car.sprite.rotation);
      }
    } else {
      const speed = this.input2.isDown('sprint') ? PLAYER_SPRINT : PLAYER_SPEED;
      const body = this.playerSprite.body;
      body.setVelocity(mv.x * speed, mv.y * speed);
      this.player.speed = Math.hypot(body.velocity.x, body.velocity.y);
      this.player.x = this.playerSprite.x;
      this.player.y = this.playerSprite.y;
      // Face movement, or the mouse when shooting.
      if (this.input2.shootHeld()) {
        this.player.angle = Math.atan2(aim.y - this.player.y, aim.x - this.player.x);
      } else if (mv.active) {
        this.player.angle = Math.atan2(mv.y, mv.x);
      }
      this.playerSprite.setRotation(this.player.angle + Math.PI / 2);
      this.player.carSpeed = 0;
      if (this.input2.justPressed('interact')) this.tryInteract(now);
      if (this.input2.shootPressed()) {
        if (this.combat.playerShoot(this.player.x, this.player.y, this.player.angle, now)) {
          this.audio.shoot();
          this.police.addHeat(4, now);
          this.flashMuzzle();
        }
      }
      if (this.input2.justPressed('attack')) {
        if (this.combat.playerMelee(this.player.x, this.player.y, this.player.angle, now)) {
          this.audio.punch();
        }
      }
    }
    // Health regen out of combat.
    if (now - (this.lastHurtT ?? 0) > 10000 && this.game.health < 100 && !this.player.inCar) {
      this.game.health = Math.min(100, this.game.health + 2 * dt);
    }
  }

  tryInteract(now) {
    // Steal the nearest car.
    const car = this.traffic.nearestCar(this.player.x, this.player.y, 64);
    if (car && !car.isPlayer) {
      this.enterCar(car);
      return;
    }
    // Pick up / mission interact is checked by the mission engine via flag.
    this.interactPressed = true;
  }

  updateCrime(dt, now) {
    // Player car hitting pedestrians.
    if (this.player.inCar) {
      const car = this.player.car;
      const ped = this.peds.nearest(this.player.x, this.player.y, 34);
      if (ped && Math.abs(car.speed) > 140) {
        if (this.peds.knockDown(ped)) {
          this.police.addHeat(15, now);
          this.peds.scare(this.player.x, this.player.y);
          this.audio.crash();
        }
      }
    }
    // Busted: a foot cop touches the player on foot while wanted.
    if (!this.player.inCar && this.police.stars >= 1) {
      const { dist } = this.police.nearest(this.player.x, this.player.y);
      if (dist < 30 && this.player.speed < 60) this.busted();
    }
    // Police cars ramming the player car damage it.
    if (this.player.inCar) {
      for (const u of this.police.units) {
        if (u.kind !== 'car') continue;
        const d = Math.hypot(u.car.sprite.x - this.player.x, u.car.sprite.y - this.player.y);
        if (d < 40 && Math.abs(u.car.speed) > 100) {
          this.player.car.health -= 8 * dt * 10;
          if (this.player.car.health <= 0) {
            this.explodeCar(this.player.car);
            this.exitCar(true);
            this.damagePlayer(20);
          }
        }
      }
    }
  }

  explodeCar(car) {
    const { x, y } = car.sprite;
    this.cameras.main.shake(250, 0.02);
    this.audio.crash();
    const p = this.add.particles(x, y, 'dot', {
      speed: { min: 80, max: 260 }, angle: { min: 0, max: 360 },
      scale: { start: 2.4, end: 0 }, lifespan: 700, quantity: 24, tint: [0xffa63d, 0xff3b30, 0xffd23e],
    });
    this.time.delayedCall(800, () => p.destroy());
    this.traffic.remove(car);
  }

  updateMission(dt, now) {
    const w = {
      playerX: this.player.x, playerY: this.player.y,
      inCar: this.player.inCar, wantedStars: this.police.stars,
      interactPressed: this.interactPressed,
      landmark: key => this.city.landmarks[key],
      tailTarget: this.tailCar ? { x: this.tailCar.sprite.x, y: this.tailCar.sprite.y } : null,
    };
    this.interactPressed = false;
    this.missions.update(dt, w);
    const step = this.missions.step;
    if (step?.at) {
      const lm = this.city.landmarks[step.at];
      if (lm) {
        this.game.missionTarget = { x: lm.x, y: lm.y };
        this.marker.setPosition(lm.x, lm.y - 30).setVisible(true);
        this.ring.setPosition(lm.x, lm.y).setVisible(true);
      }
    } else if (step?.type === 'tail' && this.tailCar) {
      this.game.missionTarget = { x: this.tailCar.sprite.x, y: this.tailCar.sprite.y };
      this.marker.setPosition(this.tailCar.sprite.x, this.tailCar.sprite.y - 30).setVisible(true);
      this.ring.setVisible(false);
    } else if (step?.type === 'defend' || step?.type === 'kill') {
      const g = this.city.landmarks.garage;
      this.game.missionTarget = { x: g.x, y: g.y };
      this.marker.setPosition(g.x, g.y - 30).setVisible(true);
      this.ring.setPosition(g.x, g.y).setVisible(true);
    }
    // Off-screen arrow toward the mission target.
    const t = this.game.missionTarget;
    if (t && !this.missions.inDialogue) {
      const cam = this.cameras.main;
      const sx = (t.x - cam.scrollX) * cam.zoom, sy = (t.y - cam.scrollY) * cam.zoom;
      const vw = cam.width, vh = cam.height;
      if (sx < 0 || sx > vw || sy < 0 || sy > vh) {
        const cx = Math.max(40, Math.min(vw - 40, sx));
        const cy = Math.max(40, Math.min(vh - 40, sy));
        this.arrow.setPosition(cx, cy).setVisible(true);
        this.arrow.setRotation(Math.atan2(sy - cy, sx - cx) + Math.PI / 2);
      } else this.arrow.setVisible(false);
    } else this.arrow.setVisible(false);
  }

  updateCamera(dt) {
    const look = 0.35;
    const tx = this.player.x + Math.cos(this.player.angle) * this.player.carSpeed * look * 0.4;
    const ty = this.player.y + Math.sin(this.player.angle) * this.player.carSpeed * look * 0.4;
    const t = 1 - Math.exp(-6 * dt);
    this.focus.x += (tx - this.focus.x) * t;
    this.focus.y += (ty - this.focus.y) * t;
    let targetZoom = this.player.inCar ? 0.85 : 1;
    // Shot mode overrides the zoom for a tighter frame on the action.
    if (this.shotMode && this.shotZoom) targetZoom = this.shotZoom;
    const zoom = this.cameras.main.zoom + (targetZoom - this.cameras.main.zoom) * t;
    this.cameras.main.setZoom(zoom);
  }

  updateHudDots() {
    this.game.policeDots = this.police.units.map(u => {
      const p = u.kind === 'car' ? u.car.sprite : u.sprite;
      return { x: p.x, y: p.y };
    });
    this.game.enemyDots = this.combat.enemies.filter(e => e.hp > 0).map(e => ({ x: e.sprite.x, y: e.sprite.y }));
  }

  skid(x, y, angle) {
    const m = this.add.image(x, y, 'dot').setDepth(1).setScale(1.4, 0.5).setRotation(angle).setAlpha(0.35).setTint(0x111111);
    this.tweens.add({ targets: m, alpha: 0, duration: 4000, onComplete: () => m.destroy() });
  }

  flashMuzzle() {
    const m = this.add.image(this.player.x + Math.cos(this.player.angle) * 22, this.player.y + Math.sin(this.player.angle) * 22, 'muzzle').setDepth(7);
    m.setRotation(this.player.angle);
    this.time.delayedCall(60, () => m.destroy());
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.world.pause();
      this.hud.showMenu(this.hud.pauseScreen());
      document.getElementById('btn-resume')?.addEventListener('click', () => this.togglePause());
      document.getElementById('btn-restart')?.addEventListener('click', () => {
        this.hud.hideMenu();
        this.paused = false;
        this.physics.world.resume();
        this.missions.start(this.game.missionIndex);
      });
      document.getElementById('btn-quit')?.addEventListener('click', () => {
        writeSave(this.game);
        this.scene.start('menu');
      });
      document.getElementById('vol-music')?.addEventListener('input', e => this.audio.setMusicVol(e.target.value / 100));
      document.getElementById('vol-sfx')?.addEventListener('input', e => this.audio.setSfxVol(e.target.value / 100));
    } else {
      this.physics.world.resume();
      this.hud.hideMenu();
    }
  }

  // fxSpark is called by combat when a bullet hits a wall.
  fxSpark(x, y) {
    const s = this.add.image(x, y, 'dot').setDepth(7).setTint(0xffe66d).setScale(1.6);
    this.time.delayedCall(90, () => s.destroy());
  }
}
