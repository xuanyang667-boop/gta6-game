// Save / load for Solmar Heat (save-systems): plain JSON in localStorage,
// version-stamped, written atomically (temp key, keep the last good save as
// backup, rename into place). Only data is saved — ids, numbers and flags;
// the city and entities are rebuilt from the seed on load.
export const SAVE_KEY = 'solmar-heat-save-v1';
export const SAVE_BAK = 'solmar-heat-save-v1.bak';
export const SAVE_VERSION = 1;

export function captureSave(game) {
  return {
    version: SAVE_VERSION,
    seed: game.seed,
    money: game.money,
    health: game.health,
    missionIndex: game.missionIndex,
    completedMissions: [...game.completedMissions],
    player: { x: Math.round(game.playerX), y: Math.round(game.playerY) },
    stats: { ...game.stats },
    settings: { ...game.settings },
    savedAt: Date.now(),
  };
}

export function writeSave(game) {
  try {
    const data = JSON.stringify(captureSave(game));
    const prev = localStorage.getItem(SAVE_KEY);
    localStorage.setItem(SAVE_KEY + '.tmp', data);
    if (prev) localStorage.setItem(SAVE_BAK, prev);
    localStorage.setItem(SAVE_KEY, data);
    localStorage.removeItem(SAVE_KEY + '.tmp');
    return true;
  } catch (e) {
    return false;
  }
}

export function readSave() {
  for (const key of [SAVE_KEY, SAVE_BAK]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data.version !== SAVE_VERSION) continue; // refuse newer/older formats
      if (typeof data.money !== 'number' || typeof data.seed !== 'number') continue;
      return data;
    } catch (e) {
      continue;
    }
  }
  return null;
}

export function hasSave() {
  return readSave() !== null;
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SAVE_BAK);
}
