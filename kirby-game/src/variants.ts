import { Color, Mesh, MeshStandardMaterial, Object3D } from 'three';

export const NPC_COLORS = [
  ['Мандарин', '#ff780a'], ['Лайм', '#a5ef16'], ['Пурпур', '#b721ef'],
  ['Бирюза', '#05d7ba'], ['Лимон', '#ffe329'], ['Лазурь', '#14a9ff'],
  ['Коралл', '#ff524a'], ['Фуксия', '#ff19a6'], ['Индиго', '#6850ff'],
  ['Мята', '#35ec87'], ['Янтарь', '#ffb20c'], ['Орхидея', '#e14df5'],
  ['Малина', '#ef1762'], ['Сапфир', '#2368ff'],
] as const;
export const KIRBY_VARIANTS = [['Классический', '#ffa2c5'], ...NPC_COLORS] as const;
export type KirbyVariant = typeof KIRBY_VARIANTS[number];

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
