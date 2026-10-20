/** Stable identities shared by NPCs, bread offerings, saves and the room. */
export const WILD_PIGEONS=['pidgie','snowball'] as const;
export type WildPigeonId=typeof WILD_PIGEONS[number];
export const wildPigeonName=(id:WildPigeonId)=>id==='snowball'?'Снежок':'Пиджи';
export const pigeonFriendAchievement=(id:WildPigeonId)=>id==='snowball'?'snowballFriend':'pidgieFriend';
export const isWildPigeonId=(value:unknown):value is WildPigeonId=>WILD_PIGEONS.includes(value as WildPigeonId);
