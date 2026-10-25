/** Stable identities shared by NPCs, bread offerings, saves and the room. */
export const WILD_PIGEONS=['pidgie','snowball','ugolyok','ryzhik','kurlyk'] as const;
export type WildPigeonId=typeof WILD_PIGEONS[number];
const names={pidgie:'Пиджи',snowball:'Снежок',ugolyok:'Уголёк',ryzhik:'Рыжик',kurlyk:'Курлык'} as const;
const objectNames={pidgie:'Пиджи',snowball:'Снежка',ugolyok:'Уголька',ryzhik:'Рыжика',kurlyk:'Курлыка'} as const;
export const wildPigeonName=(id:WildPigeonId)=>names[id];
export const wildPigeonObjectName=(id:WildPigeonId)=>objectNames[id];
export const wildPigeonId=(name:string)=>WILD_PIGEONS.find(id=>names[id]===name);
export const pigeonFriendAchievement=(id:WildPigeonId)=>`${id}Friend` as const;
export const isWildPigeonId=(value:unknown):value is WildPigeonId=>WILD_PIGEONS.includes(value as WildPigeonId);
