// Save / load through localStorage. Only progress numbers and position are stored —
// never keys, never anything sensitive.

function hasSave() {
  try { return window.localStorage.getItem(SAVE_KEY) !== null; } catch { return false; }
}

function saveGame(state) {
  try {
    const data = {
      money: state.money,
      health: state.player.health,
      ammo: state.ammo,
      hasPistol: state.hasPistol,
      missionAvailable: state.missionAvailable,
      missionsDone: state.missionsDone,
      player: { x: state.player.x, y: state.player.y },
      clock: state.clock,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
