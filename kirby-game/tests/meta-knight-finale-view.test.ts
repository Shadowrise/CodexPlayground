import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene,Group,Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {startKnightBattle} from '../src/meta-knight-battle';
import {prepareKnightFightersFinale} from '../src/meta-knight-fighters-finale';
import {MetaKnightOpponentsView} from '../src/meta-knight-opponents-view';

for(const pigeon of [false,true])test(`${pigeon?'pigeon':'Kirby'} really sits with stars on defeat, and plays repeated joy on victory`,async()=>{
 const loader=new GLTFLoader();loader.register(()=>({name:'TestTextures',loadTexture:()=>Promise.resolve(new Texture())}));
 const load=async(name:string)=>{const bytes=await readFile(new URL('../public/models/'+name,import.meta.url));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
 const kirby=await load('kirby-animated.glb'),bird=pigeon?await load('pigeon-animated.glb'):undefined,variant=pigeon?17:0;
 const actor={id:'helper',p:[0,0,-2] as [number,number,number],yaw:0,available:true,metaKnight:true,side:'boss' as const},s=startKnightBattle([actor],'helper',100000)!;
 const view=new MetaKnightOpponentsView(()=>{const m=createPlayerModel(kirby,KIRBY_VARIANTS[variant],bird);return new CharacterController(m.model,m.clips);}),scene=new Scene(),cosmic=new Group();scene.add(cosmic);
 Object.values(s.opponents!).forEach(a=>a.p[1]=180);s.phase=4;s.stage='lost';prepareKnightFightersFinale(s,[actor],101000);const f=s.fightersFinale!,id=Object.keys(s.opponents!)[0];
 view.update(s,scene,cosmic,102500,1/60);const c=view.characters.get(id)!;assert(c.actor.position.y>0&&c.actor.position.y<180);assert.equal(c.state,'Fly');assert.equal(c.actor.parent,cosmic);
 view.update(s,scene,cosmic,f.landAt+100,1/60);assert.equal(c.state,'Sitting');assert.equal(c.actor.position.y,0);assert.equal(c.actor.parent,scene);assert(scene.children.some(o=>o.name==='Fighter finale dizziness stars'&&o.visible));
 s.stage='won';f.won=true;const root=c.animationRoot,poses:number[][]=[],states=new Set<string>();
 for(let i=0;i<90;i++){view.update(s,scene,cosmic,f.landAt+700+i*180,1/60);states.add(c.state);poses.push([...root.position.toArray(),...root.quaternion.toArray(),...c.actor.getObjectByName(pigeon?'Left_wing':'Left_shoulder')!.quaternion.toArray()]);assert.equal(c.actor.position.y,0);}
 assert(states.has('Joy'));assert(states.has('Idle'));assert(poses.some(p=>Math.hypot(...p.map((v,i)=>v-poses[0][i]))>.05),'the real rig moves during joy');assert(!scene.children.some(o=>o.name==='Fighter finale dizziness stars'&&o.visible));
 view.update(undefined,scene,cosmic,f.landAt+20000,0);assert.equal(view.characters.size,0);assert(!scene.children.some(o=>o.name==='Fighter finale dizziness stars'));view.dispose();
});
