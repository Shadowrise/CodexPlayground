import {test} from 'node:test';
import assert from 'node:assert/strict';
import {knightArenaRoster,type KnightProfile} from '../src/meta-knight-party-hud';

test('the arena roster follows arrivals, returns to the meadow and disconnects without a battle snapshot',()=>{
 const local:KnightProfile={id:'me',name:'Я',variant:0},friend:KnightProfile={id:'friend',name:'Друг',variant:1},elsewhere:KnightProfile={id:'outside',name:'Поляна',variant:2};
 assert.deepEqual(knightArenaRoster('me',[local,friend,elsewhere]),['me']);
 friend.location='meta-knight-arena';assert.deepEqual(knightArenaRoster('me',[friend,local,elsewhere]),['me','friend']);
 assert.deepEqual(knightArenaRoster('me',[local,friend,friend,elsewhere]),['me','friend']);
 delete friend.location;assert.deepEqual(knightArenaRoster('me',[local,friend,elsewhere]),['me']);
 friend.location='meta-knight-arena';assert.deepEqual(knightArenaRoster('me',[local,elsewhere]),['me']);
});
