// Named input actions (input-systems): gameplay reads actions, never raw keys.
// Actions: move (4-way), interact, attack, shoot, pause, sprint, horn, mute.
// Keyboard + mouse; mouse position is kept in world coordinates for aiming.
export class Input {
  constructor(scene) {
    this.scene = scene;
    const k = scene.input.keyboard;
    this.keys = k.addKeys({
      up: 'W,UP', down: 'S,DOWN', left: 'A,LEFT', right: 'D,RIGHT',
      interact: 'E', attack: 'SPACE', pause: 'ESC,P', sprint: 'SHIFT', horn: 'H', mute: 'M',
    });
    this.pointer = scene.input.activePointer;
    this._shootEdge = false;
    scene.input.on('pointerdown', p => { if (p.leftButtonDown()) this._shootEdge = true; });
  }

  // Held state for continuous actions.
  moveVec() {
    const x = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const y = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len, active: x !== 0 || y !== 0 };
  }
  isDown(action) {
    return !!this.keys[action]?.isDown;
  }
  justPressed(action) {
    const key = this.keys[action];
    return key ? Phaser.Input.Keyboard.JustDown(key) : false;
  }
  // Mouse aim in world coordinates.
  aimWorld(camera) {
    return { x: this.pointer.worldX, y: this.pointer.worldY };
  }
  shootPressed() {
    const v = this._shootEdge || this.pointer.leftButtonDown();
    this._shootEdge = false;
    return v;
  }
  shootHeld() {
    return this.pointer.leftButtonDown();
  }
  // Call once per frame after the scene read the edge flags.
  endFrame() {
    this._shootEdge = false;
  }
}
