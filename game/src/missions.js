// Missions and story for Solmar Heat — six jobs for Leo Marlow, from stealing
// his first car to taking Solmar Bay from the Viper gang. Each mission is data:
// briefing dialogue, steps, reward. The engine checks steps against the world
// the scene hands it each frame and emits events the scene turns into HUD,
// markers and dialogue.
export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', giver: 'Mama Rosa', reward: 150,
    briefing: [
      { who: 'Mama Rosa', line: "Leo, you're back in Solmar Bay. Good. My garage needs a driver, not a dreamer." },
      { who: 'Mama Rosa', line: "There's a sedan parked by the plaza. Take it — nobody in this town locks their doors." },
      { who: 'Leo', line: 'Borrow it, you mean.' },
      { who: 'Mama Rosa', line: 'Bring it to my garage and we will call it borrowed.' },
    ],
    steps: [
      { type: 'goto', at: 'plaza', r: 90, text: 'Go to the parked car by the plaza' },
      { type: 'enterCar', text: 'Get in the car (press E)' },
      { type: 'driveTo', at: 'garage', r: 110, text: 'Drive it to Rosa\'s Garage' },
    ],
  },
  {
    id: 'the-pickup', title: 'The Pickup', giver: 'Mama Rosa', reward: 300,
    briefing: [
      { who: 'Mama Rosa', line: 'A crate came in at the marina. Pick it up and bring it to the diner. No questions.' },
      { who: 'Leo', line: 'What is in the crate?' },
      { who: 'Mama Rosa', line: 'Dinner, Leo. Very expensive dinner. Drive careful.' },
    ],
    steps: [
      { type: 'driveTo', at: 'marina', r: 110, text: 'Drive to the marina' },
      { type: 'pickup', at: 'marina', r: 80, text: 'Pick up the crate (press E)' },
      { type: 'deliver', at: 'diner', r: 110, text: 'Deliver the crate to the diner' },
    ],
  },
  {
    id: 'getaway', title: 'Getaway', giver: 'Mama Rosa', reward: 400,
    briefing: [
      { who: 'Mama Rosa', line: 'The crate was not dinner, Leo. It was the Vipers\' dinner. They called the police.' },
      { who: 'Leo', line: 'Of course they did.' },
      { who: 'Mama Rosa', line: 'Lose the cops. Get back here with two stars or less on your tail — better, with none.' },
    ],
    steps: [
      { type: 'escape', text: 'Lose the police (get your wanted level to zero)' },
      { type: 'driveTo', at: 'garage', r: 110, text: 'Get back to the garage' },
    ],
  },
  {
    id: 'tail-the-viper', title: 'Tail the Viper', giver: 'Mama Rosa', reward: 500,
    briefing: [
      { who: 'Mama Rosa', line: "Dario Voss drives a red sports car through downtown every evening. Follow him. Learn where he keeps his money." },
      { who: 'Leo', line: 'And if he spots me?' },
      { who: 'Mama Rosa', line: 'Then you are walking home, Leo. Stay back. Stay patient.' },
    ],
    steps: [
      { type: 'tail', duration: 25, minD: 120, maxD: 420, text: 'Tail Dario\'s car — stay close, but not too close' },
      { type: 'driveTo', at: 'garage', r: 110, text: 'Report back to the garage' },
    ],
  },
  {
    id: 'the-big-score', title: 'The Big Score', giver: 'Mama Rosa', reward: 1200,
    briefing: [
      { who: 'Mama Rosa', line: 'Bay National Bank. Friday. One guard, one vault, one very nervous manager. You go in, you take the cash, you run.' },
      { who: 'Leo', line: 'And the police?' },
      { who: 'Mama Rosa', line: 'They will be there, Leo. That is why you drive fast.' },
    ],
    steps: [
      { type: 'goto', at: 'bank', r: 100, text: 'Get to Bay National Bank' },
      { type: 'pickup', at: 'bank', r: 80, text: 'Grab the cash (press E)' },
      { type: 'escape', text: 'Escape the police with the cash' },
      { type: 'driveTo', at: 'garage', r: 110, text: 'Bring the cash to the garage' },
    ],
  },
  {
    id: 'king-of-the-bay', title: 'King of the Bay', giver: 'Leo', reward: 2000,
    briefing: [
      { who: 'Leo', line: "The Vipers are coming for the garage tonight. Dario wants his money back and my head with it." },
      { who: 'Mama Rosa', line: 'Then we give him neither. Hold the garage, Leo. Then finish it.' },
      { who: 'Leo', line: 'Tonight Solmar Bay gets a new king.' },
    ],
    steps: [
      { type: 'defend', at: 'garage', kills: 8, text: 'Defend the garage — take down 8 Vipers' },
      { type: 'kill', at: 'garage', kills: 1, boss: true, text: 'Finish Dario Voss' },
      { type: 'driveTo', at: 'marina', r: 120, text: 'Drive to the marina — the bay is yours' },
    ],
  },
];

export class MissionEngine {
  constructor(events) {
    this.events = events; // {onDialogue, onStep, onMissionComplete, onMissionFailed, onObjective}
    this.index = 0;
    this.stepI = 0;
    this.dialogue = [];
    this.dialogueI = 0;
    this.stepState = {};
    this.active = false;
    this.kills = 0;
  }

  get mission() { return MISSIONS[this.index]; }
  get step() { return this.mission?.steps[this.stepI]; }
  get done() { return this.index >= MISSIONS.length; }

  start(index) {
    // Out of range (e.g. free roam after the last mission): no mission, the
    // engine just stays inactive instead of crashing on an undefined mission.
    if (!MISSIONS[index]) {
      this.index = index;
      this.stepI = 0;
      this.stepState = {};
      this.kills = 0;
      this.active = false;
      this.dialogue = [];
      this.dialogueI = 0;
      return;
    }
    this.index = index;
    this.stepI = 0;
    this.stepState = {};
    this.kills = 0;
    this.active = true;
    this.queueDialogue(this.mission.briefing);
    this.events.onStep(this.mission, this.step);
  }

  queueDialogue(lines) {
    this.dialogue = lines;
    this.dialogueI = 0;
    this.events.onDialogue(lines[0]);
  }
  advanceDialogue() {
    this.dialogueI++;
    if (this.dialogueI < this.dialogue.length) {
      this.events.onDialogue(this.dialogue[this.dialogueI]);
      return true;
    }
    this.events.onDialogue(null);
    return false;
  }
  get inDialogue() { return this.dialogueI < this.dialogue.length; }

  completeStep() {
    this.stepI++;
    this.stepState = {};
    if (this.stepI >= this.mission.steps.length) {
      const m = this.mission;
      this.active = false;
      // Advance past the finished mission so `done` is true after the last
      // one (otherwise the scene would try to start a mission that isn't there).
      this.index++;
      this.events.onMissionComplete(m);
      return;
    }
    this.events.onStep(this.mission, this.step);
  }

  fail(reason) {
    this.events.onMissionFailed(this.mission, reason);
    this.start(this.index); // restart the same mission
  }

  // Called every frame by the scene with the live world state.
  update(dt, w) {
    if (!this.active || this.inDialogue) return;
    const s = this.step;
    if (!s) return;
    const at = s.at ? w.landmark(s.at) : null;
    const px = w.playerX, py = w.playerY;
    const distTo = at ? Math.hypot(px - at.x, py - at.y) : Infinity;

    switch (s.type) {
      case 'goto':
      case 'driveTo':
      case 'deliver':
        if (distTo < s.r) this.completeStep();
        break;
      case 'enterCar':
        if (w.inCar) this.completeStep();
        break;
      case 'pickup':
        if (distTo < s.r && w.interactPressed) this.completeStep();
        break;
      case 'escape':
        if (w.wantedStars === 0) this.completeStep();
        break;
      case 'tail': {
        const t = w.tailTarget;
        if (!t) break;
        const d = Math.hypot(px - t.x, py - t.y);
        this.stepState.time = (this.stepState.time ?? 0) + dt;
        if (d < 90) this.fail('Dario spotted you — too close!');
        else if (d > 520) { this.stepState.out = (this.stepState.out ?? 0) + dt; if (this.stepState.out > 3) this.fail('You lost Dario\'s car.'); }
        else this.stepState.out = 0;
        this.events.onTailProgress?.(this.stepState.time / s.duration);
        if (this.stepState.time >= s.duration) this.completeStep();
        break;
      }
      case 'defend':
      case 'kill': {
        if (this.kills >= s.kills) this.completeStep();
        break;
      }
    }
  }

  registerKill() { this.kills++; }
}
