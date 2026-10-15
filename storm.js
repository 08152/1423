import * as THREE from 'three';

export function createStorm(THREE, scene, { onDamage = () => {}, onPhase = () => {} } = {}) {
  const center = new THREE.Vector2(0, 0);
  const phases = [
    { wait: 42, duration: 46, radius: 450 },
    { wait: 20, duration: 42, radius: 350 },
    { wait: 18, duration: 38, radius: 260 },
    { wait: 16, duration: 34, radius: 185 },
    { wait: 14, duration: 30, radius: 120 },
    { wait: 12, duration: 26, radius: 68 }
  ];
  let elapsed = 0, phaseIndex = 0, radius = 535, phaseElapsed = 0, waitElapsed = 0, damageTimer = 0, active = false, shrinking = false;
  const wallMaterial = new THREE.MeshBasicMaterial({ color: '#63c8ff', transparent: true, opacity: .075, side: THREE.DoubleSide, depthWrite: false });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 190, 96, 1, true), wallMaterial); wall.position.set(0, 80, 0); wall.visible = false; scene.add(wall);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .006, 6, 160), new THREE.MeshBasicMaterial({ color: '#66cbff', transparent: true, opacity: .92 })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.1; ring.visible = false; scene.add(ring);
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1, .003, 5, 160), new THREE.MeshBasicMaterial({ color: '#d7f5ff', transparent: true, opacity: .9 })); innerRing.rotation.x = Math.PI / 2; innerRing.position.y = 1.2; innerRing.visible = false; scene.add(innerRing);

  function setRadius(value) {
    radius = Math.max(46, value);
    wall.scale.set(radius, 1, radius); ring.scale.set(radius, radius, 1); innerRing.scale.set(radius, radius, 1);
  }
  setRadius(radius);
  function update(dt, playerPosition, phaseLabel) {
    elapsed += dt;
    if (!active) {
      if (elapsed >= phases[0].wait) {
        active = true; shrinking = true; phaseIndex = 0; phaseElapsed = 0;
        wall.visible = ring.visible = innerRing.visible = true;
        onPhase(1, radius);
      }
    } else if (shrinking && phaseIndex < phases.length) {
      const phase = phases[phaseIndex];
      phaseElapsed += dt;
      const previousRadius = phaseIndex === 0 ? 535 : phases[phaseIndex - 1].radius;
      const p = THREE.MathUtils.clamp(phaseElapsed / phase.duration, 0, 1);
      setRadius(THREE.MathUtils.lerp(previousRadius, phase.radius, p));
      if (p >= 1) {
        setRadius(phase.radius);
        phaseIndex++;
        phaseElapsed = 0; waitElapsed = 0; shrinking = false;
        if (phaseIndex >= phases.length) onPhase('FINAL', radius);
      }
    } else if (active && !shrinking && phaseIndex < phases.length) {
      waitElapsed += dt;
      if (waitElapsed >= phases[phaseIndex].wait) {
        shrinking = true; phaseElapsed = 0;
        onPhase(phaseIndex + 1, phases[phaseIndex].radius);
      }
    }
    if (active) {
      // A thin animated boundary stays visible without forming a huge solid ring.
      const pulse = .84 + Math.sin(elapsed * 3.2) * .12;
      ring.material.opacity = pulse; innerRing.material.opacity = .78 + Math.sin(elapsed * 2.3) * .16;
      if (playerPosition && Math.hypot(playerPosition.x - center.x, playerPosition.z - center.y) > radius) {
        damageTimer += dt;
        if (damageTimer >= 2.25) { damageTimer = 0; onDamage(5); }
      } else damageTimer = 0;
    }
    return { active, radius, phase: active ? Math.min(phaseIndex + 1, phases.length) : 0, elapsed, outside: playerPosition ? Math.hypot(playerPosition.x - center.x, playerPosition.z - center.y) > radius : false };
  }
  return { update, getRadius: () => radius, getActive: () => active, setCenter(x, z) { center.set(x, z); wall.position.x = x; wall.position.z = z; ring.position.x = x; ring.position.z = z; innerRing.position.x = x; innerRing.position.z = z; } };
}
