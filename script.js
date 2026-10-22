(() => {
  'use strict';

  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d', { alpha: false });
  const experience = document.getElementById('experience');
  const orientationGate = document.getElementById('orientationGate');
  const welcomeLayer = document.getElementById('welcomeLayer');
  const welcomeCard = document.getElementById('welcomeCard');
  const yesButton = document.getElementById('yesButton');
  const noButton = document.getElementById('noButton');
  const noMessage = document.getElementById('noMessage');
  const captionWrap = document.getElementById('captionWrap');
  const captionKicker = document.getElementById('captionKicker');
  const storyCaption = document.getElementById('storyCaption');
  const notification = document.getElementById('notification');
  const liquidUi = document.getElementById('liquidUi');
  const confessionCard = document.getElementById('confessionCard');
  const checklistCard = document.getElementById('checklistCard');
  const birthdayCard = document.getElementById('birthdayCard');
  const checkHint = document.getElementById('checkHint');
  const revealProgress = document.getElementById('revealProgress');
  const scrollCue = document.getElementById('scrollCue');
  const blinkShutter = document.getElementById('blinkShutter');
  const confettiLayer = document.getElementById('confettiLayer');
  const replayButton = document.getElementById('replayButton');
  const taskButtons = [...document.querySelectorAll('.task-row')];
  const spoilerButtons = [...document.querySelectorAll('.spoiler-word')];
  const progressPills = [...revealProgress.children];
  const mediaPortrait = window.matchMedia('(orientation: portrait)');

  const W = 1000;
  const H = 562;
  const noReduceMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const starSeeds = Array.from({ length: 86 }, (_, i) => {
    const n = i + 1;
    return {
      x: ((n * 137.507764) % 997) / 997,
      y: ((n * 73.133) % 96) / 100,
      r: .55 + ((n * 19) % 13) / 10,
      phase: n * 1.7,
      speed: .000018 + ((n * 7) % 5) * .000004,
      orbit: 1.1 + (n % 6) * .24
    };
  });

  let stage = 'cover';
  let stageStarted = performance.now();
  let sequenceToken = 0;
  let phoneProgress = 0;
  let tasksDone = [false, false, false];
  let wordsRevealed = [false, false];
  let checklistResolve = null;
  let spoilerResolve = null;
  let timelineStarted = false;
  let portraitPauseStarted = null;
  let totalPaused = 0;
  let lastLandscapeTick = performance.now();

  function isPortrait() { return mediaPortrait.matches; }

  function updateOrientation() {
    const portrait = isPortrait();
    orientationGate.hidden = !portrait;
    document.documentElement.classList.toggle('is-portrait', portrait);
    if (portrait) {
      portraitPauseStarted ??= performance.now();
    } else if (portraitPauseStarted !== null) {
      const paused = performance.now() - portraitPauseStarted;
      totalPaused += paused;
      stageStarted += paused;
      if (portraitPauseStarted) lastLandscapeTick += paused;
      portraitPauseStarted = null;
    }
    lastLandscapeTick = performance.now();
  }
  if (mediaPortrait.addEventListener) mediaPortrait.addEventListener('change', updateOrientation);
  else mediaPortrait.addListener(updateOrientation);
  updateOrientation();

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.4);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const stageElapsed = (now) => Math.max(0, now - stageStarted);
  const rgba = (color, alpha) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;

  function setStage(next) {
    stage = next;
    stageStarted = performance.now();
    if (next === 'night' || next === 'nightPhone') experience.classList.add('is-night');
    if (next === 'sunrise' || next === 'sunPhone' || next === 'timelapse') {
      experience.classList.remove('is-night');
      experience.classList.add('is-sunrise');
    }
    if (next === 'desk' || next === 'fadeStats' || next === 'stats' || next === 'birthday') {
      experience.classList.remove('is-night', 'is-sunrise');
    }
  }

  const sleep = (ms) => new Promise(resolve => window.setTimeout(resolve, noReduceMotion ? ms : Math.min(ms, 80)));
  const waitToken = async (ms, token) => {
    let elapsed = 0;
    let last = performance.now();
    while (elapsed < ms) {
      if (token !== sequenceToken) return false;
      const now = performance.now();
      // Count only landscape time: turning the phone pauses the story rather than skipping scenes.
      if (!isPortrait()) elapsed += now - last;
      last = now;
      await new Promise(resolve => window.setTimeout(resolve, isPortrait() ? 70 : 30));
    }
    return token === sequenceToken;
  };

  async function typeCaption(text, kicker, token, speed = 34) {
    captionKicker.textContent = kicker || '';
    storyCaption.textContent = '';
    captionWrap.classList.add('is-visible');
    if (!noReduceMotion) {
      storyCaption.textContent = text;
      return token === sequenceToken;
    }
    for (let i = 0; i < text.length; i++) {
      if (token !== sequenceToken) return false;
      storyCaption.textContent = text.slice(0, i + 1);
      if (!(await waitToken(speed, token))) return false;
    }
    return token === sequenceToken;
  }

  function hideCaption() { captionWrap.classList.remove('is-visible'); }
  function showPhone(progress, token) {
    return new Promise(async resolve => {
      let elapsed = 0;
      let last = performance.now();
      const duration = 2500;
      while (elapsed < duration) {
        if (token !== sequenceToken) { phoneProgress = 0; resolve(false); return; }
        const now = performance.now();
        if (!isPortrait()) elapsed += now - last;
        last = now;
        const p = clamp(elapsed / duration);
        phoneProgress = p < .22 ? ease(p / .22) : p > .81 ? 1 - ease((p - .81) / .19) : 1;
        await new Promise(r => window.setTimeout(r, isPortrait() ? 70 : 16));
      }
      phoneProgress = 0;
      resolve(token === sequenceToken);
    });
  }

  function pathRoundedRect(c, x, y, w, h, r) {
    if (typeof c.roundRect === 'function') { c.roundRect(x, y, w, h, r); return; }
    const rr = Math.min(r, w / 2, h / 2);
    c.moveTo(x + rr, y); c.lineTo(x + w - rr, y); c.quadraticCurveTo(x + w, y, x + w, y + rr);
    c.lineTo(x + w, y + h - rr); c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    c.lineTo(x + rr, y + h); c.quadraticCurveTo(x, y + h, x, y + h - rr);
    c.lineTo(x, y + rr); c.quadraticCurveTo(x, y, x + rr, y);
  }

  function roundedRect(c, x, y, w, h, r, fill, stroke, lw = 1) {
    c.beginPath();
    pathRoundedRect(c, x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }

  function drawCover(c) {
    const g = c.createLinearGradient(0, 0, 1000, 562);
    g.addColorStop(0, '#dfe1e4');
    g.addColorStop(.55, '#d7dade');
    g.addColorStop(1, '#e4e5e7');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function drawStars(c, time, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    for (const star of starSeeds) {
      const phase = time * star.speed + star.phase;
      const x = star.x * W + Math.sin(phase) * star.orbit;
      const y = star.y * H + Math.cos(phase * .79) * star.orbit * .48;
      const flicker = .48 + (.52 * (Math.sin(phase * 1.1) + 1) / 2);
      const r = star.r * flicker;
      c.fillStyle = `rgba(255,247,221,${.35 + .65 * flicker})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      if (star.r > 1.3 && star.phase % 3 < .9) {
        c.strokeStyle = `rgba(255,248,222,${.22 * flicker})`;
        c.lineWidth = .6;
        c.beginPath(); c.moveTo(x - r * 2.8, y); c.lineTo(x + r * 2.8, y); c.moveTo(x, y - r * 2.8); c.lineTo(x, y + r * 2.8); c.stroke();
      }
    }
    c.restore();
  }

  function drawMoon(c, x, y, r, alpha = 1) {
    c.save(); c.globalAlpha = alpha;
    c.shadowColor = 'rgba(255,240,184,.28)'; c.shadowBlur = 28;
    const glow = c.createRadialGradient(x, y, 2, x, y, r * 2.4);
    glow.addColorStop(0, 'rgba(255,243,195,.19)'); glow.addColorStop(1, 'rgba(255,243,195,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(x, y, r * 2.4, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#fff0c3'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#17223e'; c.beginPath(); c.arc(x + r * .42, y - r * .18, r * .9, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawNightScene(c, time, settle = 1) {
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#081126'); sky.addColorStop(.46, '#172545'); sky.addColorStop(.78, '#314266'); sky.addColorStop(1, '#18233b');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const haze = c.createRadialGradient(510, 330, 18, 510, 330, 470);
    haze.addColorStop(0, 'rgba(120,151,199,.13)'); haze.addColorStop(1, 'rgba(120,151,199,0)');
    c.fillStyle = haze; c.fillRect(0, 0, W, H);
    drawStars(c, time, .98);
    drawMoon(c, W * .77 + Math.sin(time * .00003) * 3, H * .23, 27, .98);

    // Distant glowing apartment windows and layered city silhouettes are all drawn locally.
    const baseline = 371 + (1 - settle) * 74;
    c.fillStyle = '#141f36';
    c.beginPath(); c.moveTo(0, baseline);
    const skyline = [
      [0, 330], [35, 330], [35, 292], [71, 292], [71, 318], [100, 318], [100, 268], [132, 268], [132, 302],
      [163, 302], [163, 284], [192, 284], [192, 250], [224, 250], [224, 316], [265, 316], [265, 288], [300, 288],
      [300, 324], [340, 324], [340, 276], [369, 276], [369, 315], [406, 315], [406, 263], [442, 263], [442, 304],
      [480, 304], [480, 283], [514, 283], [514, 325], [554, 325], [554, 290], [584, 290], [584, 308],
      [622, 308], [622, 244], [653, 244], [653, 305], [689, 305], [689, 273], [720, 273], [720, 319],
      [755, 319], [755, 287], [786, 287], [786, 320], [820, 320], [820, 260], [856, 260], [856, 311],
      [892, 311], [892, 286], [924, 286], [924, 324], [956, 324], [956, 296], [1000, 296]
    ];
    for (const [x, y] of skyline) c.lineTo(x, baseline + (y - 371) * settle);
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

    // A second distant row makes the depth feel like a city, not a flat wallpaper.
    c.fillStyle = 'rgba(24,36,61,.78)';
    c.beginPath(); c.moveTo(0, baseline + 18);
    for (let x = 0; x <= W; x += 28) {
      const y = 322 + Math.sin(x * .057) * 9 + Math.cos(x * .021) * 19;
      c.lineTo(x, baseline + (y - 371) * settle + 18);
    }
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

    for (let b = 0; b < 54; b++) {
      const x = 10 + (b * 83.7) % 980;
      const top = baseline + (250 + ((b * 31) % 80) - 371) * settle;
      const h = 15 + (b * 7 % 33);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 2; col++) {
          const wx = x + col * 7;
          const wy = top + row * 11 + 12;
          if (wy < baseline + 6 && wx < W - 5 && wx > 3) {
            c.fillStyle = (b + row + col) % 4 === 0 ? 'rgba(255,217,135,.78)' : 'rgba(126,177,209,.38)';
            c.fillRect(wx, wy, 2.7, 4.5);
          }
        }
      }
    }

    // Roof rail, seen from first-person height.
    if (settle > .69) {
      const a = ease((settle - .69) / .31);
      c.save(); c.globalAlpha = a;
      const railY = 394;
      c.fillStyle = 'rgba(10,19,34,.35)'; c.beginPath(); c.moveTo(0, railY + 19); c.lineTo(W, railY - 4); c.lineTo(W, 445); c.lineTo(0, 445); c.closePath(); c.fill();
      c.strokeStyle = '#596b85'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(-10, railY + 4); c.lineTo(W + 10, railY - 3); c.stroke();
      c.strokeStyle = 'rgba(216,229,245,.68)'; c.lineWidth = 1.15;
      c.beginPath(); c.moveTo(-10, railY + 1); c.lineTo(W + 10, railY - 6); c.stroke();
      c.strokeStyle = '#42526d'; c.lineWidth = 4;
      for (let x = 18; x < W; x += 82) { const y = railY + 4 - x * .007; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 48); c.stroke(); }
      c.strokeStyle = 'rgba(222,232,245,.28)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, 430); c.lineTo(W, 423); c.stroke();
      const floor = c.createLinearGradient(0, 438, 0, H); floor.addColorStop(0, '#29334a'); floor.addColorStop(1, '#151d30');
      c.fillStyle = floor; c.beginPath(); c.moveTo(0, 443); c.lineTo(W, 435); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(163,179,204,.12)'; c.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const y = 447 + i * i * 2.1; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y - (y - 440) * .03); c.stroke(); }
      c.restore();
    }
  }

  function lerpColor(a, b, t) {
    return [Math.round(mix(a[0], b[0], t)), Math.round(mix(a[1], b[1], t)), Math.round(mix(a[2], b[2], t))];
  }
  const skyKeys = [
    { p: 0, top: [112, 177, 221], bottom: [255, 220, 167], ridge: [72, 130, 112] },
    { p: .22, top: [84, 158, 219], bottom: [255, 230, 176], ridge: [67, 128, 105] },
    { p: .43, top: [249, 166, 139], bottom: [255, 212, 161], ridge: [83, 111, 95] },
    { p: .55, top: [30, 51, 91], bottom: [108, 108, 145], ridge: [32, 65, 70] },
    { p: .76, top: [11, 24, 54], bottom: [69, 85, 119], ridge: [24, 52, 58] },
    { p: .9, top: [229, 143, 129], bottom: [255, 209, 151], ridge: [70, 120, 97] },
    { p: 1, top: [112, 177, 221], bottom: [255, 220, 167], ridge: [72, 130, 112] }
  ];
  function cycleColors(p) {
    p = ((p % 1) + 1) % 1;
    for (let i = 0; i < skyKeys.length - 1; i++) {
      const a = skyKeys[i], b = skyKeys[i + 1];
      if (p >= a.p && p <= b.p) {
        const t = ease((p - a.p) / (b.p - a.p));
        return { top: lerpColor(a.top, b.top, t), bottom: lerpColor(a.bottom, b.bottom, t), ridge: lerpColor(a.ridge, b.ridge, t), dark: p > .49 && p < .87 };
      }
    }
    return skyKeys[0];
  }

  function drawMeadow(c, time, phase = .07, legs = false, cycleAnimation = false, legsAlpha = 1) {
    const colors = cycleColors(phase);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, rgba(colors.top, 1)); sky.addColorStop(.62, rgba(colors.bottom, 1)); sky.addColorStop(1, rgba(colors.bottom, 1));
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    if (colors.dark) drawStars(c, time, clamp((phase - .49) * 3.3) * (phase > .86 ? clamp((1 - phase) * 8) : 1));

    const horizon = 376;
    const sunPhase = ((phase % 1) + 1) % 1;
    const sunX = W * (.13 + .74 * sunPhase);
    const sunY = horizon - Math.sin(sunPhase * Math.PI) * 142;
    if (cycleAnimation && (!colors.dark || sunPhase < .52 || sunPhase > .89)) {
      const alpha = colors.dark ? .15 : 1;
      c.save(); c.globalAlpha = alpha;
      const glow = c.createRadialGradient(sunX, sunY, 5, sunX, sunY, 115);
      glow.addColorStop(0, 'rgba(255,239,175,.7)'); glow.addColorStop(.6, 'rgba(255,216,123,.17)'); glow.addColorStop(1, 'rgba(255,216,123,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(sunX, sunY, 115, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffeab0'; c.beginPath(); c.arc(sunX, sunY, 58, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    if (colors.dark) {
      const moonPhase = (sunPhase + .52) % 1;
      const moonX = W * (.12 + .76 * moonPhase);
      const moonY = horizon - Math.sin(moonPhase * Math.PI) * 148;
      drawMoon(c, moonX, moonY, 19, .88);
    }

    const ridge = rgba(colors.ridge, 1);
    c.fillStyle = ridge;
    c.beginPath();
    c.moveTo(0, 373); c.lineTo(0, 350); c.lineTo(66, 338); c.lineTo(120, 350); c.lineTo(174, 329); c.lineTo(229, 348); c.lineTo(273, 343);
    c.lineTo(323, 356); c.lineTo(374, 332); c.lineTo(416, 343); c.lineTo(456, 325); c.lineTo(505, 343); c.lineTo(545, 350); c.lineTo(594, 338); c.lineTo(653, 352); c.lineTo(714, 335); c.lineTo(768, 352); c.lineTo(819, 338); c.lineTo(878, 350); c.lineTo(928, 334); c.lineTo(1000, 351); c.lineTo(1000, H); c.lineTo(0, H); c.closePath(); c.fill();

    // The mountain on the right gives the little sun a clear, low horizon to rise from.
    const mountG = c.createLinearGradient(0, 190, 0, 405);
    mountG.addColorStop(0, colors.dark ? '#293c58' : '#718d84'); mountG.addColorStop(1, ridge);
    c.fillStyle = mountG;
    c.beginPath(); c.moveTo(426, 390); c.lineTo(517, 288); c.lineTo(563, 312); c.lineTo(656, 205); c.lineTo(703, 247); c.lineTo(768, 277); c.lineTo(834, 332); c.lineTo(916, 350); c.lineTo(1000, 342); c.lineTo(1000, H); c.lineTo(426, H); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,245,221,.22)';
    c.beginPath(); c.moveTo(624, 241); c.lineTo(656, 205); c.lineTo(703, 247); c.lineTo(675, 238); c.lineTo(657, 225); c.lineTo(643, 251); c.closePath(); c.fill();

    // Low sun: its lower half disappears behind the grassy horizon.
    if (!cycleAnimation) {
      const sunriseX = W * .275;
      const centerY = 376;
      c.save(); c.beginPath(); c.rect(0, 0, W, centerY); c.clip();
      const sunGlow = c.createRadialGradient(sunriseX, centerY, 2, sunriseX, centerY, 143);
      sunGlow.addColorStop(0, 'rgba(255,232,154,.76)'); sunGlow.addColorStop(.45, 'rgba(255,218,143,.22)'); sunGlow.addColorStop(1, 'rgba(255,218,143,0)');
      c.fillStyle = sunGlow; c.beginPath(); c.arc(sunriseX, centerY, 143, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe49d'; c.beginPath(); c.arc(sunriseX, centerY, 65, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    const grass = c.createLinearGradient(0, horizon, 0, H);
    grass.addColorStop(0, colors.dark ? '#1f4a46' : '#55965f');
    grass.addColorStop(.35, colors.dark ? '#153b3b' : '#418451');
    grass.addColorStop(1, colors.dark ? '#102b31' : '#225d42');
    c.fillStyle = grass; c.fillRect(0, horizon, W, H - horizon);
    c.strokeStyle = colors.dark ? 'rgba(144,190,166,.14)' : 'rgba(222,247,164,.28)'; c.lineWidth = 1.15;
    for (let i = 0; i < 140; i++) {
      const x = (i * 61.73) % W; const y = 383 + ((i * 43.2) % 178); const h = 3 + ((i * 7) % 12);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 2 + Math.sin(time * .0003 + i) * 3, y - h * .55, x + Math.sin(i * .9 + time * .00015) * 4, y - h); c.stroke();
    }
    // Foreground knees and shins: a subtle first-person seated silhouette.
    if (legs) {
      c.save(); c.globalAlpha *= clamp(legsAlpha);
      const skin = c.createLinearGradient(0, 440, 0, H);
      skin.addColorStop(0, '#c58b73'); skin.addColorStop(.45, '#d7a48a'); skin.addColorStop(1, '#b67c69');
      c.fillStyle = 'rgba(35,75,52,.35)';
      c.beginPath(); c.ellipse(367, 524, 128, 42, -.1, 0, Math.PI * 2); c.ellipse(625, 526, 123, 40, .12, 0, Math.PI * 2); c.fill();
      c.fillStyle = skin;
      c.beginPath(); c.moveTo(195, H + 5); c.quadraticCurveTo(234, 455, 316, 441); c.quadraticCurveTo(380, 432, 421, 480); c.quadraticCurveTo(437, 514, 427, H + 5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(560, H + 5); c.quadraticCurveTo(568, 473, 614, 443); c.quadraticCurveTo(668, 424, 724, 461); c.quadraticCurveTo(767, 489, 779, H + 5); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(102,56,47,.22)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(315, 459); c.quadraticCurveTo(355, 451, 385, 472); c.moveTo(631, 457); c.quadraticCurveTo(674, 447, 706, 468); c.stroke();
      // Legs remain understated so the landscape is the focus.
      const sock = c.createLinearGradient(0, 515, 0, H); sock.addColorStop(0, '#d8ba91'); sock.addColorStop(1, '#b99470');
      c.fillStyle = sock;
      c.beginPath(); c.moveTo(212, H + 2); c.lineTo(221, 522); c.quadraticCurveTo(270, 500, 313, 525); c.lineTo(319, H + 2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(666, H + 2); c.lineTo(664, 522); c.quadraticCurveTo(712, 497, 757, 527); c.lineTo(768, H + 2); c.closePath(); c.fill();
      c.restore();
    }
  }

  function drawMiniPhoto(c, x, y, w, h, scene, time) {
    c.save(); c.beginPath(); pathRoundedRect(c, x, y, w, h, 9); c.clip();
    if (scene === 'night') {
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#101a39'); g.addColorStop(1, '#354867'); c.fillStyle = g; c.fillRect(x, y, w, h);
      for (let i = 0; i < 22; i++) { c.fillStyle = `rgba(255,244,210,${.4 + (i % 3) * .2})`; c.fillRect(x + ((i * 13) % w), y + ((i * 23) % (h * .58)), 1.2, 1.2); }
      c.fillStyle = '#fff0c3'; c.beginPath(); c.arc(x + w * .73, y + h * .21, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#18233d'; c.beginPath(); c.arc(x + w * .77, y + h * .19, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#17243a';
      for (let i = 0; i < 10; i++) { const bw = 9 + (i * 7 % 17); const bh = h * (.17 + (i * 11 % 35) / 100); c.fillRect(x + i * w / 10, y + h - bh, bw, bh); }
      c.fillStyle = '#2a3547'; c.fillRect(x, y + h * .81, w, h * .19);
    } else {
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9ad4ec'); g.addColorStop(.7, '#ffe2a2'); g.addColorStop(1, '#559b62'); c.fillStyle = g; c.fillRect(x, y, w, h);
      c.fillStyle = '#ffe7a2'; c.beginPath(); c.arc(x + w * .27, y + h * .62, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#77938b'; c.beginPath(); c.moveTo(x, y + h * .81); c.lineTo(x + w * .46, y + h * .32); c.lineTo(x + w * .64, y + h * .64); c.lineTo(x + w, y + h * .58); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); c.fill();
      c.fillStyle = '#4e9459'; c.fillRect(x, y + h * .83, w, h * .17);
    }
    c.restore();
  }

  function drawPhone(c, scene, progress, time) {
    if (progress <= .002) return;
    const p = ease(progress);
    const pw = 130, ph = 238;
    const x = W / 2 - pw / 2;
    const y = H + 24 - p * (ph + 180);
    c.save();
    c.globalAlpha = p;
    // Sleeves and hands frame the phone to sell the first-person camera moment.
    c.fillStyle = scene === 'night' ? '#202c42' : '#d6a18a';
    c.beginPath(); c.moveTo(x - 28, H + 10); c.quadraticCurveTo(x - 12, y + ph - 2, x + 16, y + ph - 18); c.lineTo(x + 38, y + ph + 6); c.lineTo(x + 8, H + 12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x + pw + 28, H + 10); c.quadraticCurveTo(x + pw + 11, y + ph - 1, x + pw - 16, y + ph - 18); c.lineTo(x + pw - 38, y + ph + 5); c.lineTo(x + pw - 8, H + 12); c.closePath(); c.fill();
    const body = c.createLinearGradient(x, y, x + pw, y + ph); body.addColorStop(0, '#111722'); body.addColorStop(.45, '#283345'); body.addColorStop(1, '#05080e');
    roundedRect(c, x, y, pw, ph, 23, body, 'rgba(240,246,255,.65)', 1.2);
    roundedRect(c, x + 5, y + 5, pw - 10, ph - 10, 19, '#070b12', null);
    drawMiniPhoto(c, x + 9, y + 10, pw - 18, ph - 20, scene, time);
    // Camera island and camera controls.
    roundedRect(c, x + pw * .35, y + 7, pw * .3, 8, 5, '#06090e', null);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.font = 'bold 7px Arial'; c.textAlign = 'left'; c.fillText('9:41', x + 15, y + 23);
    c.fillStyle = 'rgba(10,16,28,.7)'; roundedRect(c, x + 13, y + ph - 57, pw - 26, 34, 12, 'rgba(12,20,32,.72)', null);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '8px Arial'; c.fillText('Моменты ✦', x + pw / 2, y + ph - 43);
    c.fillStyle = '#f9df8c'; c.beginPath(); c.arc(x + pw / 2, y + ph - 13, 9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x + pw / 2, y + ph - 13, 6, 0, Math.PI * 2); c.stroke();
    c.restore();
  }

  function drawDesk(c, time, alpha = 1) {
    c.save(); c.globalAlpha = alpha;
    const wall = c.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#354a62'); wall.addColorStop(.56, '#8795a1'); wall.addColorStop(1, '#d1c6b3');
    c.fillStyle = wall; c.fillRect(0, 0, W, H);
    // Evening window with blue-hour sky.
    const winG = c.createLinearGradient(0, 15, 180, 205); winG.addColorStop(0, '#192c4d'); winG.addColorStop(.62, '#648ca6'); winG.addColorStop(1, '#f3c98b');
    roundedRect(c, 52, 39, 215, 190, 7, '#25344a', 'rgba(239,235,220,.65)', 4);
    c.fillStyle = winG; c.fillRect(61, 48, 197, 172);
    for (let i = 0; i < 15; i++) { c.fillStyle = `rgba(255,231,169,${.25 + (i % 3) * .13})`; c.fillRect(66 + (i * 43) % 185, 65 + (i * 27) % 108, 2, 2); }
    c.strokeStyle = 'rgba(235,236,231,.45)'; c.lineWidth = 4; c.beginPath(); c.moveTo(159, 49); c.lineTo(159, 219); c.moveTo(61, 136); c.lineTo(258, 136); c.stroke();

    const table = c.createLinearGradient(0, 205, 0, H); table.addColorStop(0, '#92765e'); table.addColorStop(.5, '#b48f6f'); table.addColorStop(1, '#6f5748');
    c.fillStyle = table; c.beginPath(); c.moveTo(0, 215); c.lineTo(W, 190); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(61,43,35,.14)'; c.lineWidth = 1;
    for (let y = 245; y < H; y += 25) { c.beginPath(); c.moveTo(0, y + Math.sin(y) * 3); c.lineTo(W, y - 21); c.stroke(); }

    // Lamp light cone lands over the notebook, while the lamp itself stays above the page.
    const cone = c.createRadialGradient(685, 266, 3, 685, 266, 355);
    cone.addColorStop(0, 'rgba(255,235,174,.52)'); cone.addColorStop(.45, 'rgba(255,226,164,.28)'); cone.addColorStop(1, 'rgba(255,226,164,0)');
    c.fillStyle = cone; c.beginPath(); c.moveTo(742, 101); c.lineTo(920, 390); c.lineTo(350, 421); c.closePath(); c.fill();

    // Loose stationery, kept away from the writing.
    c.save(); c.translate(143, 345); c.rotate(-.25); roundedRect(c, -42, -8, 85, 15, 3, '#e4cd82', '#c6ac61', 1); c.fillStyle = '#5c7c99'; c.fillRect(-43, -8, 9, 15); c.restore();
    c.save(); c.translate(834, 432); c.rotate(.18); roundedRect(c, -24, -11, 49, 22, 4, '#d7e2e5', '#9aadb5', 1); c.restore();
    c.save(); c.translate(167, 462); c.rotate(.09); roundedRect(c, -19, -10, 39, 20, 4, '#d9a19c', '#bb817c', 1); c.restore();
    c.save(); c.translate(862, 267); c.rotate(.2); c.fillStyle = '#e9d8ab'; c.beginPath(); c.moveTo(-4, -66); c.lineTo(4, -66); c.lineTo(7, 48); c.lineTo(0, 61); c.lineTo(-7, 48); c.closePath(); c.fill(); c.fillStyle = '#b58b65'; c.beginPath(); c.moveTo(-4, -66); c.lineTo(4, -66); c.lineTo(0, -78); c.closePath(); c.fill(); c.restore();

    // Open notebook, seen slightly from above.
    c.save(); c.shadowColor = 'rgba(29,35,39,.27)'; c.shadowBlur = 20; c.shadowOffsetY = 8;
    c.fillStyle = '#f4eedc'; c.beginPath(); c.moveTo(248, 178); c.lineTo(741, 154); c.lineTo(789, 438); c.lineTo(278, 467); c.closePath(); c.fill(); c.restore();
    c.strokeStyle = 'rgba(122,135,138,.18)'; c.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const yy = 222 + i * 23; c.beginPath(); c.moveTo(287, yy); c.lineTo(747, yy - 22); c.stroke(); }
    c.strokeStyle = 'rgba(182,137,126,.34)'; c.beginPath(); c.moveTo(318, 197); c.lineTo(345, 450); c.stroke();
    c.strokeStyle = 'rgba(101,107,103,.3)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(518, 170); c.lineTo(538, 459); c.stroke();

    const first = 'Ты много трудилась';
    const second = 'в этом году...';
    const count = Math.max(0, Math.floor((time - 360) / 76));
    c.save(); c.translate(347, 267); c.rotate(-.047); c.fillStyle = '#39516d'; c.font = 'italic 26px "Segoe Print", "Bradley Hand", cursive'; c.textBaseline = 'alphabetic';
    const firstN = Math.min(first.length, count);
    c.fillText(first.slice(0, firstN), 0, 0);
    const secondN = Math.max(0, Math.min(second.length, count - first.length));
    if (secondN) c.fillText(second.slice(0, secondN), 10, 49);
    c.restore();

    // A lamp with a warm shade and an articulated neck.
    c.strokeStyle = '#273543'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(904, 436); c.quadraticCurveTo(914, 378, 878, 330); c.lineTo(800, 183); c.lineTo(759, 114); c.stroke();
    c.strokeStyle = 'rgba(248,249,242,.5)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(899, 433); c.quadraticCurveTo(907, 378, 870, 329); c.lineTo(795, 180); c.stroke();
    c.fillStyle = '#243344'; c.beginPath(); c.ellipse(903, 438, 53, 11, -.04, 0, Math.PI * 2); c.fill();
    const shade = c.createLinearGradient(708, 70, 810, 135); shade.addColorStop(0, '#f4d78b'); shade.addColorStop(.52, '#e9bf62'); shade.addColorStop(1, '#a67b41');
    c.fillStyle = shade; c.beginPath(); c.moveTo(711, 76); c.quadraticCurveTo(765, 99, 810, 121); c.lineTo(784, 144); c.quadraticCurveTo(744, 122, 691, 111); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,250,220,.62)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(711, 76); c.quadraticCurveTo(765, 99, 810, 121); c.stroke();
    c.fillStyle = 'rgba(255,241,185,.78)'; c.beginPath(); c.ellipse(751, 119, 39, 8, .35, 0, Math.PI); c.fill();
    c.restore();
  }

  function drawAfterGlow(c, time) {
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#badff0'); bg.addColorStop(.55, '#e4f0f0'); bg.addColorStop(1, '#ffe9ab');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 20; i++) {
      const x = ((i * 167.3 + time * (.003 + (i % 3) * .0004)) % (W + 80)) - 40;
      const y = 42 + ((i * 57.1) % 440);
      const r = 2 + (i % 4) * 1.4;
      c.fillStyle = `rgba(255,255,255,${.15 + .1 * Math.sin(time * .0007 + i)})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(118,177,177,.32)'; c.beginPath(); c.moveTo(0, 440); c.quadraticCurveTo(230, 350, 500, 433); c.quadraticCurveTo(780, 510, W, 397); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
  }

  function render(now) {
    const elapsed = stageElapsed(now);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);

    if (stage === 'cover') {
      drawCover(ctx);
    } else if (stage === 'ascent') {
      const p = ease(elapsed / 4700);
      drawCover(ctx);
      ctx.save(); ctx.globalAlpha = p; drawNightScene(ctx, now, p); ctx.restore();
      // A gentle lens-like lift while the question stays pinned in the same place.
      if (p < .92) {
        const glow = ctx.createLinearGradient(0, H * (.45 - p * .5), 0, H);
        glow.addColorStop(0, `rgba(8,18,43,${p * .16})`); glow.addColorStop(1, 'rgba(8,18,43,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      }
    } else if (stage === 'night' || stage === 'nightPhone') {
      drawNightScene(ctx, now, 1);
      if (stage === 'nightPhone') drawPhone(ctx, 'night', phoneProgress, now);
    } else if (stage === 'blink') {
      if (elapsed < 730) drawNightScene(ctx, now, 1);
      else drawMeadow(ctx, now, .07, false);
    } else if (stage === 'sunrise' || stage === 'sunPhone') {
      const sittingFade = stage === 'sunPhone' ? ease((elapsed - 400) / 950) : 0;
      drawMeadow(ctx, now, .07, stage === 'sunPhone', false, sittingFade);
      if (stage === 'sunPhone') drawPhone(ctx, 'sunrise', phoneProgress, now);
    } else if (stage === 'timelapse') {
      const p = ease(elapsed / 11600);
      // The days start lazily, then speed up: eighteen little loops in one year.
      const cycles = 18 * Math.pow(p, 1.7);
      drawMeadow(ctx, now, cycles % 1, true, true);
      const atmosphere = ctx.createLinearGradient(0, 0, W, H);
      atmosphere.addColorStop(0, `rgba(255,230,164,${.06 + .04 * Math.sin(cycles * Math.PI * 2)})`);
      atmosphere.addColorStop(1, 'rgba(120,186,221,.025)'); ctx.fillStyle = atmosphere; ctx.fillRect(0, 0, W, H);
    } else if (stage === 'descent') {
      const p = ease(elapsed / 3600);
      drawMeadow(ctx, now, .14 + p * .31, true);
      ctx.save(); ctx.globalAlpha = p; ctx.translate(W / 2, H / 2); ctx.scale(1 + p * .5, 1 + p * .5); ctx.translate(-W / 2, -H / 2); drawDesk(ctx, now, 1); ctx.restore();
      const darken = ctx.createLinearGradient(0, H * .5, 0, H); darken.addColorStop(0, 'rgba(20,24,32,0)'); darken.addColorStop(1, `rgba(20,24,32,${.28 * p})`); ctx.fillStyle = darken; ctx.fillRect(0, 0, W, H);
    } else if (stage === 'desk') {
      drawDesk(ctx, elapsed, 1);
    } else if (stage === 'fadeStats') {
      const p = ease(elapsed / 1500);
      drawDesk(ctx, elapsed + 2500, 1 - p);
      ctx.save(); ctx.globalAlpha = p; drawAfterGlow(ctx, now); ctx.restore();
    } else if (stage === 'stats' || stage === 'birthday') {
      drawAfterGlow(ctx, now);
    } else {
      drawCover(ctx);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  async function runStory() {
    if (timelineStarted) return;
    timelineStarted = true;
    const token = ++sequenceToken;
    noButton.classList.add('is-vanishing');
    yesButton.classList.add('is-growing');
    setStage('ascent');
    experience.classList.add('is-night');
    if (!(await waitToken(4700, token))) return;

    welcomeLayer.classList.add('is-leaving');
    setStage('night');
    if (!(await typeCaption('Прошло много ночей, каждый твой сон был таким же красивым, как каждая из этих звёзд.', 'НОЧНОЕ НЕБО', token, 31))) return;
    if (!(await waitToken(1700, token))) return;

    hideCaption(); setStage('nightPhone');
    if (!(await showPhone(1, token))) return;
    if (!(await waitToken(300, token))) return;

    setStage('blink');
    blinkShutter.classList.remove('is-blinking');
    // Force a style boundary so replaying the story also replays the eyelid animation.
    void blinkShutter.offsetWidth;
    blinkShutter.classList.add('is-blinking');
    if (!(await waitToken(1500, token))) return;
    blinkShutter.classList.remove('is-blinking');

    setStage('sunrise');
    await waitToken(550, token);
    if (!(await typeCaption('Твои дни были полны радости и света.', 'А ПОТОМ ПРИХОДИЛО УТРО', token, 42))) return;
    if (!(await waitToken(1000, token))) return;

    setStage('sunPhone');
    notification.classList.add('is-visible');
    if (!(await showPhone(1, token))) return;
    if (!(await waitToken(1800, token))) return;
    notification.classList.remove('is-visible');
    hideCaption();

    setStage('timelapse');
    if (!(await waitToken(11600, token))) return;
    setStage('descent');
    if (!(await waitToken(3600, token))) return;
    setStage('desk');
    if (!(await waitToken(3600, token))) return;
    setStage('fadeStats');
    if (!(await waitToken(1500, token))) return;

    setStage('stats');
    liquidUi.classList.add('is-visible');
    confessionCard.classList.add('is-visible');
    if (!(await waitToken(1150, token))) return;
    checklistCard.classList.add('is-visible');
    await new Promise(resolve => { checklistResolve = resolve; });
    checklistResolve = null;
    if (token !== sequenceToken) return;
    setStage('birthday');
    birthdayCard.classList.add('is-visible');
    await new Promise(resolve => { spoilerResolve = resolve; });
    spoilerResolve = null;
    if (token !== sequenceToken) return;
    if (!(await waitToken(1600, token))) return;
    scrollCue.classList.add('is-visible');
  }

  yesButton.addEventListener('click', () => {
    if (timelineStarted) return;
    yesButton.disabled = true;
    noButton.disabled = true;
    runStory();
  });

  noButton.addEventListener('click', () => {
    if (timelineStarted || noButton.classList.contains('is-vanishing')) return;
    noMessage.textContent = 'хуй тебе, для кого старался';
    noMessage.classList.add('is-visible');
    noButton.classList.add('is-vanishing');
    yesButton.classList.add('is-growing');
    window.setTimeout(() => { noButton.hidden = true; }, 650);
  });

  taskButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (tasksDone[index]) return;
      tasksDone[index] = true;
      button.classList.add('is-checked');
      button.setAttribute('aria-pressed', 'true');
      checkHint.textContent = tasksDone.every(Boolean) ? 'Все пункты закрыты. Ну что, готова? ✦' : `Отмечено ${tasksDone.filter(Boolean).length} из 3`;
      if (tasksDone.every(Boolean) && checklistResolve) checklistResolve(true);
    });
  });

  function fireConfetti(buttonIndex) {
    const colors = ['#ffdf7e', '#7cc5e5', '#fff5d0', '#a8d7e9', '#ffd29b', '#effaff', '#93b9df'];
    const count = 86;
    const centerX = buttonIndex === 0 ? 38 : 63;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = `confetti-piece${i % 5 === 0 ? ' round' : ''}`;
      const x = clamp(centerX + (Math.random() - .5) * 42, 2, 98);
      piece.style.setProperty('--x', `${x}%`);
      piece.style.setProperty('--w', `${3 + Math.random() * 5}px`);
      piece.style.setProperty('--h', `${5 + Math.random() * 8}px`);
      piece.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
      piece.style.setProperty('--duration', `${2.1 + Math.random() * 1.9}s`);
      piece.style.setProperty('--delay', `${Math.random() * .27}s`);
      piece.style.setProperty('--drift', `${(Math.random() - .5) * 220}px`);
      piece.style.setProperty('--spin', `${Math.round((Math.random() - .5) * 1300)}deg`);
      confettiLayer.appendChild(piece);
      window.setTimeout(() => piece.remove(), 4700);
    }
    if ('vibrate' in navigator) {
      try { navigator.vibrate([85, 35, 60]); } catch (_) { /* iOS Safari may not expose vibration. */ }
    }
    // A quick recoil on the active word makes the confetti feel like a tiny launch.
    const active = spoilerButtons[buttonIndex];
    active.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(.92) translateY(2px)' },
      { transform: 'scale(1.04) translateY(-1px)' },
      { transform: 'scale(1)' }
    ], { duration: 330, easing: 'cubic-bezier(.2,.85,.3,1)' });
  }

  spoilerButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (wordsRevealed[index]) return;
      wordsRevealed[index] = true;
      button.classList.add('is-revealed');
      button.setAttribute('aria-label', `${button.dataset.word}, открыто`);
      button.disabled = true;
      progressPills[index].classList.add('is-on');
      fireConfetti(index);
      if (wordsRevealed.every(Boolean) && spoilerResolve) spoilerResolve(true);
      const hint = document.getElementById('birthdayHint');
      hint.textContent = wordsRevealed.every(Boolean) ? 'Вот теперь точно всё для тебя 🩵' : 'Ещё одно слово осталось…';
    });
  });

  scrollCue.addEventListener('click', () => {
    document.getElementById('finale').scrollIntoView({ behavior: noReduceMotion ? 'smooth' : 'auto', block: 'start' });
  });
  replayButton.addEventListener('click', resetStory);

  function resetStory() {
    sequenceToken++;
    if (checklistResolve) { checklistResolve(false); checklistResolve = null; }
    if (spoilerResolve) { spoilerResolve(false); spoilerResolve = null; }
    timelineStarted = false;
    phoneProgress = 0;
    tasksDone = [false, false, false];
    wordsRevealed = [false, false];
    stage = 'cover'; stageStarted = performance.now();
    experience.className = 'experience';
    welcomeLayer.classList.remove('is-leaving');
    welcomeCard.style.opacity = '';
    yesButton.disabled = false; noButton.disabled = false;
    yesButton.classList.remove('is-growing'); noButton.classList.remove('is-vanishing'); noButton.hidden = false;
    noMessage.textContent = ''; noMessage.classList.remove('is-visible');
    hideCaption(); captionKicker.textContent = ''; storyCaption.textContent = '';
    notification.classList.remove('is-visible');
    liquidUi.classList.remove('is-visible');
    [confessionCard, checklistCard, birthdayCard].forEach(card => card.classList.remove('is-visible'));
    taskButtons.forEach(button => { button.classList.remove('is-checked'); button.setAttribute('aria-pressed', 'false'); });
    checkHint.textContent = 'Нажми на каждый квадратик ✦';
    spoilerButtons.forEach(button => { button.classList.remove('is-revealed'); button.disabled = false; button.setAttribute('aria-label', `Открыть ${button.dataset.word}`); });
    progressPills.forEach(pill => pill.classList.remove('is-on'));
    document.getElementById('birthdayHint').textContent = 'Открывай по словам — не всё сразу 😉';
    scrollCue.classList.remove('is-visible');
    blinkShutter.classList.remove('is-blinking');
    confettiLayer.replaceChildren();
    window.scrollTo({ top: 0, behavior: noReduceMotion ? 'smooth' : 'auto' });
  }
})();
