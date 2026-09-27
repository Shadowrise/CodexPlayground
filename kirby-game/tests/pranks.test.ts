import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3,InstancedMesh} from 'three';
import {PrankEffects} from '../src/prank-effects';
import {isPrankKind,makePrank} from '../src/pranks';
test('cosmetic events animate, restore poses, bound trails and expire without changing gameplay coordinates',()=>{
 assert(isPrankKind('hiccup'));assert(!isPrankKind('constructor'));assert(!isPrankKind('unknown'));
 const actor=new Group(),root=new Group();actor.add(root);const target={actor,root,grounded:true},sounds:string[]=[];
 const effects=new PrankEffects(kind=>sounds.push(kind)),event=makePrank('one','hiccup',0,[0,0,0],1);
 effects.update([event],event.startsAt+80,()=>target,new Vector3());assert(root.position.y>0);assert.equal(actor.position.y,0);
 effects.beginFrame();assert.equal(root.position.y,0);assert.equal(root.scale.y,1);
 for(let i=0;i<30;i++){effects.beginFrame();effects.update([event],event.startsAt+80+i,()=>target,new Vector3());}assert.equal(sounds.filter(s=>s==='hiccup').length,1);
 effects.beginFrame();effects.update([event],event.endsAt,()=>target,new Vector3());assert.equal(effects.group.children.length,0);
 const trail=makePrank('one','rainbow',0,[0,0,0],1);
 for(let i=0;i<100;i++){actor.position.x=i*.6;effects.update([trail],trail.startsAt+i*50,()=>target,new Vector3(60,0,0));}
 const stamps=effects.group.children[0].children[0] as InstancedMesh;assert(stamps.count>0&&stamps.count<=36);
 target.grounded=false;for(let i=0;i<50;i++){actor.position.x+=.7;effects.update([trail],trail.startsAt+5000+i*100,()=>target,actor.position);}assert.equal(stamps.count,0,'no tracks in midair');
 const gift=makePrank('one','gift',10000,[0,0,0],20);assert.equal(gift.scale,2.5);
 effects.update([gift],gift.startsAt+100,()=>target,actor.position);actor.position.set(1,0,0);
 effects.update([gift],gift.startsAt+3700,()=>target,actor.position);effects.update([gift],gift.startsAt+4400,()=>target,actor.position);
 assert(sounds.includes('unbox'));assert(sounds.includes('quack'));effects.update([],gift.endsAt,()=>target,actor.position);assert.equal(effects.group.children.length,0);effects.dispose();
});
