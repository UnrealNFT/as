/* ============================================================
   CANDY RUSH NIGHT 🍭 — Runner solo 3D avec progression
   ============================================================ */

(function () {
  'use strict';

  // ---------- CONFIGURATION ----------
  const LANES = 5;
  const LANE_WIDTH = 3.8;
  const LANE_SPACING = 3.6;
  const SPAWN_Z = -90;
  const DESPAWN_Z = 25;
  const BASE_SPEED = 18;
  const MAX_SPEED = 42;
  const LANE_LIMIT = ((LANES - 1) / 2) * LANE_SPACING;
  const SAVE_KEY = 'candyRushNight_v1';

  const UPGRADES = [
    { id: 'maxLives', name: 'Cœurs sucrés', icon: '❤️', desc: 'Plus de vies au départ.', baseCost: 80, max: 4, step: 20 },
    { id: 'speed', name: 'Jambes en gélatine', icon: '⚡', desc: 'Vitesse de déplacement latéral.', baseCost: 120, max: 5, step: 40 },
    { id: 'magnet', name: 'Aimant gourmand', icon: '🧲', desc: 'L\'aimant attire plus loin.', baseCost: 100, max: 5, step: 60 },
    { id: 'score', name: 'Multiplicateur doré', icon: '✨', desc: 'Score des bonbons augmenté.', baseCost: 150, max: 5, step: 100 },
    { id: 'rush', name: 'Féérie sucrée', icon: '🌟', desc: 'La Sugar Rush dure plus longtemps.', baseCost: 200, max: 3, step: 150 },
  ];

  // ---------- ÉTAT ----------
  let scene, camera, renderer;
  let playerMesh, playerLight;
  let worldGroup;
  let entities = [];
  let decorations = [];
  let particles = [];
  let gameState = 'menu';
  let speed = BASE_SPEED;
  let distance = 0;
  let score = 0;
  let candies = 0;
  let lives = 3;
  let combo = 0;
  let sugarRush = 0;
  let rushActive = false;
  let rushTimer = 0;
  let dead = false;
  let paused = false;
  let inputX = 0;
  let playerX = 0;
  let magnetTimer = 0;
  let shieldTimer = 0;
  let doubleTimer = 0;
  let magnetRadius = 0;
  let sessionSugar = 0;

  let save = {
    sugar: 0, bestScore: 0, bestDistance: 0, runs: 0,
    upgrades: { maxLives: 0, speed: 0, magnet: 0, score: 0, rush: 0 },
  };

  const ui = {
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorText: document.getElementById('error-text'),
    menu: document.getElementById('menu'),
    shop: document.getElementById('shop'),
    help: document.getElementById('help'),
    gameover: document.getElementById('gameover'),
    pause: document.getElementById('pause'),
    hud: document.getElementById('hud'),
    hudScore: document.getElementById('hud-score'),
    hudDistance: document.getElementById('hud-distance'),
    hudCandies: document.getElementById('hud-candies'),
    sugarFill: document.getElementById('sugar-fill'),
    powerups: document.getElementById('powerups'),
    shopItems: document.getElementById('shop-items'),
    menuSugar: document.getElementById('menu-sugar'),
    menuBest: document.getElementById('menu-best'),
    menuRuns: document.getElementById('menu-runs'),
    goTitle: document.getElementById('go-title'),
    goSubtitle: document.getElementById('go-subtitle'),
    goScore: document.getElementById('go-score'),
    goSugar: document.getElementById('go-sugar'),
    goDist: document.getElementById('go-dist'),
  };

  // ---------- UTILS ----------
  function showError(msg) {
    console.error(msg);
    ui.loading.style.display = 'none';
    ui.error.style.display = 'flex';
    ui.errorText.textContent = msg;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(save, JSON.parse(raw));
    } catch (e) {}
  }
  function saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }
  function upgradeCost(id, level) {
    const up = UPGRADES.find(u => u.id === id);
    return up.baseCost + level * up.step;
  }

  // ---------- THREE.JS ----------
  function init() {
    if (typeof THREE === 'undefined') throw new Error('Three.js non chargé.');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0221);
    scene.fog = new THREE.Fog(0x0d0221, 40, 110);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 14, 22);
    camera.lookAt(0, 0, -10);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const moon = new THREE.DirectionalLight(0xffc8dd, 0.7);
    moon.position.set(10, 40, 20);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    scene.add(moon);
    scene.add(new THREE.HemisphereLight(0x8338ec, 0xff006e, 0.35));

    createWorld();
    createPlayer();

    window.addEventListener('resize', onResize);
    bindInputs();
    animate();
  }

  function createWorld() {
    worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_WIDTH * LANES + 3, 300),
      new THREE.MeshStandardMaterial({ color: 0x2a0a3b, roughness: 0.7 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = -0.05;
    road.receiveShadow = true;
    scene.add(road);

    for (let side = -1; side <= 1; side += 2) {
      const x = side * (LANE_WIDTH * LANES / 2 + 1.2);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 2.5, 300),
        new THREE.MeshStandardMaterial({ color: side < 0 ? 0xff006e : 0x8338ec })
      );
      stripe.position.set(x, 1.2, 0);
      scene.add(stripe);
    }

    for (let i = 1; i < LANES; i++) {
      const x = (i - LANES / 2) * LANE_SPACING + LANE_SPACING / 2;
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.05, 300),
        new THREE.MeshBasicMaterial({ color: 0xffc8dd, opacity: 0.35, transparent: true })
      );
      line.position.set(x, 0.02, 0);
      scene.add(line);
    }

    const starsGeo = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < 300; i++) {
      positions.push((Math.random() - 0.5) * 250, 30 + Math.random() * 80, -50 - Math.random() * 180);
    }
    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 })));

    for (let i = 0; i < 14; i++) {
      const d = createCandyCane();
      d.position.z = -20 - i * 15;
      d.position.x = (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 12);
      worldGroup.add(d);
      decorations.push(d);
    }
  }

  function createCandyCane() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xff006e });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 12), mat);
    shaft.position.y = 3;
    group.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.32, 8, 16, Math.PI), white);
    ring.position.y = 6;
    group.add(ring);
    group.scale.setScalar(0.8 + Math.random() * 0.5);
    return group;
  }

  function createPlayer() {
    const color = 0xff006e;
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 24, 24),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.25 })
    );
    body.castShadow = true;
    group.add(body);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    [-0.22, 0.22].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), eyeMat);
      eye.position.set(x, 0.25, 0.55);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pupilMat);
      pupil.position.set(x, 0.25, 0.66);
      group.add(eye, pupil);
    });

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 6, 14, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
    );
    smile.position.set(0, 0.02, 0.6);
    smile.rotation.x = Math.PI;
    group.add(smile);

    playerLight = new THREE.PointLight(color, 1.2, 12);
    playerLight.position.y = 1.2;
    group.add(playerLight);

    group.position.set(0, 0.75, 10);
    scene.add(group);
    playerMesh = group;
  }

  function createEntityMesh(type) {
    let geometry, material;
    switch (type) {
      case 'candy':
        geometry = new THREE.IcosahedronGeometry(0.45, 0);
        material = new THREE.MeshStandardMaterial({ color: 0xff006e, emissive: 0xff006e, emissiveIntensity: 0.4 });
        break;
      case 'bigcandy':
        geometry = new THREE.IcosahedronGeometry(0.65, 0);
        material = new THREE.MeshStandardMaterial({ color: 0xffbe0b, emissive: 0xffbe0b, emissiveIntensity: 0.45 });
        break;
      case 'heart':
        geometry = new THREE.SphereGeometry(0.5, 16, 16);
        material = new THREE.MeshStandardMaterial({ color: 0x06d6a0, emissive: 0x06d6a0, emissiveIntensity: 0.4 });
        break;
      case 'magnet':
        geometry = new THREE.TorusGeometry(0.35, 0.12, 8, 20);
        material = new THREE.MeshStandardMaterial({ color: 0x8338ec, emissive: 0x8338ec, emissiveIntensity: 0.5 });
        break;
      case 'shield':
        geometry = new THREE.SphereGeometry(0.5, 16, 16);
        material = new THREE.MeshStandardMaterial({ color: 0x3a86ff, emissive: 0x3a86ff, emissiveIntensity: 0.3, transparent: true, opacity: 0.8 });
        break;
      case 'double':
        geometry = new THREE.OctahedronGeometry(0.5, 0);
        material = new THREE.MeshStandardMaterial({ color: 0xfb5607, emissive: 0xfb5607, emissiveIntensity: 0.45 });
        break;
      case 'bad':
        geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        material = new THREE.MeshStandardMaterial({ color: 0x3e1f14 });
        break;
      case 'bomb':
        geometry = new THREE.SphereGeometry(0.55, 16, 16);
        material = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff0000, emissiveIntensity: 0.6 });
        break;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  function spawnEntity() {
    const lane = randInt(0, LANES - 1);
    const x = (lane - (LANES - 1) / 2) * LANE_SPACING;
    const r = Math.random();
    let type = 'candy';
    if (r < 0.06) type = 'heart';
    else if (r < 0.12) type = 'magnet';
    else if (r < 0.17) type = 'shield';
    else if (r < 0.22) type = 'double';
    else if (r < 0.38) type = 'bad';
    else if (r < 0.48) type = 'bomb';
    else if (r < 0.78) type = 'candy';
    else type = 'bigcandy';

    const mesh = createEntityMesh(type);
    mesh.position.set(x, type === 'candy' || type === 'bigcandy' ? 0 : 0.6, SPAWN_Z);
    scene.add(mesh);
    entities.push({ type, mesh, x, z: SPAWN_Z, consumed: false, lane });
  }

  function createParticles(pos, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.14),
        new THREE.MeshBasicMaterial({ color })
      );
      p.position.copy(pos);
      p.position.y += 0.4;
      p.userData = {
        vx: (Math.random() - 0.5) * 6, vy: 3 + Math.random() * 3, vz: (Math.random() - 0.5) * 6, life: 1,
      };
      scene.add(p);
      particles.push(p);
    }
  }

  // ---------- GAME LOGIC ----------
  function startRun() {
    entities.forEach(e => scene.remove(e.mesh));
    entities = [];
    particles.forEach(p => scene.remove(p));
    particles = [];

    gameState = 'playing';
    dead = false;
    paused = false;
    distance = 0;
    score = 0;
    candies = 0;
    sessionSugar = 0;
    combo = 0;
    sugarRush = 0;
    rushActive = false;
    rushTimer = 0;
    magnetTimer = 0;
    shieldTimer = 0;
    doubleTimer = 0;
    inputX = 0;
    playerX = 0;
    playerMesh.position.set(0, 0.75, 10);
    playerMesh.rotation.set(0, 0, 0);

    lives = 3 + save.upgrades.maxLives;
    magnetRadius = 3 + save.upgrades.magnet * 1.2;
    speed = BASE_SPEED;

    ui.menu.classList.remove('visible');
    ui.shop.classList.remove('visible');
    ui.gameover.classList.remove('visible');
    ui.hud.style.display = 'block';
    ui.hud.style.pointerEvents = 'none';
    updateHUD();

    save.runs++;
    saveGame();
  }

  function endRun(killed) {
    gameState = 'gameover';
    dead = true;
    save.sugar += sessionSugar;
    if (score > save.bestScore) save.bestScore = score;
    if (distance > save.bestDistance) save.bestDistance = distance;
    saveGame();

    ui.goTitle.textContent = killed ? '💥 Perdu !' : '🏁 Run terminée';
    ui.goSubtitle.textContent = killed ? 'Tu as perdu tes dernières vies.' : 'Tu as survécu à la nuit sucrée.';
    ui.goScore.textContent = Math.floor(score);
    ui.goSugar.textContent = sessionSugar;
    ui.goDist.textContent = Math.floor(distance) + 'm';

    ui.gameover.classList.add('visible');
    ui.hud.style.display = 'none';
    updateMenuStats();
  }

  function update(dt) {
    if (gameState !== 'playing' || paused) return;

    const currentSpeed = rushActive ? MAX_SPEED * 1.25 : Math.min(BASE_SPEED + distance * 0.03, MAX_SPEED);
    speed = currentSpeed;
    distance += speed * dt;

    decorations.forEach(d => {
      d.position.z += speed * dt * 0.85;
      if (d.position.z > DESPAWN_Z + 10) {
        d.position.z = SPAWN_Z;
        d.position.x = (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 12);
      }
    });

    const maxMoveSpeed = 12 + save.upgrades.speed * 3;
    playerX += (inputX - playerX) * Math.min(maxMoveSpeed * dt, 1);
    playerX = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, playerX));
    playerMesh.position.x = playerX;
    playerMesh.rotation.z = -playerX * 0.08;
    playerMesh.position.y = 0.75 + Math.sin(performance.now() * 0.006) * 0.08;

    if (magnetTimer > 0) magnetTimer -= dt;
    if (shieldTimer > 0) shieldTimer -= dt;
    if (doubleTimer > 0) doubleTimer -= dt;
    if (rushTimer > 0) {
      rushTimer -= dt;
      if (rushTimer <= 0) deactivateRush();
    }

    if (!rushActive) sugarRush = Math.max(0, sugarRush - dt * 3);

    const spawnRate = Math.max(0.35, 0.9 - distance * 0.002);
    if (Math.random() < (dt / spawnRate)) spawnEntity();

    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.consumed) continue;
      e.z += speed * dt;
      e.mesh.position.z = e.z;
      e.mesh.rotation.y += dt * 2;
      e.mesh.rotation.x += dt * 1.5;

      if (magnetTimer > 0 && (e.type === 'candy' || e.type === 'bigcandy')) {
        const dx = playerX - e.x;
        const dz = playerMesh.position.z - e.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < magnetRadius && dist > 0.5) {
          e.x += dx * dt * 5;
          e.mesh.position.x = e.x;
        }
      }

      const dx = playerX - e.x;
      const dz = playerMesh.position.z - e.z;
      if (dx * dx + dz * dz < 1.21) {
        handleCollision(e);
      }

      if (e.z > DESPAWN_Z) {
        scene.remove(e.mesh);
        entities.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.position.x += p.userData.vx * dt;
      p.position.y += p.userData.vy * dt;
      p.position.z += p.userData.vz * dt;
      p.userData.vy -= 9.8 * dt;
      p.userData.life -= dt * 1.5;
      p.scale.setScalar(Math.max(0, p.userData.life));
      if (p.userData.life <= 0) {
        scene.remove(p);
        particles.splice(i, 1);
      }
    }

    if (lives <= 0) endRun(true);

    updateHUD();
  }

  function handleCollision(e) {
    e.consumed = true;
    let color = 0xffffff;

    switch (e.type) {
      case 'candy':
        addScore(10 * (1 + save.upgrades.score * 0.25));
        sessionSugar++;
        candies++;
        sugarRush = Math.min(100, sugarRush + 8);
        color = 0xff006e;
        break;
      case 'bigcandy':
        addScore(50 * (1 + save.upgrades.score * 0.25));
        sessionSugar += 5;
        candies += 5;
        sugarRush = Math.min(100, sugarRush + 18);
        color = 0xffbe0b;
        break;
      case 'heart':
        lives++;
        sugarRush = Math.min(100, sugarRush + 5);
        color = 0x06d6a0;
        break;
      case 'magnet':
        magnetTimer = 6 + save.upgrades.magnet * 1.5;
        color = 0x8338ec;
        break;
      case 'shield':
        shieldTimer = 8;
        color = 0x3a86ff;
        break;
      case 'double':
        doubleTimer = 10;
        color = 0xfb5607;
        break;
      case 'bad':
        if (shieldTimer > 0) { shieldTimer = 0; color = 0x3a86ff; }
        else { lives--; combo = 0; sugarRush = Math.max(0, sugarRush - 20); color = 0x3e1f14; shakeCamera(); }
        break;
      case 'bomb':
        if (shieldTimer > 0) { shieldTimer = 0; color = 0x3a86ff; }
        else { lives -= 2; combo = 0; sugarRush = Math.max(0, sugarRush - 40); color = 0xff0000; shakeCamera(); }
        break;
    }

    createParticles(e.mesh.position, color, 10);
    scene.remove(e.mesh);
    const idx = entities.indexOf(e);
    if (idx > -1) entities.splice(idx, 1);

    if (sugarRush >= 100 && !rushActive) activateRush();
  }

  function addScore(points) {
    const mul = doubleTimer > 0 ? 2 : 1;
    const rushMul = rushActive ? 2 : 1;
    score += points * mul * rushMul;
  }

  function activateRush() {
    rushActive = true;
    rushTimer = 6 + save.upgrades.rush * 3;
    playerLight.color.setHex(0xffbe0b);
    playerLight.intensity = 3;
    createParticles(playerMesh.position, 0xffbe0b, 30);
  }

  function deactivateRush() {
    rushActive = false;
    sugarRush = 0;
    playerLight.color.setHex(0xff006e);
    playerLight.intensity = 1.2;
  }

  function shakeCamera() {
    const base = camera.position.clone();
    let t = 0;
    function s() {
      t += 0.15;
      camera.position.x = base.x + Math.sin(t * 20) * 0.4;
      camera.position.y = base.y + Math.cos(t * 25) * 0.3;
      if (t < 1) requestAnimationFrame(s);
      else camera.position.copy(base);
    }
    s();
  }

  function updateHUD() {
    ui.hudScore.textContent = Math.floor(score);
    ui.hudDistance.textContent = Math.floor(distance) + ' m';
    ui.hudCandies.textContent = candies;
    ui.sugarFill.style.height = Math.min(100, sugarRush) + '%';

    ui.powerups.innerHTML = '';
    if (magnetTimer > 0) addPowerIcon('🧲', magnetTimer);
    if (shieldTimer > 0) addPowerIcon('🛡️', shieldTimer);
    if (doubleTimer > 0) addPowerIcon('✖️2', doubleTimer);
    if (rushActive) addPowerIcon('🌟', rushTimer);
  }

  function addPowerIcon(icon, time) {
    const div = document.createElement('div');
    div.className = 'powerup-icon';
    div.textContent = icon;
    div.setAttribute('data-time', Math.ceil(time));
    ui.powerups.appendChild(div);
  }

  function updateMenuStats() {
    ui.menuSugar.textContent = save.sugar;
    ui.menuBest.textContent = save.bestScore;
    ui.menuRuns.textContent = save.runs;
  }

  function renderShop() {
    ui.shopItems.innerHTML = '';
    UPGRADES.forEach(up => {
      const level = save.upgrades[up.id] || 0;
      const cost = upgradeCost(up.id, level);
      const maxed = level >= up.max;
      const canAfford = save.sugar >= cost && !maxed;

      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML = `
        <div class="icon">${up.icon}</div>
        <div class="info">
          <strong>${up.name}</strong>
          <span>${up.desc}</span>
          <div class="level">Niveau ${level}/${up.max}</div>
        </div>
        <button class="buy ${maxed ? 'max' : ''}" data-id="${up.id}">
          ${maxed ? 'MAX' : cost + ' 🍬'}
        </button>
      `;
      const btn = div.querySelector('button');
      btn.disabled = !canAfford;
      btn.addEventListener('click', () => buyUpgrade(up.id));
      ui.shopItems.appendChild(div);
    });
  }

  function buyUpgrade(id) {
    const level = save.upgrades[id] || 0;
    const up = UPGRADES.find(u => u.id === id);
    if (level >= up.max) return;
    const cost = upgradeCost(id, level);
    if (save.sugar >= cost) {
      save.sugar -= cost;
      save.upgrades[id] = level + 1;
      saveGame();
      renderShop();
      updateMenuStats();
    }
  }

  // ---------- INPUTS ----------
  function bindInputs() {
    document.addEventListener('mousemove', e => {
      if (gameState !== 'playing' || paused) return;
      const pct = e.clientX / window.innerWidth;
      inputX = (pct - 0.5) * LANE_WIDTH * LANES * 1.15;
    });

    document.addEventListener('touchmove', e => {
      if (gameState !== 'playing' || paused) return;
      e.preventDefault();
      const pct = e.touches[0].clientX / window.innerWidth;
      inputX = (pct - 0.5) * LANE_WIDTH * LANES * 1.25;
    }, { passive: false });

    document.addEventListener('keydown', e => {
      if (e.code === 'Escape' && gameState === 'playing') togglePause();
      if (e.code === 'Space' && gameState === 'playing') e.preventDefault();
    });

    document.getElementById('btn-play').addEventListener('click', startRun);
    document.getElementById('btn-shop').addEventListener('click', () => { renderShop(); ui.shop.classList.add('visible'); });
    document.getElementById('btn-close-shop').addEventListener('click', () => ui.shop.classList.remove('visible'));
    document.getElementById('btn-help').addEventListener('click', () => ui.help.classList.add('visible'));
    document.getElementById('btn-close-help').addEventListener('click', () => ui.help.classList.remove('visible'));
    document.getElementById('btn-retry').addEventListener('click', startRun);
    document.getElementById('btn-back-menu').addEventListener('click', () => { ui.gameover.classList.remove('visible'); ui.menu.classList.add('visible'); ui.hud.style.display = 'none'; gameState = 'menu'; });
    document.getElementById('btn-resume').addEventListener('click', togglePause);
    document.getElementById('btn-quit').addEventListener('click', () => { paused = false; ui.pause.classList.remove('visible'); ui.menu.classList.add('visible'); ui.hud.style.display = 'none'; gameState = 'menu'; });
  }

  function togglePause() {
    if (gameState !== 'playing') return;
    paused = !paused;
    if (paused) ui.pause.classList.add('visible');
    else ui.pause.classList.remove('visible');
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    update(dt);
    renderer.render(scene, camera);
  }

  // ---------- BOOT ----------
  function boot() {
    try {
      loadSave();
      init();
      updateMenuStats();
      setTimeout(() => { ui.loading.style.display = 'none'; }, 900);
    } catch (err) {
      showError(err.message || String(err));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
