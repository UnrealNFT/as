/* ============================================================
   MIAM'MONDE 🌍 — Jeu de plateau 3D familial
   Three.js + vanilla JS
   ============================================================ */

const TILE_COUNT = 28;
const RADIUS = 14;
const START_MONEY = 1500;
const WIN_MONEY = 5000;
const STAND_PRICES = [220, 260, 300, 340, 380, 420, 460, 500, 180, 200, 240, 280];
const RENT_PER_STAND = 80;

const COLORS = {
  player: [0xff6b9d, 0x2ed573, 0x0fe6ff, 0xff9f43],
  tile: {
    start: 0x2ed573,
    stand: [0xff6b9d, 0xfeca57, 0x54a0ff, 0x5f27cd, 0x1dd1a1],
    chance: 0xff9f43,
    rest: 0x0fe6ff,
    tax: 0xff4757,
    lucky: 0xa55eea,
  },
  board: 0x16213e,
  path: 0x576574,
  center: 0x1a1a2e,
};

const STAND_NAMES = [
  'Pizza Napoli 🍕', 'Tokyo Ramen 🍜', 'Paris Crêpe 🥞', 'Mexico Tacos 🌮',
  'Istanbul Kebab 🥙', 'Bangkok Pad Thaï 🍛', 'New York Burger 🍔',
  'Rome Gelato 🍦', 'Seoul Corndog 🌭', 'Cairo Falafel 🧆',
  'Mumbai Samosa 🥟', 'Rio Açaï 🫐', 'Lisbon Pasteis 🥧', 'Berlin Currywurst 🌭',
];

const CHANCE_CARDS = [
  { icon: '🎁', title: 'Tombola gourmande', text: 'Tu reçois un panier surprise ! +150 crédits.', effect: (p) => p.money += 150 },
  { icon: '🍰', title: 'Dégustation gratuite', text: 'Le chef t\'offre une assiette ! +80 crédits.', effect: (p) => p.money += 80 },
  { icon: '💸', title: 'Addition salée', text: 'Tu as un peu trop mangé. -100 crédits.', effect: (p) => p.money -= 100 },
  { icon: '🏃', title: 'Service express', text: 'Avance de 3 cases sans payer !', effect: (p, g) => { g.movePlayer(3); g.skipAutoMove = true; } },
  { icon: '🥵', title: 'Piment surprise', text: 'Tu bois 3 litres d\'eau. Recule de 2 cases.', effect: (p, g) => { g.movePlayer(-2); g.skipAutoMove = true; } },
  { icon: '💰', title: 'Sponsor cuisine', text: 'Un gastro-blogueur te suit ! +250 crédits.', effect: (p) => p.money += 250 },
  { icon: '❤️', title: 'Recette de famille', text: 'Tout le monde admire ta cuisine ! +50 crédits.', effect: (p) => p.money += 50 },
  { icon: '🍋', title: 'Citrongate', text: 'Pas de chance, tu perds ta place. -1 tour.', effect: (p) => p.skipNextTurn = true },
];

let scene, camera, renderer, raycaster, mouse;
let boardGroup, tiles = [], stands = [], playersMeshes = [], diceMeshes = [];
let players = [], currentPlayerIndex = 0;
let gameState = 'idle';
let cameraAngle = 0;
let canBuyCurrentTile = false;
let currentTile = null;

const ui = {
  currentPlayer: document.getElementById('current-player'),
  playersPanel: document.getElementById('players-panel'),
  rollBtn: document.getElementById('roll-btn'),
  buyBtn: document.getElementById('buy-btn'),
  endBtn: document.getElementById('end-btn'),
  die1: document.getElementById('die-1'),
  die2: document.getElementById('die-2'),
  eventOverlay: document.getElementById('event-overlay'),
  eventCard: document.getElementById('event-card'),
  eventIcon: document.querySelector('.event-icon'),
  eventTitle: document.getElementById('event-title'),
  eventText: document.getElementById('event-text'),
  eventOk: document.getElementById('event-ok'),
  winOverlay: document.getElementById('win-overlay'),
  winnerName: document.getElementById('winner-name'),
  restartBtn: document.getElementById('restart-btn'),
  startScreen: document.getElementById('start-screen'),
  startBtn: document.getElementById('start-btn'),
  loading: document.getElementById('loading'),
};

/* ============================================================
   INITIALISATION THREE.JS
   ============================================================ */

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.board);
  scene.fog = new THREE.Fog(COLORS.board, 35, 70);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 32, 42);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(15, 35, 20);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  scene.add(dir);

  const hemi = new THREE.HemisphereLight(0xffd1dc, 0x16213e, 0.35);
  scene.add(hemi);

  createBoard();
  createDice();

  window.addEventListener('resize', onWindowResize);
  animate();
}

function createBoard() {
  boardGroup = new THREE.Group();
  scene.add(boardGroup);

  // Sol central
  const baseGeo = new THREE.CylinderGeometry(RADIUS - 2.5, RADIUS - 2.5, 0.6, 64);
  const baseMat = new THREE.MeshStandardMaterial({ color: COLORS.center, roughness: 0.6 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = -0.3;
  base.receiveShadow = true;
  boardGroup.add(base);

  // Bordure décorative
  const ringGeo = new THREE.TorusGeometry(RADIUS, 0.35, 16, 100);
  const ringMat = new THREE.MeshStandardMaterial({ color: COLORS.tile.start, roughness: 0.2, metalness: 0.4, emissive: 0x115522, emissiveIntensity: 0.2 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.1;
  ring.receiveShadow = true;
  boardGroup.add(ring);

  // Cases
  for (let i = 0; i < TILE_COUNT; i++) {
    const angle = (i / TILE_COUNT) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * RADIUS;
    const z = Math.sin(angle) * RADIUS;

    let type = 'stand';
    let color = COLORS.tile.stand[i % COLORS.tile.stand.length];
    let name = STAND_NAMES[i % STAND_NAMES.length];
    let price = STAND_PRICES[i % STAND_PRICES.length];

    if (i === 0) { type = 'start'; color = COLORS.tile.start; name = 'Départ 🚩'; price = 0; }
    else if (i === 7) { type = 'rest'; color = COLORS.tile.rest; name = 'Pause goûter 🍵'; price = 0; }
    else if (i === 14) { type = 'tax'; color = COLORS.tile.tax; name = 'Douane gourmande 🛃'; price = -200; }
    else if (i === 21) { type = 'lucky'; color = COLORS.tile.lucky; name = 'Tombola 🎁'; price = 0; }
    else if (i % 4 === 0) { type = 'chance'; color = COLORS.tile.chance; name = 'Carte chance 🍀'; price = 0; }

    tiles.push({ index: i, type, color, name, price, owner: null, position: new THREE.Vector3(x, 0, z), angle });

    const geo = new THREE.BoxGeometry(2.8, 0.8, 2.8);
    const mat = new THREE.MeshStandardMaterial({ color });
    const tileMesh = new THREE.Mesh(geo, mat);
    tileMesh.position.set(x, 0.4, z);
    tileMesh.rotation.y = -angle;
    tileMesh.castShadow = true;
    tileMesh.receiveShadow = true;
    tileMesh.userData = { tileIndex: i };
    boardGroup.add(tileMesh);

    // Décoration surpiquée au-dessus des stands
    if (type === 'stand') {
      const standGeo = new THREE.ConeGeometry(0.7, 1.6, 8);
      const standMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0.35 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(0, 1.4, 0);
      stand.castShadow = true;
      tileMesh.add(stand);
      stands.push(stand);
    }

    // Lien entre cases
    if (i > 0) {
      const prev = tiles[i - 1].position;
      const curr = tiles[i].position;
      const dist = prev.distanceTo(curr);
      const mid = prev.clone().add(curr).multiplyScalar(0.5);
      const pathGeo = new THREE.BoxGeometry(1, 0.15, dist);
      const pathMat = new THREE.MeshStandardMaterial({ color: COLORS.path });
      const path = new THREE.Mesh(pathGeo, pathMat);
      path.position.copy(mid);
      path.lookAt(curr);
      path.receiveShadow = true;
      boardGroup.add(path);
    }
  }

  // Fermer le circuit visuellement
  const first = tiles[0].position;
  const last = tiles[tiles.length - 1].position;
  const dist = first.distanceTo(last);
  const mid2 = first.clone().add(last).multiplyScalar(0.5);
  const closePath = new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, dist), new THREE.MeshStandardMaterial({ color: COLORS.path }));
  closePath.position.copy(mid2);
  closePath.lookAt(first);
  closePath.receiveShadow = true;
  boardGroup.add(closePath);

  // Décoration centrale : monument festival
  const podiumGeo = new THREE.CylinderGeometry(2.5, 3.5, 2, 8);
  const podium = new THREE.Mesh(podiumGeo, new THREE.MeshStandardMaterial({ color: 0x9b59b6 }));
  podium.position.y = 1;
  podium.castShadow = true;
  boardGroup.add(podium);

  const globeGeo = new THREE.IcosahedronGeometry(1.6, 1);
  const globeMat = new THREE.MeshStandardMaterial({ color: 0x0fe6ff, emissive: 0x00a8ff, emissiveIntensity: 0.25 });
  const globe = new THREE.Mesh(globeGeo, globeMat);
  globe.position.y = 3.2;
  boardGroup.add(globe);
}

function createDice() {
  const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });

  for (let i = 0; i < 2; i++) {
    const die = new THREE.Mesh(geo, mat);
    die.position.set(-8 + i * 3, 10, 8);
    die.castShadow = true;
    scene.add(die);
    diceMeshes.push(die);
  }
}

function createPlayers(count) {
  // nettoyer anciens
  playersMeshes.forEach(m => scene.remove(m));
  playersMeshes = [];
  players = [];

  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.65, 24, 24);
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.player[i], emissive: COLORS.player[i], emissiveIntensity: 0.35 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    const startTile = tiles[0].position.clone();
    mesh.position.copy(startTile);
    mesh.position.y = 1.2;
    // décalage par joueur pour éviter la superposition
    mesh.position.x += (i % 2 === 0 ? -0.6 : 0.6);
    mesh.position.z += (i < 2 ? -0.6 : 0.6);
    scene.add(mesh);
    playersMeshes.push(mesh);

    players.push({
      id: i,
      name: `Joueur ${i + 1}`,
      color: COLORS.player[i],
      money: START_MONEY,
      tileIndex: 0,
      ownedStands: [],
      skipNextTurn: false,
      mesh: mesh,
      offset: new THREE.Vector3((i % 2 === 0 ? -0.6 : 0.6), 1.2, (i < 2 ? -0.6 : 0.6)),
    });
  }
  updateUI();
}

/* ============================================================
   LOGIQUE DU JEU
   ============================================================ */

function startGame() {
  ui.startScreen.classList.add('hidden');
  createPlayers(4);
  currentPlayerIndex = 0;
  gameState = 'idle';
  updateUI();
}

function rollDice() {
  if (gameState !== 'idle') return;
  gameState = 'rolling';
  ui.rollBtn.disabled = true;

  const p = players[currentPlayerIndex];
  if (p.skipNextTurn) {
    showEvent('⏸️', 'Tour sauté', `${p.name} reprend ses forces et passe son tour.`, () => {
      p.skipNextTurn = false;
      nextTurn();
    });
    gameState = 'idle';
    ui.rollBtn.disabled = false;
    return;
  }

  ui.die1.classList.add('rolling');
  ui.die2.classList.add('rolling');

  let frames = 0;
  const interval = setInterval(() => {
    animateDiceFaces();
    frames++;
    if (frames >= 18) {
      clearInterval(interval);
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      ui.die1.textContent = d1;
      ui.die2.textContent = d2;
      ui.die1.classList.remove('rolling');
      ui.die2.classList.remove('rolling');
      movePlayerBy(d1 + d2);
    }
  }, 100);
}

function animateDiceFaces() {
  ui.die1.textContent = Math.floor(Math.random() * 6) + 1;
  ui.die2.textContent = Math.floor(Math.random() * 6) + 1;

  diceMeshes.forEach(d => {
    d.position.y = 10 + Math.random() * 2;
    d.rotation.x += Math.random() * 2;
    d.rotation.z += Math.random() * 2;
  });
}

function movePlayerBy(steps) {
  const p = players[currentPlayerIndex];
  const oldIndex = p.tileIndex;
  let newIndex = (oldIndex + steps) % TILE_COUNT;
  if (newIndex < 0) newIndex += TILE_COUNT;

  animateMove(p, newIndex, () => {
    // Bonus départ
    if (newIndex < oldIndex && steps > 0) {
      p.money += 200;
      showEvent('🚩', 'Tour complet', 'Tu as fait le tour du festival et reçois 200 crédits !', () => handleTile(newIndex));
    } else {
      handleTile(newIndex);
    }
  });
}

function movePlayer(steps) {
  // utilisé par cartes chance (+/- cases)
  const p = players[currentPlayerIndex];
  let newIndex = (p.tileIndex + steps) % TILE_COUNT;
  if (newIndex < 0) newIndex += TILE_COUNT;
  animateMove(p, newIndex, () => handleTile(newIndex));
}

function animateMove(player, targetIndex, callback) {
  let current = player.tileIndex;
  const stepFunc = () => {
    current = (current + 1) % TILE_COUNT;
    player.tileIndex = current;
    placePlayerOnTile(player);
    if (current !== targetIndex) {
      setTimeout(stepFunc, 200);
    } else {
      setTimeout(callback, 300);
    }
  };
  stepFunc();
}

function placePlayerOnTile(player) {
  const tile = tiles[player.tileIndex];
  const target = tile.position.clone().add(player.offset);
  target.y = player.offset.y + 0.2;
  player.mesh.position.copy(target);
}

function handleTile(index) {
  const tile = tiles[index];
  currentTile = tile;

  // start déjà géré
  if (tile.type === 'start') {
    gameState = 'ended';
    ui.endBtn.disabled = false;
    return;
  }

  // Case stand
  if (tile.type === 'stand') {
    if (tile.owner === null && tile.price > 0) {
      canBuyCurrentTile = players[currentPlayerIndex].money >= tile.price;
      ui.buyBtn.disabled = !canBuyCurrentTile;
      gameState = 'buyable';
      ui.endBtn.disabled = false;
    } else if (tile.owner !== null && tile.owner !== currentPlayerIndex) {
      const owner = players[tile.owner];
      const rent = RENT_PER_STAND + (owner.ownedStands.length - 1) * 30;
      players[currentPlayerIndex].money -= rent;
      owner.money += rent;
      showEvent('💰', 'Stand privé', `Tu paies ${rent} crédits à ${owner.name} !`, () => {
        gameState = 'ended';
        ui.endBtn.disabled = false;
        updateUI();
      });
    } else {
      gameState = 'ended';
      ui.endBtn.disabled = false;
    }
    updateUI();
    return;
  }

  // Carte chance
  if (tile.type === 'chance' || tile.type === 'lucky') {
    const card = CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
    showEvent(card.icon, card.title, card.text, () => {
      card.effect(players[currentPlayerIndex], this);
      gameState = 'ended';
      ui.endBtn.disabled = false;
      updateUI();
    });
    updateUI();
    return;
  }

  // Pause goûter
  if (tile.type === 'rest') {
    players[currentPlayerIndex].money += 100;
    showEvent('☕', 'Pause goûter', 'Tu te ressources et gagnes 100 crédits !', () => {
      gameState = 'ended';
      ui.endBtn.disabled = false;
      updateUI();
    });
    return;
  }

  // Douane
  if (tile.type === 'tax') {
    players[currentPlayerIndex].money += tile.price;
    showEvent('🛃', 'Douane gourmande', `Tu paies ${Math.abs(tile.price)} crédits de taxes.`, () => {
      gameState = 'ended';
      ui.endBtn.disabled = false;
      updateUI();
    });
    return;
  }

  gameState = 'ended';
  ui.endBtn.disabled = false;
  updateUI();
}

function buyStand() {
  if (gameState !== 'buyable' || !currentTile || currentTile.type !== 'stand') return;
  const p = players[currentPlayerIndex];
  if (p.money < currentTile.price) return;
  p.money -= currentTile.price;
  currentTile.owner = currentPlayerIndex;
  p.ownedStands.push(currentTile.index);

  // Marquer visuellement
  stands[currentTile.index % stands.length].material.color.setHex(0xffffff);
  stands[currentTile.index % stands.length].material.emissive.setHex(p.color);
  stands[currentTile.index % stands.length].material.emissiveIntensity = 0.7;

  canBuyCurrentTile = false;
  ui.buyBtn.disabled = true;
  updateUI();

  // Vérifier victoire par acquisition de stands
  if (p.ownedStands.length >= 8) {
    endGame(p);
  }
}

function nextTurn() {
  ui.endBtn.disabled = true;
  ui.buyBtn.disabled = true;
  ui.rollBtn.disabled = false;
  gameState = 'idle';
  currentTile = null;

  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  updateUI();
  panCameraToPlayer(players[currentPlayerIndex]);
}

function checkWin() {
  const winner = players.find(p => p.money >= WIN_MONEY || p.ownedStands.length >= 8);
  if (winner) endGame(winner);
}

function endGame(winner) {
  gameState = 'won';
  ui.winnerName.textContent = winner.name;
  ui.winnerName.style.color = '#' + winner.color.toString(16).padStart(6, '0');
  ui.winOverlay.classList.add('visible');
}

function restartGame() {
  ui.winOverlay.classList.remove('visible');
  tiles.forEach(t => t.owner = null);
  stands.forEach(s => {
    s.material.color.setHex(0xffffff);
    s.material.emissiveIntensity = 0.35;
  });
  startGame();
}

/* ============================================================
   UI ET EVENEMENTS
   ============================================================ */

function updateUI() {
  const current = players[currentPlayerIndex];
  ui.currentPlayer.textContent = current.name;
  ui.currentPlayer.style.color = '#' + current.color.toString(16).padStart(6, '0');

  ui.playersPanel.innerHTML = '<h3>👥 Joueurs</h3>';
  players.forEach((p, idx) => {
    const ownerCount = tiles.filter(t => t.owner === p.id).length;
    const div = document.createElement('div');
    div.className = 'player-card' + (idx === currentPlayerIndex ? ' active' : '');
    div.style.borderLeftColor = '#' + p.color.toString(16).padStart(6, '0');
    div.innerHTML = `
      <div class="name">${p.name}</div>
      <div class="money">${p.money} <small>crédits</small></div>
      <div class="stands">${ownerCount} stand${ownerCount > 1 ? 's' : ''}</div>
    `;
    ui.playersPanel.appendChild(div);
  });
}

function showEvent(icon, title, text, cb) {
  ui.eventIcon.textContent = icon;
  ui.eventTitle.textContent = title;
  ui.eventText.textContent = text;
  ui.eventOverlay.classList.add('visible');

  const okHandler = () => {
    ui.eventOverlay.classList.remove('visible');
    ui.eventOk.removeEventListener('click', okHandler);
    if (cb) cb();
    checkWin();
  };
  ui.eventOk.addEventListener('click', okHandler);
}

function panCameraToPlayer(player) {
  const targetPos = player.mesh.position.clone();
  const offset = new THREE.Vector3(0, 22, 18);
  const endPos = targetPos.clone().add(offset);

  let t = 0;
  const startPos = camera.position.clone();
  const animatePan = () => {
    t += 0.03;
    if (t > 1) t = 1;
    camera.position.lerpVectors(startPos, endPos, t);
    camera.lookAt(0, 0, 0);
    if (t < 1) requestAnimationFrame(animatePan);
  };
  animatePan();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  if (boardGroup) {
    boardGroup.rotation.y += 0.0008;
    // Globe animé
    if (boardGroup.children[boardGroup.children.length - 1]) {
      boardGroup.children[boardGroup.children.length - 1].rotation.y += 0.01;
    }
  }

  renderer.render(scene, camera);
}

/* ============================================================
   BRANCHEMENTS
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initThree();

  setTimeout(() => {
    ui.loading.classList.add('hidden');
  }, 1200);

  ui.startBtn.addEventListener('click', startGame);
  ui.rollBtn.addEventListener('click', rollDice);
  ui.buyBtn.addEventListener('click', buyStand);
  ui.endBtn.addEventListener('click', nextTurn);
  ui.restartBtn.addEventListener('click', restartGame);

  // Contrôles caméra souris simples
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    cameraAngle = x * 0.2;
  });
});
