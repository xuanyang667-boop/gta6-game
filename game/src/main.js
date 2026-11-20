// Solmar Heat — Phaser bootstrap.
// One game, 1280x720, scale FIT, Arcade physics with no gravity (top-down).
// Scenes: boot (textures + city) -> menu (DOM title) -> play (the world).
// The game exposes window.__shotReady for screenshot tooling (?shot= modes)
// and window.__game for debugging.
import { BootScene, MenuScene } from './scenes.js';
import { PlayScene } from './play.js';

window.__shotReady = false;

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0b0e1a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, MenuScene, PlayScene],
};

const game = new Phaser.Game(config);
window.game = game;
