// SOLMAR HEAT — canvas renderer. Warm sun-baked palette, soft shadows, a live
// minimap, and full HUD. Pure drawing: reads state, never mutates it.

const SCREEN_TITLE = 'title';
const SCREEN_PLAY = 'play';
const SCREEN_PAUSED = 'paused';


function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ------------------------------------------------------------ world layers
  function drawGround(state, camX, camY) {
    const x0 = camX - viewW / 2 - 60; const y0 = camY - viewH / 2 - 60;
    const x1 = camX + viewW / 2 + 60; const y1 = camY + viewH / 2 + 60;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Mown checker for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    const cell = 130;
    for (let gx = Math.floor(x0 / cell) * cell; gx < x1; gx += cell) {
      for (let gy = Math.floor(y0 / cell) * cell; gy < y1; gy += cell) {
        if (((gx + gy) / cell) % 2 === 0) ctx.fillRect(gx, gy, cell, cell);
      }
    }
    // Sea + wet sand + beach (west edge).
    const seaW = WORLD.seaX;
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(x0, y0, Math.max(0, Math.min(seaW, x1) - x0), y1 - y0);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(x0, y0, Math.max(0, Math.min(seaW - 18, x1) - x0), y1 - y0);
    // Animated wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let wy = Math.floor(y0 / 90) * 90; wy < y1; wy += 90) {
      const wob = Math.sin(state.time * 1.4 + wy * 0.05) * 8;
      ctx.beginPath();
      ctx.moveTo(WORLD.seaX - 26 + wob, wy);
      ctx.quadraticCurveTo(WORLD.seaX - 10 + wob, wy + 22, WORLD.seaX - 26 + wob, wy + 44);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.sandWet;
    ctx.fillRect(Math.max(x0, WORLD.seaX), y0, Math.max(0, Math.min(WORLD.sandX, x1) - Math.max(x0, WORLD.seaX)), y1 - y0);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, WORLD.seaX + 26), y0, Math.max(0, Math.min(WORLD.sandX, x1) - Math.max(x0, WORLD.seaX + 26)), y1 - y0);

    // Park.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(ROADS[2] + 51, ROADS[1] + 51, ROADS[3] - ROADS[2] - 102, ROADS[2] - ROADS[1] - 102);
    // Park pond.
    ctx.fillStyle = PALETTE.pond;
    ctx.beginPath();
    ctx.ellipse(1040, 760, 46, 30, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(1030, 752, 18, 8, -0.4, 0, TAU);
    ctx.fill();
  }

  function drawRoads() {
    // Asphalt + sidewalks.
    for (const road of ROADS) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(300, road - WORLD.roadWidth / 2 - WORLD.sidewalk, WORLD.size - 300, WORLD.roadWidth + WORLD.sidewalk * 2);
      ctx.fillRect(road - WORLD.roadWidth / 2 - WORLD.sidewalk, 0, WORLD.roadWidth + WORLD.sidewalk * 2, WORLD.size);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(300, road - WORLD.roadWidth / 2, WORLD.size - 300, WORLD.roadWidth);
      ctx.fillRect(road - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.size);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const road of ROADS) {
      for (let d = 320; d < WORLD.size; d += 46) {
        ctx.fillRect(d, road - 2, 24, 4);
        ctx.fillRect(road - 2, d, 4, 24);
      }
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(245,239,228,0.85)';
    for (const rx of ROADS) {
      for (const ry of ROADS) {
        for (let k = -2; k <= 2; k += 1) {
          ctx.fillRect(rx - 30 + k * 13, ry - WORLD.roadWidth / 2 - 8, 7, 16);
          ctx.fillRect(rx - 30 + k * 13, ry + WORLD.roadWidth / 2 - 8, 7, 16);
          ctx.fillRect(rx - WORLD.roadWidth / 2 - 8, ry - 30 + k * 13, 16, 7);
          ctx.fillRect(rx + WORLD.roadWidth / 2 - 8, ry - 30 + k * 13, 16, 7);
        }
      }
    }
    // Pier: wooden deck into the sea at y 1280..1320.
    ctx.fillStyle = PALETTE.pierDark;
    ctx.fillRect(28, 1278, 130, 44);
    ctx.fillStyle = PALETTE.pier;
    for (let px = 34; px < 150; px += 12) ctx.fillRect(px, 1282, 9, 36);
    ctx.fillStyle = '#6b4a2c';
    for (let px = 40; px < 150; px += 28) {
      ctx.beginPath(); ctx.arc(px, 1282, 3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(px, 1318, 3, 0, TAU); ctx.fill();
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      // Soft shadow to the south-east (the sun is high, slightly west).
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.shadow * 0.7, b.y + b.shadow, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingWall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      // Roof details: vents / skylights.
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.22, b.h * 0.2);
      ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.55, b.w * 0.18, b.h * 0.18);
      if (b.kind === 'hospital') {
        ctx.fillStyle = '#e01e37';
        ctx.fillRect(b.x + b.w / 2 - 4, b.y + b.h / 2 - 14, 8, 28);
        ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h / 2 - 4, 28, 8);
      }
      if (b.kind === 'club') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LA ROSA', b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
      if (b.kind === 'warehouse') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CANNERY', b.x + b.w / 2, b.y + b.h / 2 + 4);
      }
    }
    for (const c of state.city.crates) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(c.x - c.s / 2 + 3, c.y - c.s / 2 + 4, c.s, c.s);
      ctx.fillStyle = '#b98a4e';
      ctx.fillRect(c.x - c.s / 2, c.y - c.s / 2, c.s, c.s);
      ctx.strokeStyle = '#8a5f3c';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - c.s / 2 + 1, c.y - c.s / 2 + 1, c.s - 2, c.s - 2);
      ctx.beginPath();
      ctx.moveTo(c.x - c.s / 2, c.y - c.s / 2);
      ctx.lineTo(c.x + c.s / 2, c.y + c.s / 2);
      ctx.stroke();
    }
  }

  function drawTrees(state) {
    for (const t of state.city.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, 13 * t.s, 10 * t.s, 0, 0, TAU); ctx.fill();
      if (t.palm) {
        ctx.strokeStyle = '#8a5f3c';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 3, t.y - 14 * t.s); ctx.stroke();
        ctx.strokeStyle = '#3f9e4d';
        ctx.lineWidth = 3;
        for (let k = 0; k < 5; k += 1) {
          const a = -Math.PI / 2 + (k - 2) * 0.55;
          ctx.beginPath();
          ctx.moveTo(t.x + 3, t.y - 14 * t.s);
          ctx.quadraticCurveTo(t.x + 3 + Math.cos(a) * 12, t.y - 14 * t.s + Math.sin(a) * 8, t.x + 3 + Math.cos(a) * 18, t.y - 14 * t.s + Math.sin(a) * 14);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#4e9e4a';
        ctx.beginPath(); ctx.arc(t.x, t.y, 12 * t.s, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6fbf5a';
        ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, 8 * t.s, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a5f3c';
        ctx.fillRect(t.x - 2, t.y + 6, 4, 8);
      }
    }
    for (const l of state.city.lamps) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.arc(l.x + 2, l.y + 2, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a3f4a';
      ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(l.x, l.y, 2, 0, TAU); ctx.fill();
    }
  }

  function drawCar(car, time) {
    const def = CAR_MODELS[car.model];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(-def.len / 2 + 3, -def.wid / 2 + 4, def.len, def.wid, 7);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.health <= 0 ? '#3a3a3a' : car.color;
    rr(-def.len / 2, -def.wid / 2, def.len, def.wid, 7);
    ctx.fill();
    if (car.model === 'police') {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(-4, -def.wid / 2, 10, def.wid);
      // Flashing light bar.
      const phase = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e4d' : '#2e7dff';
      ctx.fillRect(-6, -def.wid / 2 - 2, 5, 5);
      ctx.fillStyle = phase ? '#2e7dff' : '#ff2e4d';
      ctx.fillRect(1, -def.wid / 2 - 2, 5, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
    }
    if (car.model === 'taxi') {
      ctx.fillStyle = '#222';
      for (let k = 0; k < 4; k += 1) ctx.fillRect(-def.len / 2 + 8 + k * 8, -def.wid / 2, 4, 4);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    rr(-def.len * 0.22, -def.wid / 2 + 4, def.len * 0.36, def.wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillRect(def.len * 0.14, -def.wid / 2 + 5, 4, def.wid - 10);
    // Wheels.
    ctx.fillStyle = '#151515';
    const wl = def.len * 0.32; const ww = 5;
    ctx.fillRect(-wl, -def.wid / 2 - 2, 10, ww);
    ctx.fillRect(-wl, def.wid / 2 - 3, 10, ww);
    ctx.fillRect(wl - 10, -def.wid / 2 - 2, 10, ww);
    ctx.fillRect(wl - 10, def.wid / 2 - 3, 10, ww);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(def.len / 2 - 2, -def.wid / 2 + 3, 3, 5);
    ctx.fillRect(def.len / 2 - 2, def.wid / 2 - 8, 3, 5);
    ctx.restore();
    // Damage smoke is spawned by the world; the burnt shell is enough here.
  }

  function drawPerson(x, y, angle, color, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down > 0) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(2, 3, 12, 8, 0, 0, TAU); ctx.fill();
    } else {
      ctx.rotate(angle);
    }
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(2, 3, 10, 8, 0, 0, TAU); ctx.fill();
    // Body (shirt) + head.
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(down > 0 ? 0 : 3, 0, 5.5, 0, TAU); ctx.fill();
    // Facing tick.
    if (down <= 0) {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(7, -2, 1.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(7, 2, 1.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.onFoot) {
      drawPerson(p.x, p.y, p.angle, '#e01e37', 0);
      // Jax's red jacket + cap.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#e01e37';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#20242c';
      ctx.beginPath(); ctx.arc(4, 0, 5.5, 0, TAU); ctx.fill();
      ctx.restore();
      if (state.hasPistol) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#222';
        ctx.fillRect(8, -2, 10, 4);
        ctx.restore();
      }
    }
    if (state.muzzle) {
      ctx.fillStyle = 'rgba(255,220,90,0.95)';
      ctx.beginPath();
      ctx.arc(state.muzzle.x, state.muzzle.y, 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(state.muzzle.x, state.muzzle.y, 4, 0, TAU);
      ctx.fill();
    }
  }

  // ------------------------------------------------------------ markers / fx
  function drawMissionMarker(state, marker) {
    if (!marker) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    // Ground beacon.
    ctx.strokeStyle = 'rgba(255,210,60,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 26 * pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,60,0.25)';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 26 * pulse, 0, TAU);
    ctx.fill();
    // Light beam.
    const grad = ctx.createLinearGradient(marker.x, marker.y - 220, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(255,210,60,0)');
    grad.addColorStop(1, 'rgba(255,210,60,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(marker.x - 7, marker.y - 220, 14, 220);
    // Diamond above.
    const bob = Math.sin(state.time * 3) * 6;
    ctx.fillStyle = '#ffd23c';
    ctx.save();
    ctx.translate(marker.x, marker.y - 46 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.strokeStyle = '#8a5f00';
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(marker.x, marker.y - 46 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.max) * 0.8;
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1.6 - pt.life / pt.max * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const s of state.skids) {
      ctx.globalAlpha = Math.max(0, Math.min(0.55, s.life / 7 * 0.55));
      ctx.strokeStyle = '#1c1c22';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Bullets.
    ctx.strokeStyle = '#ffe9a3';
    ctx.lineWidth = 2;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------ HUD
  function text(str, x, y, size, color, align = 'left', bold = true) {
    ctx.font = `${bold ? 'bold' : ''} ${size}px system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawMinimap(state) {
    const size = 168;
    const x = viewW - size - 14;
    const y = viewH - size - 14;
    const scale = size / WORLD.size;
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,24,0.82)';
    rr(x - 6, y - 6, size + 12, size + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    // Sea + sand.
    ctx.fillStyle = '#1e7fc0';
    ctx.fillRect(x, y, WORLD.seaX * scale, size);
    ctx.fillStyle = '#f2d492';
    ctx.fillRect(x + WORLD.seaX * scale, y, (WORLD.sandX - WORLD.seaX) * scale, size);
    ctx.fillStyle = '#8fce62';
    ctx.fillRect(x + WORLD.sandX * scale, y, size - WORLD.sandX * scale, size);
    // Roads.
    ctx.fillStyle = '#3d4149';
    for (const road of ROADS) {
      ctx.fillRect(x + (road - 35) * scale, y, 70 * scale, size);
      ctx.fillRect(x, y + (road - 35) * scale, size, 70 * scale);
    }
    // Buildings.
    ctx.fillStyle = 'rgba(245,239,228,0.85)';
    for (const b of state.city.buildings) {
      ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
    }
    // Mission marker.
    const marker = state._marker;
    if (marker) {
      const pulse = 3 + Math.sin(state.time * 5) * 1.5;
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath();
      ctx.arc(x + marker.x * scale, y + marker.y * scale, pulse + 2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#8a5f00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Parked/traffic cars as faint dots.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const c of state.cars) {
      if (c.driver === 'police') continue;
      ctx.fillRect(x + c.x * scale - 1, y + c.y * scale - 1, 2, 2);
    }
    // Police blips (flashing).
    if (Math.floor(state.time * 2) % 2 === 0) ctx.fillStyle = '#ff2e4d';
    else ctx.fillStyle = '#2e7dff';
    for (const c of state.cars) {
      if (c.driver !== 'police') continue;
      ctx.beginPath();
      ctx.arc(x + c.x * scale, y + c.y * scale, 3.5, 0, TAU);
      ctx.fill();
    }
    for (const c of state.cops) {
      ctx.beginPath();
      ctx.arc(x + c.x * scale, y + c.y * scale, 3, 0, TAU);
      ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(x + state.player.x * scale, y + state.player.y * scale);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    text('SOLMAR BAY', x + size / 2, y - 8, 11, '#fff', 'center');
  }

  function drawHUD(state) {
    // Top-left: cash, health, ammo.
    text(`$${state.money.toLocaleString('en-US')}`, 18, 34, 26, '#7dff8a');
    const hw = 190;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(16, 44, hw + 4, 18, 6);
    ctx.fill();
    const hpFrac = Math.max(0, state.player.health / 100);
    ctx.fillStyle = hpFrac > 0.5 ? '#5be35b' : hpFrac > 0.25 ? '#ffb02e' : '#ff3b30';
    rr(18, 46, hw * hpFrac, 14, 5);
    ctx.fill();
    text('HEALTH', 214, 59, 12, '#fff');
    if (state.hasPistol) text(`PISTOL  •  AMMO ${state.ammo}`, 18, 84, 15, '#ffe9a3');
    else text('NO WEAPON — finish Job 1 for a pistol', 18, 84, 13, '#ffd9d9');

    // Top-right: wanted stars + clock. Filled stars gold, empty stars grey.
    const filled = '★'.repeat(state.wanted);
    const empty = '☆'.repeat(5 - state.wanted);
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const emptyW = ctx.measureText(empty).width;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(empty, viewW - 18, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(empty, viewW - 18, 34);
    ctx.strokeText(filled, viewW - 18 - emptyW, 34);
    ctx.fillStyle = '#ffd23c';
    ctx.fillText(filled, viewW - 18 - emptyW, 34);
    const hh = Math.floor(state.clock);
    const mm = Math.floor((state.clock - hh) * 60);
    text(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, viewW - 18, 60, 16, '#fff', 'right');
    if (state.wanted > 0) text('WANTED', viewW - 18, 82, 12, '#ff5b5b', 'right');

    // Bottom-left: objective tracker.
    const obj = objectiveText(state);
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    const lines = wrapText(obj, 430);
    const boxH = 30 + lines.length * 18;
    rr(14, viewH - boxH - 14, 460, boxH, 10);
    ctx.fill();
    text('CURRENT JOB', 28, viewH - boxH + 8, 12, '#ffd23c');
    lines.forEach((line, i) => text(line, 28, viewH - boxH + 30 + i * 18, 14, '#fff', 'left', false));

    // Context prompt.
    const prompt = contextPrompt(state);
    if (prompt) {
      text(prompt, viewW / 2, viewH - 196, 16, '#fff', 'center');
    }

    // Toast message.
    if (state.message.text && state.time < state.message.until) {
      const alpha = Math.min(1, (state.message.until - state.time) / 0.8);
      ctx.globalAlpha = alpha;
      const mw = Math.min(760, ctx.measureText(state.message.text).width + 60);
      ctx.fillStyle = 'rgba(10,16,24,0.8)';
      rr(viewW / 2 - mw / 2, 96, mw, 44, 10);
      ctx.fill();
      text(state.message.text, viewW / 2, 125, 16, '#fff', 'center', false);
      ctx.globalAlpha = 1;
    }

    // Busted / wasted overlay.
    if (state.respawn.active) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, viewW, viewH);
      text(state.respawn.kind, viewW / 2, viewH / 2 - 10, 64, state.respawn.kind === 'BUSTED' ? '#5b8dd9' : '#ff3b30', 'center');
      text('The city keeps moving without you...', viewW / 2, viewH / 2 + 30, 18, '#fff', 'center', false);
    }

    drawMinimap(state);
  }

  function wrapText(str, maxW) {
    ctx.font = '14px system-ui, sans-serif';
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function contextPrompt(state) {
    const p = state.player;
    if (!p.onFoot) return 'E — exit car';
    for (const c of state.cars) {
      if ((c.driver === 'parked' || c.driver === 'none') && c.health > 0) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < 62) return 'E — get in the car';
      }
    }
    if (state.mission.index < 0 && state.missionAvailable < 5) {
      if (Math.hypot(p.x - PLACES.club.x, p.y - PLACES.club.y) < 90) {
        return 'E — talk to La Rosa, start the next job';
      }
    }
    return '';
  }

  // ------------------------------------------------------------ screens
  function drawTitle(state, hasSave, selected) {
    // The living city behind the menu.
    drawWorld(state, 0);
    ctx.fillStyle = 'rgba(8,14,22,0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    // Sun.
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(viewW - 180, 110, 46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,210,60,0.25)';
    ctx.beginPath();
    ctx.arc(viewW - 180, 110, 70, 0, TAU);
    ctx.fill();

    text('SOLMAR HEAT', viewW / 2, viewH * 0.3, 72, '#ffd23c', 'center');
    text('An open-world crime story in Solmar Bay', viewW / 2, viewH * 0.3 + 44, 22, '#fff', 'center', false);
    text('Jax Vega  •  La Rosa  •  Five jobs  •  One very hot city', viewW / 2, viewH * 0.3 + 74, 15, '#ffe9a3', 'center', false);

    const items = hasSave ? ['New Game', 'Continue', 'How to play'] : ['New Game', 'How to play'];
    items.forEach((item, i) => {
      const y = viewH * 0.52 + i * 46;
      if (selected === i) {
        ctx.fillStyle = 'rgba(255,210,60,0.9)';
        rr(viewW / 2 - 170, y - 26, 340, 38, 8);
        ctx.fill();
        text(item, viewW / 2, y, 20, '#20242c', 'center');
      } else {
        text(item, viewW / 2, y, 20, '#fff', 'center');
      }
    });

    text('WASD / arrows — move & drive    SHIFT — run    SPACE — punch    F — shoot (aim with mouse)', viewW / 2, viewH - 96, 15, '#fff', 'center', false);
    text('E — enter / steal car, talk to La Rosa    P — pause    M — mute', viewW / 2, viewH - 70, 15, '#fff', 'center', false);
    text('All names, characters, vehicles and places are original. Not affiliated with Rockstar Games.', viewW / 2, viewH - 40, 12, 'rgba(255,255,255,0.65)', 'center', false);
  }

  function drawHowTo() {
    ctx.fillStyle = 'rgba(8,14,22,0.88)';
    ctx.fillRect(0, 0, viewW, viewH);
    text('HOW TO PLAY', viewW / 2, 120, 40, '#ffd23c', 'center');
    const lines = [
      'You are Jax Vega, a driver fresh off the ferry in Solmar Bay.',
      'La Rosa runs the club on Marlin Row — she has five jobs for you.',
      '',
      'On foot: WASD to move, SHIFT to run, SPACE to punch, F to shoot.',
      'Near a parked car: press E to get in. That is stealing. Cops notice.',
      'In a car: W/S to drive and brake, A/D to steer. Hard turns leave skid marks.',
      '',
      'Stars mean the Solmar PD wants you. Lose them by hiding and laying low.',
      'Busted or wasted: you wake up at Solmar General, lighter in the wallet.',
      'Finish all five jobs to own the city. Your progress auto-saves.',
      '',
      'Press Enter or click to go back.',
    ];
    lines.forEach((line, i) => text(line, viewW / 2, 180 + i * 30, 16, '#fff', 'center', false));
  }

  function drawPaused(state) {
    drawWorld(state, 0);
    ctx.fillStyle = 'rgba(8,14,22,0.6)';
    ctx.fillRect(0, 0, viewW, viewH);
    text('PAUSED', viewW / 2, viewH * 0.32, 54, '#ffd23c', 'center');
    text('P / Esc — resume      S — save game      Q — quit to title', viewW / 2, viewH * 0.32 + 50, 18, '#fff', 'center', false);
    text(`Cash $${state.money.toLocaleString('en-US')}   •   Jobs done ${state.missionsDone}/5   •   Cars boosted ${state.stats.stolen}`, viewW / 2, viewH * 0.32 + 86, 16, '#ffe9a3', 'center', false);
  }

  function drawWorld(state, shake) {
    const camX = state.cam.x + (shake ? (Math.sin(state.time * 91) * shake * 10) : 0);
    const camY = state.cam.y + (shake ? (Math.cos(state.time * 113) * shake * 10) : 0);
    ctx.save();
    ctx.translate(viewW / 2 - camX, viewH / 2 - camY);
    drawGround(state, camX, camY);
    drawRoads();
    drawBuildings(state);
    drawTrees(state);
    drawParticles(state);
    // Mission marker under the actors.
    const marker = state._marker;
    drawMissionMarker(state, marker);
    // Cars sorted by y so nearer ones overlap correctly.
    const cars = [...state.cars].sort((a, b) => a.y - b.y);
    for (const car of cars) drawCar(car, state.time);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.down);
    for (const cop of state.cops) drawPerson(cop.x, cop.y, cop.angle, '#20242c', 0);
    for (const r of state.rivals) drawPerson(r.x, r.y, r.angle, '#7a1f2b', 0);
    drawPlayer(state);
    ctx.restore();
  }

  function draw(state, screen, ui) {
    state._marker = ui.marker || null;
    if (screen === SCREEN_TITLE) {
      if (ui.howTo) drawHowTo();
      else drawTitle(state, ui.hasSave, ui.selected);
      return;
    }
    if (screen === SCREEN_PAUSED) { drawPaused(state); return; }
    drawWorld(state, state.trauma);
    drawHUD(state);
  }

  return { draw, get viewW() { return viewW; }, get viewH() { return viewH; } };
}
