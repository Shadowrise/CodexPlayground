import {wildPigeonId} from './wild-pigeons';
/** Shared palette without rendering dependencies, also used by the admin page. */
export const NPC_COLORS = [
 ['Мандарин', '#ff780a'], ['Лайм', '#a5ef16'], ['Пурпур', '#b721ef'],
 ['Бирюза', '#05d7ba'], ['Лимон', '#ffe329'], ['Лазурь', '#14a9ff'],
 ['Коралл', '#ff524a'], ['Фуксия', '#ff19a6'], ['Индиго', '#6850ff'],
 ['Мята', '#35ec87'], ['Янтарь', '#ffb20c'], ['Орхидея', '#e14df5'],
 ['Малина', '#ef1762'], ['Сапфир', '#2368ff'],
] as const;
export const KIRBY_VARIANTS = [['Классический', '#ffa2c5'], ...NPC_COLORS, ['Радуга', '#f4b5ff'], ['Бандана', '#f47a28'], ['Пиджи', '#8c98a6'], ['Meta Knight', '#a8b0f7'], ['Снежок', '#f5f5f1'], ['Уголёк', '#42464d'], ['Рыжик', '#c77942']] as const;
export type KirbyVariant = typeof KIRBY_VARIANTS[number];
export const isPigeonVariant=(name:string|undefined)=>!!name&&wildPigeonId(name)!==undefined;
