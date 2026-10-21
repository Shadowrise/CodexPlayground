import {Mesh, type AnimationClip, type Material, type Object3D} from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {cloneVariant,isPigeonVariant, type KirbyVariant} from './variants';
import {clonePigeon} from './pigeon-appearance';

export type PlayerModel = {model: Object3D; clips: AnimationClip[]; character: 'kirby' | 'pigeon' | 'meta-knight'};

/** Native characters keep their original rig, geometry and authored materials. */
export function createPlayerModel(kirby: GLTF, variant: KirbyVariant, pigeon?: GLTF, npc = false, metaKnight?: GLTF,snowball?:GLTF): PlayerModel {
  const knight=variant[0]==='Meta Knight';
  if (!isPigeonVariant(variant[0])&&!knight) {
    return {model: cloneVariant(kirby.scene, variant, npc), clips: kirby.animations, character: 'kirby'};
  }
  const white=variant[0]==='Снежок',source=knight?metaKnight:white?snowball:pigeon;
  if (!source) throw new Error(knight?'Модель Meta Knight ещё не загрузилась':white?'Модель Снежка ещё не загрузилась':'Модель Пиджи ещё не загрузилась');
  if(!knight)return {model:clonePigeon(source.scene),clips:source.animations,character:'pigeon'};
  const model = cloneSkeleton(source.scene);
  model.userData.characterShadow=true;
  const character='meta-knight';
  model.userData.character = character;
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
  return {model, clips: source.animations, character};
}
