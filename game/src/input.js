// Named input actions (input-systems): gameplay reads actions, never raw keys.
// Actions: move (4-way), interact, attack, shoot, pause, sprint, horn, mute.
// Keyboard + mouse; mouse position is kept in world coordinates for aiming.
// Each action maps to one or more physical keys (explicit Key objects —
// Phaser's addKeys does not take comma lists per action).
export class Input {
  constructor(scene) {
    this.scene = scene;
    const k = scene.input.keyboard;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const key = code => k.addKey(code);
    this.map = {
      up: [key(K.W), key(K.UP)],
      down: [key(K.S), key(K.DOWN)],
      left: [key(K.A), key(K.LEFT)],
      right: [key(K.D), key(K.RIGHT)],
      interact: [key(K.E)],
      attack: [key(K.SPACE)],
      pause: [key(K.ESC), key(K.P)],
      sprint: [key(K.SHIFT)],
      horn: [key(K.H)],
      mute: [key(K.M)],
    };
    this.pointer = scene.input.activePointer;
    this._shootEdge = false;
    this._edges = new Set();
    // Edge detection via key events: Phaser's JustDown only sees a press if
    // the key is still down when the frame runs, so quick taps get lost.
    // A 'down' event per key records the action; justPressed() consumes it.
    for (const [action, keys] of Object.entries(this.map)) {
      for (const k of keys) k.on('down', () => this._edges.add(action));
    }
    scene.input.on('pointerdown', p => { if (p.leftButtonDown()) this._shootEdge = true; });
  }

  // Held state for continuous actions.
  moveVec() {
    const x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    const y = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len, active: x !== 0 || y !== 0 };
  }
  isDown(action) {
    return (this.map[action] ?? []).some(k => k.isDown);
  }
  justPressed(action) {
    if (this._edges.has(action)) { this._edges.delete(action); return true; }
    return false;
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
    this._edges.clear();
    this._shootEdge = false;
  }
}
