import * as THREE from 'three';

function box(parent, w, h, d, material, x, y, z, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}

export function createAircraft(THREE, scene, materials) {
  const group = new THREE.Group(); group.name = 'military-transport-aircraft'; scene.add(group);
  const metal = new THREE.MeshStandardMaterial({ color: '#65737a', metalness: .64, roughness: .48, map: materials.metal });
  const inner = new THREE.MeshStandardMaterial({ color: '#4b5963', metalness: .34, roughness: .76 });
  const floor = new THREE.MeshStandardMaterial({ color: '#343d43', metalness: .38, roughness: .9 });
  const rib = new THREE.MeshStandardMaterial({ color: '#859096', metalness: .65, roughness: .5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#18242b', metalness: .5, roughness: .72 });
  const warning = new THREE.MeshStandardMaterial({ color: '#e3aa24', metalness: .32, roughness: .5 });
  const redLight = new THREE.MeshStandardMaterial({ color: '#ff423b', emissive: '#ff170f', emissiveIntensity: 2.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#182f3a', metalness: .45, roughness: .2, emissive: '#10232b', emissiveIntensity: .35 });

  // Cabin floor, ceiling ribs, side walls and the open rear loading door.
  box(group, 6.8, .42, 18.6, floor, 0, -.22, -.2);
  box(group, 6.65, .28, 18.5, dark, 0, 3.52, -.2, false);
  box(group, .25, 3.8, 18.4, inner, -3.28, 1.55, -.1);
  box(group, .25, 3.8, 18.4, inner, 3.28, 1.55, -.1);
  box(group, 6.55, 3.6, .3, inner, 0, 1.55, -9.45);
  // Front cockpit bulkhead and a narrow reinforced viewport.
  box(group, 2.7, 1.1, .22, dark, 0, 2.15, -9.25);
  box(group, 1.9, .63, .09, glass, 0, 2.17, -9.1, false);
  for (let z = -8; z <= 6.5; z += 2.3) {
    const arch = new THREE.Group(); arch.position.z = z; group.add(arch);
    box(arch, .18, 3.35, .22, rib, -3.05, 1.45, 0);
    box(arch, .18, 3.35, .22, rib, 3.05, 1.45, 0);
    box(arch, 6.1, .17, .22, rib, 0, 3.1, 0);
    box(arch, 6.1, .12, .18, dark, 0, .15, 0);
  }
  // Small windows allow sky light but don't cover the open loading area.
  for (const side of [-1, 1]) {
    for (let z = -6.8; z <= 3; z += 3.1) {
      const win = box(group, .045, .8, 1.55, glass, side * 3.145, 2.15, z, false);
      const trim = box(group, .08, .95, 1.7, rib, side * 3.13, 2.15, z, false); trim.material = rib;
      // Keep a dark inset layer in front of the brighter metal trim.
      win.position.x = side * 3.09;
    }
  }
  // Benches and restraint frames along both sides.
  for (const side of [-1, 1]) {
    box(group, 1.0, .35, 7.8, dark, side * 2.22, .72, -.35);
    box(group, .88, 1.15, .35, inner, side * 2.28, 1.38, -3.9);
    for (let z = -3.2; z <= 3.4; z += 1.3) {
      box(group, .08, 1.25, .08, warning, side * 2.55, 1.65, z, false);
    }
  }
  // Tail ramp is lowered. The rear aperture is deliberately left open.
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(6.3, .28, 4.2), floor); ramp.position.set(0, -1.05, 9.4); ramp.rotation.x = -.31; ramp.castShadow = true; group.add(ramp);
  for (const x of [-3, 3]) box(group, .22, 2.1, .3, rib, x, .55, 8.2);
  box(group, 6.7, .16, .45, warning, 0, .04, 6.7, false);
  // Exterior wing and tail silhouettes sit outside the view and identify the vehicle as an aircraft.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(25, .32, 4.4), metal); wing.position.set(0, 1.0, -1.2); wing.castShadow = true; group.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(9.4, .25, 2.6), metal); tail.position.set(0, 1.3, 9.3); group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(.5, 3.1, 3.8), metal); fin.position.set(0, 2.65, 9.1); group.add(fin);
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(.85, 1.05, 4.1, 16), dark); engine.rotation.z = Math.PI / 2; engine.position.set(side * 7.7, .25, -2); group.add(engine);
    const engineRing = new THREE.Mesh(new THREE.TorusGeometry(.85, .1, 8, 20), rib); engineRing.rotation.y = Math.PI / 2; engineRing.position.set(side * 9.72, .25, -2); group.add(engineRing);
  }
  // Low red cargo lights and blinking-style red lamps inside the hold.
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), redLight); lamp.position.set(side * 2.85, 2.95, 5.8); group.add(lamp);
    const light = new THREE.PointLight('#ff251f', 1.6, 13); light.position.copy(lamp.position); group.add(light);
    box(group, .18, .45, .7, warning, side * 3.12, .35, -8.1, false);
  }
  // Pickaxe held on a bracket on the aircraft wall, visible during the take animation.
  const pickaxe = new THREE.Group(); pickaxe.name = 'wall-mounted-pickaxe'; pickaxe.position.set(-2.87, 1.65, 1.4); pickaxe.rotation.y = -Math.PI / 2; group.add(pickaxe);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 1.55, 8), new THREE.MeshStandardMaterial({ color: '#8c5b35', roughness: .72 })); handle.rotation.z = -.24; pickaxe.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.05, .19, .24), new THREE.MeshStandardMaterial({ color: '#aebac0', metalness: .86, roughness: .22 })); head.position.set(.05, .62, 0); head.rotation.z = -.24; pickaxe.add(head);
  const point = new THREE.Mesh(new THREE.ConeGeometry(.17, .48, 5), head.material); point.rotation.z = Math.PI / 2; point.position.set(.59, .62, 0); pickaxe.add(point);
  const mount = box(group, .12, .26, .45, warning, -3.06, 1.68, 1.4, false); mount.material = warning;

  // A broad curved flight path, diagonally across the island. Local -Z is aircraft-forward.
  const path = [
    new THREE.Vector3(-360, 142, 300), new THREE.Vector3(-250, 150, 100),
    new THREE.Vector3(-70, 148, -90), new THREE.Vector3(120, 151, -260),
    new THREE.Vector3(290, 145, -330), new THREE.Vector3(410, 143, -210),
    new THREE.Vector3(440, 141, -20), new THREE.Vector3(375, 144, 170),
    new THREE.Vector3(180, 142, 330), new THREE.Vector3(-70, 140, 350),
    new THREE.Vector3(-285, 141, 235)
  ];
  const curve = new THREE.CatmullRomCurve3(path, true);
  function update(timeSeconds) {
    const t = (timeSeconds * .018) % 1;
    const position = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    group.position.copy(position);
    group.rotation.set(0, Math.atan2(-tangent.x, -tangent.z), 0);
    group.rotation.z = Math.sin(timeSeconds * 1.15) * .009;
    return { t, position, tangent };
  }
  update(0);
  return { group, pickaxe, update };
}
