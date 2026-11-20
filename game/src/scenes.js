// Boot and menu scenes for Solmar Heat.
// Boot: generates all procedural art and the seeded city, then hands to Menu.
// Menu: DOM title screen (new game / continue / how to play); starts Play.
import { generateCity } from './city.js';
import { generateAll } from './assets.js';
import { AudioSys } from './audio.js';
import { Hud } from './hud.js';
import { hasSave } from './save.js';

export function getSeed() {
  const params = new URLSearchParams(window.location.search);
  const s = Number(params.get('seed'));
  return Number.isFinite(s) && s > 0 ? s : 7;
}

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    generateAll(this);
    const seed = getSeed();
    const city = generateCity(seed);
    this.registry.set('seed', seed);
    this.registry.set('city', city);
    this.registry.set('audio', new AudioSys());
    document.getElementById('loading')?.remove();
    this.scene.start('menu');
  }
}

export class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    this.hud = new Hud(this, this.registry.get('city'));
    this.registry.set('hud', this.hud);
    this.audio = this.registry.get('audio');
    // Shot mode (?shot=...): skip the title screen and go straight into play
    // so screenshot tooling can stage a scene without a click.
    const params = new URLSearchParams(window.location.search);
    if (params.get('shot')) {
      this.scene.start('play', { fresh: true });
      return;
    }
    this.showStart();
  }

  showStart() {
    this.hud.showMenu(this.hud.startScreen(hasSave()));
    this.bind('btn-new', () => { this.hud.hideMenu(); this.scene.start('play', { fresh: true }); });
    this.bind('btn-continue', () => { this.hud.hideMenu(); this.scene.start('play', { fresh: false }); });
    this.bind('btn-how', () => {
      this.hud.showMenu(this.hud.howScreen());
      this.bind('btn-back', () => this.showStart());
    });
  }

  bind(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { this.audio.unlock(); this.audio.click(); fn(); });
  }
}
