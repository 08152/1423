import * as THREE from 'three';

// The game loads its image textures directly from URLs. Canvas-generated textures are fallbacks
// so an external host being unavailable does not stop the game from loading.
export const TEXTURE_URLS = {
  grass: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
  brick: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
  metal: 'https://threejs.org/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',
  water: 'https://threejs.org/examples/textures/waternormals.jpg'
};

function proceduralTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = kind === 'grass' ? '#5a8650' : kind === 'sand' ? '#bd985c' : kind === 'snow' ? '#dce6e8' : kind === 'rock' ? '#7e8587' : kind === 'metal' ? '#526674' : '#6f6259';
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const n = Math.random();
    ctx.fillStyle = n > .5 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.06)';
    if (kind === 'grass') ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 3 + Math.random() * 5);
    else ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 8, 1 + Math.random() * 5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(5, 5);
  return texture;
}

export function loadWebTexture(url, fallbackKind = 'grass', repeat = 5) {
  const fallback = proceduralTexture(fallbackKind);
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const promise = new Promise(resolve => {
    loader.load(url, texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.repeat.set(repeat, repeat);
      texture.anisotropy = 4;
      resolve(texture);
    }, undefined, () => resolve(fallback));
  });
  return { fallback, promise };
}

export function createMaterials() {
  const grass = loadWebTexture(TEXTURE_URLS.grass, 'grass', 6);
  const brick = loadWebTexture(TEXTURE_URLS.brick, 'brick', 2);
  const metal = loadWebTexture(TEXTURE_URLS.metal, 'metal', 3);
  const water = loadWebTexture(TEXTURE_URLS.water, 'water', 4);
  return {
    grass: grass.fallback, sand: proceduralTexture('sand'), snow: proceduralTexture('snow'), rock: proceduralTexture('rock'),
    brick: brick.fallback, metal: metal.fallback, waterNormal: water.fallback,
    ready: Promise.all([grass.promise, brick.promise, metal.promise, water.promise]).then(([g, b, m, w]) => ({ grass: g, brick: b, metal: m, waterNormal: w }))
  };
}
