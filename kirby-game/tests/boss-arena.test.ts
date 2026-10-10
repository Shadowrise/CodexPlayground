import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_ARENA as A,ARENA_POSTS,constrainArena} from '../src/boss-arena-site';
import {dryGround,RIVERS,RIVER_HALF_WIDTH} from '../src/pond-layout';
import {LANDMARKS} from '../src/landmark-sites';
import {SKY_TRAIL_SITE} from '../src/sky-trail-layout';
import {HOME_SITE} from '../src/home-site';
import {MAZE_SITE} from '../src/maze-layout';
import {BALLOON_SITES} from '../src/balloon-sites';
import {createCoasterCurve} from '../src/coaster';
import {fruitLayout} from '../src/fruit-layout';
import {outsideLandmarks,sceneryClearance} from '../src/landmarks';

test('arena fits a dry, unobstructed 72m play area without rerouting existing attractions',()=>{
 assert.equal(A.playRadius*2,72);assert(dryGround(A.x,A.z,A.radius));
 for(const site of [...LANDMARKS,SKY_TRAIL_SITE,HOME_SITE,MAZE_SITE,...BALLOON_SITES.map(p=>({...p,radius:22})),{x:135,z:45,radius:25}])assert(Math.hypot(A.x-site.x,A.z-site.z)>A.radius+site.radius);
 for(const point of createCoasterCurve().getPoints(1800))assert(Math.hypot(point.x-A.x,point.z-A.z)>A.radius+4);
 for(const point of RIVERS.flat())assert(Math.hypot(point.x-A.x,point.z-A.z)>A.radius+RIVER_HALF_WIDTH);
 assert(!sceneryClearance(A.x,A.z));
 const moved=outsideLandmarks(A.x+5,A.z,6);assert(Math.hypot(moved.x-A.x,moved.z-A.z)>A.radius+6);assert(sceneryClearance(moved.x,moved.z,6));
 const fruits=fruitLayout();assert.equal(fruits.length,70);for(const p of fruits)assert(Math.hypot(p.x-A.x,p.z-A.z)>A.radius+5);
});

test('arena posts block walkers but all four broad entrances and the play area remain open',()=>{
 for(const post of ARENA_POSTS){const p={x:A.x+post.x,y:0,z:A.z+post.z};constrainArena(p,1);assert(Math.hypot(p.x-A.x-post.x,p.z-A.z-post.z)>=post.radius+.599);}
 for(let gate=0;gate<4;gate++)for(let r=0;r<=46;r+=.5){const a=gate*Math.PI/2,p={x:A.x+Math.sin(a)*r,y:0,z:A.z+Math.cos(a)*r},before={...p};constrainArena(p,1);assert.deepEqual(p,before);}
 for(const post of ARENA_POSTS){const p={x:A.x+post.x,y:post.height+1,z:A.z+post.z},before={...p};constrainArena(p,1);assert.deepEqual(p,before);}
});
