import * as THREE from 'three';
import { MAP_SIZE, MAX_HEALTH, MAX_SHIELD, HOLD_SECONDS } from './config.js';
import { createMaterials } from './assets.js';
import { createWorld } from './world.js';
import { createAircraft } from './plane.js';
import { createFirstPersonRig, createLobbyAvatar, createRedCube } from './player.js';
import { createMapUI } from './map-ui.js';
import { createClickSound, showToast, setCaption } from './ui.js';
import { createMatchmaking } from './network.js';
import { createCombatSystem } from './combat.js';
import { createStorm } from './storm.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, .1, 3200);
camera.position.set(19, 46, 140); camera.lookAt(0, 28, 0); camera.rotation.order = 'YXZ'; camera.up.set(0, 1, 0); scene.add(camera);
const textures = createMaterials();
const world = createWorld(THREE, scene, textures);
const lobbyAvatar = createLobbyAvatar(THREE, scene);
const aircraft = createAircraft(THREE, scene, textures);
const hands = createFirstPersonRig(THREE, camera, scene);
const peerCube = createRedCube(THREE, scene, 1.8); peerCube.visible = false;
const clickSound = createClickSound();
const combat = createCombatSystem(THREE, camera, scene, { onEvent: handleCombatEvent });
const storm = createStorm(THREE, scene, { onDamage: amount => { if (state === 'playing') applyDamage(amount, 'STURM'); }, onPhase: (phase, radius) => { if (matchStarted && phase !== 1) showToast(`STURMZONE ${phase === 'FINAL' ? 'FINAL' : phase} · ${Math.round(radius)} M`, 2200); } });
const keys = new Set();
const clock = new THREE.Clock();

let state = 'lobby'; // lobby | inPlane | takingPickaxe | turning | runningJump | falling | parachute | playing
let matchElapsed = 0;
let sequenceTime = 0;
let fallTime = 0;
let parachuteOpenTime = 0;
let mapOpened = false;
let pointerLocked = false;
let sensitivity = 1;
let quality = 'high';
let mouseYaw = 0;
let mousePitch = 0;
let groundVerticalVelocity = 0;
let isGrounded = false;
let wasdEnabled = false;
let eHeld = false;
let holdProgress = 0;
let holdTarget = null;
let focusedChest = null;
let ownPeerStateTimer = 0;
let currentRegion = 'INSEL';
let chuteVelocity = new THREE.Vector3();
let jumpStartYaw = 0;
let jumpStartPos = new THREE.Vector3();
let planeJumpTangent = new THREE.Vector3(0, 0, -1);
let parachuteRig = null;
let ropeLine = null;
let ropePositions = null;
let canopyMaterial = null;
let canopyOpened = false;
let toastHold = 0;
let health = MAX_HEALTH;
let shield = MAX_SHIELD;
let stamina = 100;
let sprintVisibleTimer = 0;
let ePressed = false;
let currentInteractable = null;
let currentInteractableId = null;
let swingAnimation = 0;
let lodTimer = 0;
let currentAimFov = 63;
let qualitySelect = document.getElementById('quality-select');

const lobby = document.getElementById('lobby');
const queueScreen = document.getElementById('queue-screen');
const playButton = document.getElementById('play-button');
const queueStatus = document.getElementById('queue-status');
const queueCopy = document.getElementById('queue-copy');
const playersCount = document.getElementById('players-count');
const queueDetail = document.getElementById('queue-detail');
const hud = document.getElementById('hud');
const healthFill = document.getElementById('health-fill');
const shieldFill = document.getElementById('shield-fill');
const healthValue = document.getElementById('health-value');
const shieldValue = document.getElementById('shield-value');
const chestPrompt = document.getElementById('chest-prompt');
const ringProgress = document.getElementById('hold-ring-progress');
const pointerHint = document.getElementById('pointer-hint');
const settingsPanel = document.getElementById('settings-panel');
const blackFade = document.getElementById('black-fade');
const sprintMeter = document.getElementById('sprint-meter');
const sprintFill = document.getElementById('sprint-fill');
const sprintValue = document.getElementById('sprint-value');
const stormReadout = document.getElementById('storm-readout');
const inventorySlots = [...document.querySelectorAll('.inventory-slot')];
const weaponReadout = document.getElementById('weapon-readout');

const mapUI = createMapUI({
  onMarkersChange: markers => world.setWaypoints(markers),
  onOpenChange: open => {
    mapOpened = open;
    if (open) hands.setPose('map');
    else restoreHandPose();
  }
});

function handleCombatEvent(type, payload) {
  if (type === 'heal-complete') {
    health = MAX_HEALTH;
    showToast('HEALING · LEBEN AUFGEFÜLLT', 1800);
  } else if (type === 'loot-collected') {
    const names = { shotgun: 'SCHROTFLINTE', pistol: 'PISTOLE', healing: 'HEALING', 'shotgun-ammo': 'SCHROTMUNITION', 'pistol-ammo': 'PISTOLENMUNITION' };
    showToast(`${payload.rarity.toUpperCase()} · ${names[payload.itemId] || payload.itemId}${payload.amount > 1 ? ` · +${payload.amount}` : ''}`, 1800);
  } else if (type === 'heal-start') {
    showToast(`HEALING · ${payload.remaining} ÜBRIG`, 900);
  } else if (type === 'reload-start') {
    showToast('NACHLADEN …', 700);
  } else if (type === 'reload-complete') {
    showToast('WAFFE GELADEN', 850);
  }
  if (type === 'inventory-change' || type === 'reload-complete' || type === 'heal-complete') renderInventory();
}

function applyDamage(amount, source = 'GEGNER') {
  if (health <= 0 || !Number.isFinite(amount) || amount <= 0) return;
  let remaining = amount;
  const shieldHit = Math.min(shield, remaining); shield -= shieldHit; remaining -= shieldHit;
  health = Math.max(0, health - remaining);
  if (health <= 0) {
    showToast('AUSSER GEFECHT · MATCH BEENDET', 3200);
    document.exitPointerLock?.(); pointerLocked = false;
  } else if (source === 'STURM') showToast(`STURM-SCHADEN · -${amount}`, 850);
  updateHud();
}

function renderInventory() {
  const s = combat.getStatus();
  const content = [
    { icon: '✦', count: '∞', name: 'SPITZHACKE', sub: 'NAHKAMPF', owned: true },
    { icon: s.shotgunOwned ? '▰' : '🔒', count: s.shotgunOwned ? `${s.shotgunAmmo}/${s.shotgunReserve}` : '—', name: s.shotgunOwned ? 'PUMP-SCHROTFLINTE' : 'VERSCHLOSSEN', sub: s.shotgunOwned ? s.shotgunRarity.toUpperCase() : 'IN TRUHE FINDEN', owned: s.shotgunOwned },
    { icon: s.pistolOwned ? '⌁' : '🔒', count: s.pistolOwned ? `${s.pistolAmmo}/${s.pistolReserve}` : '—', name: s.pistolOwned ? 'SICHERHEITS-PISTOLE' : 'VERSCHLOSSEN', sub: s.pistolOwned ? s.pistolRarity.toUpperCase() : 'IN TRUHE FINDEN', owned: s.pistolOwned },
    { icon: s.healingCount > 0 ? '✚' : '🔒', count: s.healingCount, name: s.healingCount > 0 ? 'HEALING' : 'VERSCHLOSSEN', sub: s.healingCount > 0 ? 'LEBEN' : 'IN TRUHE FINDEN', owned: s.healingCount > 0 },
    { icon: '□', count: '—', name: 'FREI', sub: 'LEER', owned: true }
  ];
  inventorySlots.forEach((node, index) => {
    node.classList.toggle('active', index + 1 === s.slot);
    const icon = node.querySelector('span'); const count = node.querySelector('em');
    if (icon) icon.textContent = content[index].icon;
    if (count) count.textContent = content[index].count;
  });
  const item = content[s.slot - 1];
  if (weaponReadout && item) weaponReadout.innerHTML = `${item.name} <span>${item.sub}</span>`;
}

function setInventorySlot(slot) {
  combat.setSlot(slot);
  const active = combat.getActiveItem();
  if (state === 'playing') {
    combat.setEnabled(true);
    hands.setPose(active === 'pickaxe' ? 'hold-pickaxe' : active === 'healing' ? 'syringe' : active === 'shotgun' ? 'weapon-shotgun' : active === 'pistol' ? 'weapon-pistol' : 'weapon', matchElapsed);
  }
  renderInventory();
}

function restoreHandPose() {
  if (state === 'falling') hands.setPose('freefall', fallTime);
  else if (state === 'parachute') hands.setPose('parachute', parachuteOpenTime);
  else if (state === 'playing') {
    const moving = keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD');
    const active = combat.getActiveItem();
    const combatStatus = combat.getStatus();
    if (combatStatus.reloading) hands.setPose(combatStatus.reloadWeapon === 'shotgun' ? 'reload-shotgun' : 'reload-pistol', combatStatus.reloadProgress);
    else hands.setPose(moving && (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 'sprint' : active === 'pickaxe' ? 'hold-pickaxe' : active === 'healing' ? 'syringe' : active === 'shotgun' ? 'weapon-shotgun' : active === 'pistol' ? 'weapon-pistol' : moving ? 'walk' : 'idle', matchElapsed);
  }
  else hands.setPose('hidden');
}

function createParachuteRig() {
  const group = new THREE.Group(); group.visible = false; group.name = 'deployed-parachute'; scene.add(group);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(4.8, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b7a77c', side: THREE.DoubleSide, roughness: .88, metalness: .03 }));
  canopy.scale.set(1.28, .62, .82); canopy.position.y = 7.2; group.add(canopy); canopyMaterial = canopy.material;
  // Alternating canvas panels and seam lines help the open canopy read as fabric.
  for (let i = 0; i < 12; i++) {
    const theta = (i / 12) * Math.PI * 2;
    const seam = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 4.7, 4), new THREE.MeshStandardMaterial({ color: '#594f3c', roughness: 1 }));
    seam.position.set(Math.sin(theta) * 2.8, 8.0, Math.cos(theta) * 1.8); seam.rotation.z = .42 * Math.cos(theta); seam.rotation.x = .35 * Math.sin(theta); group.add(seam);
  }
  const ropeMat = new THREE.LineBasicMaterial({ color: '#efe6d0', transparent: true, opacity: .92 });
  const ropeGeo = new THREE.BufferGeometry(); ropePositions = new Float32Array(8 * 2 * 3); ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropePositions, 3));
  ropeLine = new THREE.LineSegments(ropeGeo, ropeMat); scene.add(ropeLine);
  return group;
}
parachuteRig = createParachuteRig();

function updateParachuteRig() {
  if (!canopyOpened) return;
  const pos = new THREE.Vector3(); camera.getWorldPosition(pos);
  parachuteRig.position.set(pos.x, pos.y, pos.z - .1);
  const q = new THREE.Quaternion(); camera.getWorldQuaternion(q); parachuteRig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), new THREE.Euler().setFromQuaternion(q).y);
  const canopyCenter = new THREE.Vector3(pos.x, pos.y + 7.15, pos.z - .1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = canopyCenter.x + Math.sin(a) * 4.5;
    const y = canopyCenter.y - .9;
    const z = canopyCenter.z + Math.cos(a) * 2.9;
    const handX = pos.x + Math.sin(a) * .38;
    const handY = pos.y - .38;
    const handZ = pos.z - .65;
    const j = i * 6;
    ropePositions[j] = x; ropePositions[j + 1] = y; ropePositions[j + 2] = z;
    ropePositions[j + 3] = handX; ropePositions[j + 4] = handY; ropePositions[j + 5] = handZ;
  }
  ropeLine.geometry.attributes.position.needsUpdate = true;
  ropeLine.geometry.computeBoundingSphere();
}

let network = null;
let matchStarted = false;
function updatePlayersCount(count) {
  playersCount.textContent = String(count);
  queueDetail.textContent = count >= 2 ? 'Zweiter Spieler gefunden. Match wird gestartet …' : 'Warte auf einen zweiten Spieler …';
  queueCopy.textContent = count >= 2 ? 'Spieler gefunden — bereit zum Absprung' : 'Suche nach Spieler 2 …';
}
function startMatch() {
  if (matchStarted) return;
  matchStarted = true;
  network?.stopSearch();
  lobby.classList.add('hidden'); queueScreen.classList.add('hidden');
  lobbyAvatar.avatar.visible = false; lobbyAvatar.halo.visible = false;
  blackFade.classList.add('active');
  setTimeout(() => blackFade.classList.remove('active'), 180);
  state = 'inPlane'; matchElapsed = 0; sequenceTime = 0; fallTime = 0; parachuteOpenTime = 0; mapOpened = false; health = MAX_HEALTH; shield = MAX_SHIELD; stamina = 100; combat.setSlot(1); combat.setEnabled(false); renderInventory();
  mapUI.close();
  aircraft.update(0);
  aircraft.group.add(camera);
  camera.position.set(0, 1.62, -2.4); camera.rotation.order = 'YXZ'; camera.rotation.set(0, 0, 0);
  mouseYaw = 0; mousePitch = 0;
  hands.setPose('hidden');
  hud.classList.add('hidden'); hud.classList.remove('reveal');
  parachuteRig.visible = false; ropeLine.visible = false; canopyOpened = false;
  pointerHint.classList.add('hidden');
  setCaption('MILITÄRTRANSPORT · HECKKLAPPE OFFEN', true);
  setTimeout(() => { if (state === 'inPlane') setCaption('', false); }, 2300);
}

network = createMatchmaking({
  onPlayersChanged: updatePlayersCount,
  onMatchFound: startMatch,
  onConnectionStatus: (status, message) => {
    if (!queueScreen.classList.contains('hidden') && message) queueDetail.textContent = message;
    if (status === 'error' && !queueScreen.classList.contains('hidden')) queueCopy.textContent = 'Online-Verbindung nicht verfügbar';
    if (status === 'connected' && !queueScreen.classList.contains('hidden')) queueCopy.textContent = 'Online verbunden · Suche läuft';
  },
  onPeerState: (peerId, remote) => {
    if (!remote || !Number.isFinite(remote.x) || !Number.isFinite(remote.y) || !Number.isFinite(remote.z)) return;
    peerCube.position.set(remote.x, remote.y - .8, remote.z);
    peerCube.rotation.set(0, remote.yaw || 0, 0);
    peerCube.visible = matchStarted;
  },
  onPeerEvent: (action, payload) => {
    if (action === 'peer-disconnected') {
      peerCube.visible = false;
      showToast('DER ANDERE SPIELER HAT DIE VERBINDUNG GETRENNT', 3000);
    } else if (action === 'chest-open' && payload?.id != null) {
      const sharedChest = world.chests.find(chest => chest.userData.chestData.id === payload.id);
      if (sharedChest) world.openChest(sharedChest, payload.loot);
    } else if (action === 'loot-collected' && payload?.id != null) {
      world.collectLootById(payload.id);
    } else if (action === 'player-damage' && payload?.amount) {
      applyDamage(payload.amount, 'GEGNER');
    } else if (action === 'pickup-collected' && payload?.id != null) {
      world.collectPickupById(payload.id);
    } else if (action === 'door-state' && Number.isFinite(payload?.x) && Number.isFinite(payload?.z)) {
      world.setDoorStateAt(payload.x, payload.z, Boolean(payload.open));
    } else if (action === 'glass-break' && Number.isFinite(payload?.x) && Number.isFinite(payload?.y) && Number.isFinite(payload?.z)) {
      world.breakGlassAt(payload.x, payload.y, payload.z, payload.normal);
    }
  }
});

playButton.addEventListener('click', () => {
  if (state !== 'lobby') return;
  clickSound.click(true);
  queueScreen.classList.remove('hidden');
  updatePlayersCount(1);
  network.startSearch();
});
document.getElementById('cancel-queue').addEventListener('click', () => {
  clickSound.click(false); network.stopSearch(); queueScreen.classList.add('hidden'); lobby.classList.remove('hidden');
  queueCopy.textContent = 'Bereit zum Start';
});
document.getElementById('settings-button').addEventListener('click', () => { clickSound.click(false); settingsPanel.classList.toggle('hidden'); });
document.getElementById('settings-close').addEventListener('click', () => { clickSound.click(false); settingsPanel.classList.add('hidden'); });
document.getElementById('sensitivity-slider').addEventListener('input', event => { sensitivity = Number(event.target.value) || 1; });
qualitySelect.addEventListener('change', event => {
  quality = event.target.value;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? .8 : quality === 'medium' ? 1.1 : 1.5));
  renderer.shadowMap.enabled = quality !== 'low';
  showToast(`GRAFIK: ${quality === 'high' ? 'HOCH' : quality === 'medium' ? 'MITTEL' : 'LEISTUNG'}`, 1300);
});

function getWorldPosition() { const p = new THREE.Vector3(); camera.getWorldPosition(p); return p; }
function getWorldYaw() {
  const q = new THREE.Quaternion(); camera.getWorldQuaternion(q);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  return Math.atan2(-forward.x, -forward.z);
}
function requestPointerLock() {
  if (!['inPlane', 'parachute', 'playing'].includes(state) || mapOpened) return;
  canvas.requestPointerLock?.();
}
canvas.addEventListener('click', () => {
  if (['inPlane', 'parachute', 'playing'].includes(state) && !mapOpened && !pointerLocked) requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  pointerHint.classList.toggle('hidden', !hud.classList.contains('reveal') || pointerLocked);
});
document.addEventListener('mousemove', event => {
  if (!pointerLocked || mapOpened) return;
  const sens = .0018 * sensitivity;
  if (state === 'inPlane' || state === 'takingPickaxe' || state === 'turning' || state === 'runningJump') {
    camera.rotation.y -= event.movementX * sens;
    camera.rotation.x = Math.max(-.75, Math.min(.65, camera.rotation.x - event.movementY * sens));
    mouseYaw = camera.rotation.y; mousePitch = camera.rotation.x;
  } else if (state === 'parachute' || state === 'playing') {
    camera.rotation.y -= event.movementX * sens;
    camera.rotation.x = Math.max(-1.25, Math.min(1.15, camera.rotation.x - event.movementY * sens));
  }
});

document.addEventListener('keydown', event => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'KeyM' && !event.repeat && matchStarted && ['inPlane', 'parachute', 'playing'].includes(state)) { mapUI.toggle(); clickSound.click(false); return; }
  if (event.code === 'Escape' && mapOpened) { mapUI.close(); return; }
  if (state === 'playing' && /^Digit[1-5]$/.test(event.code) && !event.repeat) { setInventorySlot(Number(event.code.slice(-1))); return; }
  if (event.code === 'KeyR' && !event.repeat && state === 'playing') { combat.startReload(); return; }
  keys.add(event.code);
  if (event.code === 'KeyE') { eHeld = true; ePressed = !event.repeat; }
  if (event.code === 'Space' && !event.repeat) {
    if (state === 'inPlane' && !mapOpened) beginJumpSequence();
    else if (state === 'playing' && isGrounded) { groundVerticalVelocity = 8.9; isGrounded = false; clickSound.thump(); }
  }
});
document.addEventListener('keyup', event => {
  keys.delete(event.code);
  if (event.code === 'KeyE') { eHeld = false; ePressed = false; holdProgress = 0; ringProgress.style.strokeDashoffset = '119.4'; }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sprintVisibleTimer = Math.max(sprintVisibleTimer, .28);
});

canvas.addEventListener('mousedown', event => {
  if (!matchStarted || state !== 'playing' || mapOpened) return;
  if (event.button === 2) { combat.setAiming(true); return; }
  if (event.button !== 0) return;
  if (!pointerLocked) { requestPointerLock(); return; }
  const active = combat.getActiveItem();
  if (active === 'healing') {
    if (combat.useHealing()) hands.setPose('syringe', matchElapsed);
  } else if (active === 'shotgun' || active === 'pistol') {
    const shot = combat.fire();
    if (shot) resolveShot(shot);
  } else if (active === 'pickaxe') {
    swingAnimation = .35; hands.setPose('swing', 0);
    const target = raycastWorld(3.6);
    if (target?.object?.userData?.isGlass && world.breakGlass(target.object, target.point, target.face?.normal || null)) {
      network.sendAction('glass-break', { x: target.point.x, y: target.point.y, z: target.point.z, normal: [0, 0, 1] });
      showToast('GLAS ZERBROCHEN', 750);
    }
  }
});
canvas.addEventListener('mouseup', event => { if (event.button === 2) combat.setAiming(false); });
canvas.addEventListener('mouseleave', () => combat.setAiming(false));
window.addEventListener('wheel', event => {
  if (state !== 'playing' || mapOpened) return;
  const current = combat.getSlot();
  const next = ((current - 1 + (event.deltaY > 0 ? 1 : 4)) % 5) + 1;
  setInventorySlot(next);
}, { passive: true });

function detachCameraFromAircraft() {
  camera.updateWorldMatrix(true, false);
  const position = camera.getWorldPosition(new THREE.Vector3());
  const forward = camera.getWorldDirection(new THREE.Vector3()).normalize();
  // Keep yaw/pitch, deliberately discard the aircraft's roll. This prevents upside-down starts.
  const yaw = Math.atan2(-forward.x, -forward.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
  aircraft.group.remove(camera); scene.add(camera);
  camera.position.copy(position); camera.up.set(0, 1, 0); camera.rotation.order = 'YXZ';
  camera.rotation.set(THREE.MathUtils.clamp(pitch, -0.5, 0.5), yaw, 0, 'YXZ');
  camera.updateMatrixWorld(true);
}
function beginJumpSequence() {
  if (state !== 'inPlane') return;
  if (mapOpened) mapUI.close();
  document.exitPointerLock?.(); pointerLocked = false;
  state = 'takingPickaxe'; sequenceTime = 0; jumpStartYaw = camera.rotation.y;
  aircraft.pickaxe.visible = true;
  hands.setPose('take', 0);
  setCaption('SPITZHACKE AUFNEHMEN', true);
  queueScreen.classList.add('hidden');
}
function startFalling() {
  detachCameraFromAircraft();
  const tangent = planeJumpTangent.clone().setY(0).normalize();
  chuteVelocity.copy(tangent).multiplyScalar(17.5);
  camera.rotation.x = -.08;
  state = 'falling'; fallTime = 0;
  aircraft.group.visible = false;
  camera.rotation.order = 'YXZ'; camera.rotation.z = 0;
  hands.setPose('freefall', 0);
  setCaption('FREIER FALL', true);
}
function openParachute() {
  state = 'parachute'; parachuteOpenTime = 0; canopyOpened = true;
  parachuteRig.visible = true; ropeLine.visible = true;
  clickSound.thump();
  // A short downward snap simulates the canopy catching air.
  camera.position.y -= 1.35;
  camera.rotation.x = -.11;
  hands.setPose('parachute', 0);
  hud.classList.remove('hidden'); hud.classList.remove('reveal');
  void hud.offsetWidth; hud.classList.add('reveal');
  combat.setEnabled(false); renderInventory();
  pointerHint.classList.toggle('hidden', pointerLocked);
  setCaption('FALLSCHIRM GEÖFFNET', true);
  setTimeout(() => { if (state === 'parachute' || state === 'playing') setCaption('', false); }, 1800);
}

function moveInsideAircraft(dt) {
  const speed = 5.4;
  const yaw = camera.rotation.y;
  let dx = 0, dz = 0;
  const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
  if (keys.has('KeyW')) { dx += forwardX; dz += forwardZ; }
  if (keys.has('KeyS')) { dx -= forwardX; dz -= forwardZ; }
  if (keys.has('KeyD')) { dx += rightX; dz += rightZ; }
  if (keys.has('KeyA')) { dx -= rightX; dz -= rightZ; }
  const len = Math.hypot(dx, dz) || 1;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x + dx / len * speed * dt, -2.3, 2.3);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z + dz / len * speed * dt, -7.9, 5.1);
  camera.position.y = 1.62;
}
function moveAirborne(dt) {
  const pos = getWorldPosition();
  let forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; if (forward.lengthSq() < .0001) forward.set(0, 0, -1); forward.normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  let dx = 0, dz = 0;
  if (state !== 'falling' && !mapOpened) {
    if (keys.has('KeyW')) { dx += forward.x; dz += forward.z; }
    if (keys.has('KeyS')) { dx -= forward.x; dz -= forward.z; }
    if (keys.has('KeyD')) { dx += right.x; dz += right.z; }
    if (keys.has('KeyA')) { dx -= right.x; dz -= right.z; }
  }
  const len = Math.hypot(dx, dz) || 1;
  const steering = state === 'falling' ? 0 : 8.3;
  camera.position.x += (chuteVelocity.x + (dx / len) * steering) * dt;
  camera.position.z += (chuteVelocity.z + (dz / len) * steering) * dt;
  if (state === 'falling') camera.position.y -= 23.5 * dt;
  else camera.position.y -= 7.9 * dt;
  const ground = world.heightAt(camera.position.x, camera.position.z) + 1.75;
  if (camera.position.y <= ground) {
    camera.position.y = ground; state = 'playing'; isGrounded = true; groundVerticalVelocity = 0;
    parachuteRig.visible = false; ropeLine.visible = false; canopyOpened = false;
    combat.setEnabled(true); combat.setSlot(1); renderInventory();
    hands.setPose('hold-pickaxe', matchElapsed); setCaption('', false);
    showToast(`GELANDET · ${world.locationNameAt(pos.x, pos.z)}`, 2800);
  }
}
function moveOnGround(dt) {
  let forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; if (forward.lengthSq() < .0001) forward.set(0, 0, -1); forward.normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  let dx = 0, dz = 0;
  if (keys.has('KeyW')) { dx += forward.x; dz += forward.z; }
  if (keys.has('KeyS')) { dx -= forward.x; dz -= forward.z; }
  if (keys.has('KeyD')) { dx += right.x; dz += right.z; }
  if (keys.has('KeyA')) { dx -= right.x; dz -= right.z; }
  const moving = Math.hypot(dx, dz) > .01;
  const wantsSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && moving && stamina > 1;
  const sprinting = wantsSprint && !mapOpened;
  if (moving && !mapOpened) {
    const len = Math.hypot(dx, dz); const speed = sprinting ? 23 : 13.5;
    const nextX = camera.position.x + dx / len * speed * dt;
    const nextZ = camera.position.z + dz / len * speed * dt;
    if (!world.collidesAt(nextX, camera.position.z) && world.heightAt(nextX, camera.position.z) > 0) camera.position.x = nextX;
    if (!world.collidesAt(camera.position.x, nextZ) && world.heightAt(camera.position.x, nextZ) > 0) camera.position.z = nextZ;
  }
  if (sprinting) { stamina = Math.max(0, stamina - 27 * dt); sprintVisibleTimer = .55; }
  else stamina = Math.min(100, stamina + 19 * dt);
  sprintMeter.classList.toggle('active', sprinting || stamina < 99.5 || sprintVisibleTimer > 0);
  sprintFill.style.width = `${stamina}%`; sprintValue.textContent = `${Math.round(stamina)}%`;
  sprintVisibleTimer = Math.max(0, sprintVisibleTimer - dt);
  groundVerticalVelocity -= 26 * dt;
  camera.position.y += groundVerticalVelocity * dt;
  const ground = world.heightAt(camera.position.x, camera.position.z) + 1.72;
  if (camera.position.y <= ground) { camera.position.y = ground; groundVerticalVelocity = 0; isGrounded = true; }
  else isGrounded = false;
  if (swingAnimation > 0) { swingAnimation = Math.max(0, swingAnimation - dt); hands.setPose('swing', 1 - swingAnimation / .35); }
  else {
    const active = combat.getActiveItem();
    const combatStatus = combat.getStatus();
    if (combatStatus.reloading) hands.setPose(combatStatus.reloadWeapon === 'shotgun' ? 'reload-shotgun' : 'reload-pistol', combatStatus.reloadProgress);
    else if (active === 'pickaxe') hands.setPose(moving && sprinting ? 'sprint' : moving ? 'walk' : 'hold-pickaxe', matchElapsed);
    else if (active === 'healing') hands.setPose('syringe', matchElapsed);
    else hands.setPose(moving && sprinting ? 'sprint' : moving ? 'walk' : active === 'shotgun' ? 'weapon-shotgun' : active === 'pistol' ? 'weapon-pistol' : 'weapon', matchElapsed);
  }
}

function updateChestInteraction(dt) {
  if (state !== 'playing' || mapOpened) {
    chestPrompt.classList.add('hidden'); focusedChest = null; currentInteractable = null; currentInteractableId = null; holdProgress = 0; ringProgress.style.strokeDashoffset = '119.4'; ePressed = false; return;
  }
  camera.updateWorldMatrix(true, false);
  const interactable = world.findFocusedInteractable(camera);
  currentInteractable = interactable;
  const target = interactable?.object || null;
  const id = target?.userData?.chestData?.id ?? target?.userData?.pickupData?.id ?? target?.userData?.doorData?.x ?? null;
  if (interactable?.type === 'door') {
    chestPrompt.classList.remove('hidden');
    chestPrompt.querySelector('strong').textContent = target.userData.doorData.open ? 'E TÜR SCHLIESSEN' : 'E TÜR ÖFFNEN';
    chestPrompt.querySelector('small').textContent = 'GEBÄUDE BETRETEN';
    ringProgress.style.strokeDashoffset = '0';
    if (ePressed) {
      const opened = world.toggleDoor(target);
      const data = target.userData.doorData;
      network.sendAction('door-state', { x: data.x, z: data.z, open: opened });
      showToast(opened ? 'TÜR GEÖFFNET' : 'TÜR GESCHLOSSEN', 900);
    }
    ePressed = false; holdProgress = 0; currentInteractableId = id; focusedChest = null; return;
  }
  if (!interactable || !['chest', 'ammo', 'loot'].includes(interactable.type)) {
    chestPrompt.classList.add('hidden'); holdTarget = null; focusedChest = null; currentInteractableId = null; holdProgress = 0; ringProgress.style.strokeDashoffset = '119.4'; ePressed = false; return;
  }
  focusedChest = interactable.type === 'chest' ? target : null;
  chestPrompt.classList.remove('hidden');
  chestPrompt.querySelector('strong').textContent = interactable.type === 'chest' ? 'GEDRÜCKT HALTEN' : 'E HALTEN';
  if (interactable.type === 'chest') chestPrompt.querySelector('small').textContent = 'TRUHE ÖFFNEN · LOOT FINDEN';
  else if (interactable.type === 'loot') chestPrompt.querySelector('small').textContent = `${String(interactable.rarity).toUpperCase()} · ${interactable.itemId} · AUFSAMMELN`;
  else chestPrompt.querySelector('small').textContent = `${interactable.ammo === 'shotgun' ? 'SCHROTMUNITION' : 'PISTOLENMUNITION'} · E HALTEN`;
  if (holdTarget !== target || currentInteractableId !== id) { holdTarget = target; holdProgress = 0; }
  currentInteractableId = id;
  if (eHeld) {
    holdProgress = Math.min(1, holdProgress + dt / (interactable.type === 'chest' ? HOLD_SECONDS : .6));
    ringProgress.style.strokeDashoffset = String(119.4 * (1 - holdProgress));
    if (holdProgress >= 1) {
      if (interactable.type === 'chest') {
        const loot = world.openChest(target);
        if (loot) {
          network.sendAction('chest-open', { id: target.userData.chestData.id, loot });
          showToast(`TRUHE GEÖFFNET · ${loot.length} ITEM${loot.length > 1 ? 'S' : ''}`, 1700);
        }
      } else if (interactable.type === 'loot') {
        const loot = world.collectLoot(target);
        if (loot) {
          combat.addLoot(loot.itemId, loot.rarity, loot.amount);
          network.sendAction('loot-collected', loot);
        }
      } else {
        const pickup = world.collectPickup(target);
        if (pickup) {
          combat.addAmmo(pickup.type, pickup.amount);
          network.sendAction('pickup-collected', { id: pickup.id });
          showToast(`+${pickup.amount} ${pickup.type === 'shotgun' ? 'SCHROTPATRONEN' : 'PISTOLENPATRONEN'}`, 1500);
        }
      }
      eHeld = false; ePressed = false; keys.delete('KeyE'); holdTarget = null; focusedChest = null; currentInteractable = null; currentInteractableId = null; holdProgress = 0;
      chestPrompt.classList.add('hidden'); ringProgress.style.strokeDashoffset = '119.4';
    }
  } else { holdProgress = 0; ringProgress.style.strokeDashoffset = '119.4'; }
  ePressed = false;
}

function raycastWorld(maxDistance = 180, directionOverride = null) {
  camera.updateWorldMatrix(true, false);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const direction = directionOverride ? directionOverride.clone().normalize() : camera.getWorldDirection(new THREE.Vector3()).normalize();
  const ray = new THREE.Raycaster(origin, direction, .05, maxDistance);
  const excluded = new Set([camera, aircraft.group, peerCube, lobbyAvatar.avatar, lobbyAvatar.halo, parachuteRig, ropeLine]);
  const roots = scene.children.filter(o => !excluded.has(o) && o.visible && !o.isInstancedMesh && !o.name?.startsWith('muzzle-flash') && !o.name?.startsWith('shot-impact'));
  const hits = ray.intersectObjects(roots, true).filter(hit => hit.object.visible && !hit.object.userData?.isLocationLabel);
  return hits[0] || null;
}
function createImpactMark(point, normal) {
  const material = new THREE.MeshBasicMaterial({ color: '#161c20', transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(.075 + Math.random() * .035, 7), material); mesh.name = 'shot-impact-mark';
  mesh.position.copy(point); const n = normal?.clone?.() || new THREE.Vector3(0, 1, 0); mesh.position.addScaledVector(n, .018);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); scene.add(mesh); impactMarks.push(mesh);
  if (impactMarks.length > 180) { const old = impactMarks.shift(); scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
}
const impactMarks = [];
function resolveShot(shot) {
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const baseDir = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  let peerDamage = 0;
  for (let i = 0; i < shot.pellets; i++) {
    const spread = shot.pellets === 1 ? 0 : (i - (shot.pellets - 1) / 2) * .012;
    const dir = baseDir.clone().addScaledVector(right, spread).addScaledVector(up, (i % 2 ? 1 : -1) * Math.abs(spread) * .5).normalize();
    const hit = raycastWorld(shot.range, dir);
    const peerRay = new THREE.Raycaster(origin, dir, .05, shot.range).intersectObject(peerCube, true)[0];
    if (peerCube.visible && peerRay && (!hit || peerRay.distance < hit.distance)) {
      if (shot.weapon === 'shotgun') {
        const centerDistance = origin.distanceTo(peerCube.position);
        const distanceFactor = centerDistance >= 30 ? 0 : THREE.MathUtils.clamp(1 - centerDistance / 30, 0, 1);
        peerDamage += Math.round(shot.damage * distanceFactor);
      } else {
        const distanceFactor = THREE.MathUtils.clamp(1 - peerRay.distance / shot.range * .35, .45, 1);
        peerDamage += Math.round(shot.damage * distanceFactor);
      }
    } else if (hit) {
      if (hit.object.userData?.isGlass) {
        if (world.breakGlass(hit.object, hit.point, hit.face?.normal || null)) {
          network.sendAction('glass-break', { x: hit.point.x, y: hit.point.y, z: hit.point.z, normal: [0, 0, 1] });
        }
      } else createImpactMark(hit.point, hit.face?.normal || new THREE.Vector3(0, 1, 0));
    }
  }
  if (peerDamage > 0) {
    network.sendAction('player-damage', { amount: Math.min(peerDamage, shot.weapon === 'shotgun' ? 80 : 24), weapon: shot.weapon });
    showToast(`TREFFER · ${Math.min(peerDamage, shot.weapon === 'shotgun' ? 80 : 24)} SCHADEN`, 900);
  }
}

function updateHud() {
  healthValue.textContent = String(Math.round(health)); shieldValue.textContent = String(Math.round(shield));
  healthFill.style.width = `${health / MAX_HEALTH * 100}%`; shieldFill.style.width = `${shield / MAX_SHIELD * 100}%`;
  healthFill.style.filter = health < 30 ? 'saturate(1.35) brightness(1.15)' : '';
  if (stormReadout) stormReadout.textContent = storm.getActive() ? `${Math.round(storm.getRadius())} M SICHER` : 'ZONE WIRD VORBEREITET';
  const pos = getWorldPosition(); mapUI.updatePlayerPosition(pos.x, pos.z, world.locationNameAt(pos.x, pos.z));
  pointerHint.classList.toggle('hidden', pointerLocked || hud.classList.contains('hidden') || mapOpened);
}

function updatePeerState(dt) {
  ownPeerStateTimer += dt;
  if (ownPeerStateTimer < .12 || !matchStarted) return;
  ownPeerStateTimer = 0;
  camera.updateWorldMatrix(true, false);
  const p = getWorldPosition();
  network.sendState({ x: p.x, y: p.y, z: p.z, phase: state, yaw: getWorldYaw() });
}

function animate() {
  const dt = Math.min(clock.getDelta(), .035);
  const elapsed = clock.elapsedTime;
  if (state === 'lobby') {
    lobbyAvatar.avatar.position.y = 31 + Math.sin(elapsed * 1.25) * .35;
    lobbyAvatar.avatar.rotation.y = Math.sin(elapsed * .35) * .23;
    lobbyAvatar.halo.rotation.z = elapsed * .16;
  }
  world.updateChests(dt);
  combat.update(dt);
  if (matchStarted) {
    matchElapsed += dt;
    aircraft.update(matchElapsed);
    if (state === 'inPlane') {
      planeJumpTangent.set(0, 0, -1).applyQuaternion(aircraft.group.quaternion).normalize();
      if (!mapOpened) moveInsideAircraft(dt);
      if (!mapOpened) hands.setPose('hidden');
      // A full route lasts a little under a minute. If the player waits too long, start the same scripted drop safely.
      if (matchElapsed >= 48) { showToast('LETZTER AUFRUF · AUTOMATISCHER ABSPRUNG', 1500); beginJumpSequence(); }
    } else if (state === 'takingPickaxe') {
      sequenceTime += dt;
      const t = Math.min(1, sequenceTime / 1.15); hands.setPose('take', t);
      if (sequenceTime > .72) aircraft.pickaxe.visible = false;
      if (sequenceTime > 1.15) { state = 'turning'; sequenceTime = 0; jumpStartYaw = camera.rotation.y; }
    } else if (state === 'turning') {
      sequenceTime += dt;
      const t = Math.min(1, sequenceTime / 1.25); const smooth = t * t * (3 - 2 * t);
      camera.rotation.y = jumpStartYaw + Math.PI * smooth;
      camera.rotation.x = -.04 - .08 * smooth; camera.rotation.z = 0;
      camera.position.z = THREE.MathUtils.lerp(-2.4, 4.3, smooth);
      camera.position.y = 1.62 + .08 * Math.sin(t * Math.PI);
      hands.setPose('run-jump', t);
      setCaption('HECKKLAPPE · ABSPRUNG', true);
      if (sequenceTime > 1.25) { state = 'runningJump'; sequenceTime = 0; jumpStartPos.copy(camera.position); jumpStartYaw = camera.rotation.y; }
    } else if (state === 'runningJump') {
      sequenceTime += dt;
      const t = Math.min(1, sequenceTime / .82); const smooth = t * t * (3 - 2 * t);
      camera.position.z = THREE.MathUtils.lerp(4.3, 10.1, smooth);
      camera.position.y = 1.62 + Math.sin(t * Math.PI) * .48 - Math.max(0, t - .76) * 2.8;
      camera.rotation.x = -.08 - Math.sin(t * Math.PI) * .1; camera.rotation.z = 0;
      hands.setPose('run-jump', t);
      if (sequenceTime > .82) { clickSound.thump(); startFalling(); sequenceTime = 0; }
    } else if (state === 'falling') {
      fallTime += dt; moveAirborne(dt); hands.setPose('freefall', fallTime);
      if (fallTime >= 3 && state === 'falling') openParachute();
    } else if (state === 'parachute') {
      parachuteOpenTime += dt; moveAirborne(dt); if (state === 'parachute') hands.setPose('parachute', parachuteOpenTime);
      updateParachuteRig();
    } else if (state === 'playing') {
      moveOnGround(dt); updateChestInteraction(dt);
    }
    const pos = getWorldPosition();
    lodTimer += dt;
    if (lodTimer >= .35) { lodTimer = 0; world.updateLOD(pos); }
    const stormState = storm.update(dt, state === 'playing' ? pos : null);
    if (stormReadout && stormState.active) stormReadout.textContent = `${Math.round(stormState.radius)} M SICHER`;
    const targetFov = combat.isAiming() && state === 'playing' ? 48 : 63;
    const oldFov = camera.fov; currentAimFov = THREE.MathUtils.damp(currentAimFov, targetFov, 10, dt);
    if (Math.abs(oldFov - currentAimFov) > .08) { camera.fov = currentAimFov; camera.updateProjectionMatrix(); }
    if (mapOpened) hands.setPose('map');
    updateHud(); updatePeerState(dt);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

textures.ready.then(loaded => world.applyTextures(loaded)).catch(() => {});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});
window.addEventListener('blur', () => { keys.clear(); eHeld = false; holdProgress = 0; });
window.addEventListener('contextmenu', event => event.preventDefault());
requestAnimationFrame(animate);
