import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CharacterController} from '../src/controller';
import {createPlayerModel} from '../src/player-model';
import {KIRBY_VARIANTS} from '../src/variant-palette';
import {startKnightBattle,type KnightActor} from '../src/meta-knight-battle';
import {startHelperAbility,HELPER} from '../src/meta-knight-helper';
import {MetaKnightHelperView} from '../src/meta-knight-helper-view';
import {MetaKnightOpponentsView} from '../src/meta-knight-opponents-view';
import {refugeStar} from '../src/meta-knight-cosmic-refuge';
import {KNIGHT_WARNING_STYLE} from '../src/meta-knight-warning-style';
import {knightWarningArrowGeometry,KNIGHT_WARNING_SURFACE} from '../src/meta-knight-warning-material';
import {prepareKnightFightersFinale} from '../src/meta-knight-fighters-finale';
import {knightCelebration} from '../src/meta-knight-celebration';
import {prepareKnightDefeat,knightDefeatPose} from '../src/meta-knight-defeat';
import {fitKnightFormationCamera} from '../src/meta-knight-formation-camera';

async function load(name:string){const bytes=await readFile(new URL('../public/models/'+name,import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'TestTextures',loadTexture:()=>Promise.resolve(new T.Texture())}));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
async function helperFixture(){const gltf=await load('meta-knight-animated.glb'),model=createPlayerModel(gltf,KIRBY_VARIANTS[18],undefined,false,gltf),c=new CharacterController(model.model,model.clips),scene=new T.Scene();scene.add(c.actor);const actor:KnightActor={id:'helper',p:[0,0,-2],yaw:0,available:true,metaKnight:true,side:'boss'},s=startKnightBattle([actor],'helper',100000)!;Object.assign(s,{stage:'rest',since:100000,until:1000000});actor.p=[0,0,0];return {s,actor,c,scene,view:new MetaKnightHelperView(c,()=>{})};}
test('the crescent keeps its windup and real projectile but draws no yellow lane or arrows',async()=>{
 const {s,actor,c,view}=await helperFixture();assert(startHelperAbility(s,actor,1,100000));const cast=s.players.helper.helper!.cast!;
 view.update(s,actor.id,cast.release-1,1/60);assert((view as any).lanes.every((m:T.Mesh)=>!m.visible));assert((view as any).arrows.every((m:T.Mesh)=>!m.visible));assert(!(view as any).crescent.group.visible);
 view.update(s,actor.id,cast.release+100,1/60);assert((view as any).crescent.group.visible);assert((view as any).lanes.every((m:T.Mesh)=>!m.visible));view.dispose();c.disposeEffects();
});
test('the player dash uses eight boss chevrons and rounded glass while keeping its body colours',async()=>{
 const {s,actor,c,view}=await helperFixture(),body=new Map<T.MeshStandardMaterial,{hex:number;strength:number}>(),blade=c.actor.getObjectByName('Galaxia')!;
 c.actor.traverse(o=>{if(!(o instanceof T.Mesh))return;let node:T.Object3D|null=o;while(node&&node!==blade)node=node.parent;if(node===blade)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial)body.set(m,{hex:m.emissive.getHex(),strength:m.emissiveIntensity});});
 assert(startHelperAbility(s,actor,2,100000));const cast=s.players.helper.helper!.cast!,arrowGeometry=knightWarningArrowGeometry();
 for(const now of [cast.at+700,cast.release+100]){view.update(s,actor.id,now,1/60);const lane=(view as any).lanes[0] as T.Mesh<T.PlaneGeometry,T.ShaderMaterial>,arrows=(view as any).arrows as T.Mesh<T.ShapeGeometry,T.MeshBasicMaterial>[];assert(lane.visible);assert.equal(arrows.filter(a=>a.visible).length,8);assert.equal(lane.scale.x,HELPER.dashHalfWidth*2);assert.equal(lane.scale.y,36+7.2);assert(lane.material.fragmentShader.includes(KNIGHT_WARNING_SURFACE));const colour=now<cast.release?KNIGHT_WARNING_STYLE.gold:KNIGHT_WARNING_STYLE.red;assert.equal((lane.material.uniforms.tint.value as T.Color).getHex(),colour);
  arrows.forEach((a,i)=>{assert.deepEqual(a.geometry.attributes.position.array,arrowGeometry.attributes.position.array);assert.equal(a.material.color.getHex(),colour);assert(Math.abs(a.position.z-(i+.5)*36/8)<1e-8);assert.equal(a.scale.x,3);});for(const [m,p] of body){assert.equal(m.emissive.getHex(),p.hex);assert.equal(m.emissiveIntensity,p.strength);}}
 arrowGeometry.dispose();view.dispose();c.disposeEffects();
});
for(const pigeon of [false,true])test(`${pigeon?'pigeon':'Kirby'} AI receives and clears the same golden refuge blessing`,async()=>{
 const kirby=await load('kirby-animated.glb'),bird=pigeon?await load('pigeon-animated.glb'):undefined,variant=pigeon?17:0,s=startKnightBattle([{id:'helper',p:[0,0,-2],yaw:0,available:true,metaKnight:true,side:'boss'}],'helper',100000)!;
 s.phase=4;s.stage='cosmic-star-open';s.cosmicRefuge={at:100000,activatedAt:100100,angle:0,world:0,contacts:{}};const star=refugeStar(s,102000);Object.values(s.opponents!).forEach(a=>a.p=[star[0],180,star[2]]);
 const view=new MetaKnightOpponentsView(()=>{const m=createPlayerModel(kirby,KIRBY_VARIANTS[variant],bird);return new CharacterController(m.model,m.clips);}),scene=new T.Scene(),cosmic=new T.Group();scene.add(cosmic);view.update(s,scene,cosmic,102000,1/60);
 for(const [id,c] of view.characters){assert(c.actor.getObjectByName('Golden refuge safety blessing')?.visible);s.opponents![id].p[0]+=12;}
 view.update(s,scene,cosmic,102000,1/60);for(const c of view.characters.values())assert(!c.actor.getObjectByName('Golden refuge safety blessing')?.visible);view.clear();assert.equal(view.characters.size,0);
});
test('both knight endings use the arena centre and reserve separate outer positions for every opponent',()=>{
 const actors:KnightActor[]=[{id:'helper',p:[0,0,-2],yaw:0,available:true,metaKnight:true,side:'boss'}],s=startKnightBattle(actors,'helper',100000)!;s.phase=4;s.stage='lost';Object.values(s.opponents!).forEach(a=>a.p=[0,180,0]);prepareKnightFightersFinale(s,actors,101000);
 const targets=Object.values(s.fightersFinale!.actors).map(a=>a.to);for(const p of targets)assert(Math.hypot(p[0],p[2])>=12-1e-6);for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++)assert(Math.hypot(targets[i][0]-targets[j][0],targets[i][2]-targets[j][2])>=2.65);
 s.celebration={at:101000,boss:[25,0,15],helpers:{helper:[20,0,-20]}};for(const id of ['boss','helper'])for(const now of [110000,120000,135000]){const p=knightCelebration(s,id,now)!;assert.deepEqual(p.centre,[0,0,0]);assert(Math.hypot(p.p[0],p.p[2])<4.3);}
 s.stage='cosmic-descent';s.since=140000;s.cosmicFall={at:140000,yaw:0};actors[0].p=[24,180,-20];prepareKnightDefeat(s,actors,[25,180,10],140000);const boss=knightDefeatPose(s,'boss',145000)!,helper=knightDefeatPose(s,'helper',145000)!;assert(Math.hypot(boss.p[0]+helper.p[0],boss.p[2]+helper.p[2])<1e-8);assert.equal(boss.p[1],0);assert.equal(helper.p[1],0);
});
for(const [width,height] of [[1280,800],[390,844],[844,390]])test(`shared shots keep the upper lightning visible from behind at ${width}x${height}`,()=>{
 const frame={kind:'duet',yaw:Math.PI,anchor:[3.3,180,0] as [number,number,number],points:[],elevation:.3},top=Math.min(120,height*.2),pose=fitKnightFormationCamera(frame,width,height,frame.yaw,0,top),camera=new T.PerspectiveCamera(pose.fov,width/height,.25,3000);camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3().fromArray(pose.focus));camera.updateMatrixWorld();const tip=new T.Vector3(0,201,0).project(camera);assert(tip.y<1-2*top/height&&tip.y>-.8&&Math.abs(tip.x)<.9);assert(Math.hypot(pose.position[0]-3.3,pose.position[1]-180,pose.position[2])<39,'a modest backward move, not an arena-wide shot');
});
