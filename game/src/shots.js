// Deterministic screenshot scenes behind ?shot=cover|chase|mission|city.
// Each one plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot, so the frame is what a short game really
// looks like — and the same seed always gives the same frame.

function makeCar(state, model, x, y, angle, driver, extra = {}) {
  const def = CAR_MODELS[model];
  const car = {
    id: state.cars.length,
    model, x, y, angle,
    vx: 0, vy: 0, speed: 0,
    color: extra.color || def.colors[0],
    health: 100,
    driver, stolen: !!extra.stolen, smokeT: 0,
    axis: extra.axis || 'x', road: extra.road || 1170, dir: extra.dir || 1,
    turnCd: 3, brake: false, ramCd: 0, stuckT: 0, wreckT: 0, skidPrev: null,
  };
  state.cars.push(car);
  return car;
}

function makePed(state, x, y, axis, road, dir, color) {
  const ped = {
    x, y, angle: 0, speed: 55,
    axis, road, dir, color,
    side: 1, flee: 0, fleeX: 0, fleeY: 0, down: 0, turnCd: 3,
  };
  state.peds.push(ped);
  return ped;
}

function playerCar(state) {
  return state.cars[state.player.carId] ?? null;
}

// Drive forward along a road, staying in lane, braking for traffic ahead.
// Pure pursuit: aim at a point 150 units ahead on the lane, plus a gentle
// weaving offset (radians) so a chase looks alive without leaving the road.
// `cruise` caps the speed.
function driveInput(state, road, weave = 0, cruise = 330) {
  const car = playerCar(state);
  if (!car) return { mx: 0, my: 0, run: false, punch: false, shoot: false, enter: false };
  const laneY = road + 18;
  const desired = Math.atan2(laneY - car.y, 60) + weave;
  const steer = Math.max(-1, Math.min(1, angDiff(car.angle, desired) * 2.5));
  let throttle = car.speed >= cruise ? 0 : -1;
  for (const other of state.cars) {
    if (other === car) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 110 && side < 30) { throttle = 0; break; } // coast, never reverse into the chase
  }
  return { mx: steer, my: throttle, run: false, punch: false, shoot: false, enter: false };
}

// Walk toward a point.
function walkInput(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x; const dy = ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d < 12) return { mx: 0, my: 0, run: false, punch: false, shoot: false, enter: false };
  return { mx: dx / d, my: dy / d, run: false, punch: false, shoot: false, enter: false };
}

function putPlayerInCar(state, car) {
  state.player.onFoot = false;
  state.player.carId = car.id;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  car.driver = 'player';
}

// Remove random traffic, parked cars and pedestrians from the player's corridor
// so the staged chase is a clean run down the road, not a pile-up the
// autopilot never asked for. Runs before the scene's own cars are placed.
function clearCorridor(state, road, x0, x1) {
  state.cars = state.cars.filter((c) => !((c.driver === 'traffic' || c.driver === 'parked' || c.driver === 'none') && Math.abs(c.y - road) < 60 && c.x > x0 && c.x < x1));
  state.peds = state.peds.filter((p) => !(Math.abs(p.y - road) < 70 && p.x > x0 && p.x < x1));
}

function runSteps(world, seconds, inputFn) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) world.step(STEP, inputFn(world.state, i * STEP), false);
}

function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name === 'chase') {
    // Three stars, two cruisers on Jax's tail, weaving down Marlin Row.
    s.money = 860;
    s.clock = 15.5;
    s.wanted = 3;
    clearCorridor(s, 1430, 950, 2560);
    const car = makeCar(s, 'sport', 1000, 1448, 0, 'player', { color: '#e01e37', road: 1430, dir: 1 });
    car.speed = 300;
    putPlayerInCar(s, car);
    const c1 = makeCar(s, 'police', 600, 1448, 0, 'police', { road: 1430, dir: 1 });
    c1.speed = 320;
    const c2 = makeCar(s, 'police', 520, 1410, 0, 'police', { road: 1430, dir: 1 });
    c2.speed = 330;
    makeCar(s, 'sedan', 1750, 1448, 0, 'traffic', { axis: 'x', road: 1430, dir: 1 });
    runSteps(world, 4.5, (st, t) => driveInput(st, 1430, -Math.abs(Math.sin(t * 1.5)) * 0.3, 300));
    s.message = { text: '', until: 0 };
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Dock Run: Jax on foot at the pier, the package marker glowing at Pier 9.
    s.money = 430;
    s.clock = 9.0;
    s.player.x = 235;
    s.player.y = 1300;
    s.player.angle = Math.PI; // facing the sea / the pier
    s.cam.x = 235;
    s.cam.y = 1300;
    makeCar(s, 'sedan', 285, 1240, Math.PI / 2, 'parked', { color: '#3d7dd9' });
    makePed(s, 265, 1360, 'x', 1430, 1, '#f2a541');
    makePed(s, 300, 1180, 'x', 1170, -1, '#5b8dd9');
    world.startMission(1); // Dock Run
    runSteps(world, 2.5, (st) => walkInput(st, 150, 1300));
    s.message = { text: '', until: 0 };
    return { screen: SCREEN_PLAY };
  }
  if (name === 'city') {
    // On foot by Palm Court Park and the beach, pedestrians about, a boosted
    // sedan parked at the kerb.
    s.money = 250;
    s.clock = 11.0;
    s.player.x = 700;
    s.player.y = 780;
    s.player.angle = 0;
    s.cam.x = 700;
    s.cam.y = 780;
    const boosted = makeCar(s, 'sedan', 660, 845, 0, 'none', { color: '#d94f3d', stolen: true });
    void boosted;
    makeCar(s, 'taxi', 640, 955, Math.PI, 'parked', { color: '#f7c948' });
    makePed(s, 720, 760, 'x', 910, 1, '#e2725b');
    makePed(s, 760, 820, 'y', 650, 1, '#7fb069');
    makePed(s, 640, 700, 'x', 650, -1, '#c96fd6');
    makePed(s, 850, 880, 'y', 910, -1, '#3d7dd9');
    world.startMission(0); // First Wheels
    runSteps(world, 3, (st) => walkInput(st, 900, 800));
    s.message = { text: '', until: 0 };
    return { screen: SCREEN_PLAY };
  }
  // cover: cruising the central boulevard with traffic, one star of heat.
  s.money = 1250;
  s.clock = 10.0;
  s.wanted = 1;
  clearCorridor(s, 1170, 850, 2560);
  const car = makeCar(s, 'sedan', 900, 1188, 0, 'player', { color: '#d94f3d', road: 1170, dir: 1 });
  car.speed = 260;
  putPlayerInCar(s, car);
  const cop = makeCar(s, 'police', 500, 1188, 0, 'police', { road: 1170, dir: 1 });
  cop.speed = 280;
  makeCar(s, 'taxi', 1180, 1152, Math.PI, 'traffic', { axis: 'x', road: 1170, dir: -1 });
  makeCar(s, 'sedan', 1420, 1188, 0, 'traffic', { axis: 'x', road: 1170, dir: 1 });
  makeCar(s, 'truck', 620, 1152, Math.PI, 'traffic', { axis: 'x', road: 1170, dir: -1 });
  makePed(s, 1010, 1120, 'x', 1170, 1, '#f2a541');
  makePed(s, 1240, 1240, 'x', 1170, -1, '#5b8dd9');
  world.startMission(1); // Dock Run — objective visible in the HUD
  runSteps(world, 4, (st) => driveInput(st, 1170, 0, 300));
  s.message = { text: '', until: 0 };
  return { screen: SCREEN_PLAY };
}
