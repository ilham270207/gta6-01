// Keyboard + mouse input. Held movement is polled every step; presses (E, F, Space,
// P, Enter, M) are queued as one-shot actions the game consumes with takeActions().
const ACTION_CONFIRM = 1;
const ACTION_PAUSE = 2;
const ACTION_ENTER = 4;
const ACTION_SHOOT = 8;
const ACTION_PUNCH = 16;
const ACTION_SAVE = 32;
const ACTION_MUTE = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_SHOOT,
  Space: ACTION_PUNCH,
  KeyS: ACTION_SAVE,
  KeyM: ACTION_MUTE,
};

function createInput(canvas) {
  const keys = new Set();
  const queue = [];
  const mouse = { x: 0, y: 0, down: false };

  function onKeyDown(event) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      const action = KEY_ACTIONS[event.code];
      if (action) queue.push(action);
    }
    keys.add(event.code);
  }
  function onKeyUp(event) { keys.delete(event.code); }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    queue.push(ACTION_SHOOT);
    queue.push(ACTION_CONFIRM);
  }
  function onMouseUp() { mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    // Held movement vector, normalised.
    move() {
      let x = 0; let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    shootHeld() { return mouse.down || keys.has('KeyF'); },
    takeActions() {
      let actions = 0;
      while (queue.length) actions |= queue.shift();
      return actions;
    },
  };
}
