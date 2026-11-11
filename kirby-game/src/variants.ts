import { Color, Material, Mesh, MeshLambertMaterial, MeshStandardMaterial, Object3D } from 'three';
import {rainbowCrown,rainbowSkin} from './rainbow-kirby';
import {applyBandana} from './bandana-kirby';
import {prepareCharacterDetail} from './character-detail';

import {KIRBY_VARIANTS,isPigeonVariant,type KirbyVariant} from './variant-palette';
export {NPC_COLORS,KIRBY_VARIANTS,isPigeonVariant,type KirbyVariant} from './variant-palette';

export function remainingVariants(selected: KirbyVariant) {
  // Keep the existing fourteen ambient NPCs and network world budget.
  return KIRBY_VARIANTS.filter(variant => variant[0] !== selected[0]).slice(0,14);
}

export function styleVariant(element:HTMLElement,variant:KirbyVariant){
  element.style.setProperty('--kirby-color',variant[1]);
  element.classList.toggle('rainbow-kirby',variant[0]==='Радуга');
  element.classList.toggle('bandana-kirby',variant[0]==='Бандана');
  element.classList.toggle('pigeon-character',isPigeonVariant(variant[0]));
  element.classList.toggle('snowball-character',variant[0]==='Снежок');
  element.classList.toggle('ugolyok-character',variant[0]==='Уголёк');
  element.classList.toggle('ryzhik-character',variant[0]==='Рыжик');
  element.classList.toggle('kurlyk-character',variant[0]==='Курлык');
  element.classList.toggle('metapidgie-character',variant[0]==='Мета Пиджи');
  element.classList.toggle('meta-knight-character',variant[0]==='Meta Knight');
}

function matteSurface(source: MeshStandardMaterial) {
  const material = new MeshLambertMaterial();
  // Keep the GLB's face colours, alpha/depth settings and textures, without
  // its specular/clearcoat layers. Directional light and shadows still apply.
  Material.prototype.copy.call(material, source);
  material.color.copy(source.color);
  material.map = source.map;
  material.emissive.copy(source.emissive);
  material.emissiveIntensity = source.emissiveIntensity;
  material.emissiveMap = source.emissiveMap;
  material.aoMap = source.aoMap;
  material.aoMapIntensity = source.aoMapIntensity;
  material.normalMap = source.normalMap;
  material.normalMapType = source.normalMapType;
  material.normalScale.copy(source.normalScale);
  material.bumpMap = source.bumpMap;
  material.bumpScale = source.bumpScale;
  material.alphaMap = source.alphaMap;
  material.flatShading = source.flatShading;
  return material;
}

// Face details are never recoloured per character. Meadow NPCs and seated
// passengers share one instance of each, so consecutive characters reuse the
// same material state. Players keep their own copies.
const SHARED_FACE=/^(Eyes|Iris|Eye reflections|Cheeks|Smile|Tongue)/;
const sharedFaces=new WeakMap<MeshStandardMaterial,MeshStandardMaterial|MeshLambertMaterial>();
export function cloneVariant(template: Object3D, variant: KirbyVariant, npc: boolean) {
  if(npc)prepareCharacterDetail(template);
  const model = template.clone(true);
  model.userData.characterShadow=true;
  model.userData.shadowSilhouette='kirby';
  const materials = new Map<MeshStandardMaterial, MeshStandardMaterial | MeshLambertMaterial>();
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const recolor = (source: MeshStandardMaterial) => {
      if (!materials.has(source)) {
        const shared=npc&&variant[0]!=='Радуга'&&variant[0]!=='Бандана'&&SHARED_FACE.test(source.name);
        const material = (shared?sharedFaces.get(source):undefined) ?? (/^(Kirby|Feet|Cheeks|Smile|Tongue)/.test(source.name) ? matteSurface(source) : source.clone());
        if(shared)sharedFaces.set(source,material);
        if (material.name.startsWith('Kirby') && variant[0] !== 'Классический') material.color.set(variant[1]);
        if (material.name.startsWith('Feet') && npc) material.color.copy(new Color('#12452a'));
        materials.set(source, material);
      }
      return materials.get(source)!;
    };
    object.material = Array.isArray(object.material) ? object.material.map(recolor) : recolor(object.material);
    if(variant[0]==='Радуга'){
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(material.name.startsWith('Kirby'))object.geometry=rainbowSkin(object.geometry,material);
        if(material.name.startsWith('Feet')&&!npc)material.color.set('#b33ee6');
      }
    }
    object.castShadow = !npc || object.name.startsWith('Body');
    object.receiveShadow = true;
  });
  if(variant[0]==='Радуга'){
    const head=model.getObjectByName('Body_motion')??model.getObjectByName('Body motion');
    if(head)head.add(rainbowCrown());
  }
  if(variant[0]==='Бандана')applyBandana(model);
  return model;
}
