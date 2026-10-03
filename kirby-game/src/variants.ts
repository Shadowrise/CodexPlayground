import { Color, Mesh, MeshStandardMaterial, Object3D } from 'three';
import {rainbowCrown,rainbowSkin} from './rainbow-kirby';

import {KIRBY_VARIANTS,type KirbyVariant} from './variant-palette';
export {NPC_COLORS,KIRBY_VARIANTS,type KirbyVariant} from './variant-palette';

export function remainingVariants(selected: KirbyVariant) {
  // Keep the existing fourteen ambient NPCs and network world budget.
  return KIRBY_VARIANTS.filter(variant => variant[0] !== selected[0]).slice(0,14);
}

export function styleVariant(element:HTMLElement,variant:KirbyVariant){
  element.style.setProperty('--kirby-color',variant[1]);
  element.classList.toggle('rainbow-kirby',variant[0]==='Радуга');
}

export function cloneVariant(template: Object3D, variant: KirbyVariant, npc: boolean) {
  const model = template.clone(true);
  const materials = new Map<MeshStandardMaterial, MeshStandardMaterial>();
  model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const recolor = (source: MeshStandardMaterial) => {
      if (!materials.has(source)) {
        const material = source.clone();
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
  return model;
}
