import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

/**
 * Future-ready GLB loader for Models/. All paths are centralized, and each URL is loaded once.
 * Static objects can be instanced; rigged/animated characters should use cloneAnimated().
 */
export class ModelCache {
  constructor({ basePath = './Models/' } = {}) {
    this.basePath = basePath;
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.batches = new Map();
  }

  resolve(nameOrUrl) {
    return /^(https?:|data:|blob:)/i.test(nameOrUrl) ? nameOrUrl : `${this.basePath}${String(nameOrUrl).replace(/^\/+/, '')}`;
  }

  load(nameOrUrl) {
    const url = this.resolve(nameOrUrl);
    if (!this.cache.has(url)) {
      const promise = this.loader.loadAsync(url).catch(error => {
        this.cache.delete(url);
        throw new Error(`GLB konnte nicht geladen werden: ${url}. ${error?.message || error}`);
      });
      this.cache.set(url, promise);
    }
    return this.cache.get(url);
  }

  /** Instanced rendering for repeating, static GLB assets like trees, grass and rocks. */
  async createBatch(nameOrUrl, capacity = 1000, parent) {
    const url = this.resolve(nameOrUrl);
    const cached = await this.load(url);
    const modelRoot = cached.scene;
    modelRoot.updateMatrixWorld(true);
    const rootInverse = modelRoot.matrixWorld.clone().invert();
    const parts = [];
    modelRoot.traverse(object => {
      if (!object.isMesh || object.isSkinnedMesh || object.morphTargetInfluences?.length) return;
      const localMatrix = rootInverse.clone().multiply(object.matrixWorld);
      const instanced = new THREE.InstancedMesh(object.geometry, object.material, capacity);
      instanced.count = 0;
      instanced.castShadow = object.castShadow !== false;
      instanced.receiveShadow = object.receiveShadow !== false;
      instanced.frustumCulled = true;
      instanced.name = `${object.name || 'GLB mesh'}-instanced`;
      if (parent) parent.add(instanced);
      parts.push({ instanced, localMatrix });
    });
    if (!parts.length) throw new Error(`Das Modell ${url} enthält keine statischen Meshes für Instancing.`);
    const batch = {
      url, capacity, count: 0, parts,
      add({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 } = {}) {
        if (this.count >= this.capacity) return -1;
        const pos = Array.isArray(position) ? new THREE.Vector3(...position) : new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);
        const euler = Array.isArray(rotation) ? new THREE.Euler(...rotation) : new THREE.Euler(rotation.x || 0, rotation.y || 0, rotation.z || 0);
        const scl = typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(scale.x ?? 1, scale.y ?? 1, scale.z ?? 1);
        const placement = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(euler), scl);
        const index = this.count++;
        for (const part of this.parts) {
          const combined = placement.clone().multiply(part.localMatrix);
          part.instanced.setMatrixAt(index, combined);
          part.instanced.count = this.count;
          part.instanced.instanceMatrix.needsUpdate = true;
        }
        return index;
      },
      finalize() { for (const part of this.parts) { part.instanced.count = this.count; part.instanced.instanceMatrix.needsUpdate = true; } return this; },
      setVisible(visible) { for (const part of this.parts) part.instanced.visible = !!visible; }
    };
    this.batches.set(`${url}#${this.batches.size}`, batch);
    return batch;
  }

  /** Rigged assets are cloned from the cached glTF scene, not downloaded a second time. */
  async cloneAnimated(nameOrUrl) {
    const cached = await this.load(nameOrUrl);
    return cloneSkeleton(cached.scene);
  }

  loadedUrls() { return [...this.cache.keys()]; }
}

/** Simple reusable distance thresholds for high/medium/far representations. */
export function chooseLod(distance, { high = 220, medium = 620, far = 1250 } = {}) {
  if (distance < high) return 'high';
  if (distance < medium) return 'medium';
  if (distance < far) return 'far';
  return 'culled';
}
