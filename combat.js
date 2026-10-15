import * as THREE from 'three';

// All weapon geometry is created once and kept in memory. No external weapon asset is required.
const lerp = THREE.MathUtils.lerp;

function box(parent, size, position, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, radiusTop, radiusBottom, length, position, material, rotation = [Math.PI / 2, 0, 0], sides = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, sides), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function createShotgun(THREE) {
  const g = new THREE.Group();
  g.name = 'custom-pump-shotgun';
  g.position.set(.24, -.265, -.78);
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#27323b', metalness: .83, roughness: .29 });
  const edgeMetal = new THREE.MeshStandardMaterial({ color: '#89949a', metalness: .9, roughness: .24 });
  const polymer = new THREE.MeshStandardMaterial({ color: '#252a2e', roughness: .62 });
  const wood = new THREE.MeshStandardMaterial({ color: '#6d482b', roughness: .72 });
  box(g, [.17, .16, .39], [0, 0, -.11], darkMetal);
  box(g, [.13, .14, .40], [0, -.015, -.45], darkMetal);
  cylinder(g, .047, .047, .84, [0, .015, -.58], edgeMetal, [Math.PI / 2, 0, 0], 14);
  box(g, [.135, .13, .22], [0, .005, -.24], polymer);
  box(g, [.13, .16, .28], [0, -.14, .22], wood, [-.22, 0, 0]);
  box(g, [.13, .20, .15], [0, -.19, -.04], polymer, [-.18, 0, 0]);
  const pump = new THREE.Group(); pump.position.set(0, -.01, -.57); g.add(pump);
  box(pump, [.20, .115, .25], [0, 0, 0], wood);
  for (let i = 0; i < 5; i++) box(pump, [.21, .012, .018], [0, -.043 + i * .021, -.09], polymer);
  // Iron sights: two rear posts and a front bead along the same sight line.
  box(g, [.022, .07, .025], [-.045, .105, -.11], edgeMetal);
  box(g, [.022, .07, .025], [.045, .105, -.11], edgeMetal);
  cylinder(g, .018, .018, .06, [0, .087, -.94], new THREE.MeshStandardMaterial({ color: '#e8c878', metalness: .7, roughness: .25 }), [0, 0, 0], 8);
  // Hinged loading gate that opens during the five-shell reload animation.
  const gate = new THREE.Group(); gate.position.set(0, .095, -.16); g.add(gate);
  box(gate, [.15, .018, .17], [0, .006, .035], edgeMetal);
  const cartridgeClip = new THREE.Group(); cartridgeClip.name = 'temporary-five-shell-strip'; cartridgeClip.visible = false; g.add(cartridgeClip);
  const brass = new THREE.MeshStandardMaterial({ color: '#c99843', metalness: .82, roughness: .23 });
  const shell = new THREE.MeshStandardMaterial({ color: '#a63c2d', roughness: .45 });
  for (let i = 0; i < 5; i++) {
    const z = -.14 - i * .065;
    cylinder(cartridgeClip, .027, .027, .12, [0, .17, z], brass, [Math.PI / 2, 0, 0], 10);
    cylinder(cartridgeClip, .031, .031, .075, [0, .17, z - .015], shell, [Math.PI / 2, 0, 0], 10);
  }
  return { group: g, pump, gate, cartridgeClip, base: g.position.clone() };
}

function createPistol(THREE) {
  const g = new THREE.Group();
  g.name = 'custom-semi-auto-pistol';
  g.position.set(.24, -.27, -.68);
  const slideMetal = new THREE.MeshStandardMaterial({ color: '#3a454c', metalness: .86, roughness: .24 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#202a30', metalness: .37, roughness: .51 });
  const gripMat = new THREE.MeshStandardMaterial({ color: '#323438', roughness: .84 });
  const slide = new THREE.Group(); slide.position.set(0, .075, -.12); g.add(slide);
  box(slide, [.145, .105, .38], [0, 0, -.02], slideMetal);
  box(slide, [.11, .11, .10], [0, -.003, -.255], slideMetal);
  for (let i = 0; i < 5; i++) box(slide, [.15, .008, .018], [0, .038, .055 + i * .039], frameMat);
  cylinder(slide, .025, .025, .20, [0, -.003, -.25], slideMetal, [Math.PI / 2, 0, 0], 10);
  box(g, [.16, .10, .25], [0, -.03, -.06], frameMat);
  box(g, [.12, .23, .14], [0, -.18, .055], gripMat, [-.22, 0, 0]);
  box(g, [.02, .04, .065], [0, -.12, -.14], slideMetal);
  // Front and rear sights.
  box(slide, [.022, .027, .025], [-.05, .065, -.12], slideMetal);
  box(slide, [.022, .027, .025], [.05, .065, -.12], slideMetal);
  const magazine = new THREE.Group(); magazine.position.set(0, -.24, .07); g.add(magazine);
  box(magazine, [.095, .20, .105], [0, 0, 0], slideMetal);
  box(magazine, [.098, .14, .015], [0, -.01, .055], gripMat);
  const ejectionPort = box(slide, [.06, .026, .08], [.076, .009, -.01], new THREE.MeshStandardMaterial({ color: '#0c1419', metalness: .2, roughness: .7 }));
  return { group: g, slide, magazine, ejectionPort, base: g.position.clone(), slideBase: slide.position.clone() };
}

function createSyringe(THREE) {
  const g = new THREE.Group(); g.name = 'healing-syringe'; g.position.set(.27, -.29, -.72); g.rotation.set(.05, -.16, -.36);
  const body = new THREE.MeshStandardMaterial({ color: '#d9e6eb', roughness: .32, metalness: .05, transparent: true, opacity: .86 });
  const liquid = new THREE.MeshStandardMaterial({ color: '#35d4a6', emissive: '#0c6c50', emissiveIntensity: .42, roughness: .35 });
  const metal = new THREE.MeshStandardMaterial({ color: '#cfd6d8', metalness: .94, roughness: .16 });
  cylinder(g, .045, .045, .39, [0, 0, -.05], body, [Math.PI / 2, 0, 0], 12);
  cylinder(g, .031, .031, .22, [0, 0, -.05], liquid, [Math.PI / 2, 0, 0], 12);
  cylinder(g, .012, .012, .19, [0, 0, -.31], metal, [Math.PI / 2, 0, 0], 8);
  box(g, [.11, .018, .05], [0, .055, .15], metal);
  box(g, [.09, .018, .06], [0, -.055, .15], metal);
  const plunger = box(g, [.06, .06, .08], [0, 0, .19], metal);
  // Small grip wings help it look held rather than floating by itself.
  box(g, [.14, .025, .045], [0, -.06, -.08], body);
  return { group: g, plunger, base: g.position.clone() };
}

export function createCombatSystem(THREE, camera, scene, { onEvent = () => {} } = {}) {
  const root = new THREE.Group(); root.name = 'first-person-combat-and-items'; camera.add(root); root.visible = false;
  const shotgun = createShotgun(THREE), pistol = createPistol(THREE), syringe = createSyringe(THREE);
  root.add(shotgun.group, pistol.group, syringe.group);
  const inventory = [
    { slot: 1, id: 'pickaxe', label: 'SPITZHACKE', icon: '✦', count: '∞' },
    { slot: 2, id: 'shotgun', label: 'PUMP-SCHROTFLINTE', icon: '▰', count: '5 / 25' },
    { slot: 3, id: 'pistol', label: 'SICHERHEITS-PISTOLE', icon: '⌁', count: '10 / 60' },
    { slot: 4, id: 'healing', label: 'HEALING', icon: '✚', count: '3' },
    { slot: 5, id: 'utility', label: 'FREI', icon: '□', count: '' }
  ];
  let slot = 1, enabled = false, aiming = false;
  let shotgunAmmo = 0, shotgunReserve = 0, pistolAmmo = 0, pistolReserve = 0, healingCount = 0;
  let shotgunOwned = false, pistolOwned = false;
  let shotgunRarity = 'common', pistolRarity = 'common';
  let recoil = 0, flashTime = 0, reload = null, healAnimation = null, pumpTime = 0, shotCooldown = 0;
  let casings = [], effects = [], droppedMagazines = [];
  let muzzleFlash = null;
  const flashMat = new THREE.MeshBasicMaterial({ color: '#fff0b0', transparent: true, opacity: .95 });
  muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(.075, 8, 6), flashMat); muzzleFlash.name = 'muzzle-flash-effect'; muzzleFlash.visible = false; scene.add(muzzleFlash);

  function refreshItemVisibility() {
    shotgun.group.visible = enabled && slot === 2;
    pistol.group.visible = enabled && slot === 3;
    syringe.group.visible = enabled && slot === 4 && healingCount > 0;
  }
  function cancelReload() {
    if (!reload) return;
    if (reload.weapon === 'shotgun') { shotgun.gate.rotation.x = 0; shotgun.cartridgeClip.visible = false; shotgun.cartridgeClip.position.set(0, 0, 0); }
    if (reload.weapon === 'pistol') { pistol.magazine.visible = true; pistol.slide.position.z = pistol.slideBase.z + (pistolAmmo === 0 ? .075 : 0); }
    reload = null;
  }
  function setSlot(next) {
    const newSlot = Math.max(1, Math.min(5, Number(next) || 1));
    if (newSlot === 2 && !shotgunOwned) return slot;
    if (newSlot === 3 && !pistolOwned) return slot;
    if (newSlot === 4 && healingCount <= 0) return slot;
    if (newSlot !== slot && reload) cancelReload();
    slot = newSlot; aiming = false;
    refreshItemVisibility();
    return slot;
  }
  function setEnabled(value) { enabled = !!value; root.visible = enabled; refreshItemVisibility(); if (!enabled) aiming = false; }
  function getSlot() { return slot; }
  function getActiveItem() { return inventory[slot - 1]?.id || 'pickaxe'; }
  function isOwned(item) { return item === 'shotgun' ? shotgunOwned : item === 'pistol' ? pistolOwned : item === 'healing' ? healingCount > 0 : true; }
  function setAiming(value) { aiming = !!value && enabled && (slot === 2 || slot === 3) && !reload; }
  function isAiming() { return aiming; }
  function getStatus() {
    return { slot, active: getActiveItem(), shotgunAmmo, shotgunReserve, pistolAmmo, pistolReserve, healingCount, aiming, reloading: !!reload, reloadWeapon: reload?.weapon || null, reloadProgress: reload ? Math.min(1, reload.elapsed / reload.duration) : 0, shotgunOwned, pistolOwned, shotgunRarity, pistolRarity };
  }
  function addAmmo(type, amount = 5) {
    if (type === 'shotgun') shotgunReserve = Math.min(60, shotgunReserve + amount);
    if (type === 'pistol') pistolReserve = Math.min(180, pistolReserve + amount);
    onEvent('inventory-change', getStatus());
  }
  function addLoot(itemId, rarity = 'common', amount = 1) {
    const order = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
    if (itemId === 'shotgun') {
      const upgraded = order[rarity] > order[shotgunRarity];
      shotgunOwned = true; if (upgraded) shotgunRarity = rarity;
      if (shotgunAmmo <= 0) shotgunAmmo = 5;
      if (shotgunReserve <= 0) shotgunReserve = 10;
    } else if (itemId === 'pistol') {
      const upgraded = order[rarity] > order[pistolRarity];
      pistolOwned = true; if (upgraded) pistolRarity = rarity;
      if (pistolAmmo <= 0) pistolAmmo = 10;
      if (pistolReserve <= 0) pistolReserve = 30;
    } else if (itemId === 'healing') {
      healingCount = Math.min(3, healingCount + Math.max(1, amount));
    } else if (itemId === 'shotgun-ammo') addAmmo('shotgun', amount);
    else if (itemId === 'pistol-ammo') addAmmo('pistol', amount);
    onEvent('loot-collected', { itemId, rarity, amount, status: getStatus() });
    onEvent('inventory-change', getStatus());
    return true;
  }
  function fire(aimHit = null) {
    if (!enabled || reload || healAnimation || shotCooldown > 0) return null;
    if (slot !== 2 && slot !== 3) return null;
    if (slot === 2 && !shotgunOwned || slot === 3 && !pistolOwned) return null;
    const isShotgun = slot === 2;
    if (isShotgun && shotgunAmmo <= 0 || !isShotgun && pistolAmmo <= 0) { startReload(); return null; }
    if (isShotgun) { shotgunAmmo--; recoil = 1; pumpTime = .36; shotCooldown = .26; }
    else { pistolAmmo--; recoil = 1; shotCooldown = .20; }
    flashTime = .055;
    const muzzleObject = isShotgun ? shotgun.group : pistol.group;
    muzzleObject.updateWorldMatrix(true, false);
    const muzzle = muzzleObject.localToWorld(new THREE.Vector3(0, .02, isShotgun ? -.99 : -.43));
    muzzleFlash.position.copy(muzzle); muzzleFlash.visible = true;
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const casingCount = isShotgun ? 1 : 1;
    for (let i = 0; i < casingCount; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, isShotgun ? .09 : .065, 8), new THREE.MeshStandardMaterial({ color: '#c59a42', metalness: .82, roughness: .28 }));
      c.position.copy(muzzle).addScaledVector(right, .12).addScaledVector(up, -.02); c.rotation.set(Math.random() * 4, 0, Math.random() * 4); scene.add(c);
      casings.push({ mesh: c, velocity: right.clone().multiplyScalar(2.2 + Math.random()).addScaledVector(up, 1.5 + Math.random()).addScaledVector(dir, .4), life: 2.2, spin: 8 + Math.random() * 10 });
    }
    const rarityMultiplier = isShotgun ? ({ common: 1, uncommon: 1.08, rare: 1.16, epic: 1.25, legendary: 1.35 }[shotgunRarity] || 1) : ({ common: 1, uncommon: 1.05, rare: 1.1, epic: 1.16, legendary: 1.22 }[pistolRarity] || 1);
    onEvent('shot', { weapon: isShotgun ? 'shotgun' : 'pistol', damage: (isShotgun ? 16 : 24) * rarityMultiplier, range: isShotgun ? 30 : 180, pellets: isShotgun ? 5 : 1, aimed: aiming, hit: aimHit, ammo: getStatus(), rarity: isShotgun ? shotgunRarity : pistolRarity });
    onEvent('inventory-change', getStatus());
    return { weapon: isShotgun ? 'shotgun' : 'pistol', damage: isShotgun ? 16 : 24, range: isShotgun ? 30 : 180, pellets: isShotgun ? 5 : 1, aimed: aiming };
  }
  function startReload() {
    if (!enabled || reload || healAnimation) return false;
    if (slot === 2) {
      const need = 5 - shotgunAmmo;
      if (need <= 0 || shotgunReserve <= 0) return false;
      reload = { weapon: 'shotgun', elapsed: 0, duration: Math.max(1, Math.min(need, shotgunReserve)), need, startingAmmo: shotgunAmmo, shellsLoaded: 0 };
      shotgun.gate.rotation.x = 0; shotgun.cartridgeClip.visible = true; shotgun.cartridgeClip.position.set(-.35, -.03, -.15); aiming = false;
      onEvent('reload-start', { weapon: 'shotgun' }); return true;
    }
    if (slot === 3) {
      if (!pistolOwned || pistolAmmo >= 10 || pistolReserve <= 0) return false;
      reload = { weapon: 'pistol', elapsed: 0, duration: 1.55, need: 10 - pistolAmmo, startedDrop: false }; aiming = false;
      onEvent('reload-start', { weapon: 'pistol' }); return true;
    }
    return false;
  }
  function useHealing() {
    if (!enabled || slot !== 4 || healingCount <= 0 || healAnimation || reload) return false;
    healingCount--; healAnimation = { elapsed: 0, duration: .95 };
    syringe.group.visible = true; syringe.group.position.copy(syringe.base); syringe.group.scale.setScalar(1);
    onEvent('heal-start', { remaining: healingCount }); onEvent('inventory-change', getStatus());
    return true;
  }
  function update(dt) {
    shotCooldown = Math.max(0, shotCooldown - dt);
    recoil = Math.max(0, recoil - dt * 4.8);
    flashTime = Math.max(0, flashTime - dt); muzzleFlash.visible = flashTime > 0;
    const gun = slot === 2 ? shotgun : pistol;
    if (enabled && slot === 2) {
      shotgun.group.position.x = lerp(shotgun.base.x, aiming ? .04 : .24, .24);
      shotgun.group.position.y = lerp(shotgun.base.y, aiming ? -.19 : -.265, .24);
      shotgun.group.position.z = lerp(shotgun.base.z + recoil * .12, aiming ? -.96 : -.78, .24);
      shotgun.group.rotation.x = recoil * -.05;
      if (pumpTime > 0) {
        pumpTime = Math.max(0, pumpTime - dt);
        const phase = 1 - pumpTime / .33;
        shotgun.pump.position.z = -.57 + Math.sin(Math.min(1, phase) * Math.PI) * .105;
      } else shotgun.pump.position.z = -.57;
    }
    if (enabled && slot === 3) {
      pistol.group.position.x = lerp(pistol.base.x, aiming ? .04 : .24, .24);
      pistol.group.position.y = lerp(pistol.base.y, aiming ? -.19 : -.27, .24);
      pistol.group.position.z = lerp(pistol.base.z + recoil * .095, aiming ? -.81 : -.68, .24);
      pistol.group.rotation.x = recoil * -.07;
      const slideBack = recoil > .72 || (pistolAmmo === 0 && !reload) ? .075 : recoil * .042;
      pistol.slide.position.z = pistol.slideBase.z + slideBack;
    }
    if (enabled && slot === 4 && healAnimation) {
      healAnimation.elapsed += dt;
      const t = Math.min(1, healAnimation.elapsed / healAnimation.duration);
      const dip = t < .35 ? t / .35 : 1 - (t - .35) / .65;
      syringe.group.position.z = syringe.base.z + .23 * dip;
      syringe.group.position.y = syringe.base.y - .08 * Math.sin(t * Math.PI);
      syringe.group.rotation.x = .05 - .52 * Math.sin(t * Math.PI);
      syringe.group.scale.setScalar(t > .78 ? Math.max(.001, 1 - (t - .78) / .22) : 1);
      if (t >= 1) { healAnimation = null; syringe.group.scale.setScalar(1); refreshItemVisibility(); onEvent('heal-complete', { remaining: healingCount }); }
    }
    if (reload) {
      reload.elapsed += dt;
      const t = Math.min(1, reload.elapsed / reload.duration);
      if (reload.weapon === 'shotgun') {
        // One shell per second: open the gate, present a five-shell strip, then feed
        // the shells one by one. The strip is a temporary visual prop and is deleted
        // as soon as the gate closes.
        const shellProgress = Math.min(reload.need, Math.floor(reload.elapsed));
        reload.shellsLoaded = shellProgress;
        const gateOpen = reload.elapsed < .18 || reload.elapsed < reload.duration - .18;
        if (reload.elapsed < .18) shotgun.gate.rotation.x = -.95 * (reload.elapsed / .18);
        else if (reload.elapsed < reload.duration - .18) shotgun.gate.rotation.x = -.95;
        else shotgun.gate.rotation.x = -.95 * (1 - (reload.elapsed - (reload.duration - .18)) / .18);
        shotgun.cartridgeClip.visible = reload.elapsed < reload.duration - .18;
        const visibleShells = Math.max(0, reload.need - shellProgress);
        shotgun.cartridgeClip.children.forEach((child, index) => {
          const shellIndex = Math.floor(index / 2);
          child.visible = shellIndex < visibleShells;
        });
        const insertPhase = Math.min(1, Math.max(0, (reload.elapsed - .18) / Math.max(.001, reload.duration - .36)));
        shotgun.cartridgeClip.position.set(.04, .03 + .08 * Math.sin(insertPhase * Math.PI), -.28 - .16 * insertPhase);
      } else if (reload.weapon === 'pistol') {
        if (!reload.startedDrop && t > .18) {
          reload.startedDrop = true; pistol.magazine.visible = false;
          camera.updateWorldMatrix(true, false);
          const wp = pistol.group.localToWorld(new THREE.Vector3(0, -.24, .07));
          const dropped = new THREE.Group();
          box(dropped, [.095, .20, .105], [0, 0, 0], new THREE.MeshStandardMaterial({ color: '#343d43', metalness: .72, roughness: .35 }));
          dropped.position.copy(wp); scene.add(dropped); droppedMagazines.push({ mesh: dropped, elapsed: 0, velocity: new THREE.Vector3(.05, -.3, .08) });
        }
      }
      if (t >= 1) {
        if (reload.weapon === 'shotgun') {
          const load = Math.min(5 - shotgunAmmo, shotgunReserve);
          shotgunAmmo += load; shotgunReserve -= load;
          shotgun.gate.rotation.x = 0; shotgun.cartridgeClip.visible = false; shotgun.cartridgeClip.position.set(0, 0, 0);
        } else {
          const load = Math.min(10 - pistolAmmo, pistolReserve);
          pistolAmmo += load; pistolReserve -= load; pistol.magazine.visible = true; pistol.slide.position.z = pistol.slideBase.z;
        }
        const done = reload.weapon; reload = null; onEvent('reload-complete', { weapon: done, ammo: getStatus() }); onEvent('inventory-change', getStatus());
      }
    }
    for (let i = casings.length - 1; i >= 0; i--) {
      const c = casings[i]; c.life -= dt; c.velocity.y -= 7.8 * dt; c.mesh.position.addScaledVector(c.velocity, dt); c.mesh.rotation.x += dt * c.spin; c.mesh.rotation.z += dt * c.spin * .62;
      if (c.mesh.position.y < 0) { c.mesh.position.y = 0; c.velocity.y *= -.18; c.velocity.x *= .72; c.velocity.z *= .72; }
      if (c.life <= 0) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); casings.splice(i, 1); }
    }
    for (let i = droppedMagazines.length - 1; i >= 0; i--) {
      const d = droppedMagazines[i]; d.elapsed += dt; d.mesh.position.addScaledVector(d.velocity, dt); d.velocity.y -= 5.5 * dt; d.mesh.rotation.x += dt * 2; const scale = Math.max(0, 1 - d.elapsed / .48); d.mesh.scale.setScalar(scale);
      if (d.elapsed > .48) { scene.remove(d.mesh); d.mesh.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); }); droppedMagazines.splice(i, 1); }
    }
    if (enabled && slot === 1) { /* pickaxe is rendered by the shared hand rig */ }
  }
  refreshItemVisibility();
  return { setSlot, getSlot, getActiveItem, isOwned, setEnabled, setAiming, isAiming, getStatus, addAmmo, addLoot, fire, startReload, useHealing, update };
}
