import { Color, Mesh, MeshStandardMaterial, Object3D } from 'three';

import {KIRBY_VARIANTS,type KirbyVariant} from './variant-palette';
export {NPC_COLORS,KIRBY_VARIANTS,type KirbyVariant} from './variant-palette';

export function remainingVariants(selected: KirbyVariant) {
  return KIRBY_VARIANTS.filter(variant => variant[0] !== selected[0]);
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
    object.castShadow = !npc || object.name.startsWith('Body');
    object.receiveShadow = true;
  });
  return model;
}
