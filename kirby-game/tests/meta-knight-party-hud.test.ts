import {test} from 'node:test';
import assert from 'node:assert/strict';
import {knightArenaRoster,type KnightProfile} from '../src/meta-knight-party-hud';
import {knightAnnexPoint,META_KNIGHT_ANNEX} from '../src/meta-knight-arena-site';
import {startKnightBattle} from '../src/meta-knight-battle';

test('the arena roster follows arrivals, returns to the meadow and disconnects without a battle snapshot',()=>{
 const local:KnightProfile={id:'me',name:'Я',variant:0,location:'meta-knight-arena',p:[0,0,-2]},friend:KnightProfile={id:'friend',name:'Друг',variant:1,p:[10,0,0]},elsewhere:KnightProfile={id:'outside',name:'Поляна',variant:2,p:[0,0,0]};
 assert.deepEqual(knightArenaRoster('me',[local,friend,elsewhere]),['me']);
 friend.location='meta-knight-arena';assert.deepEqual(knightArenaRoster('me',[friend,local,elsewhere]),['me','friend']);
 assert.deepEqual(knightArenaRoster('me',[local,friend,friend,elsewhere]),['me','friend']);
 delete friend.location;assert.deepEqual(knightArenaRoster('me',[local,friend,elsewhere]),['me']);
 friend.location='meta-knight-arena';assert.deepEqual(knightArenaRoster('me',[local,elsewhere]),['me']);
});

test('the ready roster counts a player only after crossing the gate, including the local player',()=>{
 const profile=(id:string,along:number):KnightProfile=>{const p=knightAnnexPoint(0,along);return {id,name:id,variant:0,location:'meta-knight-arena',p:[p.x,0,p.z]};};
 const me=profile('me',56),friend=profile('friend',20),waiting=profile('waiting',64),gate=profile('gate',META_KNIGHT_ANNEX.gate);
 assert.deepEqual(knightArenaRoster('me',[me,waiting,friend,gate]),['friend']);
 me.p=profile('me',META_KNIGHT_ANNEX.gate-.1).p;assert.deepEqual(knightArenaRoster('me',[friend,me,waiting,gate]),['me','friend']);
 me.p=profile('me',META_KNIGHT_ANNEX.gate+.1).p;assert.deepEqual(knightArenaRoster('me',[me,friend,waiting,gate]),['friend']);
 delete friend.p;assert.deepEqual(knightArenaRoster('me',[me,friend]),[],'an unknown position must not promise participation');
});

test('the active roster uses the captured participants and never adds spectators or late arrivals',()=>{
 const profiles:KnightProfile[]=[{id:'me',name:'Я',variant:0,location:'meta-knight-arena',p:[0,0,-2]},{id:'friend',name:'Друг',variant:1,location:'meta-knight-arena',p:[41,0,0]}];
 const s=startKnightBattle(profiles.map(p=>({id:p.id,p:p.p as [number,number,number],yaw:0,available:true})),'me',1000)!;
 profiles[0].p=[60,180,0];profiles.push({id:'late',name:'Позже',variant:2,location:'meta-knight-arena',p:[0,0,0]});
 assert.deepEqual(knightArenaRoster('me',profiles,s),['me','friend']);
 delete profiles[1].location;assert.deepEqual(knightArenaRoster('me',profiles,s),['me'],'leaving the scene still removes the row');
});
