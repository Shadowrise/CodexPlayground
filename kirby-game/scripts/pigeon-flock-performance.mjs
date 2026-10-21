import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Texture,Vector3} from 'three';
import {PigeonFlock} from '../src/pigeon-flock.ts';
const output=new URL('../node_modules/.cache/pigeon-flock/',import.meta.url);await mkdir(output,{recursive:true});
const load=async file=>{const b=await readFile(new URL('../public/models/'+file,import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'NodeTextureMetadata',loadTexture:()=>Promise.resolve(new Texture())}));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
const [pidgie,snowball]=await Promise.all([load('pigeon-animated.glb'),load('snowball-animated.glb')]);
const metrics={};for(const [name,template] of Object.entries({pidgie,snowball})){let meshes=0,triangles=0,keys=0;template.scene.traverse(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;}});for(const clip of template.animations)keys+=clip.tracks.reduce((n,t)=>n+t.times.length,0);metrics[name]={meshes,triangles,keys};}
const specs=Array.from({length:24},(_,i)=>({id:'bird-'+i,playerId:'guest',skin:i%2?'snowball':'pidgie',seed:Math.imul(i+1,2654435761)>>>0,order:i}));
const player={id:'guest',position:new Vector3(),hasBread:false};let probes=0;
const host=new PigeonFlock({pidgie,snowball},{safeGround:()=>{probes++;return true;}});
for(let i=0;i<700;i++)host.update(.05,specs,true,[player],[]);
const copies=structuredClone(specs);for(let i=0;i<3;i++)for(const c of host.checkpoints())copies.find(b=>b.id===c.id).checkpoint=c;
const guest=new PigeonFlock({pidgie,snowball},{safeGround:()=>{probes++;return true;}});guest.update(0,copies,false,[player],[]);
for(const [name,flock,isHost] of [['host',host,true],['guest',guest,false]]){
 const times=[];probes=0;
 for(let i=0;i<360;i++){player.position.x=i/30;const start=performance.now();flock.update(1/60,isHost?specs:copies,isHost,[player],[]);times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);metrics[name]={meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:times[Math.floor(times.length*.95)],terrainProbes:probes};
}
host.clear();guest.clear();const filename=process.argv[2]??'performance.json';await writeFile(new URL(filename,output),JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics));
