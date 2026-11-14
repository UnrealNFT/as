/* ============================================================
   ÎLE AUX BONBONS 🍭 — Course des Gourmands
   Jeu de plateau 3D simple, coloré et familial
   ============================================================ */

(function () {
  'use strict';

  // ---------- CONFIGURATION ----------
  const TILE_COUNT = 28;
  const COLS = 7;
  const SPACING = 4.5;
  const START_MONEY = 0;
  const FINISH_BONUS = 100;

  const PLAYERS_DEF = [
    { name: 'Gélatti Rose', emoji: '🍧', color: 0xff006e },
    { name: 'Citron Vert', emoji: '🍋', color: 0x06d6a0 },
    { name: 'Bleuette', emoji: '🫐', color: 0x3a86ff },
    { name: 'Caramel', emoji: '🍮', color: 0xff9f06 },
  ];

  const TILE_TYPES = {
    normal: { color: 0xffd6ff, label: 'Bonbon', icon: '🍬', points: 10 },
    boost: { color: 0xffbe0b, label: 'Sucette Boost', icon: '🍭', points: 5, move: +2 },
    trap: { color: 0x7c2d12, label: 'Chocolat Amer', icon: '🍫', points: -5, move: -2 },
    gift: { color: 0x06d6a0, label: 'Cadeau Gourmand', icon: '🎁', pointsRange: [20, 50] },
    rainbow: { color: 0x8338ec, label: 'Arc-en-ciel', icon: '🌈', move: +4 },
    start: { color: 0xffffff, label: 'Départ', icon: '🏝️', points: 0 },
    finish: { color: 0xff006e, label: 'Trésor Final', icon: '🏆', points: 0 },
  };

  // Parcours en serpent : 4 rangées de 7 cases
  const tileTypes = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    if (i === 0) { tileTypes.push('start'); continue; }
    if (i === TILE_COUNT - 1) { tileTypes.push('finish'); continue; }
    const r = Math.random();
    if (r < 0.08) tileTypes.push('rainbow');
    else if (r < 0.18) tileTypes.push('gift');
    else if (r < 0.32) tileTypes.push('boost');
    else if (r < 0.42) tileTypes.push('trap');
    else tileTypes.push('normal');
  }

  // ---------- ÉTAT ----------
  let scene, camera, renderer;
  let tiles = [], tileMeshes = [];
  let players = [];
  let currentIndex = 0;
  let gameState = 'idle';
  let canPlay = false;

  const ui = {
    loading: document.getElementById('loading'),
    start: document.getElementById('start'),
    end: document.getElementById('end'),
    error: document.getElementById('error-screen'),
    errorText: document.getElementById('error-text'),
    activePlayer: document.getElementById('active-player'),
    scores: document.getElementById('scores'),
    dieResult: document.getElementById('die-result'),
    instruction: document.getElementById('instruction'),
    playBtn: document.getElementById('play-btn'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn'),
    winnerTitle: document.getElementById('winner-title'),
    winnerText: document.getElementById('winner-text'),
    finalScores: document.getElementById('final-scores'),
  };

  // ---------- UTILITAIRES ----------
  function showError(msg) {
    console.error('[CandyIsland]', msg);
    ui.loading.style.display = 'none';
    ui.error.style.display = 'flex';
    ui.errorText.textContent = msg;
  }

  function hex(n) {
    return '#' + n.toString(16).padStart(6, '0');
  }

  function positionForIndex(i) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const x = (row % 2 === 0 ? col : (COLS - 1 - col)) * SPACING;
    const z = row * SPACING;
    return new THREE.Vector3(x - (COLS - 1) * SPACING / 2, 0, z - (Math.floor((TILE_COUNT - 1) / COLS)) * SPACING / 2);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------- THREE.JS ----------
  function initThree() {
    if (typeof THREE === 'undefined') {
      throw new Error('Three.js n\'est pas chargé. Vérifie ta connexion internet.');
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbde0fe);
    scene.fog = new THREE.Fog(0xbde0fe, 45, 110);

    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 42, 48);
    camera.lookAt(0, 0, 0);

    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lumières
    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const sun = new THREE.DirectionalLight(0xfff5d6, 0.9);
    sun.position.set(20, 50, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffc8dd, 0.35));

    createWorld();
    createBoard();
    createPlayers();

    window.addEventListener('resize', onResize);
    animate();
  }

  function createWorld() {
    // Mer rose
    const seaGeo = new THREE.PlaneGeometry(300, 300);
    const seaMat = new THREE.MeshStandardMaterial({ color: 0xffc8dd, roughness: 0.4 });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -2.5;
    sea.receiveShadow = true;
    scene.add(sea);

    // Quelques nuages flottants
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
      const p1 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), mat);
      const p2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), mat);
      const p3 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), mat);
      p2.position.set(1.4, -0.3, 0.4);
      p3.position.set(-1.2, 0.1, 0);
      cloud.add(p1, p2, p3);
      cloud.position.set((Math.random() - 0.5) * 80, 14 + Math.random() * 8, (Math.random() - 0.5) * 60 - 10);
      cloud.userData = { speed: 0.005 + Math.random() * 0.01 };
      scene.add(cloud);
    }
  }

  function createBoard() {
    const geometry = new THREE.CylinderGeometry(1.6, 1.8, 0.8, 32);
    const startGeo = new THREE.CylinderGeometry(2, 2.2, 1, 32);
    const finishGeo = new THREE.CylinderGeometry(2.2, 2.4, 1.2, 32);

    for (let i = 0; i < TILE_COUNT; i++) {
      const typeKey = tileTypes[i];
      const type = TILE_TYPES[typeKey];
      const pos = positionForIndex(i);

      let mesh;
      if (typeKey === 'start') {
        mesh = new THREE.Mesh(startGeo, new THREE.MeshStandardMaterial({ color: type.color, emissive: 0xff99cc, emissiveIntensity: 0.25 }));
      } else if (typeKey === 'finish') {
        mesh = new THREE.Mesh(finishGeo, new THREE.MeshStandardMaterial({ color: type.color, emissive: 0xff006e, emissiveIntensity: 0.35 }));
      } else {
        mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: type.color, emissive: type.color, emissiveIntensity: 0.15 }));
      }

      mesh.position.copy(pos);
      mesh.position.y = typeKey === 'finish' ? 0.6 : (typeKey === 'start' ? 0.5 : 0.4);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { index: i, type: typeKey };
      scene.add(mesh);
      tileMeshes.push(mesh);

      tiles.push({ index: i, type: typeKey, ...type, position: pos.clone() });

      // Numéro de case (petit cylindre blanc)
      if (typeKey !== 'start' && typeKey !== 'finish') {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.05, 0.12, 8, 32),
          new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(pos.x, pos.y + 0.45, pos.z);
        scene.add(ring);
      }

      // Pont vers la case précédente
      if (i > 0) {
        const prev = positionForIndex(i - 1);
        const curr = pos;
        const dist = prev.distanceTo(curr);
        const mid = prev.clone().add(curr).multiplyScalar(0.5);
        const bridge = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.25, dist),
          new THREE.MeshStandardMaterial({ color: 0xff9ebb })
        );
        bridge.position.copy(mid);
        bridge.position.y = 0.15;
        bridge.lookAt(curr);
        scene.add(bridge);
      }
    }
  }

  function createPlayers() {
    players = PLAYERS_DEF.map((def, i) => {
      const group = new THREE.Group();

      // Corps
      const bodyGeo = new THREE.SphereGeometry(0.7, 24, 24);
      const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.25 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true;
      group.add(body);

      // Yeux
      const eyeGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.22, 0.25, 0.55);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.22, 0.25, 0.55);
      group.add(eyeL, eyeR);

      // Sourire
      const smile = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.04, 4, 12, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
      );
      smile.position.set(0, 0.08, 0.58);
      smile.rotation.x = Math.PI;
      group.add(smile);

      const startPos = tiles[0].position.clone();
      group.position.copy(startPos);
      group.position.y = 1.4;
      // Décalage pour éviter la superposition
      const dx = (i % 2 === 0 ? -1 : 1) * 0.65;
      const dz = (i < 2 ? -1 : 1) * 0.65;
      group.position.x += dx;
      group.position.z += dz;

      scene.add(group);

      return {
        id: i,
        ...def,
        mesh: group,
        tileIndex: 0,
        points: START_MONEY,
        finished: false,
        offset: new THREE.Vector3(dx, 1.4, dz),
      };
    });
  }

  function placePlayer(player) {
    const target = tiles[player.tileIndex].position.clone().add(player.offset);
    player.mesh.position.copy(target);
  }

  async function animateMove(player, targetIndex) {
    const steps = (targetIndex - player.tileIndex + TILE_COUNT) % TILE_COUNT;
    for (let s = 0; s < steps; s++) {
      player.tileIndex = (player.tileIndex + 1) % TILE_COUNT;
      const target = tiles[player.tileIndex].position.clone().add(player.offset);
      target.y = player.offset.y + 1.2;

      const start = player.mesh.position.clone();
      const duration = 250;
      const startTime = performance.now();

      await new Promise(resolve => {
        function tween(now) {
          const t = Math.min((now - startTime) / duration, 1);
          player.mesh.position.lerpVectors(start, target, t);
          player.mesh.position.y = start.y + Math.sin(t * Math.PI) * 1.2 + (target.y - start.y) * t;
          player.mesh.rotation.y += 0.15;
          if (t < 1) requestAnimationFrame(tween);
          else {
            player.mesh.position.y = player.offset.y;
            resolve();
          }
        }
        requestAnimationFrame(tween);
      });

      await sleep(60);
    }
  }

  // ---------- JEU ----------
  function updateUI() {
    const current = players[currentIndex];
    ui.activePlayer.textContent = `${current.emoji} ${current.name}`;
    ui.activePlayer.style.color = hex(current.color);

    ui.scores.innerHTML = '<h3>🍬 Sucres</h3>';
    players.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'player-score' + (idx === currentIndex ? ' active' : '');
      div.style.borderLeftColor = hex(p.color);
      div.innerHTML = `
        <div class="avatar">${p.emoji}</div>
        <div class="score-info">
          <div class="name">${p.name}</div>
          <div class="points">${p.points} <small>sucres</small></div>
        </div>
      `;
      ui.scores.appendChild(div);
    });
  }

  function showToast(icon, title, subtitle) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<div style="font-size:3rem;margin-bottom:6px">${icon}</div><div>${title}</div>${subtitle ? `<div style="font-size:1rem;font-weight:400;margin-top:6px;opacity:.85">${subtitle}</div>` : ''}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2200);
  }

  async function playTurn() {
    if (!canPlay || gameState !== 'idle') return;
    canPlay = false;
    ui.playBtn.disabled = true;

    const player = players[currentIndex];
    ui.instruction.textContent = `${player.name} lance le dé...`;

    // Animation du dé
    let roll = 0;
    for (let i = 0; i < 12; i++) {
      roll = Math.floor(Math.random() * 6) + 1;
      ui.dieResult.textContent = roll;
      await sleep(80);
    }

    // Calcul destination
    let target = player.tileIndex + roll;
    if (target >= TILE_COUNT - 1) target = TILE_COUNT - 1;

    await animateMove(player, target);

    const tile = tiles[player.tileIndex];
    let points = 0;
    let message = '';
    let extraMove = 0;

    switch (tile.type) {
      case 'normal':
        points = tile.points;
        message = `+${points} sucres délicieux !`;
        showToast(tile.icon, tile.label, message);
        break;
      case 'boost':
        points = tile.points;
        extraMove = tile.move;
        message = `Sucette boost ! +${points} sucres et avance de ${extraMove} cases.`;
        showToast(tile.icon, tile.label, message);
        break;
      case 'trap':
        points = tile.points;
        extraMove = tile.move;
        message = `Chocolat amer... ${points} sucres et recule de ${Math.abs(extraMove)} cases.`;
        showToast(tile.icon, tile.label, message);
        break;
      case 'gift':
        points = Math.floor(Math.random() * (tile.pointsRange[1] - tile.pointsRange[0] + 1)) + tile.pointsRange[0];
        message = `Cadeau surprise ! +${points} sucres.`;
        showToast(tile.icon, tile.label, message);
        break;
      case 'rainbow':
        extraMove = tile.move;
        message = `Arc-en-ciel magique ! Avance de ${extraMove} cases.`;
        showToast(tile.icon, tile.label, message);
        break;
      case 'finish':
        player.finished = true;
        points = FINISH_BONUS;
        message = `Trésor final ! +${points} sucors.`;
        showToast(tile.icon, tile.label, message);
        break;
    }

    player.points += points;

    // Mouvement bonus
    if (extraMove !== 0) {
      await sleep(900);
      let bonusTarget = player.tileIndex + extraMove;
      bonusTarget = Math.max(0, Math.min(TILE_COUNT - 1, bonusTarget));
      await animateMove(player, bonusTarget);
      // Pas d'effet supplémentaire sur la case d'atterrissage pour rester simple
    }

    updateUI();

    // Vérifier fin de partie
    if (player.finished || allFinished()) {
      await sleep(1000);
      endGame();
      return;
    }

    // Passer au joueur suivant actif
    currentIndex = nextPlayerIndex(currentIndex);
    updateUI();
    ui.instruction.textContent = `C'est à ${players[currentIndex].name} de jouer !`;
    canPlay = true;
    ui.playBtn.disabled = false;
  }

  function nextPlayerIndex(from) {
    let idx = (from + 1) % players.length;
    return idx;
  }

  function allFinished() {
    return players.some(p => p.finished);
  }

  function endGame() {
    gameState = 'ended';
    ui.playBtn.disabled = true;

    const sorted = [...players].sort((a, b) => b.points - a.points);
    const winner = sorted[0];

    ui.winnerTitle.textContent = `🏆 ${winner.name} gagne !`;
    ui.winnerTitle.style.color = hex(winner.color);
    ui.winnerText.textContent = `Avec ${winner.points} sucres, c'est le gourmand suprême.`;

    ui.finalScores.innerHTML = '';
    sorted.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'final-row' + (i === 0 ? ' winner' : '');
      row.innerHTML = `
        <span style="font-size:1.4rem">${p.emoji} ${p.name}</span>
        <strong style="color:${hex(p.color)}">${p.points} sucres</strong>
      `;
      ui.finalScores.appendChild(row);
    });

    ui.end.classList.add('visible');
  }

  function startGame() {
    ui.start.classList.remove('visible');
    // Reset
    players.forEach(p => {
      p.points = START_MONEY;
      p.finished = false;
      p.tileIndex = 0;
      placePlayer(p);
    });
    currentIndex = 0;
    gameState = 'idle';
    canPlay = true;
    updateUI();
    ui.instruction.textContent = 'Lance le dé pour avancer ton bonbon !';
    ui.dieResult.textContent = '—';
    ui.playBtn.disabled = false;
  }

  function restartGame() {
    ui.end.classList.remove('visible');
    startGame();
  }

  // ---------- BOUCLE ----------
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);

    // Nuages flottants
    scene.children.forEach(child => {
      if (child.userData && child.userData.speed) {
        child.position.x += child.userData.speed;
        if (child.position.x > 60) child.position.x = -60;
      }
    });

    // Légère oscillation des joueurs
    players.forEach(p => {
      p.mesh.position.y = p.offset.y + Math.sin(performance.now() * 0.003 + p.id) * 0.08;
    });

    renderer.render(scene, camera);
  }

  // ---------- DÉMARRAGE ----------
  function boot() {
    try {
      initThree();

      ui.startBtn.addEventListener('click', startGame);
      ui.playBtn.addEventListener('click', playTurn);
      ui.restartBtn.addEventListener('click', restartGame);

      setTimeout(() => {
        ui.loading.style.display = 'none';
      }, 1000);
    } catch (err) {
      showError(err.message || String(err));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
