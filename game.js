(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const uiRoot = document.getElementById("ui");
  const panel = document.getElementById("panel");
  const startBtn = document.getElementById("start-btn");
  const hint = document.getElementById("hint");

  const state = {
    mode: "menu", // menu | playing | gameover
    w: 0,
    h: 0,
    t: 0, // seconds since start (playing only)
    rng: mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0),
    mouse: { x: 0, y: 0, seen: false },
    player: { x: 0, y: 0, r: 18, invuln: 0 },
    items: [],
    lives: 3,
    dodges: 0,
    score: 0, // time-based
    shake: 0,
    spawnClock: 0,
    spawnEvery: 0.85,
    difficulty: 0,
    externalTime: false,
  };

  let lastNow = performance.now();
  let rafId = null;

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function randRange(rng, a, b) {
    return a + (b - a) * rng();
  }

  function pick(rng, arr) {
    return arr[(rng() * arr.length) | 0];
  }

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = Math.max(1, Math.floor(window.innerWidth));
    const cssH = Math.max(1, Math.floor(window.innerHeight));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.w = cssW;
    state.h = cssH;

    if (!state.mouse.seen) {
      state.player.x = cssW * 0.5;
      state.player.y = cssH * 0.6;
      state.mouse.x = state.player.x;
      state.mouse.y = state.player.y;
    }
  }

  function showMenu(message) {
    document.body.classList.remove("playing");
    uiRoot.style.display = "grid";
    panel.style.display = "block";
    hint.textContent = message || "";
  }

  function hideMenu() {
    document.body.classList.add("playing");
  }

  function resetGame() {
    state.t = 0;
    state.items.length = 0;
    state.lives = 3;
    state.dodges = 0;
    state.score = 0;
    state.shake = 0;
    state.spawnClock = 0;
    state.spawnEvery = 0.85;
    state.difficulty = 0;
    state.player.invuln = 0;
    state.mode = "playing";
    hideMenu();
  }

  function spawnItem() {
    const side = (state.rng() * 4) | 0; // 0 left, 1 right, 2 top, 3 bottom
    const margin = 60;
    let x, y;
    if (side === 0) {
      x = -margin;
      y = randRange(state.rng, 0, state.h);
    } else if (side === 1) {
      x = state.w + margin;
      y = randRange(state.rng, 0, state.h);
    } else if (side === 2) {
      x = randRange(state.rng, 0, state.w);
      y = -margin;
    } else {
      x = randRange(state.rng, 0, state.w);
      y = state.h + margin;
    }

    const r = randRange(state.rng, 10, 22);
    const baseSpeed = randRange(state.rng, 220, 360) + state.difficulty * 55;

    // Aim toward player with a little random offset so it's dodgeable.
    const tx = state.player.x + randRange(state.rng, -90, 90);
    const ty = state.player.y + randRange(state.rng, -90, 90);
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const vx = (dx / len) * baseSpeed;
    const vy = (dy / len) * baseSpeed;

    const type = pick(state.rng, ["orb", "block", "dart"]);
    const color = pick(state.rng, ["#66e3ff", "#ff5cbe", "#ffe56a", "#7bff9d"]);

    state.items.push({
      id: `${(state.rng() * 1e9) | 0}`,
      x,
      y,
      vx,
      vy,
      r,
      type,
      rot: randRange(state.rng, 0, Math.PI * 2),
      rotSpd: randRange(state.rng, -5, 5),
      color,
      age: 0,
      trail: [],
    });
  }

  function step(dt) {
    if (state.mode !== "playing") return;

    state.t += dt;
    state.score = Math.floor(state.t * 10) / 10;
    state.difficulty = clamp(state.t / 18, 0, 5);

    // The cursor is the ball: hard-lock to mouse position for crisp control.
    if (state.mouse.seen) {
      state.player.x = state.mouse.x;
      state.player.y = state.mouse.y;
    }
    state.player.x = clamp(state.player.x, 0, state.w);
    state.player.y = clamp(state.player.y, 0, state.h);

    if (state.player.invuln > 0) state.player.invuln -= dt;
    if (state.shake > 0) state.shake -= dt;

    // Difficulty curve: faster spawns over time, but cap so it stays playable.
    const minEvery = 0.24;
    state.spawnEvery = clamp(0.85 - state.difficulty * 0.12, minEvery, 1.0);
    state.spawnClock += dt;
    while (state.spawnClock >= state.spawnEvery) {
      state.spawnClock -= state.spawnEvery;
      spawnItem();
    }

    // Move items
    const pad = 140;
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      it.age += dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.rotSpd * dt;

      it.trail.push({ x: it.x, y: it.y });
      if (it.trail.length > 8) it.trail.shift();

      // Collision
      if (state.player.invuln <= 0) {
        const d = Math.hypot(it.x - state.player.x, it.y - state.player.y);
        if (d <= it.r + state.player.r) {
          state.lives -= 1;
          state.player.invuln = 0.95;
          state.shake = 0.25;
          state.items.splice(i, 1);
          if (state.lives <= 0) {
            state.mode = "gameover";
            showMenu(`Game over — survived ${state.score}s • dodged ${state.dodges}. Press R.`);
          }
          continue;
        }
      }

      // Count as a dodge when it fully leaves the extended bounds.
      if (
        it.x < -pad ||
        it.x > state.w + pad ||
        it.y < -pad ||
        it.y > state.h + pad
      ) {
        state.dodges += 1;
        state.items.splice(i, 1);
      }
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, state.w, state.h);
    g.addColorStop(0, "#0b0d14");
    g.addColorStop(1, "#070914");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.w, state.h);

    // Subtle grid / noise
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#dfe6ff";
    const step = 48;
    for (let x = (state.t * 22) % step; x < state.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.h);
      ctx.stroke();
    }
    for (let y = (state.t * 18) % step; y < state.h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(state.w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawItem(it) {
    // Trail
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < it.trail.length; i++) {
      const p = it.trail[i];
      const a = (i + 1) / it.trail.length;
      ctx.globalAlpha = 0.04 + a * 0.18;
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, it.r * (0.55 + a * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);

    ctx.fillStyle = it.color;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;

    if (it.type === "block") {
      const s = it.r * 1.6;
      roundRect(-s / 2, -s / 2, s, s, it.r * 0.35);
      ctx.fill();
      ctx.stroke();
    } else if (it.type === "dart") {
      const len = it.r * 2.6;
      const w = it.r * 1.1;
      ctx.beginPath();
      ctx.moveTo(len * 0.55, 0);
      ctx.lineTo(-len * 0.4, w * 0.6);
      ctx.lineTo(-len * 0.2, 0);
      ctx.lineTo(-len * 0.4, -w * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // orb
      ctx.beginPath();
      ctx.arc(0, 0, it.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, it.r * 1.8);
      glow.addColorStop(0, "rgba(255,255,255,0.25)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, it.r * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    ctx.font = "600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillStyle = "rgba(238,242,255,0.92)";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;

    const left = 14;
    const top = 14;
    ctx.fillText(`Lives: ${state.lives}`, left, top + 0);
    ctx.fillText(`Time: ${state.score}s`, left, top + 18);
    ctx.fillText(`Dodged: ${state.dodges}`, left, top + 36);
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    const pulse = 0.6 + 0.4 * Math.sin(state.t * 8);
    const inv = p.invuln > 0 ? 0.35 + 0.65 * pulse : 1;

    ctx.save();
    ctx.globalAlpha = inv;
    ctx.translate(p.x, p.y);

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 1.9);
    g.addColorStop(0, "rgba(102,227,255,0.35)");
    g.addColorStop(0.5, "rgba(255,92,190,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#eef2ff";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Small inner mark to show movement direction.
    const dx = state.mouse.x - p.x;
    const dy = state.mouse.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    ctx.fillStyle = "rgba(7,16,25,0.55)";
    ctx.beginPath();
    ctx.arc((dx / len) * p.r * 0.45, (dy / len) * p.r * 0.45, p.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    // Screen shake
    ctx.save();
    if (state.shake > 0) {
      const mag = 10 * (state.shake / 0.25);
      const ox = randRange(state.rng, -mag, mag);
      const oy = randRange(state.rng, -mag, mag);
      ctx.translate(ox, oy);
    }

    drawBackground();
    for (const it of state.items) drawItem(it);
    if (state.mode === "playing") drawPlayer();
    if (state.mode === "playing") drawHUD();

    // In menu/gameover, show a faint demo player ball.
    if (state.mode !== "playing") {
      ctx.save();
      ctx.globalAlpha = 0.35;
      drawPlayer();
      ctx.restore();
    }

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;
    step(dt);
    render();
  }

  function startRAF() {
    if (rafId != null) return;
    lastNow = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stopRAF() {
    if (rafId == null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setExternalTimeMode(on) {
    state.externalTime = on;
    if (on) stopRAF();
    else startRAF();
  }

  function setMouseFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = clamp(e.clientX - rect.left, 0, rect.width);
    state.mouse.y = clamp(e.clientY - rect.top, 0, rect.height);
    state.mouse.seen = true;
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore
    } finally {
      setTimeout(resize, 50);
    }
  }

  // Expose deterministic hooks for Playwright.
  window.advanceTime = (ms) => {
    setExternalTimeMode(true);
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) step(1 / 60);
    render();
  };

  window.render_game_to_text = () => {
    const payload = {
      coord: "origin top-left; +x right; +y down; units = CSS pixels",
      mode: state.mode,
      canvas: { w: state.w, h: state.h },
      player: {
        x: round1(state.player.x),
        y: round1(state.player.y),
        r: state.player.r,
        invuln_s: round2(Math.max(0, state.player.invuln)),
      },
      lives: state.lives,
      time_s: round1(state.score),
      dodged: state.dodges,
      difficulty: round2(state.difficulty),
      items: state.items.slice(0, 20).map((it) => ({
        x: round1(it.x),
        y: round1(it.y),
        r: Math.round(it.r),
        vx: Math.round(it.vx),
        vy: Math.round(it.vy),
        type: it.type,
      })),
    };
    return JSON.stringify(payload);
  };

  function round1(n) {
    return Math.round(n * 10) / 10;
  }
  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  // Input
  window.addEventListener("mousemove", (e) => {
    setMouseFromEvent(e);
  });
  window.addEventListener("mousedown", (e) => {
    setMouseFromEvent(e);
    if (state.mode === "menu" && e.button === 0) resetGame();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") toggleFullscreen();
    if (e.key === "r" || e.key === "R") {
      resetGame();
      return;
    }
    if (e.key === "Escape" && state.mode !== "playing") {
      // Let users escape out of gameover back to menu.
      state.mode = "menu";
      showMenu("");
    }
  });

  // UI
  startBtn.addEventListener("click", () => resetGame());

  // Boot
  window.addEventListener("resize", resize);
  resize();
  showMenu("");
  startRAF();
})();
