// Shot modes for Solmar Heat — deterministic staged scenes for the entry
// screenshots (?shot=cover|chase|mission|street&seed=7). Each stages the world
// (player, cars, police, mission) then the scene signals window.__shotReady.
// These run only when the URL carries ?shot=; normal play is untouched.
import { TILE } from './city.js';

function skipDialogue(scene) {
  while (scene.missions.inDialogue) scene.missions.advanceDialogue();
}

function putPlayerInCar(scene, x, y, key, angle = 0) {
  const car = scene.traffic.spawnParked(x, y, key);
  car.sprite.setPosition(x, y);
  car.sprite.setRotation(angle);
  scene.playerSprite.setPosition(x, y);
  scene.player.x = x; scene.player.y = y;
  scene.enterCar(car);
  return car;
}

export function applyShot(scene, mode) {
  const city = scene.city;
  const g = city.landmarks;
  const downtown = { x: 48 * TILE, y: 48 * TILE };
  skipDialogue(scene);

  if (mode === 'cover') {
    // Leo driving a blue sedan down a downtown avenue, traffic ahead, HUD live.
    const car = putPlayerInCar(scene, downtown.x, downtown.y, 'car-blue', 0);
    car.speed = 240;
    car.sprite.body.setVelocity(240, 0);
    const t1 = scene.traffic.spawnParked(downtown.x + 320, downtown.y - 40, 'car-red');
    const t2 = scene.traffic.spawnParked(downtown.x + 520, downtown.y + 40, 'car-orange');
    const t3 = scene.traffic.spawnParked(downtown.x - 260, downtown.y + 40, 'car-green');
    for (const t of [t1, t2, t3]) { t.parked = false; t.setPath([{ x: downtown.x + 900, y: t.sprite.y }]); }
    scene.cameras.main.setZoom(0.9);
  } else if (mode === 'chase') {
    // Three stars: SBPD cars closing in behind Leo on the avenue.
    const car = putPlayerInCar(scene, downtown.x, downtown.y, 'car-sport', 0);
    car.speed = 320;
    scene.police.addHeat(55, scene.time.now);
    for (let i = 0; i < 3; i++) {
      const u = scene.police.spawnUnit(scene.player.x, scene.player.y, 'car');
      u.state = 'chase';
      u.car.sprite.setPosition(downtown.x - 260 - i * 90, downtown.y + (i - 1) * 70);
      u.car.sprite.setRotation(0);
      u.car.speed = 300;
    }
    scene.cameras.main.setZoom(0.9);
  } else if (mode === 'mission') {
    // The Big Score: Leo on foot at Bay National Bank, rivals closing in.
    scene.missions.start(4);
    skipDialogue(scene);
    scene.playerSprite.setPosition(g.bank.x, g.bank.y + 90);
    scene.player.x = g.bank.x; scene.player.y = g.bank.y + 90;
    scene.police.addHeat(30, scene.time.now);
    for (let i = 0; i < 2; i++) {
      const e = scene.combat.spawnEnemy(g.bank.x + 140 + i * 60, g.bank.y - 40 + i * 40, 'rival');
      scene.combatEnemyGroup().add(e.sprite);
    }
    scene.cameras.main.setZoom(1);
  } else if (mode === 'street') {
    // On foot downtown: peds, traffic, the city at golden hour.
    scene.missions.start(1);
    skipDialogue(scene);
    const plaza = { x: 48 * TILE, y: 48 * TILE };
    scene.playerSprite.setPosition(plaza.x, plaza.y);
    scene.player.x = plaza.x; scene.player.y = plaza.y;
    scene.peds.spawn(10, plaza.x, plaza.y);
    scene.cameras.main.setZoom(1);
  }
}
