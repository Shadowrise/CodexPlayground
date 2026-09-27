/** Shared palette without rendering dependencies, also used by the admin page. */
export const NPC_COLORS = [
 ['Мандарин', '#ff780a'], ['Лайм', '#a5ef16'], ['Пурпур', '#b721ef'],
 ['Бирюза', '#05d7ba'], ['Лимон', '#ffe329'], ['Лазурь', '#14a9ff'],
 ['Коралл', '#ff524a'], ['Фуксия', '#ff19a6'], ['Индиго', '#6850ff'],
 ['Мята', '#35ec87'], ['Янтарь', '#ffb20c'], ['Орхидея', '#e14df5'],
 ['Малина', '#ef1762'], ['Сапфир', '#2368ff'],
] as const;
export const KIRBY_VARIANTS = [['Классический', '#ffa2c5'], ...NPC_COLORS] as const;
export type KirbyVariant = typeof KIRBY_VARIANTS[number];
