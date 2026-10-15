import * as THREE from 'three';

function makeFinger(THREE, parent, x, y, z, length, radius, mat, bend = 0) {
  const finger = new THREE.Group(); finger.position.set(x, y, z); finger.rotation.z = bend; parent.add(finger);
  const segment1 = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length * .45, 3, 6), mat); segment1.position.y = length * .25; finger.add(segment1);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * .92, 8, 7), mat); joint.position.y = length * .48; finger.add(joint);
  const segment2 = new THREE.Mesh(new THREE.CapsuleGeometry(radius * .78, length * .32, 3, 6), mat); segment2.position.y = length * .68; finger.add(segment2);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(radius * .77, 8, 7), mat); tip.position.y = length * .88; finger.add(tip);
  const nail = new THREE.Mesh(new THREE.SphereGeometry(radius * .42, 7, 5), new THREE.MeshStandardMaterial({ color: '#d7b9a6', roughness: .52 })); nail.scale.set(1, .55, .45); nail.position.set(0, length * .92, -radius * .48); finger.add(nail);
  return finger;
}
function createDetailedHand(THREE, side) {
  const root = new THREE.Group(); root.name = side === 'left' ? 'left-first-person-hand' : 'right-first-person-hand';
  root.position.set(side === 'left' ? -.34 : .34, -.39, -.78);
  root.rotation.z = side === 'left' ? -.22 : .22;
  root.rotation.x = -.1;
  const skin = new THREE.MeshStandardMaterial({ color: '#c89676', roughness: .65 });
  const shade = new THREE.MeshStandardMaterial({ color: '#ab765c', roughness: .72 });
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(.078, .26, 4, 8), skin); wrist.position.set(0, -.15, .01); wrist.rotation.x = -.25; root.add(wrist);
  const wristBand = new THREE.Mesh(new THREE.TorusGeometry(.079, .012, 5, 16), shade); wristBand.position.set(0, -.035, .01); wristBand.rotation.x = Math.PI / 2; root.add(wristBand);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(.2, .19, .08), skin); palm.position.set(0, .035, 0); palm.rotation.z = side === 'left' ? -.06 : .06; root.add(palm);
  const knuckles = new THREE.Group(); knuckles.position.set(0, .11, -.005); root.add(knuckles);
  const fingerDefs = [
    { x: -.079, len: .115, r: .024, bend: -.16 }, { x: -.04, len: .145, r: .026, bend: -.06 },
    { x: 0, len: .155, r: .027, bend: 0 }, { x: .04, len: .14, r: .025, bend: .07 }, { x: .079, len: .11, r: .023, bend: .14 }
  ];
  const fingers = [];
  fingerDefs.forEach((f, i) => {
    const finger = makeFinger(THREE, knuckles, f.x, .01, -.01, f.len, f.r, skin, f.bend);
    fingers.push(finger);
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(f.r * 1.02, 8, 6), shade); knuckle.position.set(f.x, .018, -.045); knuckles.add(knuckle);
  });
  const thumb = makeFinger(THREE, root, side === 'left' ? -.12 : .12, .035, .015, .105, .032, skin, side === 'left' ? -.82 : .82); thumb.rotation.x = -.2;
  // Tendon and joint details give the gloves-less hands a more articulated shape.
  for (const x of [-.046, 0, .046]) {
    const tendon = new THREE.Mesh(new THREE.CapsuleGeometry(.008, .08, 2, 5), shade); tendon.position.set(x, .115, .045); tendon.rotation.z = x * -1.4; root.add(tendon);
  }
  root.userData.fingers = fingers; root.userData.thumb = thumb;
  return root;
}

export function createFirstPersonRig(THREE, camera, scene) {
  const group = new THREE.Group(); group.name = 'first-person-hands'; camera.add(group);
  const left = createDetailedHand(THREE, 'left'), right = createDetailedHand(THREE, 'right');
  group.add(left, right);
  group.visible = false;

  const pickaxe = new THREE.Group(); pickaxe.name = 'first-person-pickaxe'; pickaxe.position.set(.37, -.32, -.8); pickaxe.rotation.set(.14, -.48, .62); group.add(pickaxe);
  const wood = new THREE.MeshStandardMaterial({ color: '#88542e', roughness: .72 });
  const steel = new THREE.MeshStandardMaterial({ color: '#c8d4d8', metalness: .86, roughness: .21 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.026, .032, .8, 9), wood); pickaxe.add(grip);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.57, .105, .13), steel); head.position.set(0, .36, 0); pickaxe.add(head);
  const spike = new THREE.Mesh(new THREE.ConeGeometry(.09, .29, 6), steel); spike.rotation.z = Math.PI / 2; spike.position.set(.35, .36, 0); pickaxe.add(spike);
  const leftStrap = new THREE.Mesh(new THREE.TorusGeometry(.15, .018, 5, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#5b6770', metalness: .65 })); leftStrap.position.set(-.24, .25, -.12); leftStrap.rotation.set(.2, 0, .7); group.add(leftStrap);

  function setPose(pose, t = 0) {
    const ease = v => v * v * (3 - 2 * v);
    const e = ease(Math.max(0, Math.min(1, t)));
    group.visible = pose !== 'hidden';
    pickaxe.visible = pose === 'take' || pose === 'hold-pickaxe' || pose === 'swing';
    left.visible = right.visible = group.visible;
    // Reset the finger curl each frame, then apply a closed-fist or task-specific grip.
    left.userData.fingers.forEach(f => { f.rotation.x = 0; }); right.userData.fingers.forEach(f => { f.rotation.x = 0; });
    left.userData.thumb.rotation.z = -.82; right.userData.thumb.rotation.z = .82;
    // Reset before each pose.
    left.position.set(-.34, -.39, -.78); right.position.set(.34, -.39, -.78);
    left.rotation.set(-.1, 0, -.22); right.rotation.set(-.1, 0, .22);
    if (pose === 'map') {
      left.position.set(-.26, -.27, -.65); right.position.set(.26, -.27, -.65);
      left.rotation.set(-.5, -.22, -.18); right.rotation.set(-.5, .22, .18);
      left.userData.fingers.forEach(f => { f.rotation.x = -.55; }); right.userData.fingers.forEach(f => { f.rotation.x = -.55; });
    } else if (pose === 'take') {
      right.position.x = .34 - .42 * e; right.position.y = -.39 + .33 * e; right.rotation.z = .22 - .42 * e;
      left.position.x = -.34 + .15 * e; left.position.y = -.39 + .06 * e;
      pickaxe.position.set(.37 - .12 * e, -.32 + .05 * e, -.8 - .1 * e);
      if (t > .78) { const fade = Math.min(1, (t - .78) / .22); pickaxe.scale.setScalar(1 - fade); }
      else pickaxe.scale.setScalar(1);
    } else if (pose === 'run-jump') {
      left.position.set(-.32, -.32 + Math.sin(t * 18) * .04, -.64); right.position.set(.32, -.32 - Math.sin(t * 18) * .04, -.64);
      left.rotation.x = -.3; right.rotation.x = -.3; left.rotation.z = -.42; right.rotation.z = .42;
    } else if (pose === 'freefall') {
      left.position.set(-.38, -.26, -.68); right.position.set(.38, -.26, -.68);
      left.rotation.set(-.78, -.28, -.58); right.rotation.set(-.78, .28, .58);
      left.userData.fingers.forEach(f => { f.rotation.x = -.3; }); right.userData.fingers.forEach(f => { f.rotation.x = -.3; });
    } else if (pose === 'parachute') {
      left.position.set(-.42, -.17, -.72); right.position.set(.42, -.17, -.72);
      left.rotation.set(-1.05, -.22, -.62); right.rotation.set(-1.05, .22, .62);
      left.userData.fingers.forEach(f => { f.rotation.x = -.8; }); right.userData.fingers.forEach(f => { f.rotation.x = -.8; });
      left.userData.thumb.rotation.z = -.4; right.userData.thumb.rotation.z = .4;
    } else if (pose === 'walk' || pose === 'sprint') {
      const rate = pose === 'sprint' ? 17 : 10;
      const swing = Math.sin(t * rate);
      left.position.y = -.39 + swing * (pose === 'sprint' ? .06 : .035); right.position.y = -.39 - swing * (pose === 'sprint' ? .06 : .035);
      left.position.x = -.34 + Math.max(0, swing) * .025; right.position.x = .34 + Math.max(0, -swing) * .025;
      left.rotation.z = -.2 - swing * (pose === 'sprint' ? .22 : .1); right.rotation.z = .2 + swing * (pose === 'sprint' ? .22 : .1);
      // While sprinting the fingers are open and the hands pump naturally; walking keeps a light fist.
      const curl = pose === 'sprint' ? .12 : 1.02;
      left.userData.fingers.forEach(f => { f.rotation.x = curl; }); right.userData.fingers.forEach(f => { f.rotation.x = curl; });
      if (pose === 'sprint') { left.userData.thumb.rotation.z = -.35; right.userData.thumb.rotation.z = .35; }
    } else if (pose === 'weapon' || pose === 'weapon-shotgun' || pose === 'weapon-pistol' || pose === 'reload-shotgun' || pose === 'reload-pistol' || pose === 'syringe') {
      // Weapon poses are built around the actual grip/pump positions instead of
      // leaving the hands floating beside the weapon. The fingers are curled into
      // fists and the thumbs sit across the grip.
      left.position.set(-.24, -.34, -.70); right.position.set(.27, -.35, -.67);
      left.rotation.set(-.28, -.10, -.20); right.rotation.set(-.28, .10, .20);
      left.userData.fingers.forEach(f => { f.rotation.x = 1.18; }); right.userData.fingers.forEach(f => { f.rotation.x = 1.18; });
      left.userData.thumb.rotation.z = -.18; right.userData.thumb.rotation.z = .18;
      if (pose === 'weapon-shotgun' || pose === 'reload-shotgun') {
        // Right hand wraps the rear grip; left hand supports and closes around the pump.
        right.position.set(.24, -.39, -.84);
        right.rotation.set(-.12, .02, .14);
        left.position.set(.24, -.36, -1.27);
        left.rotation.set(-.18, -.02, -.05);
        right.userData.fingers.forEach(f => { f.rotation.x = 1.32; });
        left.userData.fingers.forEach(f => { f.rotation.x = 1.38; });
        right.userData.thumb.rotation.z = .42;
        left.userData.thumb.rotation.z = -.38;
        if (pose === 'reload-shotgun') {
          const phase = e;
          // The support hand leaves the pump, presents the shell strip, then returns.
          left.position.x = .24 - .38 * Math.sin(Math.min(1, phase * 1.35) * Math.PI);
          left.position.y = -.36 + .16 * Math.sin(Math.min(1, phase * 1.35) * Math.PI);
          left.position.z = -1.27 + .24 * Math.sin(Math.min(1, phase * 1.35) * Math.PI);
          left.rotation.x = -.18 - .55 * Math.sin(Math.min(1, phase * 1.35) * Math.PI);
        }
      } else if (pose === 'weapon-pistol' || pose === 'reload-pistol') {
        // Right hand wraps the pistol grip. The left hand cups underneath the frame
        // and closes around the right hand instead of intersecting the slide.
        right.position.set(.25, -.39, -.78);
        right.rotation.set(-.18, .04, .12);
        left.position.set(.08, -.40, -.83);
        left.rotation.set(-.20, -.10, -.22);
        right.userData.fingers.forEach(f => { f.rotation.x = 1.34; });
        left.userData.fingers.forEach(f => { f.rotation.x = 1.26; });
        right.userData.thumb.rotation.z = .52;
        left.userData.thumb.rotation.z = -.46;
        if (pose === 'reload-pistol') {
          const phase = e;
          // Support hand moves away while the reload hand works the magazine, then both hands return.
          const away = Math.sin(Math.min(1, phase * 1.55) * Math.PI);
          left.position.x = .08 - .32 * away;
          left.position.y = -.40 - .05 * away;
          left.position.z = -.83 + .12 * away;
          right.position.y = -.39 + .03 * away;
        }
      }
      if (pose === 'syringe') {
        left.position.set(.08, -.35, -.67); right.position.set(.20, -.26, -.69); right.rotation.z = -.28; left.rotation.z = -.2; left.userData.fingers.forEach(f => { f.rotation.x = .4; }); right.userData.fingers.forEach(f => { f.rotation.x = .82; });
      }
    } else if (pose === 'swing') {
      const swing = Math.sin(e * Math.PI); right.position.set(.32 - .12 * swing, -.34 + .17 * swing, -.66); right.rotation.set(-.25 - .55 * swing, .08, .22 - .75 * swing);
      left.position.set(-.29, -.34, -.67); left.userData.fingers.forEach(f => { f.rotation.x = 1.02; }); right.userData.fingers.forEach(f => { f.rotation.x = 1.02; });
    } else if (pose === 'idle') {
      left.position.y += Math.sin(t * 1.7) * .01; right.position.y -= Math.sin(t * 1.7) * .01;
      left.userData.fingers.forEach(f => { f.rotation.x = 1.08; }); right.userData.fingers.forEach(f => { f.rotation.x = 1.08; });
    }
  }
  setPose('hidden');
  return { group, left, right, pickaxe, setPose };
}

export function createRedCube(THREE, scene, scale = 1.7) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#ff3030', roughness: .42, metalness: .12, emissive: '#8c0505', emissiveIntensity: .23 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(scale, scale, scale), bodyMat); body.castShadow = true; body.receiveShadow = true; group.add(body);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(scale * 1.005, scale * 1.005, scale * 1.005)), new THREE.LineBasicMaterial({ color: '#ffd4cf', transparent: true, opacity: .86 })); group.add(edges);
  scene.add(group); return group;
}

export function createLobbyAvatar(THREE, scene) {
  const avatar = createRedCube(THREE, scene, 4.4); avatar.position.set(0, 31, 0); avatar.name = 'lobby-red-cube-avatar';
  const halo = new THREE.Mesh(new THREE.TorusGeometry(5.3, .12, 10, 70), new THREE.MeshBasicMaterial({ color: '#ffc928', transparent: true, opacity: .82 })); halo.rotation.x = Math.PI / 2; halo.position.set(0, 24.5, 0); scene.add(halo);
  const spot = new THREE.SpotLight('#ffdf7e', 170, 110, Math.PI / 5, .55, 1.5); spot.position.set(5, 55, 8); spot.target = avatar; scene.add(spot);
  const fill = new THREE.PointLight('#46ceff', 45, 70); fill.position.set(-12, 32, 0); scene.add(fill);
  return { avatar, halo };
}
