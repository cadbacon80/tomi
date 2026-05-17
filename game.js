const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const upgradeModal = document.getElementById("upgradeModal");
const startButton = document.getElementById("startButton");
const statusTitle = document.getElementById("statusTitle");
const fields = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  wave: document.getElementById("wave"),
  hull: document.getElementById("hull"),
  chain: document.getElementById("chain"),
  relics: document.getElementById("relics"),
  blaster: document.getElementById("blaster"),
  drift: document.getElementById("drift"),
  choices: document.getElementById("upgradeChoices")
};

const keys = new Set();
const bestKey = "tomi-game-best";
const crosshairKey = "tomi-game-crosshair";
let best = Number(localStorage.getItem(bestKey) || 0);
let crosshairStyle = localStorage.getItem(crosshairKey) || "ring";
let lastTime = 0;
let state = "menu";
let shake = 0;
let game;
const mouse = { x: 0, y: 0, inside: false, down: false };

const upgrades = [
  { name: "Wide Pulse", text: "Pulse radius +18%", apply: g => g.pulseRadius *= 1.18 },
  { name: "Echo Battery", text: "Pulse cooldown -16%", apply: g => g.pulseCooldown *= 0.84 },
  { name: "Clean Hull", text: "Repair 24 hull", apply: g => g.hull = Math.min(g.maxHull, g.hull + 24) },
  { name: "Magnet Lens", text: "Relic pull range +38%", apply: g => g.magnet *= 1.38 },
  { name: "Hot Engines", text: "Acceleration +14%", apply: g => g.speed *= 1.14 },
  { name: "Chain Theory", text: "Chain lasts longer", apply: g => g.chainGrace += 0.8 },
  { name: "Hard Map", text: "Score +25%, anomalies +10%", apply: g => { g.scoreBonus += 0.25; g.spawnBonus += 0.1; } },
  { name: "Plated Nose", text: "Max hull +20 and repair", apply: g => { g.maxHull += 20; g.hull += 20; } },
  { name: "Rail Needle", text: "Blaster damage +35%", apply: g => g.boltDamage *= 1.35 },
  { name: "Heat Sink", text: "Blaster fires faster", apply: g => g.fireCooldown *= 0.78 },
  { name: "Heavy Capacitor", text: "Overdrive shots pierce +1", apply: g => g.overdrivePierce += 1 },
  { name: "Scatter Lens", text: "Blaster fires two side sparks", apply: g => g.sideShots += 1 },
  { name: "Drift Dynamo", text: "Drift charges overdrive faster", apply: g => g.driftRate *= 1.45 },
  { name: "Ramming Field", text: "Drifting through enemies hurts them", apply: g => g.ramDamage += 4 },
  { name: "Pulse Shards", text: "Pulse launches shrapnel bolts", apply: g => g.pulseShards += 4 },
  { name: "Greedy Maps", text: "More relics, more score", apply: g => { g.relicBonus += 3; g.scoreBonus += 0.18; } }
];

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const nextWidth = Math.max(640, Math.floor(rect.width * scale));
  const nextHeight = Math.max(420, Math.floor(rect.height * scale));
  if (canvas.width !== nextWidth) canvas.width = nextWidth;
  if (canvas.height !== nextHeight) canvas.height = nextHeight;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function newGame() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  game = {
    player: { x: w * 0.5, y: h * 0.5, vx: 0, vy: 0, r: 13 },
    relics: [],
    hazards: [],
    bullets: [],
    particles: [],
    score: 0,
    wave: 1,
    relicCount: 0,
    hull: 100,
    maxHull: 100,
    chain: 1,
    chainTimer: 0,
    chainGrace: 2.4,
    pulse: 0,
    pulseCooldown: 2.8,
    pulseTimer: 0,
    pulseRadius: 96,
    speed: 820,
    magnet: 110,
    fireCooldown: 0.28,
    fireTimer: 0,
    boltDamage: 8,
    boltSpeed: 720,
    overdrive: 0,
    overdrivePierce: 1,
    sideShots: 0,
    driftRate: 1,
    ramDamage: 0,
    pulseShards: 0,
    relicBonus: 0,
    scoreBonus: 0,
    spawnBonus: 0,
    upgradeOpen: false,
    stars: Array.from({ length: 120 }, () => ({ x: rand(0, w), y: rand(0, h), s: rand(0.4, 2.1), a: rand(0.2, 0.8) }))
  };
  spawnWave();
  state = "play";
  statusTitle.textContent = "Mapping";
  overlay.classList.add("hidden");
  upgradeModal.classList.add("hidden");
  fields.choices.innerHTML = "";
}

function spawnWave() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const count = Math.floor(7 + game.wave * 1.8 + game.relicBonus);
  const hazards = Math.floor((3 + game.wave * 0.75) * (1 + game.spawnBonus));
  for (let i = 0; i < count; i++) {
    game.relics.push({
      x: rand(35, w - 35),
      y: rand(35, h - 35),
      r: rand(8, 15),
      value: Math.floor(rand(8, 22) + game.wave * 2),
      phase: rand(0, Math.PI * 2)
    });
  }
  for (let i = 0; i < hazards; i++) {
    const angle = rand(0, Math.PI * 2);
    game.hazards.push({
      x: rand(40, w - 40),
      y: rand(40, h - 40),
      vx: Math.cos(angle) * rand(42, 102 + game.wave * 10),
      vy: Math.sin(angle) * rand(42, 102 + game.wave * 10),
      r: rand(13, 25),
      spin: rand(-2, 2)
    });
  }
}

function makeParticles(x, y, color, amount = 16) {
  for (let i = 0; i < amount; i++) {
    const angle = rand(0, Math.PI * 2);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * rand(40, 210),
      vy: Math.sin(angle) * rand(40, 210),
      life: rand(0.35, 0.9),
      max: 1,
      color
    });
  }
}

function spawnBullet(x, y, angle, powered = false) {
  if (!game) return;
  game.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * game.boltSpeed,
    vy: Math.sin(angle) * game.boltSpeed,
    r: powered ? 5 : 3,
    life: powered ? 0.95 : 0.7,
    damage: game.boltDamage * (powered ? 2.2 : 1),
    pierce: powered ? game.overdrivePierce : 0,
    color: powered ? "#f4c95d" : "#62a8ff"
  });
}

function fireBlaster() {
  if (!game || state !== "play" || game.fireTimer > 0) return;
  const p = game.player;
  const angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
  const powered = game.overdrive >= 100;
  spawnBullet(p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20, angle, powered);
  for (let i = 0; i < game.sideShots; i++) {
    const offset = 0.18 + i * 0.09;
    spawnBullet(p.x, p.y, angle - offset, false);
    spawnBullet(p.x, p.y, angle + offset, false);
  }
  if (powered) {
    game.overdrive = 0;
    shake = 7;
  }
  game.fireTimer = game.fireCooldown;
  makeParticles(p.x + Math.cos(angle) * 18, p.y + Math.sin(angle) * 18, powered ? "#f4c95d" : "#62a8ff", powered ? 14 : 6);
}

function damageHazard(index, damage, knockAngle, force = 90) {
  const hazard = game.hazards[index];
  if (!hazard) return false;
  hazard.r -= damage * 0.55;
  hazard.vx += Math.cos(knockAngle) * force;
  hazard.vy += Math.sin(knockAngle) * force;
  makeParticles(hazard.x, hazard.y, hazard.r < 10 ? "#f4c95d" : "#62a8ff", 8);
  if (hazard.r < 9) {
    game.hazards.splice(index, 1);
    game.score += 42 * game.chain * (1 + game.scoreBonus);
    makeParticles(hazard.x, hazard.y, "#f4c95d", 22);
    return true;
  }
  return false;
}

function chooseUpgrades() {
  state = "upgrade";
  game.upgradeOpen = true;
  statusTitle.textContent = "Choose mutation";
  upgradeModal.classList.remove("hidden");
  const picks = [...upgrades].sort(() => Math.random() - 0.5).slice(0, 3);
  fields.choices.innerHTML = "";
  picks.forEach((pick) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.innerHTML = `<strong>${pick.name}</strong><span>${pick.text}</span>`;
    button.addEventListener("click", () => {
      pick.apply(game);
      game.wave += 1;
      game.upgradeOpen = false;
      upgradeModal.classList.add("hidden");
      fields.choices.innerHTML = "";
      spawnWave();
      statusTitle.textContent = "Mapping";
      state = "play";
    });
    fields.choices.appendChild(button);
  });
}

function endGame() {
  state = "over";
  best = Math.max(best, Math.floor(game.score));
  localStorage.setItem(bestKey, String(best));
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = "Map Lost";
  overlay.querySelector("p").textContent = `Final score ${Math.floor(game.score)}. Press R or start another run.`;
  startButton.textContent = "Restart";
  statusTitle.textContent = "Wrecked";
}

function update(dt) {
  if (!game || state !== "play") return;
  const p = game.player;
  let ax = 0;
  let ay = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) ay -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) ay += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) ax -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) ax += 1;
  const mag = Math.hypot(ax, ay) || 1;
  const brake = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const accel = brake ? game.speed * 0.72 : game.speed;
  p.vx += (ax / mag) * accel * dt;
  p.vy += (ay / mag) * accel * dt;
  let speedNow = Math.hypot(p.vx, p.vy);
  if (brake && speedNow > 120) {
    const turn = ((keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0));
    if (turn) {
      const slide = turn * dt * 2.15;
      const cos = Math.cos(slide);
      const sin = Math.sin(slide);
      const nextVx = p.vx * cos - p.vy * sin;
      const nextVy = p.vx * sin + p.vy * cos;
      p.vx = nextVx;
      p.vy = nextVy;
    }
    game.overdrive = Math.min(100, game.overdrive + dt * 42 * game.driftRate * Math.min(2.6, speedNow / 340));
    if (Math.random() < 0.9) makeParticles(p.x - p.vx * 0.012, p.y - p.vy * 0.012, "#f4c95d", 1);
  }
  p.vx *= brake ? 0.965 : 0.986;
  p.vy *= brake ? 0.965 : 0.986;
  speedNow = Math.hypot(p.vx, p.vy);
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (mouse.down) fireBlaster();
  if (p.x < p.r || p.x > w - p.r) p.vx *= -0.7;
  if (p.y < p.r || p.y > h - p.r) p.vy *= -0.7;
  p.x = Math.max(p.r, Math.min(w - p.r, p.x));
  p.y = Math.max(p.r, Math.min(h - p.r, p.y));

  game.pulseTimer = Math.max(0, game.pulseTimer - dt);
  game.fireTimer = Math.max(0, game.fireTimer - dt);
  game.pulse = Math.max(0, game.pulse - dt * 240);
  game.chainTimer = Math.max(0, game.chainTimer - dt);
  if (game.chainTimer <= 0) game.chain = 1;
  shake = Math.max(0, shake - dt * 24);

  for (const relic of game.relics) {
    relic.phase += dt * 4;
    const d = dist(p, relic);
    if (d < game.magnet) {
      relic.x += ((p.x - relic.x) / Math.max(1, d)) * dt * 140;
      relic.y += ((p.y - relic.y) / Math.max(1, d)) * dt * 140;
    }
  }

  for (let i = game.relics.length - 1; i >= 0; i--) {
    const relic = game.relics[i];
    if (dist(p, relic) < p.r + relic.r) {
      game.relics.splice(i, 1);
      game.chain = Math.min(9, game.chain + 1);
      game.chainTimer = game.chainGrace;
      game.relicCount += 1;
      game.score += relic.value * game.chain * (1 + game.scoreBonus);
      makeParticles(relic.x, relic.y, "#49f2a7", 14);
    }
  }

  for (let i = game.hazards.length - 1; i >= 0; i--) {
    const hazard = game.hazards[i];
    hazard.x += hazard.vx * dt;
    hazard.y += hazard.vy * dt;
    if (hazard.x < hazard.r || hazard.x > w - hazard.r) hazard.vx *= -1;
    if (hazard.y < hazard.r || hazard.y > h - hazard.r) hazard.vy *= -1;
    if (dist(p, hazard) < p.r + hazard.r) {
      const angle = Math.atan2(p.y - hazard.y, p.x - hazard.x);
      if (brake && game.ramDamage > 0 && speedNow > 260) {
        damageHazard(i, game.ramDamage, -angle, 150);
        game.overdrive = Math.min(100, game.overdrive + 8);
      }
      p.vx += Math.cos(angle) * 260;
      p.vy += Math.sin(angle) * 260;
      game.hull -= 18;
      game.chain = 1;
      game.chainTimer = 0;
      shake = 10;
      makeParticles(p.x, p.y, "#ff5d6c", 22);
      hazard.x -= Math.cos(angle) * 34;
      hazard.y -= Math.sin(angle) * 34;
    }
  }

  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const bullet = game.bullets[i];
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.life <= 0 || bullet.x < -40 || bullet.x > w + 40 || bullet.y < -40 || bullet.y > h + 40) {
      game.bullets.splice(i, 1);
      continue;
    }
    for (let j = game.hazards.length - 1; j >= 0; j--) {
      const hazard = game.hazards[j];
      if (dist(bullet, hazard) < bullet.r + hazard.r) {
        const angle = Math.atan2(bullet.vy, bullet.vx);
        damageHazard(j, bullet.damage, angle, 120);
        if (bullet.pierce > 0) {
          bullet.pierce -= 1;
        } else {
          game.bullets.splice(i, 1);
        }
        break;
      }
    }
  }

  for (let i = game.particles.length - 1; i >= 0; i--) {
    const part = game.particles[i];
    part.life -= dt;
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vx *= 0.96;
    part.vy *= 0.96;
    if (part.life <= 0) game.particles.splice(i, 1);
  }

  if (game.hull <= 0) endGame();
  if (game.relics.length === 0 && state === "play") chooseUpgrades();
  updateHud();
}

function pulse() {
  if (!game || state !== "play" || game.pulseTimer > 0) return;
  game.pulse = game.pulseRadius;
  game.pulseTimer = game.pulseCooldown;
  shake = 4;
  for (let i = 0; i < game.pulseShards; i++) {
    const angle = (Math.PI * 2 * i) / game.pulseShards + rand(-0.08, 0.08);
    spawnBullet(game.player.x, game.player.y, angle, false);
  }
  for (let i = game.hazards.length - 1; i >= 0; i--) {
    const hazard = game.hazards[i];
    const d = dist(game.player, hazard);
    if (d < game.pulseRadius + hazard.r) {
      const angle = Math.atan2(hazard.y - game.player.y, hazard.x - game.player.x);
      hazard.vx += Math.cos(angle) * 220;
      hazard.vy += Math.sin(angle) * 220;
      damageHazard(i, 9, angle, 220);
    }
  }
}

function updateHud() {
  if (!game) {
    fields.best.textContent = best;
    return;
  }
  fields.score.textContent = Math.floor(game.score);
  fields.best.textContent = best;
  fields.wave.textContent = game.wave;
  fields.hull.textContent = Math.max(0, Math.ceil(game.hull));
  fields.chain.textContent = `x${game.chain}`;
  fields.relics.textContent = game.relicCount;
  fields.blaster.textContent = game.fireTimer <= 0 ? "Ready" : `${Math.ceil(game.fireTimer * 10) / 10}s`;
  fields.drift.textContent = `${Math.floor(game.overdrive)}%`;
}

function drawShip(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.vy, p.vx) || -Math.PI / 2);
  ctx.fillStyle = "#edf7f4";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-13, -10);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-13, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#49f2a7";
  ctx.fillRect(-7, -3, 12, 6);
  ctx.restore();
}

function draw() {
  resizeCanvas();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  ctx.fillStyle = "#030608";
  ctx.fillRect(0, 0, w, h);

  if (!game) {
    ctx.restore();
    requestAnimationFrame(loop);
    return;
  }

  for (const star of game.stars) {
    ctx.fillStyle = `rgba(237, 247, 244, ${star.a})`;
    ctx.fillRect(star.x, star.y, star.s, star.s);
  }

  ctx.strokeStyle = "rgba(73, 242, 167, 0.09)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  for (const relic of game.relics) {
    const bob = Math.sin(relic.phase) * 3;
    ctx.strokeStyle = "#49f2a7";
    ctx.fillStyle = "rgba(73, 242, 167, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(relic.x, relic.y + bob, relic.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4c95d";
    ctx.fillRect(relic.x - 2, relic.y + bob - 2, 4, 4);
  }

  for (const hazard of game.hazards) {
    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    ctx.rotate(performance.now() * 0.001 * hazard.spin);
    ctx.fillStyle = "rgba(255, 93, 108, 0.2)";
    ctx.strokeStyle = "#ff5d6c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const r = i % 2 ? hazard.r * 0.6 : hazard.r;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  for (const bullet of game.bullets) {
    ctx.strokeStyle = bullet.color;
    ctx.lineWidth = bullet.r;
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x - bullet.vx * 0.035, bullet.y - bullet.vy * 0.035);
    ctx.stroke();
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (game.pulse > 0) {
    ctx.strokeStyle = `rgba(98, 168, 255, ${game.pulse / game.pulseRadius})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, game.pulseRadius - game.pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const part of game.particles) {
    ctx.globalAlpha = Math.max(0, part.life);
    ctx.fillStyle = part.color;
    ctx.fillRect(part.x, part.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  drawShip(game.player);

  const cooldown = 1 - game.pulseTimer / game.pulseCooldown;
  ctx.fillStyle = "rgba(237, 247, 244, 0.14)";
  ctx.fillRect(18, h - 24, 180, 8);
  ctx.fillStyle = cooldown >= 1 ? "#49f2a7" : "#62a8ff";
  ctx.fillRect(18, h - 24, 180 * Math.max(0, Math.min(1, cooldown)), 8);
  ctx.fillStyle = "rgba(237, 247, 244, 0.14)";
  ctx.fillRect(18, h - 40, 180, 8);
  ctx.fillStyle = game.overdrive >= 100 ? "#f4c95d" : "#ff5d6c";
  ctx.fillRect(18, h - 40, 180 * Math.max(0, Math.min(1, game.overdrive / 100)), 8);

  if (mouse.inside && state === "play") {
    drawCrosshair(mouse.x, mouse.y);
  }
  ctx.restore();
  requestAnimationFrame(loop);
}

function drawCrosshair(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = game.overdrive >= 100 ? "#f4c95d" : "#49f2a7";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2;
  if (crosshairStyle === "diamond") {
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-10, 0);
    ctx.moveTo(10, 0);
    ctx.lineTo(18, 0);
    ctx.moveTo(0, -18);
    ctx.lineTo(0, -10);
    ctx.moveTo(0, 10);
    ctx.lineTo(0, 18);
    ctx.stroke();
  } else if (crosshairStyle === "dot") {
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-14, 0);
    ctx.moveTo(14, 0);
    ctx.lineTo(22, 0);
    ctx.moveTo(0, -22);
    ctx.lineTo(0, -14);
    ctx.moveTo(0, 14);
    ctx.lineTo(0, 22);
    ctx.stroke();
  }
  ctx.restore();
}

function loop(time = 0) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    pulse();
  }
  if (event.code === "KeyR") newGame();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
  mouse.inside = true;
});
canvas.addEventListener("mouseenter", () => {
  mouse.inside = true;
});
canvas.addEventListener("mouseleave", () => {
  mouse.inside = false;
  mouse.down = false;
});
canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
  mouse.inside = true;
  mouse.down = true;
  fireBlaster();
});
window.addEventListener("mouseup", () => {
  mouse.down = false;
});
document.querySelectorAll(".crosshairChoice").forEach((button) => {
  button.classList.toggle("active", button.dataset.crosshair === crosshairStyle);
  button.addEventListener("click", () => {
    crosshairStyle = button.dataset.crosshair;
    localStorage.setItem(crosshairKey, crosshairStyle);
    document.querySelectorAll(".crosshairChoice").forEach((choice) => {
      choice.classList.toggle("active", choice === button);
    });
  });
});
startButton.addEventListener("click", newGame);

resizeCanvas();
updateHud();
requestAnimationFrame(loop);
