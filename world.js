import * as THREE from 'three';
import { MAP_SIZE, HALF_MAP, LOCATIONS } from './config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dist2 = (x1, z1, x2, z2) => Math.hypot(x1 - x2, z1 - z2);
let seed = 791937; // Deterministic layout so both local multiplayer tabs share the same map and chest positions.
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function randRange(a, b) { return a + (b - a) * rand(); }
function gauss(x, z, cx, cz, sigma, height) { const d = ((x - cx) ** 2 + (z - cz) ** 2) / (2 * sigma * sigma); return height * Math.exp(-d); }

export function heightAt(x, z) {
  // Crowns Rest is a separate small island near the south-eastern coast.
  const crownDistance = dist2(x, z, 380, 360);
  if (crownDistance < 62) return -20 + 36 * smooth(0, 14, 62 - crownDistance);
  const r = Math.sqrt((x / 520) ** 2 + (z / 550) ** 2);
  const a = Math.atan2(z, x);
  const edge = 1 + .033 * Math.sin(a * 4 + .4) + .025 * Math.cos(a * 7) + .015 * Math.sin(a * 13 + 2);
  if (r >= edge) return -24;
  const edgeFade = smooth(0, .045, edge - r);
  const rolling = Math.sin(x * .021 + Math.cos(z * .017) * 2) * 2.8 + Math.cos(z * .026 - x * .008) * 3.2 + Math.sin((x + z) * .044) * 1.2;
  let h = 4 + (1 - r) * 8 + rolling;
  h += gauss(x, z, -340, -360, 98, 52); // Frosty Peaks
  h += gauss(x, z, 280, -375, 104, 61); // Snowfall Ridge
  h += gauss(x, z, 230, -45, 78, 26); // Rift Rocks
  h += gauss(x, z, -310, 95, 100, 22); // Willow Heights
  h += gauss(x, z, -120, 260, 105, 15);
  h += gauss(x, z, 345, 345, 67, 10);
  if (x > 170 && z > -20) h = h * .65 + 7; // desert plateau
  return -24 + (h + 24) * edgeFade;
}

function biomeAt(x, z, y = heightAt(x, z)) {
  if (dist2(x, z, -340, -360) < 124 || dist2(x, z, 280, -375) < 128 || y > 54) return 'snow';
  if (x > 175 && z > -5 && dist2(x, z, 365, 75) < 270) return 'desert';
  if ((x < -80 && z > -210 && z < 30) || (x > 90 && z > 145 && z < 300)) return 'forest';
  if (dist2(x, z, 230, -45) < 95) return 'rock';
  return 'grass';
}
function makeLabel(text) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const c = canvas.getContext('2d'); c.clearRect(0, 0, 512, 96);
  c.fillStyle = 'rgba(5,15,23,.78)'; c.beginPath(); c.roundRect(5, 7, 502, 82, 10); c.fill();
  c.strokeStyle = 'rgba(229,243,251,.5)'; c.lineWidth = 3; c.stroke();
  c.font = '800 35px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f3f8fb'; c.shadowColor = '#000'; c.shadowBlur = 8; c.fillText(text.toUpperCase(), 256, 49, 470);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(26, 4.9, 1); sprite.userData.isLocationLabel = true;
  return sprite;
}
function makeBox(THREE, parent, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function createBuilding(THREE, scene, loc, idx, materials, registry) {
  const group = new THREE.Group();
  const angle = Math.round(rand() * 3) * Math.PI / 2 + randRange(-.045, .045);
  const radius = loc.kind === 'city' || loc.kind === 'port' ? randRange(18, 62) : randRange(12, 49);
  let x = loc.x + Math.cos(rand() * Math.PI * 2) * radius;
  let z = loc.z + Math.sin(rand() * Math.PI * 2) * radius;
  if (heightAt(x, z) < 0) { x = loc.x + (x - loc.x) * .55; z = loc.z + (z - loc.z) * .55; }
  const ground = heightAt(x, z);
  group.position.set(x, ground, z);
  group.rotation.y = angle;
  // Slightly follow broad terrain slopes and use buried/supporting foundations at each corner.
  const slopeX = (heightAt(x + 3, z) - heightAt(x - 3, z)) / 6;
  const slopeZ = (heightAt(x, z + 3) - heightAt(x, z - 3)) / 6;
  group.rotation.x = THREE.MathUtils.clamp(slopeZ * .20, -.10, .10);
  group.rotation.z = THREE.MathUtils.clamp(-slopeX * .20, -.10, .10);
  const urban = loc.kind === 'city' || loc.kind === 'port' || loc.kind === 'town';
  const w = urban ? randRange(8, 15) : randRange(6, 11);
  const d = urban ? randRange(7, 14) : randRange(6, 10);
  const h = loc.kind === 'city' ? randRange(9, 22) : loc.kind === 'port' ? randRange(7, 15) : randRange(4.5, 10);
  const tone = loc.biome === 'desert' ? ['#c7a16d', '#b58b58', '#d3b987'][Math.floor(rand() * 3)] : loc.biome === 'industrial' ? ['#4c5c65', '#6d777b', '#566b72'][Math.floor(rand() * 3)] : ['#a7b2b6', '#8d9b9f', '#c0c4bc', '#788f96'][Math.floor(rand() * 4)];
  const wall = new THREE.MeshStandardMaterial({ color: tone, map: (loc.biome === 'industrial' ? materials.metal : materials.brick), roughness: .91 });
  const roofColors = loc.biome === 'desert' ? ['#674a36', '#946d45'] : loc.biome === 'industrial' ? ['#323f48', '#4b5961'] : ['#394a58', '#794d45', '#596e73'];
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColors[Math.floor(rand() * roofColors.length)], roughness: .8, metalness: loc.biome === 'industrial' ? .35 : .06 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1d5265', emissive: '#143140', emissiveIntensity: .25, roughness: .22, metalness: .28, transparent: true, opacity: .78 });
  const doorX = w * .17;
  const doorW = 1.35, doorH = 2.30, wallT = .38;
  makeBox(THREE, group, w, .28, d, new THREE.MeshStandardMaterial({ color: '#62676a', roughness: 1 }), 0, .05, 0);
  // Side and rear walls are solid, while the front façade is modelled with real door/window openings.
  makeBox(THREE, group, w, h, wallT, wall, 0, h / 2, -d / 2);
  makeBox(THREE, group, wallT, h, d, wall, -w / 2, h / 2, 0);
  makeBox(THREE, group, wallT, h, d, wall, w / 2, h / 2, 0);
  const windowW = Math.max(.85, w * .13), windowH = Math.max(1.05, Math.min(1.8, h * .13));
  const windowList = [];
  for (let row = 0; row < Math.min(3, Math.floor((h - 1.2) / 3.4)); row++) {
    for (let col = -1; col <= 1; col++) {
      if (rand() < .15) continue;
      const wx = col * w * .27;
      if (Math.abs(wx - doorX) < 1.25) continue;
      const wy = 2.6 + row * 2.65;
      windowList.push({ wx, wy });
    }
  }
  const facadeShape = new THREE.Shape();
  facadeShape.moveTo(-w / 2, 0); facadeShape.lineTo(w / 2, 0); facadeShape.lineTo(w / 2, h); facadeShape.lineTo(-w / 2, h); facadeShape.closePath();
  function addOpeningHole(x1, y1, x2, y2) {
    const hole = new THREE.Path();
    hole.moveTo(x1, y1); hole.lineTo(x1, y2); hole.lineTo(x2, y2); hole.lineTo(x2, y1); hole.closePath();
    facadeShape.holes.push(hole);
  }
  addOpeningHole(doorX - doorW / 2, 0, doorX + doorW / 2, doorH);
  for (const win of windowList) addOpeningHole(win.wx - windowW / 2, win.wy - windowH / 2, win.wx + windowW / 2, win.wy + windowH / 2);
  const facadeGeo = new THREE.ExtrudeGeometry(facadeShape, { depth: wallT, bevelEnabled: false, steps: 1, curveSegments: 1 });
  const facade = new THREE.Mesh(facadeGeo, wall); facade.position.set(0, 0, d / 2 - wallT / 2); facade.castShadow = true; facade.receiveShadow = true; group.add(facade);
  makeBox(THREE, group, w + 1, .75, d + 1, roofMat, 0, h + .35, 0);
  // Extra roof lip and beams add a clearer silhouette from far away.
  for (const side of [-1, 1]) makeBox(THREE, group, .16, .20, d + .6, roofMat, side * (w / 2 + .18), h + .02, 0);
  // Terrain-following foundation piers prevent buildings appearing suspended on slopes.
  const foundationMat = new THREE.MeshStandardMaterial({ color: '#5e6263', roughness: 1 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * w * .43, lz = sz * d * .43;
    const wx = x + lx * Math.cos(angle) + lz * Math.sin(angle);
    const wz = z - lx * Math.sin(angle) + lz * Math.cos(angle);
    const delta = heightAt(wx, wz) - ground;
    const height = Math.max(.45, Math.abs(delta) + .45);
    const cy = delta >= 0 ? (delta - .45) / 2 : delta / 2;
    makeBox(THREE, group, .42, height, .42, foundationMat, lx, cy, lz);
  }
  // Panes and frames fill the true façade openings; broken glass reveals the interior.
  for (const { wx, wy } of windowList) {
    const pane = makeBox(THREE, group, windowW, windowH, .075, glass, wx, wy, d / 2 + .23);
    pane.userData.isGlass = true; pane.userData.building = group; pane.userData.windowBounds = { x: wx, y: wy, w: windowW, h: windowH, frontZ: d / 2 };
    registry.windows.push(pane); registry.shootTargets.push(pane);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#3b4b53', metalness: .5, roughness: .5 });
    for (const dx of [-windowW / 2, windowW / 2]) makeBox(THREE, group, .075, windowH + .12, .10, frameMat, wx + dx, wy, d / 2 + .27);
    for (const dy of [-windowH / 2, windowH / 2]) makeBox(THREE, group, windowW + .12, .075, .10, frameMat, wx, wy + dy, d / 2 + .27);
  }
  const doorPivot = new THREE.Group(); doorPivot.position.set(doorX - doorW / 2, 0, d / 2 + .04); group.add(doorPivot);
  const doorMat = new THREE.MeshStandardMaterial({ color: '#263742', roughness: .8, metalness: .16 });
  const doorMesh = makeBox(THREE, doorPivot, doorW, doorH, .13, doorMat, doorW / 2, doorH / 2, 0);
  doorMesh.userData.isDoor = true; doorMesh.userData.doorGroup = doorPivot;
  doorPivot.userData.doorData = { open: false, targetRotation: 0, x, z, building: group };
  registry.doors.push(doorPivot); registry.doorTargets.push(doorMesh);
  // Distance LODs: detailed near version, simplified mid-range silhouette and one-colour far proxy.
  const low = new THREE.Group(); low.position.copy(group.position); low.rotation.copy(group.rotation); low.visible = false;
  const lowMat = new THREE.MeshStandardMaterial({ color: tone, roughness: 1 });
  makeBox(THREE, low, w, h, d, lowMat, 0, h / 2, 0);
  makeBox(THREE, low, w + .8, .55, d + .8, roofMat, 0, h + .25, 0);
  const far = new THREE.Group(); far.position.copy(group.position); far.rotation.copy(group.rotation); far.visible = false;
  const farMat = new THREE.MeshStandardMaterial({ color: tone, roughness: 1 });
  makeBox(THREE, far, w, h, d, farMat, 0, h / 2, 0);
  scene.add(group, low, far);
  registry.buildings.push({ high: group, low, far, x, z, w, d, h, angle, doorX, doorW, doorH, roofMat, tone });
  if (loc.kind === 'port') {
    for (let c = 0; c < (idx % 3) + 1; c++) {
      const boxMat = new THREE.MeshStandardMaterial({ color: ['#9f493e', '#496f83', '#b18a45'][c % 3], metalness: .42, roughness: .65, map: materials.metal });
      makeBox(THREE, group, 5, 2.5, 2.7, boxMat, (c - 1) * 6, 1.25, -d / 2 - 3.5);
    }
  }
  return group;
}

function createRoad(THREE, scene, a, b, width = 3.1) {
  const start = new THREE.Vector3(a.x, heightAt(a.x, a.z) + .75, a.z);
  const end = new THREE.Vector3(b.x, heightAt(b.x, b.z) + .75, b.z);
  const mid1 = new THREE.Vector3(a.x * .67 + b.x * .33, 0, a.z * .67 + b.z * .33);
  const mid2 = new THREE.Vector3(a.x * .33 + b.x * .67, 0, a.z * .33 + b.z * .67);
  mid1.y = heightAt(mid1.x, mid1.z) + .75; mid2.y = heightAt(mid2.x, mid2.z) + .75;
  const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, end]);
  const points = curve.getPoints(100); const vertices = [], indices = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], tangent = curve.getTangent(i / (points.length - 1));
    const nx = -tangent.z, nz = tangent.x; const len = Math.hypot(nx, nz) || 1;
    vertices.push(p.x + nx / len * width, p.y, p.z + nz / len * width);
    vertices.push(p.x - nx / len * width, p.y + .025, p.z - nz / len * width);
    if (i < points.length - 1) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#565e5d', roughness: 1, side: THREE.DoubleSide });
  const road = new THREE.Mesh(geo, mat); road.receiveShadow = true; scene.add(road);
  // Dashed painted road centreline.
  const linePoints = points.filter((_, i) => i % 5 === 0).map(p => new THREE.Vector3(p.x, p.y + .07, p.z));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color: '#d2c7a2', transparent: true, opacity: .62 })); scene.add(line);
}
function createChest(THREE, scene, x, z, id) {
  const group = new THREE.Group(); group.position.set(x, heightAt(x, z) + .1, z); group.userData.isChest = true;
  const dark = new THREE.MeshStandardMaterial({ color: '#604021', roughness: .67, metalness: .12 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e7ad2c', roughness: .33, metalness: .62, emissive: '#7a4a0c', emissiveIntensity: .13 });
  const seam = new THREE.MeshStandardMaterial({ color: '#392a1e', roughness: .72, metalness: .25 });
  makeBox(THREE, group, 2.55, 1.25, 1.65, dark, 0, .68, 0);
  makeBox(THREE, group, 2.7, .17, 1.77, gold, 0, .93, 0);
  makeBox(THREE, group, .22, 1.28, 1.83, gold, 0, .66, 0);
  makeBox(THREE, group, .52, .44, .13, gold, 0, .78, .91);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 1.18, -.76); group.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.65, .63, .25), dark); lid.position.set(0, .05, .76); lid.castShadow = true; lidPivot.add(lid);
  const lidTop = new THREE.Mesh(new THREE.BoxGeometry(2.76, .14, 1.77), gold); lidTop.position.set(0, .36, .76); lidTop.castShadow = true; lidPivot.add(lidTop);
  const lidBand = new THREE.Mesh(new THREE.BoxGeometry(.22, .68, 1.82), gold); lidBand.position.set(0, .16, .76); lidBand.castShadow = true; lidPivot.add(lidBand);
  // Faint glow and interaction target make empty loot chests easy to recognize.
  const glow = new THREE.PointLight('#ffb526', 1.3, 7, 2); glow.position.set(0, 1.5, 0); group.add(glow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, .055, 6, 24), new THREE.MeshBasicMaterial({ color: '#ffcc45', transparent: true, opacity: .46 })); ring.rotation.x = Math.PI / 2; ring.position.y = .04; group.add(ring);
  group.traverse(o => { if (o.isMesh) { o.userData.chestGroup = group; o.castShadow = true; o.receiveShadow = true; } });
  group.userData.chestData = { id, opened: false, lidPivot, targetRotation: 0, meshes: [] };
  scene.add(group);
  return group;
}

function createAmmoPickup(THREE, scene, x, z, id, type) {
  const group = new THREE.Group(); group.position.set(x, heightAt(x, z) + .8, z); group.userData.pickupData = { id, type, collected: false, amount: type === 'shotgun' ? 5 : 18 };
  const metal = new THREE.MeshStandardMaterial({ color: '#303c43', metalness: .72, roughness: .38 });
  const color = type === 'shotgun' ? '#ad4434' : '#c1a04e';
  const shell = new THREE.MeshStandardMaterial({ color, metalness: .48, roughness: .4 });
  makeBox(THREE, group, 1.15, .42, .75, metal, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const round = new THREE.Mesh(new THREE.CylinderGeometry(.10, .10, .35, 8), shell);
    round.rotation.z = Math.PI / 2; round.position.set(-.31 + i * .31, .26, 0); round.castShadow = true; group.add(round);
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.78, .035, 5, 24), new THREE.MeshBasicMaterial({ color: type === 'shotgun' ? '#ff6e55' : '#ffd66a', transparent: true, opacity: .78 })); halo.rotation.x = Math.PI / 2; halo.position.y = -.52; group.add(halo);
  group.traverse(o => { if (o.isMesh) { o.userData.pickupGroup = group; o.castShadow = true; } });
  scene.add(group); return group;
}


function createLootPickup(THREE, scene, x, z, id, loot) {
  const group = new THREE.Group();
  group.position.set(x, heightAt(x, z) + 0.9, z);
  const rarityColors = {
    common: '#aeb8c0', uncommon: '#39d17a', rare: '#3b9cff', epic: '#b65cff', legendary: '#ff9f24'
  };
  const color = rarityColors[loot.rarity] || rarityColors.common;
  const data = { id, type: 'loot', itemId: loot.itemId, rarity: loot.rarity, amount: loot.amount || 1, collected: false };
  group.userData.lootData = data;
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.78, 0.78),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18, metalness: .2, roughness: .42 })
  );
  core.rotation.set(.18, .35, -.12);
  group.add(core);
  const inner = new THREE.Mesh(
    new THREE.OctahedronGeometry(.28, 0),
    new THREE.MeshBasicMaterial({ color })
  );
  group.add(inner);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(.68, .035, 6, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .82 })
  );
  halo.rotation.x = Math.PI / 2; halo.position.y = -.55; group.add(halo);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, opacity: .96 }));
  label.scale.set(1.15, .38, 1); label.position.y = 1.15; label.userData.isLocationLabel = true; group.add(label);
  group.traverse(o => { if (o.isMesh) { o.userData.lootGroup = group; o.castShadow = true; o.receiveShadow = true; } });
  scene.add(group);
  return group;
}

function rollChestLoot(rand) {
  const rarityRoll = rand();
  let rarity = 'common';
  if (rarityRoll < .02) rarity = 'legendary';
  else if (rarityRoll < .08) rarity = 'epic';
  else if (rarityRoll < .20) rarity = 'rare';
  else if (rarityRoll < .45) rarity = 'uncommon';
  const itemRoll = rand();
  let itemId = itemRoll < .34 ? 'shotgun' : itemRoll < .62 ? 'pistol' : itemRoll < .82 ? 'healing' : itemRoll < .91 ? 'shotgun-ammo' : 'pistol-ammo';
  const multipliers = { common: 1, uncommon: 1.12, rare: 1.25, epic: 1.4, legendary: 1.6 };
  let amount = itemId === 'healing' ? 1 : itemId === 'shotgun-ammo' ? Math.round(5 * multipliers[rarity]) : itemId === 'pistol-ammo' ? Math.round(18 * multipliers[rarity]) : 1;
  return { itemId, rarity, amount };
}

export function createWorld(THREE, scene, texturePack) {
  scene.background = new THREE.Color('#82cce9');
  scene.fog = new THREE.Fog('#a9d3df', 320, 1180);
  const registry = { buildings: [], doors: [], doorTargets: [], windows: [], shootTargets: [], shards: [], pickups: [], lootPickups: [], obstacles: [] };
  const hemi = new THREE.HemisphereLight('#d9f1ff', '#263b2c', 2.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3d7', 3.1); sun.position.set(-220, 350, -160); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -600; sun.shadow.camera.right = 600; sun.shadow.camera.top = 600; sun.shadow.camera.bottom = -600; sun.shadow.bias = -.00025; scene.add(sun);
  const oceanGeo = new THREE.PlaneGeometry(3600, 3600, 1, 1); oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({ color: '#0c6789', roughness: .3, metalness: .12, normalMap: texturePack.waterNormal, normalScale: new THREE.Vector2(.25, .25) });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat); ocean.position.y = -19; ocean.receiveShadow = true; scene.add(ocean);

  // Chunked terrain: the near LOD keeps all biome materials, while middle/far LODs use fewer vertices.
  const terrainExtent = 1300;
  const totalSegments = 200, chunkGrid = 8, chunkSegments = totalSegments / chunkGrid;
  const biomeOrder = ['grass', 'forest', 'desert', 'snow', 'rock'];
  const cGrass = new THREE.Color('#4e9149'), cForest = new THREE.Color('#235c3b'), cDesert = new THREE.Color('#c6a363'), cSnow = new THREE.Color('#dce7e8'), cRock = new THREE.Color('#777b78'), cDune = new THREE.Color('#e3bd78');
  const terrainMats = [
    new THREE.MeshStandardMaterial({ map: texturePack.grass, vertexColors: true, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ map: texturePack.grass, vertexColors: true, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ map: texturePack.sand, vertexColors: true, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ map: texturePack.snow, vertexColors: true, roughness: 1, metalness: 0 }),
    new THREE.MeshStandardMaterial({ map: texturePack.rock, vertexColors: true, roughness: 1, metalness: 0 })
  ];
  const simpleTerrainMat = new THREE.MeshStandardMaterial({ map: texturePack.grass, vertexColors: true, roughness: 1, metalness: 0 });
  function terrainVertex(ix, iz) {
    const x = -terrainExtent / 2 + ix / totalSegments * terrainExtent;
    const z = -terrainExtent / 2 + iz / totalSegments * terrainExtent;
    const y = heightAt(x, z), biome = biomeAt(x, z, y);
    let color = biome === 'snow' ? cSnow : biome === 'desert' ? cDune : biome === 'forest' ? cForest : biome === 'rock' ? cRock : cGrass;
    const shade = .87 + .13 * (Math.sin(x * .043) * Math.cos(z * .033) + 1) / 2;
    const cc = color.clone().multiplyScalar(shade);
    if (y < 1 && y > -20) cc.lerp(new THREE.Color('#b5ba91'), .55);
    return { x, y, z, color: cc, biome };
  }
  function makeChunkGeometry(chunkX, chunkZ, localSegments, multiMaterial) {
    const vertices = [], colors = [], uvs = [], indices = [];
    const groups = { grass: [], forest: [], desert: [], snow: [], rock: [] };
    const stride = chunkSegments / localSegments;
    for (let iz = 0; iz <= localSegments; iz++) for (let ix = 0; ix <= localSegments; ix++) {
      const v = terrainVertex(chunkX * chunkSegments + ix * stride, chunkZ * chunkSegments + iz * stride);
      vertices.push(v.x, v.y, v.z); colors.push(v.color.r, v.color.g, v.color.b); uvs.push((v.x + MAP_SIZE / 2) / 22, (v.z + MAP_SIZE / 2) / 22);
    }
    for (let iz = 0; iz < localSegments; iz++) for (let ix = 0; ix < localSegments; ix++) {
      const a = iz * (localSegments + 1) + ix;
      const cx = -terrainExtent / 2 + (chunkX * chunkSegments + (ix + .5) * stride) / totalSegments * terrainExtent;
      const cz = -terrainExtent / 2 + (chunkZ * chunkSegments + (iz + .5) * stride) / totalSegments * terrainExtent;
      const b = biomeAt(cx, cz, heightAt(cx, cz));
      const key = groups[b] ? b : 'grass';
      groups[key].push(a, a + localSegments + 1, a + 1, a + 1, a + localSegments + 1, a + localSegments + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    if (multiMaterial) {
      for (let mi = 0; mi < biomeOrder.length; mi++) { const list = groups[biomeOrder[mi]], offset = indices.length; indices.push(...list); geo.addGroup(offset, list.length, mi); }
    } else for (const list of Object.values(groups)) indices.push(...list);
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  const terrainChunks = [];
  for (let cz = 0; cz < chunkGrid; cz++) for (let cx = 0; cx < chunkGrid; cx++) {
    const high = new THREE.Mesh(makeChunkGeometry(cx, cz, chunkSegments, true), terrainMats);
    high.name = `terrain-high-${cx}-${cz}`; high.receiveShadow = true; high.castShadow = true;
    const low = new THREE.Mesh(makeChunkGeometry(cx, cz, 8, false), simpleTerrainMat);
    low.name = `terrain-low-${cx}-${cz}`; low.receiveShadow = true; low.castShadow = false; low.visible = false;
    const far = new THREE.Mesh(makeChunkGeometry(cx, cz, 2, false), simpleTerrainMat);
    far.name = `terrain-far-${cx}-${cz}`; far.receiveShadow = false; far.castShadow = false; far.visible = false;
    scene.add(high, low, far);
    const minX = -terrainExtent / 2 + cx / chunkGrid * terrainExtent, minZ = -terrainExtent / 2 + cz / chunkGrid * terrainExtent;
    terrainChunks.push({ high, low, far, x: minX + terrainExtent / chunkGrid / 2, z: minZ + terrainExtent / chunkGrid / 2 });
  }
  const terrain = new THREE.Group(); terrain.name = 'island-terrain-chunks';
  // Keep a handle to all chunk meshes for texture upgrades and LOD selection.
  terrain.userData.chunks = terrainChunks;

  // Small islands and coastal rocks.
  for (let i = 0; i < 45; i++) {
    const angle = rand() * Math.PI * 2, r = randRange(500, 690), x = Math.cos(angle) * r, z = Math.sin(angle) * r * 1.04;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(randRange(2, 12), 0), new THREE.MeshStandardMaterial({ color: rand() > .5 ? '#687a7b' : '#4a797b', roughness: 1 }));
    rock.position.set(x, -15 + randRange(-1, 3), z); rock.scale.y = .38; rock.rotation.set(rand(), rand(), rand()); scene.add(rock);
  }

  // The named POIs are aligned with the uploaded top-down map. Larger build radii create fuller city silhouettes.
  for (const loc of LOCATIONS) {
    const markerY = heightAt(loc.x, loc.z);
    const label = makeLabel(loc.name); label.position.set(loc.x, Math.max(markerY + 26, 30), loc.z); scene.add(label);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8, .24, 6, 36), new THREE.MeshBasicMaterial({ color: loc.biome === 'desert' ? '#f4c46a' : '#dbeeff', transparent: true, opacity: .55 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(loc.x, markerY + .35, loc.z); scene.add(ring);
    for (let i = 0; i < loc.buildings * (loc.kind === 'city' ? 1.9 : loc.kind === 'port' ? 1.6 : 1.45); i++) createBuilding(THREE, scene, loc, i, texturePack, registry);
  }

  // Roads link neighbouring POIs as a broad island road network.
  const roadPairs = [[2,3],[3,4],[2,6],[6,5],[6,7],[7,8],[7,10],[10,11],[10,13],[9,10],[9,12],[13,14],[14,15],[12,13],[3,8],[1,3],[0,2]];
  for (const [a, b] of roadPairs) createRoad(THREE, scene, LOCATIONS[a], LOCATIONS[b], (LOCATIONS[a].kind === 'city' || LOCATIONS[b].kind === 'city') ? 3.5 : 2.6);

  // Forests: instanced meshes keep hundreds of trees affordable in a browser.
  const trunkGeo = new THREE.CylinderGeometry(.45, .75, 4.5, 6);
  const pineGeo = new THREE.ConeGeometry(3.2, 8, 7); pineGeo.translate(0, 4.6, 0);
  const leafGeo = new THREE.IcosahedronGeometry(3.2, 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#62452d', roughness: 1 });
  const pineMat = new THREE.MeshStandardMaterial({ color: '#236a3e', roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#347d45', roughness: 1 });
  const treeCount = 2450;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount); trunks.name = 'instanced-tree-trunks';
  const pines = new THREE.InstancedMesh(pineGeo, pineMat, treeCount); pines.name = 'instanced-tree-canopies';
  const leafy = new THREE.InstancedMesh(leafGeo, leafMat, Math.floor(treeCount * .32)); leafy.name = 'instanced-tree-leaves';
  trunks.castShadow = pines.castShadow = leafy.castShadow = true; trunks.receiveShadow = true;
  const dummy = new THREE.Object3D(); let used = 0, usedLeaf = 0;
  for (let attempts = 0; attempts < 11500 && used < treeCount; attempts++) {
    const x = randRange(-480, 480), z = randRange(-500, 500), y = heightAt(x, z);
    if (y < 1 || y > 62 || rand() < .22) continue;
    let clear = false;
    for (const loc of LOCATIONS) if (dist2(x, z, loc.x, loc.z) < (loc.kind === 'forest' ? 35 : 72)) { clear = true; break; }
    if (clear) continue;
    const biome = biomeAt(x, z, y);
    const desert = biome === 'desert'; if (desert && rand() < .92) continue;
    const scale = randRange(.64, 1.55);
    dummy.position.set(x, y + 2.2 * scale, z); dummy.rotation.set(0, rand() * Math.PI * 2, 0); dummy.scale.set(scale, scale, scale); dummy.updateMatrix();
    trunks.setMatrixAt(used, dummy.matrix); pines.setMatrixAt(used, dummy.matrix);
    registry.obstacles.push({ x, z, radius: 1.1 * scale, type: 'tree' });
    const foliageColor = biome === 'snow' ? new THREE.Color('#dbe9ee') : biome === 'forest' ? new THREE.Color(rand() > .5 ? '#1c5339' : '#2a6740') : new THREE.Color(rand() > .5 ? '#2c7540' : '#428448');
    pines.setColorAt(used, foliageColor); trunks.setColorAt(used, new THREE.Color('#62452d'));
    if (usedLeaf < leafy.count && rand() < .27 && biome !== 'snow') { leafy.setMatrixAt(usedLeaf, dummy.matrix); leafy.setColorAt(usedLeaf, foliageColor); usedLeaf++; }
    used++;
  }
  trunks.count = used; pines.count = used; leafy.count = usedLeaf; scene.add(trunks, pines, leafy);

  // Rocks, boulders and desert spires.
  for (let i = 0; i < 560; i++) {
    const x = randRange(-480, 480), z = randRange(-500, 500), y = heightAt(x, z);
    if (y < 2 || y > 80) continue;
    const biome = biomeAt(x, z, y);
    if (biome === 'grass' && rand() < .72) continue;
    if (LOCATIONS.some(loc => dist2(x, z, loc.x, loc.z) < 28)) continue;
    const size = biome === 'desert' ? randRange(2, 8) : randRange(1, 5.5);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 1), new THREE.MeshStandardMaterial({ color: biome === 'snow' ? '#aebdc2' : biome === 'desert' ? '#9a6b3b' : '#666f70', roughness: 1 }));
    rock.position.set(x, y + size * .35, z); rock.rotation.set(rand(), rand(), rand()); rock.scale.set(1, randRange(.55, 1.4), randRange(.8, 1.3)); rock.castShadow = true; rock.receiveShadow = true; scene.add(rock);
    registry.obstacles.push({ x, z, radius: size * .58, type: 'rock' });
  }

  // River bends through the centre, small ponds, and two lagoons.
  function waterShape(x, z, rx, rz, rotation = 0) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 44), new THREE.MeshStandardMaterial({ color: '#168eb0', roughness: .24, metalness: .18, transparent: true, opacity: .93 }));
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = rotation; mesh.scale.set(rx, rz, 1); mesh.position.set(x, heightAt(x, z) + .45, z); scene.add(mesh); return mesh;
  }
  waterShape(-7, -90, 34, 65, .35); waterShape(65, 105, 27, 43, -.42); waterShape(-235, 245, 22, 36, .1); waterShape(355, 270, 28, 55, .3);
  // Decorative bridge over one narrow waterway.
  const bridge = new THREE.Group(); bridge.position.set(28, heightAt(28, -70) + 1.1, -70); bridge.rotation.y = .28; scene.add(bridge);
  const wood = new THREE.MeshStandardMaterial({ color: '#805b3c', roughness: 1 });
  makeBox(THREE, bridge, 9, .45, 22, wood, 0, 0, 0);
  for (const s of [-1, 1]) { makeBox(THREE, bridge, .35, 1.3, 22, wood, s * 4.1, .6, 0); for (let k = -4; k <= 4; k++) makeBox(THREE, bridge, .45, 1.05, .45, wood, s * 4.1, .6, k * 2.5); }

  // Loot chests randomized in clearings around the island. Every chest rolls real loot when opened.
  const chests = [];
  let tries = 0;
  while (chests.length < 46 && tries++ < 5000) {
    let x = randRange(-455, 455), z = randRange(-475, 475); const y = heightAt(x, z);
    if (y < 2 || y > 58 || biomeAt(x, z, y) === 'snow' && rand() < .55) continue;
    if (LOCATIONS.some(loc => dist2(x, z, loc.x, loc.z) < 18)) continue;
    if (chests.some(c => dist2(x, z, c.position.x, c.position.z) < 22)) continue;
    const chest = createChest(THREE, scene, x, z, chests.length + 1); chests.push(chest);
  }

  // Loose ammunition still exists outside chests as bonus world loot.
  let pickupId = 1;
  for (const loc of LOCATIONS) {
    if (loc.kind === 'forest' || loc.kind === 'mountain') continue;
    const count = loc.kind === 'city' || loc.kind === 'port' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2, r = randRange(8, 25);
      const x = loc.x + Math.cos(angle) * r, z = loc.z + Math.sin(angle) * r;
      if (heightAt(x, z) > 0) registry.pickups.push(createAmmoPickup(THREE, scene, x, z, pickupId++, rand() > .5 ? 'shotgun' : 'pistol'));
    }
  }

  const waypointGroup = new THREE.Group(); scene.add(waypointGroup);
  const chestRaycaster = new THREE.Raycaster(); chestRaycaster.far = 7.5;
  const chestTargets = chests;
  const applyTextures = loaded => {
    if (loaded.grass) scene.traverse(o => { if (o.isMesh && o.material && (Array.isArray(o.material) ? o.material.some(m => m.map === texturePack.grass) : o.material.map === texturePack.grass)) { const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) if (m.map === texturePack.grass) { m.map = loaded.grass; m.needsUpdate = true; } } });
    if (loaded.brick) scene.traverse(o => { if (o.isMesh && o.material?.map === texturePack.brick) { o.material.map = loaded.brick; o.material.needsUpdate = true; } });
    if (loaded.metal) scene.traverse(o => { if (o.isMesh && o.material?.map === texturePack.metal) { o.material.map = loaded.metal; o.material.needsUpdate = true; } });
    if (loaded.waterNormal) { oceanMat.normalMap = loaded.waterNormal; oceanMat.needsUpdate = true; }
  };

  function findFocusedChest(camera) {
    chestRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const all = chestRaycaster.intersectObjects(chestTargets, true);
    if (!all.length) return null;
    const group = all[0].object.userData.chestGroup;
    if (!group || group.userData.chestData.opened) return null;
    const playerPos = new THREE.Vector3(); camera.getWorldPosition(playerPos);
    if (playerPos.distanceTo(group.position) > 7.2) return null;
    return group;
  }
  function findFocusedInteractable(camera) {
    chestRaycaster.far = 8.2;
    chestRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const targets = [...chestTargets, ...registry.doorTargets, ...registry.pickups, ...registry.lootPickups];
    const all = chestRaycaster.intersectObjects(targets, true);
    if (!all.length) return null;
    const object = all[0].object;
    const chest = object.userData.chestGroup;
    const door = object.userData.doorGroup;
    const pickup = object.userData.pickupGroup;
    const loot = object.userData.lootGroup;
    const root = chest || door || pickup || loot;
    if (!root || root.userData.pickupData?.collected || root.userData.lootData?.collected || root.userData.chestData?.opened) return null;
    const playerPos = new THREE.Vector3(); camera.getWorldPosition(playerPos);
    if (playerPos.distanceTo(root.getWorldPosition(new THREE.Vector3())) > 7.7) return null;
    if (chest) return { type: 'chest', object: root };
    if (door) return { type: 'door', object: root };
    if (pickup) return { type: 'ammo', object: root, ammo: root.userData.pickupData.type, amount: root.userData.pickupData.amount };
    if (loot) return { type: 'loot', object: root, itemId: root.userData.lootData.itemId, rarity: root.userData.lootData.rarity, amount: root.userData.lootData.amount };
    return null;
  }
  function updateChests(delta) {
    for (const chest of chests) {
      const data = chest.userData.chestData;
      data.lidPivot.rotation.x = THREE.MathUtils.damp(data.lidPivot.rotation.x, data.targetRotation, 6.5, delta);
    }
    for (const door of registry.doors) {
      const data = door.userData.doorData;
      door.rotation.y = THREE.MathUtils.damp(door.rotation.y, data.targetRotation, 7.2, delta);
    }
    for (const pickup of registry.pickups) {
      if (!pickup.userData.pickupData.collected) pickup.position.y = heightAt(pickup.position.x, pickup.position.z) + .8 + Math.sin(performance.now() * .0018 + pickup.userData.pickupData.id) * .12;
    }
    for (const loot of registry.lootPickups) {
      if (!loot.userData.lootData.collected) {
        loot.position.y = heightAt(loot.position.x, loot.position.z) + .9 + Math.sin(performance.now() * .0022 + loot.userData.lootData.id) * .14;
        loot.rotation.y += delta * .9;
      }
    }
    for (let i = registry.shards.length - 1; i >= 0; i--) {
      const s = registry.shards[i]; s.age += delta;
      if (!s.grounded) {
        s.velocity.y -= 9.8 * delta;
        s.mesh.position.addScaledVector(s.velocity, delta);
        s.mesh.rotation.x += delta * s.spin; s.mesh.rotation.z += delta * s.spin * .65;
        const floor = heightAt(s.mesh.position.x, s.mesh.position.z) + .08;
        if (s.mesh.position.y <= floor) { s.mesh.position.y = floor; s.grounded = true; s.groundAge = 0; }
      } else {
        s.groundAge += delta; const scale = Math.max(.001, 1 - s.groundAge / 2.8); s.mesh.scale.setScalar(scale);
      }
      if (s.age > 6) { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); registry.shards.splice(i, 1); }
    }
  }
  function openChest(chest, sharedLoot = null) {
    if (!chest || chest.userData.chestData.opened) return null;
    const chestId = chest.userData.chestData.id;
    chest.userData.chestData.opened = true; chest.userData.chestData.targetRotation = -1.65;
    chest.traverse(o => { if (o.isPointLight) { o.intensity = .15; o.distance = 2; } });
    let lootRolls;
    if (Array.isArray(sharedLoot) && sharedLoot.length) {
      lootRolls = sharedLoot.slice(0, 2).map(item => ({
        itemId: String(item.itemId || 'pistol-ammo'),
        rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(item.rarity) ? item.rarity : 'common',
        amount: Math.max(1, Math.min(100, Math.round(Number(item.amount) || 1))),
        id: Number.isInteger(item.id) ? item.id : 10000 + chestId * 10
      }));
    } else {
      // The chest's deterministic seed means both online clients roll the same contents,
      // including when both players try to open the same chest nearly simultaneously.
      let seedValue = (0x9e3779b9 ^ Math.imul(chestId, 0x85ebca6b)) >>> 0;
      const chestRandom = () => {
        seedValue = (Math.imul(seedValue, 1664525) + 1013904223) >>> 0;
        return seedValue / 4294967296;
      };
      const first = rollChestLoot(chestRandom);
      const secondChance = chestRandom();
      lootRolls = secondChance < .38 ? [first, rollChestLoot(chestRandom)] : [first];
    }
    const spawned = [];
    lootRolls.forEach((loot, index) => {
      // Stable per-chest positions/IDs keep loot aligned on both online clients.
      const stableAngle = (((chestId * 137.5) + index * 181) % 360) * Math.PI / 180;
      const radius = index === 0 ? 1.8 : 1.35;
      const x = chest.position.x + Math.cos(stableAngle) * radius;
      const z = chest.position.z + Math.sin(stableAngle) * radius;
      const lootId = Number.isInteger(loot.id) ? loot.id : 10000 + chestId * 10 + index;
      const item = { itemId: loot.itemId, rarity: loot.rarity, amount: loot.amount || 1, id: lootId, x, z };
      const pickup = createLootPickup(THREE, scene, x, z, lootId, item);
      registry.lootPickups.push(pickup);
      spawned.push(item);
    });
    chest.userData.chestData.loot = spawned;
    return spawned;
  }
  function collectLoot(loot) {
    const data = loot?.userData?.lootData;
    if (!data || data.collected) return null;
    data.collected = true;
    loot.visible = false;
    return { itemId: data.itemId, rarity: data.rarity, amount: data.amount, id: data.id };
  }
  function toggleDoor(door) {
    if (!door?.userData.doorData) return false;
    const data = door.userData.doorData; data.open = !data.open; data.targetRotation = data.open ? -1.48 : 0; return data.open;
  }
  function setDoorStateAt(x, z, isOpen) {
    let best = null, bestDistance = Infinity;
    for (const door of registry.doors) {
      const data = door.userData.doorData;
      const distance = Math.hypot(data.x - x, data.z - z);
      if (distance < bestDistance) { best = door; bestDistance = distance; }
    }
    if (!best || bestDistance > 4) return false;
    best.userData.doorData.open = Boolean(isOpen);
    best.userData.doorData.targetRotation = isOpen ? -1.48 : 0;
    return true;
  }
  function collectLootById(id) {
    const item = registry.lootPickups.find(entry => entry.userData.lootData?.id === id);
    return item ? collectLoot(item) : null;
  }
  function collectPickupById(id) {
    const item = registry.pickups.find(entry => entry.userData.pickupData?.id === id);
    return item ? collectPickup(item) : null;
  }
  function collectPickup(pickup) {
    const data = pickup?.userData?.pickupData;
    if (!data || data.collected) return null;
    data.collected = true; pickup.visible = false;
    return { type: data.type, amount: data.amount, id: data.id };
  }
  function breakGlass(mesh, point, normal) {
    if (!mesh?.userData?.isGlass || mesh.userData.glassBroken) return false;
    mesh.userData.glassBroken = true; mesh.visible = false;
    const source = mesh.material;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const shardGeo = new THREE.TetrahedronGeometry(.12 + rand() * .12, 0);
      const shardMat = new THREE.MeshStandardMaterial({ color: source.color || '#7bb4c4', transparent: true, opacity: .8, metalness: .18, roughness: .18 });
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.copy(point).add(new THREE.Vector3(randRange(-.35, .35), randRange(-.25, .25), randRange(-.25, .25)));
      shard.rotation.set(rand() * 3, rand() * 3, rand() * 3); scene.add(shard);
      const dir = normal ? normal.clone() : new THREE.Vector3(0, 0, 1);
      const velocity = dir.multiplyScalar(randRange(1.2, 3.5)).add(new THREE.Vector3(randRange(-2, 2), randRange(1.5, 4), randRange(-2, 2)));
      registry.shards.push({ mesh: shard, velocity, age: 0, grounded: false, groundAge: 0, spin: randRange(1.5, 8) });
    }
    return true;
  }
  function breakGlassAt(x, y, z, normalValues = null) {
    const point = new THREE.Vector3(x, y, z);
    let nearest = null, bestDistance = Infinity;
    for (const pane of registry.windows) {
      if (!pane.visible || pane.userData.glassBroken) continue;
      pane.updateWorldMatrix(true, false);
      const panePos = pane.getWorldPosition(new THREE.Vector3());
      const distance = panePos.distanceTo(point);
      if (distance < bestDistance) { nearest = pane; bestDistance = distance; }
    }
    if (!nearest || bestDistance > 4.5) return false;
    const normal = Array.isArray(normalValues) && normalValues.length === 3
      ? new THREE.Vector3(Number(normalValues[0]) || 0, Number(normalValues[1]) || 0, Number(normalValues[2]) || 1)
      : new THREE.Vector3(0, 0, 1);
    return breakGlass(nearest, point, normal);
  }
  function collidesAt(x, z, radius = .7) {
    for (const obstacle of registry.obstacles) {
      if (Math.abs(x - obstacle.x) > radius + obstacle.radius || Math.abs(z - obstacle.z) > radius + obstacle.radius) continue;
      if (Math.hypot(x - obstacle.x, z - obstacle.z) < radius + obstacle.radius) return true;
    }
    for (const chest of chests) { if (!chest.userData.chestData.opened && Math.hypot(x - chest.position.x, z - chest.position.z) < radius + 1.25) return true; }
    for (const b of registry.buildings) {
      if (Math.abs(x - b.x) > b.w + radius || Math.abs(z - b.z) > b.d + radius) continue;
      const dx = x - b.x, dz = z - b.z;
      const lx = dx * Math.cos(b.angle) + dz * Math.sin(b.angle);
      const lz = -dx * Math.sin(b.angle) + dz * Math.cos(b.angle);
      if (Math.abs(lx) > b.w / 2 + radius || Math.abs(lz) > b.d / 2 + radius) continue;
      const nearSide = Math.abs(lx) > b.w / 2 - .55;
      const nearBack = lz < -b.d / 2 + .55;
      const nearFront = lz > b.d / 2 - .55;
      if (nearSide || nearBack) return true;
      if (nearFront) {
        const brokenWindow = registry.windows.some(pane => pane.userData.glassBroken && pane.userData.building === b.high && pane.userData.windowBounds && Math.abs(lx - pane.userData.windowBounds.x) < pane.userData.windowBounds.w / 2 + radius * .45 && pane.userData.windowBounds.y - pane.userData.windowBounds.h / 2 < 2.1 && pane.userData.windowBounds.y + pane.userData.windowBounds.h / 2 > .2);
        if (brokenWindow) continue;
        const door = registry.doors.find(d => d.userData.doorData.building === b.high);
        const doorOpen = door?.userData.doorData.open;
        if (Math.abs(lx - b.doorX) < b.doorW * .5 + radius * .45 && doorOpen) continue;
        return true;
      }
      // The interior stays traversable, so an opened door really leads inside.
    }
    return false;
  }
  function updateLOD(position) {
    for (const b of registry.buildings) {
      const d = Math.hypot(position.x - b.x, position.z - b.z);
      b.high.visible = d < 210; b.low.visible = d >= 210 && d < 620; b.far.visible = d >= 620 && d < 1320;
    }
    for (const chunk of terrainChunks) {
      const d = Math.hypot(position.x - chunk.x, position.z - chunk.z);
      chunk.high.visible = d < 255; chunk.low.visible = d >= 255 && d < 610; chunk.far.visible = d >= 610 && d < 1270;
    }
  }
  function getShootTargets() { return registry.shootTargets.filter(m => m.visible && !m.userData.glassBroken); }
  function setWaypoints(markers) {
    while (waypointGroup.children.length) {
      const child = waypointGroup.children[0];
      waypointGroup.remove(child);
      child.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } });
    }
    for (const marker of markers) {
      const x = (marker.u - .5) * MAP_SIZE, z = (marker.v - .5) * MAP_SIZE, y = heightAt(x, z);
      const group = new THREE.Group(); group.position.set(x, Math.max(0, y), z);
      const red = new THREE.MeshBasicMaterial({ color: '#ff2424' });
      const glow = new THREE.MeshBasicMaterial({ color: '#ff2222', transparent: true, opacity: .28, side: THREE.DoubleSide });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12), red); sphere.position.y = 5; group.add(sphere);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.22, .6, 11, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ff2727', transparent: true, opacity: .8 })); beam.position.y = 8.2; group.add(beam);
      const groundRing = new THREE.Mesh(new THREE.TorusGeometry(4, .24, 8, 28), red); groundRing.rotation.x = Math.PI / 2; groundRing.position.y = .35; group.add(groundRing);
      const aura = new THREE.Mesh(new THREE.CircleGeometry(6, 28), glow); aura.rotation.x = -Math.PI / 2; aura.position.y = .18; group.add(aura);
      waypointGroup.add(group);
    }
  }
  function locationNameAt(x, z) {
    let nearest = null, distance = Infinity;
    for (const loc of LOCATIONS) { const d = dist2(x, z, loc.x, loc.z); if (d < distance) { distance = d; nearest = loc; } }
    return distance < 90 ? nearest.name.toUpperCase() : 'WILDE INSEL';
  }
  return { terrain, terrainChunks, ocean, chests, doors: registry.doors, pickups: registry.pickups, lootPickups: registry.lootPickups, applyTextures, findFocusedChest, findFocusedInteractable, updateChests, openChest, collectLoot, collectLootById, toggleDoor, setDoorStateAt, collectPickup, collectPickupById, breakGlass, breakGlassAt, getShootTargets, collidesAt, updateLOD, setWaypoints, heightAt, locationNameAt, locations: LOCATIONS };
}
