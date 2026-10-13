import {Mesh, type AnimationClip, type Material, type Object3D} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {cloneVariant, type KirbyVariant} from './variants';

export type PlayerModel = {model: Object3D; clips: AnimationClip[]; character: 'kirby' | 'pigeon'};

/** Choose the original model and rig, rather than colouring a Kirby as a bird. */
export function createPlayerModel(kirby: GLTF, variant: KirbyVariant, pigeon?: GLTF, npc = false): PlayerModel {
  if (variant[0] !== 'Пиджи') {
    return {model: cloneVariant(kirby.scene, variant, npc), clips: kirby.animations, character: 'kirby'};
  }
  if (!pigeon) throw new Error('Модель Пиджи ещё не загрузилась');
  const model = cloneSkeleton(pigeon.scene);
  model.userData.character = 'pigeon';
  const materials = new Map<Material, Material>();
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const cloneMaterial = (source: Material) => {
      let material = materials.get(source);
      if (!material) { material = source.clone(); materials.set(source, material); }
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
    object.castShadow = object.receiveShadow = true;
  });
  return {model, clips: pigeon.animations, character: 'pigeon'};
}
