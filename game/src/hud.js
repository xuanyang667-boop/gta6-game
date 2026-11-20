// DOM HUD for Solmar Heat (game-ui-ux: HUD driven by events, DOM for text).
// Money, health, wanted stars, objective, speed, minimap (a small canvas that
// blits a pre-rendered city image and draws dots), banners, dialogue and toasts.
import { WORLD_PX } from './city.js';

export class Hud {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.el = {
      hud: document.getElementById('hud'),
      money: document.getElementById('money'),
      healthFill: document.getElementById('health-fill'),
      wanted: document.getElementById('wanted'),
      objectiveTitle: document.querySelector('#objective .title'),
      objectiveText: document.querySelector('#objective .text'),
      speed: document.getElementById('speed'),
      banner: document.getElementById('banner'),
      dialog: document.getElementById('dialog'),
      dialogWho: document.querySelector('#dialog .who'),
      dialogLine: document.querySelector('#dialog .line'),
      toast: document.getElementById('toast'),
      menu: document.getElementById('menu'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.mapTimer = 0;
    this.bannerTimer = null;
    this.toastTimer = null;
    this.buildMinimapBase();
  }

  buildMinimapBase() {
    // Pre-render the city ground at 180x180 once.
    const base = document.createElement('canvas');
    base.width = 180; base.height = 180;
    const g = base.getContext('2d');
    const s = 180 / WORLD_PX;
    const colors = ['#6fae4e', '#3a3d46', '#3a3d46', '#3a3d46', '#41444e', '#b9b3a4', '#e3cd96', '#2f8fc9', '#4e8f3c', '#43464f', '#3a3d46', '#3a3d46', '#c9b18a'];
    const { grid } = this.city;
    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 96; x++) {
        g.fillStyle = colors[grid[y * 96 + x]] ?? '#6fae4e';
        g.fillRect(Math.floor(x * 32 * s), Math.floor(y * 32 * s), Math.ceil(32 * s), Math.ceil(32 * s));
      }
    }
    this.mapBase = base;
  }

  show() { this.el.hud.style.display = 'block'; }
  hide() { this.el.hud.style.display = 'none'; }

  update(game, player, mission, dt) {
    this.el.money.textContent = '$' + game.money.toLocaleString('en-US');
    this.el.healthFill.style.width = Math.max(0, game.health) + '%';
    const stars = game.wantedStars;
    for (const star of this.el.wanted.querySelectorAll('.star')) {
      star.classList.toggle('lit', Number(star.dataset.s) <= stars);
    }
    const mph = player?.inCar ? Math.round(Math.abs(player.carSpeed) * 0.12) : 0;
    this.el.speed.textContent = player?.inCar ? mph + ' mph' : '';
    if (mission?.step) {
      this.el.objectiveTitle.textContent = mission.mission.title;
      this.el.objectiveText.textContent = mission.step.text;
    } else if (mission?.done) {
      this.el.objectiveTitle.textContent = 'King of Solmar Bay';
      this.el.objectiveText.textContent = 'The bay is yours. Free roam — cause chaos, or just enjoy the sunset.';
    } else {
      this.el.objectiveTitle.textContent = '';
      this.el.objectiveText.textContent = '';
    }
    // Minimap at ~10 Hz.
    this.mapTimer += dt;
    if (this.mapTimer > 0.1) {
      this.mapTimer = 0;
      this.drawMinimap(game, player);
    }
  }

  drawMinimap(game, player) {
    const g = this.mapCtx;
    const s = 180 / WORLD_PX;
    g.drawImage(this.mapBase, 0, 0);
    const dot = (x, y, color, r = 3) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(x * s, y * s, r, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.stroke();
    };
    if (game.missionTarget) dot(game.missionTarget.x, game.missionTarget.y, '#ffd23e', 4);
    for (const c of game.policeDots ?? []) dot(c.x, c.y, '#2e6fd2', 2.5);
    for (const c of game.enemyDots ?? []) dot(c.x, c.y, '#ff3b30', 2.5);
    if (player) {
      dot(player.x, player.y, '#7dff9b', 3.5);
      // View cone tick.
      g.strokeStyle = '#7dff9b'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(player.x * s, player.y * s);
      g.lineTo(player.x * s + Math.cos(player.angle) * 10, player.y * s + Math.sin(player.angle) * 10); g.stroke();
    }
  }

  banner(text, sub = '', ms = 2600) {
    this.el.banner.innerHTML = text + (sub ? '<div style="font-size:18px;color:#fff">' + sub + '</div>' : '');
    this.el.banner.style.display = 'block';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { this.el.banner.style.display = 'none'; }, ms);
  }

  toast(text, ms = 3000) {
    this.el.toast.textContent = text;
    this.el.toast.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.display = 'none'; }, ms);
  }

  showDialogue(line) {
    if (!line) { this.el.dialog.style.display = 'none'; return; }
    this.el.dialogWho.textContent = line.who;
    this.el.dialogLine.textContent = line.line;
    this.el.dialog.style.display = 'block';
  }

  // ---- Menus (DOM) ----
  showMenu(html) {
    this.el.menu.innerHTML = html;
    this.el.menu.style.display = 'flex';
  }
  hideMenu() { this.el.menu.style.display = 'none'; this.el.menu.innerHTML = ''; }

  startScreen(hasSave) {
    return `
      <h1>SOLMAR HEAT</h1>
      <h2>AN OPEN-WORLD CRIME GAME IN SOLMAR BAY</h2>
      <p>You are Leo Marlow, a driver back in the sun-soaked city of Solmar Bay.
      Steal cars, run jobs for Mama Rosa, outrun the SBPD, and take the bay
      from the Viper gang — one mission at a time.</p>
      <div>
        <button id="btn-new">NEW GAME</button>
        ${hasSave ? '<button id="btn-continue">CONTINUE</button>' : ''}
        <button id="btn-how">HOW TO PLAY</button>
      </div>
      <div class="controls">
        <b>WASD / Arrows</b> move &amp; drive &nbsp;·&nbsp; <b>E</b> enter / exit car, pick up<br>
        <b>Mouse</b> aim &nbsp;·&nbsp; <b>Click</b> shoot &nbsp;·&nbsp; <b>Space</b> punch<br>
        <b>Esc / P</b> pause &nbsp;·&nbsp; <b>H</b> horn &nbsp;·&nbsp; <b>M</b> mute
      </div>`;
  }

  howScreen() {
    return `
      <h1>HOW TO PLAY</h1>
      <p style="text-align:left">
      <b>On foot:</b> WASD to walk. Walk up to a car and press <b>E</b> to steal it.<br>
      <b>Driving:</b> W to accelerate, S to brake/reverse, A/D to steer. Press <b>E</b> to get out.<br>
      <b>Combat:</b> aim with the mouse, click to shoot, Space to punch.<br>
      <b>Wanted:</b> crimes raise your heat — stealing cars, hurting people, shooting.
      The SBPD sends patrols, then chases. Lose them to cool down. If a cop catches you on foot, you're busted.<br>
      <b>Missions:</b> follow the yellow marker. Finish all six jobs to become King of Solmar Bay.<br>
      <b>Save:</b> your progress autosaves after every mission. Continue from the title screen.
      </p>
      <div><button id="btn-back">BACK</button></div>`;
  }

  pauseScreen() {
    return `
      <h1>PAUSED</h1>
      <p>Solmar Bay waits for no one. Well — right now it does.</p>
      <div>
        <button id="btn-resume">RESUME</button>
        <button id="btn-restart">RESTART MISSION</button>
        <button id="btn-quit">QUIT TO TITLE</button>
      </div>
      <div class="controls">
        Music <input type="range" id="vol-music" min="0" max="100" value="50" style="width:120px;vertical-align:middle">
        &nbsp; SFX <input type="range" id="vol-sfx" min="0" max="100" value="80" style="width:120px;vertical-align:middle">
      </div>`;
  }

  overScreen(kind, lost) {
    const title = kind === 'busted' ? 'BUSTED!' : 'WASTED!';
    const text = kind === 'busted'
      ? 'The SBPD caught you. They took your bail money and dropped you at the hospital.'
      : 'You got taken down. The hospital patched you up — for a price.';
    return `
      <h1>${title}</h1>
      <p>${text}</p>
      <p>You lost <b>$${lost}</b>. Your wanted level is clear.</p>
      <div><button id="btn-respawn">BACK TO THE STREETS</button></div>`;
  }

  endScreen() {
    return `
      <h1>KING OF SOLMAR BAY</h1>
      <h2>DARIO VOSS IS FINISHED. THE BAY IS YOURS.</h2>
      <p>You did it, Leo. Six jobs, one empire. The SBPD still wants you — but in
      Solmar Bay, that just means you're famous. Keep playing in free roam, or
      start a new game and do it cleaner.</p>
      <div><button id="btn-freeroam">FREE ROAM</button><button id="btn-title">TITLE SCREEN</button></div>`;
  }
}
