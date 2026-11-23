// LA VEGA — world: city generation, physics, traffic, pedestrians, police,
// wanted system, combat, missions. Deterministic: every random choice comes from
// the seeded rng, so ?shot= scenes replay identically.

const TAU = Math.PI * 2;

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function laneOffset(axis, dir) {
  // Right-hand traffic: offset to the right of the direction of travel.
  if (axis === 'x') return dir > 0 ? 18 : -18;
  return dir > 0 ? -18 : 18;
}

// ---------------------------------------------------------------- city gen
function generateCity(rng) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const crates = [];
  const parkingLots = [];

  // Special plots, keyed by block indices (ix between ROADS[ix]..ROADS[ix+1]).
  const special = {
    '2,1': 'park',
    '4,2': 'club',
    '1,4': 'garage',
    '0,6': 'warehouse',
    '6,0': 'hospital',
  };

  function addBuilding(bx, by, bw, bh, roof, kind) {
    buildings.push({ x: bx, y: by, w: bw, h: bh, roof, kind: kind || 'block', shadow: 10 + rng.range(0, 8) });
  }

  for (let ix = 0; ix < ROADS.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS.length - 1; iy += 1) {
      const x0 = ROADS[ix] + WORLD.roadWidth / 2 + WORLD.sidewalk + 8;
      const y0 = ROADS[iy] + WORLD.roadWidth / 2 + WORLD.sidewalk + 8;
      const x1 = ROADS[ix + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 8;
      const y1 = ROADS[iy + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk - 8;
      const key = `${ix},${iy}`;
      const kind = special[key];
      if (kind === 'park') continue; // park is open green, trees only
      if (kind === 'club') { addBuilding(x0 + 14, y0 + 10, x1 - x0 - 28, y1 - y0 - 20, '#c96fd6', 'club'); continue; }
      if (kind === 'garage') { addBuilding(x0 + 6, y0 + 26, x1 - x0 - 12, y1 - y0 - 52, '#f27d4a', 'garage'); continue; }
      if (kind === 'warehouse') { addBuilding(x0 + 4, y0 + 8, x1 - x0 - 8, y1 - y0 - 16, '#8a8f98', 'warehouse'); continue; }
      if (kind === 'hospital') { addBuilding(x0 + 18, y0 + 12, x1 - x0 - 36, y1 - y0 - 24, '#e8e8e8', 'hospital'); continue; }
      if (rng.chance(0.12)) { parkingLots.push({ x0, y0, x1, y1 }); continue; }
      if (rng.chance(0.1)) continue; // empty plaza block
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (rng.chance(0.55)) {
        // Two buildings side by side.
        const split = rng.range(0.42, 0.58);
        addBuilding(x0, y0, bw * split - 8, bh, rng.pick(PALETTE.buildingRoofs));
        addBuilding(x0 + bw * split + 8, y0, bw * (1 - split) - 8, bh, rng.pick(PALETTE.buildingRoofs));
      } else {
        addBuilding(x0 + rng.range(0, 14), y0 + rng.range(0, 10), bw - rng.range(0, 28), bh - rng.range(0, 20), rng.pick(PALETTE.buildingRoofs));
      }
    }
  }

  // Trees along sidewalks.
  for (const road of ROADS) {
    for (let t = 320; t < WORLD.size - 40; t += 110) {
      if (rng.chance(0.45)) trees.push({ x: road + WORLD.roadWidth / 2 + 9, y: t + rng.range(-20, 20), palm: false, s: rng.range(0.85, 1.2) });
      if (rng.chance(0.45)) trees.push({ x: t + rng.range(-20, 20), y: road + WORLD.roadWidth / 2 + 9, palm: false, s: rng.range(0.85, 1.2) });
    }
  }
  // Park trees + pond.
  for (let i = 0; i < 26; i += 1) {
    trees.push({ x: rng.range(950, 1130), y: rng.range(690, 870), palm: rng.chance(0.4), s: rng.range(0.9, 1.35) });
  }
  // Beach palms.
  for (let i = 0; i < 14; i += 1) {
    trees.push({ x: rng.range(175, 285), y: rng.range(120, 2480), palm: true, s: rng.range(0.9, 1.3) });
  }
  // Street lamps at intersections.
  for (const rx of ROADS) {
    for (const ry of ROADS) {
      lamps.push({ x: rx - WORLD.roadWidth / 2 - 6, y: ry - WORLD.roadWidth / 2 - 6 });
      lamps.push({ x: rx + WORLD.roadWidth / 2 + 6, y: ry + WORLD.roadWidth / 2 + 6 });
    }
  }
  // Crates at the warehouse and the docks.
  for (let i = 0; i < 7; i += 1) crates.push({ x: rng.range(430, 610), y: rng.range(2180, 2260), s: rng.range(16, 26) });
  for (let i = 0; i < 5; i += 1) crates.push({ x: rng.range(190, 280), y: rng.range(1200, 1400), s: rng.range(16, 26) });

  return { buildings, trees, lamps, crates, parkingLots };
}

// ---------------------------------------------------------------- world
function createWorld(rng, seed) {
  let state = null;

  function freshState() {
    const city = generateCity(rng);
    const s = {
      seed,
      time: 0,
      clock: 10.0, // 10:00 in the morning, sun high over the bay
      money: 250,
      ammo: 0,
      hasPistol: false,
      wanted: 0,
      wantedDecay: 0,
      wantedGainCd: 0,
      city,
      player: {
        x: 1500, y: 1140, angle: 0, health: 100,
        onFoot: true, carId: -1, lastHurt: -99, punchCd: 0, shootCd: 0,
      },
      cars: [],
      peds: [],
      cops: [],
      rivals: [],
      bullets: [],
      particles: [],
      skids: [],
      mission: { index: -1, step: 0, timer: 0, hasPackage: false },
      missionAvailable: 0,
      missionsDone: 0,
      message: { text: '', until: 0 },
      respawn: { active: false, timer: 0, kind: '' },
      trauma: 0,
      cam: { x: 1500, y: 1140 },
      viewW: 1280,
      viewH: 720,
      sounds: [],
      saveRequested: false,
      stats: { stolen: 0, shots: 0 },
      muzzle: null,
      attract: 0,
    };
    return s;
  }

  function say(text, dur = 4) {
    state.message = { text, until: state.time + dur };
  }
  function sound(name) { state.sounds.push(name); }

  function pointInBuilding(x, y) {
    for (const b of state.city.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    for (const c of state.city.crates) {
      if (x >= c.x - c.s / 2 && x <= c.x + c.s / 2 && y >= c.y - c.s / 2 && y <= c.y + c.s / 2) return c;
    }
    return null;
  }

  // Push a circle out of buildings/crates; returns true if it hit something.
  function collideCircle(p, r) {
    let hit = false;
    const solids = state.city.buildings;
    for (let i = 0; i < solids.length; i += 1) {
      const b = solids[i];
      const cx = clamp(p.x, b.x, b.x + b.w);
      const cy = clamp(p.y, b.y, b.y + b.h);
      const dx = p.x - cx; const dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.y = cy + (dy / d) * r;
        } else {
          p.y = b.y - r; // inside: push out the top
        }
      }
    }
    for (const c of state.city.crates) {
      const cx = clamp(p.x, c.x - c.s / 2, c.x + c.s / 2);
      const cy = clamp(p.y, c.y - c.s / 2, c.y + c.s / 2);
      const dx = p.x - cx; const dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      const r2 = r + c.s / 2 - 4;
      if (d2 < r2 * r2 && d2 > 0.01) {
        hit = true;
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r2;
        p.y = cy + (dy / d) * r2;
      }
    }
    return hit;
  }

  function spawnCar(model, x, y, angle, driver) {
    const def = CAR_MODELS[model];
    const car = {
      id: state.cars.length,
      model,
      x, y, angle,
      vx: 0, vy: 0, speed: 0,
      color: rng.pick(def.colors),
      health: 100,
      driver, // 'player' | 'traffic' | 'police' | 'parked' | 'none'
      stolen: false,
      smokeT: 0,
      // traffic AI
      axis: 'x', road: ROADS[2], dir: 1, turnCd: 2, brake: false,
      ramCd: 0, stuckT: 0, wreckT: 0,
    };
    state.cars.push(car);
    return car;
  }

  function randomRoadSpot() {
    const axis = rng.chance(0.5) ? 'x' : 'y';
    const road = rng.pick(ROADS);
    const along = rng.range(340, WORLD.size - 60);
    const dir = rng.chance(0.5) ? 1 : -1;
    const off = laneOffset(axis, dir);
    if (axis === 'x') return { x: along, y: road + off, angle: dir > 0 ? 0 : Math.PI, axis, road, dir };
    return { x: road + off, y: along, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2, axis, road, dir };
  }

  function spawnTraffic() {
    const spot = randomRoadSpot();
    const model = rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sport']);
    const car = spawnCar(model, spot.x, spot.y, spot.angle, 'traffic');
    car.axis = spot.axis; car.road = spot.road; car.dir = spot.dir;
    car.speed = CAR_MODELS[model].top * rng.range(0.4, 0.6);
    return car;
  }

  function spawnParked() {
    const spot = randomRoadSpot();
    const model = rng.pick(['sedan', 'sedan', 'taxi', 'sport', 'truck']);
    const off = spot.axis === 'x' ? 27 : -27;
    const x = spot.axis === 'x' ? spot.x : spot.road + off;
    const y = spot.axis === 'x' ? spot.road + off : spot.y;
    const car = spawnCar(model, x, y, spot.angle, 'parked');
    return car;
  }

  function spawnPed() {
    const spot = randomRoadSpot();
    const off = (WORLD.roadWidth / 2 + WORLD.sidewalk + 4) * (rng.chance(0.5) ? 1 : -1);
    const ped = {
      x: spot.axis === 'x' ? spot.x : spot.road + off,
      y: spot.axis === 'x' ? spot.road + off : spot.y,
      angle: rng.range(0, TAU),
      speed: rng.range(38, 68),
      axis: spot.axis, road: spot.road, dir: rng.chance(0.5) ? 1 : -1,
      color: rng.pick(['#e2725b', '#5b8dd9', '#f2a541', '#7fb069', '#c96fd6', '#e8e8e8', '#3d7dd9']),
      side: rng.chance(0.5) ? 1 : -1,
      flee: 0, fleeX: 0, fleeY: 0, down: 0, turnCd: rng.range(1, 4),
    };
    state.peds.push(ped);
    return ped;
  }

  function spawnPoliceCar() {
    // On the nearest road, a few hundred units from the player.
    const p = state.player;
    let best = null; let bestD = 1e9;
    for (const road of ROADS) {
      for (const along of [p.x - 620, p.x + 620, p.y - 620, p.y + 620]) {
        const cand = { x: road, y: along };
        const d = dist(cand.x, cand.y, p.x, p.y);
        if (d > 480 && d < bestD) { bestD = d; best = cand; }
      }
    }
    const x = best ? best.x : clamp(p.x + 600, 340, 2560);
    const y = best ? best.y : clamp(p.y, 40, 2560);
    const car = spawnCar('police', x, y, Math.atan2(p.y - y, p.x - x), 'police');
    car.speed = 200;
    return car;
  }

  function spawnFootCop() {
    const p = state.player;
    const a = rng.range(0, TAU);
    const cop = {
      x: clamp(p.x + Math.cos(a) * 260, 320, 2560),
      y: clamp(p.y + Math.sin(a) * 260, 40, 2560),
      angle: 0, speed: 205, hp: 100, punchCd: 0, giveUp: 0,
    };
    state.cops.push(cop);
    return cop;
  }

  function spawnRival(x, y) {
    const rival = { x, y, angle: 0, hp: 100, shootCd: rng.range(0.5, 1.4), speed: 125 };
    state.rivals.push(rival);
    return rival;
  }

  function addParticles(x, y, n, color, speed, life, size) {
    for (let i = 0; i < n; i += 1) {
      const a = rng.range(0, TAU);
      const sp = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rng.range(life * 0.5, life), max: life,
        size: rng.range(size * 0.6, size * 1.4), color,
      });
    }
    if (state.particles.length > 500) state.particles.splice(0, state.particles.length - 500);
  }

  function explosion(x, y) {
    addParticles(x, y, 26, '#ff9a3c', 260, 0.9, 7);
    addParticles(x, y, 18, '#5a5a66', 120, 1.6, 12);
    addParticles(x, y, 10, '#ffd166', 320, 0.5, 5);
    state.trauma = Math.min(1, state.trauma + 0.7);
    sound('crash');
  }

  // ------------------------------------------------------------ population
  function populate() {
    for (let i = 0; i < 20; i += 1) spawnTraffic();
    for (let i = 0; i < 12; i += 1) spawnParked();
    for (let i = 0; i < 34; i += 1) spawnPed();
    // A couple of parked cars right by the club so the first job is easy to start.
    spawnCar('sedan', 1620, 1150, 0, 'parked');
    spawnCar('taxi', 1470, 1150, Math.PI, 'parked');
  }

  function reset() {
    state = freshState();
    populate();
  }

  function applySave(data) {
    if (!data) return;
    state.money = data.money ?? 250;
    state.player.health = data.health ?? 100;
    state.ammo = data.ammo ?? 0;
    state.hasPistol = !!data.hasPistol;
    state.missionAvailable = data.missionAvailable ?? 0;
    state.missionsDone = data.missionsDone ?? 0;
    if (data.player) {
      state.player.x = clamp(data.player.x, 320, 2560);
      state.player.y = clamp(data.player.y, 40, 2560);
      state.cam.x = state.player.x;
      state.cam.y = state.player.y;
    }
    if (typeof data.clock === 'number') state.clock = data.clock;
  }

  // ------------------------------------------------------------ damage flow
  function damagePlayer(amount) {
    const p = state.player;
    if (state.respawn.active || state.time - p.lastHurt < 0.25) return;
    p.lastHurt = state.time;
    p.health -= amount;
    state.trauma = Math.min(1, state.trauma + 0.25);
    if (p.health <= 0) wastePlayer();
  }

  function bustPlayer() {
    if (state.respawn.active) return;
    state.money = Math.max(0, state.money - 150);
    state.wanted = 0;
    state.cops = [];
    for (const c of state.cars) if (c.driver === 'police') c.driver = 'none';
    state.respawn = { active: true, timer: 2.5, kind: 'BUSTED' };
    say('BUSTED! The La Vega PD took $150 in fines.', 3);
    sound('busted');
  }

  function wastePlayer() {
    if (state.respawn.active) return;
    state.money = Math.max(0, state.money - 200);
    state.wanted = 0;
    state.cops = [];
    for (const c of state.cars) if (c.driver === 'police') c.driver = 'none';
    state.respawn = { active: true, timer: 2.5, kind: 'WASTED' };
    say('WASTED! The medics patched you up — $200 hospital bill.', 3);
    sound('busted');
  }

  function doRespawn() {
    state.respawn.active = false;
    state.player.health = 100;
    state.player.onFoot = true;
    state.player.carId = -1;
    state.player.x = PLACES.hospital.x;
    state.player.y = PLACES.hospital.y + 60;
    state.cam.x = state.player.x;
    state.cam.y = state.player.y;
    state.saveRequested = true;
  }

  function gainWanted(n) {
    if (state.wantedGainCd > 0) return;
    state.wanted = Math.min(5, state.wanted + n);
    state.wantedGainCd = 5;
    state.wantedDecay = 0;
  }

  // ------------------------------------------------------------ player
  function playerCar() {
    if (!state.player.onFoot && state.player.carId >= 0) return state.cars[state.player.carId] ?? null;
    return null;
  }

  function nearestParked(x, y, maxD) {
    let best = null; let bestD = maxD;
    for (const c of state.cars) {
      if (c.driver !== 'parked' && c.driver !== 'none') continue;
      if (c.health <= 0) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    p.onFoot = false;
    p.carId = car.id;
    car.driver = 'player';
    if (car.driver === 'player' && car.stolen === false && (car.prevDriver === 'parked' || car.prevDriver === 'none')) {
      // stolen flag is set below by the caller when appropriate
    }
    car.speed = Math.max(car.speed, 0);
    sound('pickup');
  }

  function exitCar() {
    const p = state.player;
    const car = playerCar();
    if (!car) return;
    car.driver = 'none';
    car.speed = 0; car.vx = 0; car.vy = 0;
    p.onFoot = true;
    p.carId = -1;
    const side = car.angle + Math.PI / 2;
    p.x = clamp(car.x + Math.cos(side) * 30, 320, 2560);
    p.y = clamp(car.y + Math.sin(side) * 30, 40, 2560);
    p.angle = car.angle;
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);

    if (!p.onFoot) {
      const car = playerCar();
      if (!car || car.health <= 0) {
        if (car && car.health <= 0) { explosion(car.x, car.y); }
        p.onFoot = true; p.carId = -1;
        p.health -= 20;
        if (p.health <= 0) { wastePlayer(); return; }
      } else {
        updateDriveCar(car, dt, input);
        p.x = car.x; p.y = car.y; p.angle = car.angle;
        // Damage smoke when the ride is falling apart.
        if (car.health < 50) {
          car.smokeT -= dt;
          if (car.smokeT <= 0) {
            car.smokeT = 0.12;
            state.particles.push({
              x: car.x + rng.range(-8, 8), y: car.y + rng.range(-8, 8),
              vx: rng.range(-15, 15), vy: rng.range(-30, -10),
              life: 1.1, max: 1.1, size: rng.range(6, 11), color: '#5a5a66',
            });
          }
        }
      }
    } else {
      // On foot.
      const speed = input.run ? PLAYER.run : PLAYER.walk;
      const mx = input.mx || 0; const my = input.my || 0;
      if (mx !== 0 || my !== 0) {
        p.angle = Math.atan2(my, mx);
        p.x += mx * speed * dt;
        p.y += my * speed * dt;
      }
      p.x = clamp(p.x, 165, WORLD.size - 10);
      p.y = clamp(p.y, 10, WORLD.size - 10);
      if (collideCircle(p, PLAYER.radius)) {
        // slid along the wall; keep it simple
      }
      // Aim at the mouse while shooting.
      if (input.shoot && input.aimX !== undefined) {
        p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
      }
      // Slow health regen when calm.
      if (state.time - p.lastHurt > 8 && p.health < 100) p.health = Math.min(100, p.health + 1.5 * dt);
    }

    // Punch.
    if (input.punch && p.punchCd <= 0) {
      p.punchCd = 0.35;
      sound('punch');
      const reach = PLAYER.punchRange;
      const tx = p.x + Math.cos(p.angle) * reach;
      const ty = p.y + Math.sin(p.angle) * reach;
      for (const r of state.rivals) {
        if (dist(tx, ty, r.x, r.y) < 34) {
          r.hp -= PLAYER.punchDamage;
          addParticles(r.x, r.y, 6, '#ffd166', 140, 0.4, 4);
        }
      }
      for (const c of state.cops) {
        if (dist(tx, ty, c.x, c.y) < 34) {
          c.hp -= PLAYER.punchDamage;
          addParticles(c.x, c.y, 6, '#ffd166', 140, 0.4, 4);
          gainWanted(1);
        }
      }
    }

    // Shoot.
    if (input.shoot && p.shootCd <= 0 && state.hasPistol && state.ammo > 0) {
      p.shootCd = 0.22;
      state.ammo -= 1;
      state.stats.shots += 1;
      const ax = input.aimX !== undefined ? input.aimX : p.x + Math.cos(p.angle) * 100;
      const ay = input.aimY !== undefined ? input.aimY : p.y + Math.sin(p.angle) * 100;
      const a = Math.atan2(ay - p.y, ax - p.x);
      state.bullets.push({
        x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
        angle: a, speed: 760, life: 0.8, from: 'player', damage: 34,
      });
      state.muzzle = { x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26, t: 0.06 };
      sound('shot');
      gainWanted(1);
      // Pedestrians nearby run for cover.
      for (const ped of state.peds) {
        if (dist(ped.x, ped.y, p.x, p.y) < 320) {
          ped.flee = 3; ped.fleeX = p.x; ped.fleeY = p.y;
        }
      }
    }

    // Enter / exit car, or start a mission at the club.
    if (input.enter) {
      if (!p.onFoot) {
        exitCar();
      } else {
        const car = nearestParked(p.x, p.y, 62);
        const nearClub = dist(p.x, p.y, PLACES.club.x, PLACES.club.y) < 90;
        if (car) {
          const wasParked = car.driver === 'parked';
          car.prevDriver = car.driver;
          enterCar(car);
          if (wasParked) {
            car.stolen = true;
            state.stats.stolen += 1;
            let seen = false;
            for (const c of state.cars) if (c.driver === 'police' && dist(c.x, c.y, p.x, p.y) < 450) seen = true;
            for (const c of state.cops) if (dist(c.x, c.y, p.x, p.y) < 450) seen = true;
            if (seen) { gainWanted(1); say('A cop saw you boost that car!'); }
            else say('Car boosted. Keep it smooth, Jax.');
          }
        } else if (nearClub && state.mission.index < 0 && state.missionAvailable < MISSIONS.length) {
          startMission(state.missionAvailable);
        } else if (nearClub && state.mission.index < 0) {
          say('La Rosa: "You did it all, Jax. The city is yours."');
        }
      }
    }
  }

  function updateDriveCar(car, dt, input) {
    const def = CAR_MODELS[car.model];
    const fwdX = Math.cos(car.angle); const fwdY = Math.sin(car.angle);
    const fwdSpeed = car.vx * fwdX + car.vy * fwdY;
    let throttle = 0;
    if (input.my < 0) throttle = 1; // W / up: forward
    else if (input.my > 0) throttle = -1; // S / down: brake / reverse
    if (throttle > 0) car.speed = Math.min(def.top, car.speed + def.accel * dt);
    else if (throttle < 0) {
      if (fwdSpeed > 30) car.speed = Math.max(0, car.speed - def.accel * 1.6 * dt);
      else car.speed = Math.max(-130, car.speed - def.accel * 0.7 * dt);
    } else {
      car.speed *= Math.max(0, 1 - 0.9 * dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    const steer = input.mx || 0;
    const steerAuthority = clamp(Math.abs(car.speed) / 120, 0.25, 1);
    car.angle += steer * def.turn * steerAuthority * dt * (car.speed < 0 ? -1 : 1);
    // Drift: velocity chases the heading, hard steering at speed leaves skid marks.
    const nx = Math.cos(car.angle); const ny = Math.sin(car.angle);
    const grip = 5;
    car.vx += (nx * car.speed - car.vx) * Math.min(1, grip * dt);
    car.vy += (ny * car.speed - car.vy) * Math.min(1, grip * dt);
    const prevX = car.x; const prevY = car.y;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.x = clamp(car.x, 165, WORLD.size - 10);
    car.y = clamp(car.y, 10, WORLD.size - 10);
    const hitWall = collideCircle(car, CAR_MODELS[car.model].len * 0.42);
    if (hitWall) {
      const impact = Math.abs(car.speed);
      car.speed *= 0.45;
      car.vx *= 0.45; car.vy *= 0.45;
      if (impact > 120) {
        car.health -= Math.min(24, impact * 0.06);
        addParticles(car.x, car.y, 8, '#ffd166', 200, 0.4, 4);
        state.trauma = Math.min(1, state.trauma + 0.25);
        sound('crash');
        if (car.health <= 0) explosion(car.x, car.y);
      }
    }
    // Skid marks on hard turns at speed, or when the car is sliding sideways:
    // segments from the rear wheels.
    const slip = Math.abs(angDiff(car.angle, Math.atan2(car.vy, car.vx)));
    if ((Math.abs(steer) > 0.35 || slip > 0.22) && Math.abs(car.speed) > 210) {
      const bx = car.x - nx * CAR_MODELS[car.model].len * 0.4;
      const by = car.y - ny * CAR_MODELS[car.model].len * 0.4;
      if (car.skidPrev) {
        state.skids.push({ x1: car.skidPrev.x, y1: car.skidPrev.y, x2: bx, y2: by, life: 7 });
        if (state.skids.length > 500) state.skids.splice(0, state.skids.length - 500);
      }
      car.skidPrev = { x: bx, y: by };
    } else {
      car.skidPrev = null;
    }
    // Running over pedestrians is a crime, Jax.
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (dist(ped.x, ped.y, car.x, car.y) < 20) {
        ped.down = 2;
        ped.flee = 4; ped.fleeX = car.x; ped.fleeY = car.y;
        addParticles(ped.x, ped.y, 8, '#ffd166', 160, 0.5, 4);
        gainWanted(1);
        say('You hit a pedestrian! The whole bay saw that.');
      }
    }
  }

  // ------------------------------------------------------------ traffic AI
  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.driver !== 'traffic') continue;
      const def = CAR_MODELS[car.model];
      car.turnCd -= dt;
      // Where this car is along its road.
      const along = car.axis === 'x' ? car.x : car.y;
      // At an intersection, sometimes turn onto the crossing road.
      for (const cross of ROADS) {
        if (Math.abs(along - cross) < 22 && car.turnCd <= 0) {
          car.turnCd = rng.range(2, 5);
          if (rng.chance(0.4)) {
            const newAxis = car.axis === 'x' ? 'y' : 'x';
            const newDir = rng.chance(0.5) ? 1 : -1;
            car.axis = newAxis;
            car.road = cross;
            car.dir = newDir;
            car.angle = newAxis === 'x' ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
          }
          break;
        }
      }
      // End of the road: turn around.
      if (along < 330 || along > WORLD.size - 50) {
        car.dir *= -1;
        car.angle += Math.PI;
        car.turnCd = 3;
      }
      // Brake for the car ahead in the same lane.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car || other.driver === 'none') continue;
        if (other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
        const gap = (car.axis === 'x' ? (other.x - car.x) * car.dir : (other.y - car.y) * car.dir);
        const lateral = car.axis === 'x' ? Math.abs(other.y - car.y) : Math.abs(other.x - car.x);
        if (gap > 0 && gap < 78 && lateral < 26) { blocked = true; break; }
      }
      const target = blocked ? 0 : def.top * 0.55;
      car.speed += clamp(target - car.speed, -def.accel * dt, def.accel * 0.6 * dt);
      // Ease onto the correct lane.
      const wantOff = laneOffset(car.axis, car.dir);
      if (car.axis === 'x') {
        car.y += clamp(car.road + wantOff - car.y, -60 * dt, 60 * dt);
        car.x += car.dir * car.speed * dt;
      } else {
        car.x += clamp(car.road + wantOff - car.x, -60 * dt, 60 * dt);
        car.y += car.dir * car.speed * dt;
      }
      car.vx = car.axis === 'x' ? car.dir * car.speed : 0;
      car.vy = car.axis === 'y' ? car.dir * car.speed : 0;
      collideCircle(car, def.len * 0.42);
    }
    // Keep the streets alive.
    const traffic = state.cars.filter((c) => c.driver === 'traffic').length;
    if (traffic < 18) spawnTraffic();
    const parked = state.cars.filter((c) => c.driver === 'parked').length;
    if (parked < 8) spawnParked();
  }

  // ------------------------------------------------------------ pedestrians
  function updatePeds(dt) {
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) { ped.flee = 3; ped.fleeX = state.player.x; ped.fleeY = state.player.y; }
        continue;
      }
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
        ped.x += Math.cos(a) * 165 * dt;
        ped.y += Math.sin(a) * 165 * dt;
        ped.angle = a;
        ped.x = clamp(ped.x, 165, WORLD.size - 10);
        ped.y = clamp(ped.y, 10, WORLD.size - 10);
        collideCircle(ped, 12);
        continue;
      }
      ped.turnCd -= dt;
      const along = ped.axis === 'x' ? ped.x : ped.y;
      for (const cross of ROADS) {
        if (Math.abs(along - cross) < 18 && ped.turnCd <= 0) {
          ped.turnCd = rng.range(3, 8);
          if (rng.chance(0.35)) {
            ped.axis = ped.axis === 'x' ? 'y' : 'x';
            ped.road = cross;
            ped.dir = rng.chance(0.5) ? 1 : -1;
          }
          break;
        }
      }
      if (along < 330 || along > WORLD.size - 40) ped.dir *= -1;
      const off = (WORLD.roadWidth / 2 + WORLD.sidewalk + 4) * ped.side;
      if (ped.axis === 'x') {
        ped.y += clamp(ped.road + off - ped.y, -80 * dt, 80 * dt);
        ped.x += ped.dir * ped.speed * dt;
        ped.angle = ped.dir > 0 ? 0 : Math.PI;
      } else {
        ped.x += clamp(ped.road + off - ped.x, -80 * dt, 80 * dt);
        ped.y += ped.dir * ped.speed * dt;
        ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    if (state.peds.length < 30) spawnPed();
  }

  // ------------------------------------------------------------ police
  function updatePolice(dt) {
    const p = state.player;
    const wantCars = Math.min(state.wanted, 4);
    const haveCars = state.cars.filter((c) => c.driver === 'police').length;
    if (state.wanted > 0 && haveCars < wantCars && rng.chance(0.02)) spawnPoliceCar();
    const wantCops = state.wanted >= 2 ? Math.min(state.wanted - 1, 3) : 0;
    if (state.wanted > 0 && state.cops.length < wantCops && rng.chance(0.015)) spawnFootCop();

    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      if (state.wanted === 0) { car.driver = 'none'; continue; }
      const def = CAR_MODELS.police;
      const target = Math.atan2(p.y - car.y, p.x - car.x);
      const diff = angDiff(car.angle, target);
      const prevAngle = car.angle;
      car.angle += clamp(diff, -def.turn * dt, def.turn * dt);
      // A cruiser cornering hard leaves skid marks, just like the player's car.
      const turnRate = Math.abs(angDiff(prevAngle, car.angle)) / dt;
      if (turnRate > 1.0 && car.speed > 200) {
        const bx = car.x - Math.cos(car.angle) * def.len * 0.4;
        const by = car.y - Math.sin(car.angle) * def.len * 0.4;
        if (car.skidPrev) {
          state.skids.push({ x1: car.skidPrev.x, y1: car.skidPrev.y, x2: bx, y2: by, life: 7 });
          if (state.skids.length > 500) state.skids.splice(0, state.skids.length - 500);
        }
        car.skidPrev = { x: bx, y: by };
      } else {
        car.skidPrev = null;
      }
      const chaseTop = def.top * (state.wanted >= 4 ? 1.0 : 0.92);
      car.speed = Math.min(chaseTop, car.speed + def.accel * dt);
      const nx = Math.cos(car.angle); const ny = Math.sin(car.angle);
      car.vx += (nx * car.speed - car.vx) * Math.min(1, 5 * dt);
      car.vy += (ny * car.speed - car.vy) * Math.min(1, 5 * dt);
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      car.x = clamp(car.x, 165, WORLD.size - 10);
      car.y = clamp(car.y, 10, WORLD.size - 10);
      const hitWall = collideCircle(car, def.len * 0.42);
      if (hitWall) { car.speed *= 0.5; car.vx *= 0.5; car.vy *= 0.5; car.stuckT += dt; }
      else car.stuckT = Math.max(0, car.stuckT - dt);
      if (car.stuckT > 2.5) {
        // Stuck on a building: respawn the cruiser elsewhere.
        car.x = clamp(p.x + (rng.chance(0.5) ? -600 : 600), 340, 2560);
        car.y = clamp(p.y + (rng.chance(0.5) ? -500 : 500), 40, 2560);
        car.stuckT = 0;
        car.speed = 150;
      }
      const d = dist(car.x, car.y, p.x, p.y);
      car.ramCd -= dt;
      if (d < 58 && car.ramCd <= 0) {
        car.ramCd = 0.7;
        if (p.onFoot) { bustPlayer(); }
        else {
          const pc = playerCar();
          if (pc) {
            pc.health -= 3;
            car.health -= 3;
            addParticles(p.x, p.y, 8, '#ffd166', 200, 0.4, 4);
            state.trauma = Math.min(1, state.trauma + 0.3);
            sound('crash');
            if (pc.health <= 0) explosion(pc.x, pc.y);
          }
        }
      }
      // Police cars ram each other apart, they do not stack.
      for (const other of state.cars) {
        if (other === car || other.driver !== 'police') continue;
        const dd = dist(car.x, car.y, other.x, other.y);
        if (dd < 50 && dd > 0.01) {
          const push = (50 - dd) / 2;
          const ax = (car.x - other.x) / dd; const ay = (car.y - other.y) / dd;
          car.x += ax * push; car.y += ay * push;
          other.x -= ax * push; other.y -= ay * push;
        }
      }
    }

    for (let i = state.cops.length - 1; i >= 0; i -= 1) {
      const cop = state.cops[i];
      if (state.wanted === 0) { state.cops.splice(i, 1); continue; }
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d > 800) { state.cops.splice(i, 1); continue; }
      if (!p.onFoot) {
        cop.giveUp += dt;
        if (cop.giveUp > 2.5) { state.cops.splice(i, 1); continue; }
      } else cop.giveUp = 0;
      cop.punchCd -= dt;
      const a = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = a;
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      collideCircle(cop, 12);
      if (d < 24 && p.onFoot) bustPlayer();
      else if (d < 40 && cop.punchCd <= 0 && p.onFoot) {
        cop.punchCd = 0.8;
        damagePlayer(9);
        sound('punch');
      }
    }
  }

  // ------------------------------------------------------------ rivals
  function updateRivals(dt) {
    const p = state.player;
    for (let i = state.rivals.length - 1; i >= 0; i -= 1) {
      const r = state.rivals[i];
      if (r.hp <= 0) {
        addParticles(r.x, r.y, 14, '#e25f7a', 180, 0.7, 5);
        state.rivals.splice(i, 1);
        sound('crash');
        continue;
      }
      const d = dist(r.x, r.y, p.x, p.y);
      const a = Math.atan2(p.y - r.y, p.x - r.x);
      r.angle = a;
      if (d > 200) {
        r.x += Math.cos(a) * r.speed * dt;
        r.y += Math.sin(a) * r.speed * dt;
        collideCircle(r, 12);
      }
      r.shootCd -= dt;
      if (r.shootCd <= 0 && d < 430 && !state.respawn.active) {
        r.shootCd = rng.range(1.1, 1.7);
        const spread = rng.range(-0.16, 0.16);
        state.bullets.push({
          x: r.x + Math.cos(a) * 20, y: r.y + Math.sin(a) * 20,
          angle: a + spread, speed: 620, life: 0.9, from: 'rival', damage: 8,
        });
        sound('enemyShot');
      }
    }
  }

  // ------------------------------------------------------------ bullets
  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.life -= dt;
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      let dead = b.life <= 0 || b.x < 150 || b.x > WORLD.size || b.y < 0 || b.y > WORLD.size;
      if (!dead && pointInBuilding(b.x, b.y)) {
        addParticles(b.x, b.y, 4, '#c9c2b4', 120, 0.3, 3);
        dead = true;
      }
      if (!dead && b.from === 'player') {
        for (const r of state.rivals) {
          if (dist(b.x, b.y, r.x, r.y) < 16) {
            r.hp -= b.damage;
            addParticles(b.x, b.y, 6, '#e25f7a', 160, 0.4, 4);
            dead = true; break;
          }
        }
        if (!dead) for (const c of state.cops) {
          if (dist(b.x, b.y, c.x, c.y) < 16) {
            c.hp -= b.damage;
            addParticles(b.x, b.y, 6, '#3d7dd9', 160, 0.4, 4);
            gainWanted(1);
            dead = true; break;
          }
        }
        if (!dead) for (const ped of state.peds) {
          if (ped.down <= 0 && dist(b.x, b.y, ped.x, ped.y) < 15) {
            ped.down = 3;
            gainWanted(1);
            addParticles(b.x, b.y, 6, '#e25f7a', 160, 0.4, 4);
            dead = true; break;
          }
        }
        if (!dead) for (const car of state.cars) {
          if (car.driver === 'player') continue;
          if (dist(b.x, b.y, car.x, car.y) < 26) {
            car.health -= b.damage * 0.5;
            addParticles(b.x, b.y, 5, '#ffd166', 160, 0.35, 4);
            if (car.health <= 0 && car.driver !== 'none') explosion(car.x, car.y);
            dead = true; break;
          }
        }
      }
      if (!dead && b.from === 'rival') {
        const p = state.player;
        const pc = playerCar();
        if (pc && dist(b.x, b.y, pc.x, pc.y) < 28) {
          pc.health -= b.damage * 0.5;
          addParticles(b.x, b.y, 5, '#ffd166', 160, 0.35, 4);
          if (pc.health <= 0) explosion(pc.x, pc.y);
          dead = true;
        } else if (p.onFoot && dist(b.x, b.y, p.x, p.y) < 15) {
          damagePlayer(b.damage);
          addParticles(b.x, b.y, 5, '#e25f7a', 160, 0.35, 4);
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  // ------------------------------------------------------------ wanted
  function updateWanted(dt) {
    state.wantedGainCd = Math.max(0, state.wantedGainCd - dt);
    if (state.wanted === 0) return;
    let near = false;
    for (const c of state.cars) {
      if (c.driver === 'police' && dist(c.x, c.y, state.player.x, state.player.y) < 550) { near = true; break; }
    }
    if (!near) for (const c of state.cops) {
      if (dist(c.x, c.y, state.player.x, state.player.y) < 550) { near = true; break; }
    }
    if (near) state.wantedDecay = 0;
    else {
      state.wantedDecay += dt;
      if (state.wantedDecay >= 8) {
        state.wantedDecay = 0;
        state.wanted -= 1;
        if (state.wanted === 0) say('You lost the cops. The heat is off — for now.');
        else say('The heat is cooling off...');
      }
    }
  }

  // ------------------------------------------------------------ missions
  function missionMarker() {
    const step = currentStep(state.mission);
    if (!step) return null;
    if (step.marker) return step.marker;
    if (step.type === 'steal') {
      const car = nearestParked(state.player.x, state.player.y, 100000);
      return car ? { x: car.x, y: car.y } : PLACES.club;
    }
    if (step.type === 'evade') return null;
    return null;
  }

  function startMission(index) {
    const def = MISSIONS[index];
    state.mission = { index, step: 0, timer: 0, hasPackage: false };
    if (def.id === 3) {
      state.wanted = Math.max(state.wanted, 2);
      state.mission.timer = 150;
    }
    if (def.id === 5) state.mission.timer = 150;
    say(`${def.name} — ${def.giver}: ${def.intro}`, 6);
    sound('pickup');
  }

  function completeMission() {
    const def = MISSIONS[state.mission.index];
    state.money += def.reward;
    state.missionsDone += 1;
    state.missionAvailable = Math.max(state.missionAvailable, state.mission.index + 1);
    say(`${def.name} complete! +$${def.reward}. ${def.onComplete}`, 6);
    sound('jingle');
    if (def.id === 1) { state.hasPistol = true; state.ammo += 24; }
    if (def.id === 4) state.ammo += 48;
    state.mission = { index: -1, step: 0, timer: 0, hasPackage: false };
    state.saveRequested = true;
  }

  function failMission(reason) {
    say(`Job failed: ${reason} Talk to La Rosa to try again.`, 5);
    sound('fail');
    state.mission = { index: -1, step: 0, timer: 0, hasPackage: false };
  }

  function updateMission(dt) {
    if (state.mission.index < 0) return;
    const def = MISSIONS[state.mission.index];
    const step = currentStep(state.mission);
    if (!step) { completeMission(); return; }
    const p = state.player;

    if (step.type === 'checkpoint' || def.id === 5) {
      state.mission.timer -= dt;
      if (state.mission.timer <= 0) { failMission('Out of time on The La Vega Score.'); return; }
    }
    if (def.id === 3) {
      state.mission.timer -= dt;
      if (state.mission.timer <= 0 && state.wanted > 0) { failMission('The cops never lost you.'); return; }
    }

    const marker = missionMarker();
    const reachR = step.type === 'checkpoint' ? 55 : 48;
    switch (step.type) {
      case 'steal': {
        const car = playerCar();
        if (car && car.stolen) state.mission.step += 1;
        break;
      }
      case 'reach': {
        if (marker && dist(p.x, p.y, marker.x, marker.y) < reachR) {
          if (def.id === 2 && state.mission.step === 0) {
            state.mission.hasPackage = true;
            state.wanted = Math.max(state.wanted, 2);
            say('Package grabbed. Cops are onto you — get it to the club!');
            sound('pickup');
          }
          if (def.id === 4 && state.mission.step === 0) {
            // The Vultures are waiting in the cannery.
            spawnRival(PLACES.warehouse.x + 30, PLACES.warehouse.y + 30);
            spawnRival(PLACES.warehouse.x + 90, PLACES.warehouse.y + 60);
            spawnRival(PLACES.warehouse.x + 40, PLACES.warehouse.y + 100);
            spawnRival(PLACES.warehouse.x + 110, PLACES.warehouse.y + 20);
            say('The Vultures are here. Four of them. Make it count, Jax.');
          }
          state.mission.step += 1;
        }
        break;
      }
      case 'deliver': {
        const okCar = !step.needCar || !p.onFoot;
        if (marker && okCar && dist(p.x, p.y, marker.x, marker.y) < reachR) state.mission.step += 1;
        break;
      }
      case 'evade': {
        if (state.wanted === 0) state.mission.step += 1;
        break;
      }
      case 'killAll': {
        if (state.rivals.length === 0) state.mission.step += 1;
        break;
      }
      case 'checkpoint': {
        if (marker && dist(p.x, p.y, marker.x, marker.y) < reachR) {
          state.mission.timer += 20;
          state.mission.step += 1;
          sound('pickup');
          say(`Checkpoint! +20s on the clock.`, 2);
        }
        break;
      }
      default:
        break;
    }
    if (state.mission.index >= 0 && state.mission.step >= def.steps.length) completeMission();
  }

  // ------------------------------------------------------------ main step
  function step(dt, input, demo) {
    state.time += dt;
    state.clock = (state.clock + dt / 60) % 24; // 1 real second = 1 game minute
    state.trauma = Math.max(0, state.trauma - dt * 1.4);
    if (state.muzzle) {
      state.muzzle.t -= dt;
      if (state.muzzle.t <= 0) state.muzzle = null;
    }
    for (let i = state.skids.length - 1; i >= 0; i -= 1) {
      state.skids[i].life -= dt;
      if (state.skids[i].life <= 0) state.skids.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98; pt.vy *= 0.98;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }

    if (state.respawn.active) {
      state.respawn.timer -= dt;
      if (state.respawn.timer <= 0) doRespawn();
      // The city keeps moving while Jax is down.
      updateTraffic(dt);
      updatePeds(dt);
      return;
    }

    if (!demo) updatePlayer(dt, input);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateRivals(dt);
    updateBullets(dt);
    updateWanted(dt);
    if (!demo) updateMission(dt);

    // Car-vs-car collisions (all pairs, cheap at this scale).
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i]; const b = cars[j];
        if (a.driver === 'none' && b.driver === 'none') continue;
        const rr = (CAR_MODELS[a.model].len + CAR_MODELS[b.model].len) * 0.32;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < rr && d > 0.01) {
          const push = (rr - d) / 2;
          const ax = (a.x - b.x) / d; const ay = (a.y - b.y) / d;
          a.x += ax * push; a.y += ay * push;
          b.x -= ax * push; b.y -= ay * push;
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 90) {
            a.health -= 4; b.health -= 4;
            a.speed *= 0.7; b.speed *= 0.7;
            addParticles((a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffd166', 180, 0.35, 4);
            if (a.driver === 'player' || b.driver === 'player') {
              state.trauma = Math.min(1, state.trauma + 0.2);
              sound('crash');
            }
            if (a.health <= 0 && a.driver !== 'none') explosion(a.x, a.y);
            if (b.health <= 0 && b.driver !== 'none') explosion(b.x, b.y);
          }
        }
      }
    }
    // Wrecked cars smoulder, then get towed away.
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const c = cars[i];
      if (c.health <= 0 && c.driver !== 'player') {
        c.wreckT += dt;
        if (c.wreckT > 25) {
          if (c.driver === 'traffic' || c.driver === 'police') cars.splice(i, 1);
          else c.driver = 'none';
        }
      }
    }

    // Camera follows the player.
    const tx = state.player.x; const ty = state.player.y;
    state.cam.x += (tx - state.cam.x) * Math.min(1, 6 * dt);
    state.cam.y += (ty - state.cam.y) * Math.min(1, 6 * dt);
    const hw = state.viewW / 2; const hh = state.viewH / 2;
    state.cam.x = clamp(state.cam.x, Math.min(hw, WORLD.size / 2), Math.max(WORLD.size - hw, WORLD.size / 2));
    state.cam.y = clamp(state.cam.y, Math.min(hh, WORLD.size / 2), Math.max(WORLD.size - hh, WORLD.size / 2));
    if (state.viewW >= WORLD.size) state.cam.x = WORLD.size / 2;
    if (state.viewH >= WORLD.size) state.cam.y = WORLD.size / 2;
  }

  reset();

  return {
    get state() { return state; },
    reset,
    step,
    applySave,
    startMission,
    missionMarker,
    say,
  };
}
