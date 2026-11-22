// SOLMAR HEAT — boot and the one loop. Fixed 1/60 s steps, title / play /
// paused screens, save/load, procedural audio, and the ?shot= scene stager.
//
// ?seed=N fixes the world. ?shot=cover|chase|mission|city (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed), seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) { status.textContent = message; }

function currentMarker() {
  const s = world.state;
  if (s.mission.index >= 0) return world.missionMarker();
  if (s.missionAvailable < 5) return PLACES.club;
  return null;
}

function runShot(name) {
  const scene = stageShot(name, world);
  world.state.viewW = renderer.viewW;
  world.state.viewH = renderer.viewH;
  let painted = 0;
  function paint() {
    // Keep repainting: a headless compositor only presents frames while the
    // page keeps producing them, and the staged scene must stay on screen.
    renderer.draw(world.state, scene.screen, { marker: currentMarker() });
    painted += 1;
    if (painted === 2) window.__shotReady = true;
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let selected = 0;
  let howTo = false;
  let saved = hasSave();
  let accumulator = 0;
  let last = performance.now();

  function menuItems() { return saved ? ['new', 'continue', 'howto'] : ['new', 'howto']; }

  function startGame(fresh) {
    world.reset();
    if (!fresh) world.applySave(loadGame());
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Solmar Heat. Visit La Rosa at the club to start a job.');
  }

  function menuAction() {
    const item = menuItems()[selected];
    if (item === 'howto') { howTo = true; return; }
    if (item === 'continue') startGame(false);
    else startGame(true);
  }

  function menuClick() {
    const items = menuItems();
    const mx = input.mouse.x; const my = input.mouse.y;
    for (let i = 0; i < items.length; i += 1) {
      const y = renderer.viewH * 0.52 + i * 46;
      if (Math.abs(mx - renderer.viewW / 2) < 170 && Math.abs(my - y) < 24) {
        selected = i;
        menuAction();
        return true;
      }
    }
    return false;
  }

  // Menu navigation keys (arrows / W / S on the title screen).
  window.addEventListener('keydown', (event) => {
    if (screen !== SCREEN_TITLE || howTo) return;
    const items = menuItems();
    if (event.code === 'ArrowDown' || event.code === 'KeyS') selected = (selected + 1) % items.length;
    else if (event.code === 'ArrowUp' || event.code === 'KeyW') selected = (selected - 1 + items.length) % items.length;
  });

  // Actions are taken once per frame and handed to the first fixed step,
  // so a single key press is never eaten by the menu handler or replayed.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (howTo) {
        if (actions & ACTION_CONFIRM) howTo = false;
        return;
      }
      if (actions & ACTION_CONFIRM) {
        if (!menuClick()) menuAction();
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PLAY; announce('Playing.'); }
      else if (actions & ACTION_SAVE) {
        if (saveGame(world.state)) announce('Game saved.');
        else announce('Save failed.');
      }
    }
  }

  // Q quits to the title from pause.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_PAUSED && event.code === 'KeyQ') {
      screen = SCREEN_TITLE;
      selected = 0;
      howTo = false;
      saved = hasSave();
      announce('Solmar Heat. Press Enter or click to start.');
    }
  });

  function buildInput() {
    const s = world.state;
    const move = input.move();
    const rect = canvas.getBoundingClientRect();
    const scaleX = s.viewW / rect.width;
    const scaleY = s.viewH / rect.height;
    const mouseWorldX = s.cam.x + (input.mouse.x * scaleX - s.viewW / 2);
    const mouseWorldY = s.cam.y + (input.mouse.y * scaleY - s.viewH / 2);
    return {
      mx: move.x, my: move.y,
      run: input.run(),
      punch: false, shoot: false, enter: false,
      aimX: mouseWorldX, aimY: mouseWorldY,
      shootHeld: input.shootHeld(),
    };
  }

  function step(actions) {
    const s = world.state;
    if (screen === SCREEN_TITLE) {
      // Attract mode: the city lives behind the menu.
      world.step(STEP, { mx: 0, my: 0, run: false, punch: false, shoot: false, enter: false }, true);
      return;
    }
    const base = buildInput();
    const frameInput = {
      ...base,
      punch: !!(actions & ACTION_PUNCH),
      shoot: !!(actions & ACTION_SHOOT) || base.shootHeld,
      enter: !!(actions & ACTION_ENTER),
    };
    world.step(STEP, frameInput, false);
    // Drain the sound queue.
    for (const name of s.sounds) {
      if (name === 'shot') audio.shot();
      else if (name === 'enemyShot') audio.enemyShot();
      else if (name === 'punch') audio.punch();
      else if (name === 'crash') audio.crash();
      else if (name === 'pickup') audio.pickup();
      else if (name === 'jingle') audio.jingle();
      else if (name === 'fail') audio.fail();
      else if (name === 'busted') audio.busted();
    }
    s.sounds.length = 0;
    // Engine + siren follow the action.
    const car = !s.player.onFoot && s.cars[s.player.carId] ? s.cars[s.player.carId] : null;
    audio.engine(car ? Math.abs(car.speed) / 450 : 0, !!car);
    audio.siren(s.wanted > 0);
    audio.update(STEP);
    if (s.saveRequested) {
      s.saveRequested = false;
      saveGame(s);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const s = world.state;
    s.viewW = renderer.viewW;
    s.viewH = renderer.viewH;
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(s, screen, { marker: currentMarker(), hasSave: saved, selected, howTo });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
