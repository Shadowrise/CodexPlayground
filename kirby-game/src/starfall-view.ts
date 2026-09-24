import * as T from 'three';
import {STAR_COUNT,STAR_INTERVAL,STAR_LIFE,STAR_LIMIT,CELEBRATE_MS,RESULTS_MS,starValue,starfallPhase,type StarfallState} from './starfall';
import {KIRBY_VARIANTS} from './variants';
import {sceneryClearance} from './landmarks';
const COLORS=['#ff668f','#ffc640','#63ed95','#52dfff','#9d83ff','#ff87eb','#ff974d'];
function texture(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d')!,g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffffff');g.addColorStop(.14,'#ffffffe0');g.addColorStop(.4,'#ffffff40');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
function starGeometry(){const shape=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.43:1;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)shape.lineTo(x,y);else shape.moveTo(x,y);}shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.09,bevelThickness:.09});g.translate(0,0,-.11);return g;}
export class StarfallView {
 readonly group=new T.Group();
 readonly hud=document.createElement('div');readonly results=document.createElement('dialog');
 private stars=new Map<number,{group:T.Group;origin:T.Vector3;claimed:boolean}>();
 private geometry=starGeometry();private glow=texture();private materials=COLORS.map(color=>new T.MeshStandardMaterial({color,metalness:.35,roughness:.13,emissive:color,emissiveIntensity:.55}));
 private glowMaterials=COLORS.map(color=>new T.SpriteMaterial({map:this.glow,color,transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending}));
 private white=new T.SpriteMaterial({map:this.glow,depthWrite:false,blending:T.AdditiveBlending});
 private finale=new T.Group();private phase='';private resultKey='';private initialized=false;private center=new T.Vector3();
 constructor(private pickup:()=>void,private cheer:()=>void,leave:()=>void){
  this.hud.id='starfall-hud';this.hud.hidden=true;this.hud.setAttribute('role','status');document.body.append(this.hud);
  this.results.id='starfall-results';document.body.append(this.results);this.results.addEventListener('cancel',e=>e.preventDefault());
  this.results.addEventListener('click',e=>{if((e.target as HTMLElement).closest('button'))leave();});
  this.group.name='Personal rainbow starfall';this.group.add(this.finale);this.finale.visible=false;
  const dot=(x:number,y:number,color:number,size=.2)=>{const s=new T.Sprite(this.glowMaterials[color]);s.position.set(x,y,0);s.scale.setScalar(size);this.finale.add(s);};
  // A smiling Kirby constellation, outlined with tiny rainbow stars.
  for(let i=0;i<70;i++){const a=i/70*Math.PI*2;dot(Math.cos(a)*2.4,Math.sin(a)*2.2,0,.48);}
  for(const side of [-1,1]){for(let i=0;i<14;i++){const a=i/14*Math.PI*2;dot(side*2.5+Math.cos(a)*.8,-.25+Math.sin(a)*.5,0,.38);dot(side*1.25+Math.cos(a)*.85,-2+Math.sin(a)*.4,6,.36);}for(let i=0;i<7;i++)dot(side*.72,.15+i*.12,3,.28);dot(side*1.45,-.35,5,.6);}
  for(let i=0;i<12;i++){const a=Math.PI+i/11*Math.PI;dot(Math.cos(a)*.48,-.25+Math.sin(a)*.45,1,.25);}
  for(let i=0;i<70;i++){const s=new T.Sprite(this.glowMaterials[i%7]);s.userData.spark=i;s.scale.setScalar(.28);this.finale.add(s);}
 }
 private spawn(index:number,p:T.Vector3,obstacles:readonly {x:number;z:number}[]){
  const g=new T.Group(),color=index%7,body=new T.Mesh(this.geometry,this.materials[color]);g.add(body);
  const halo=new T.Sprite(this.glowMaterials[color]);halo.scale.setScalar(3.7);g.add(halo);
  for(let j=0;j<3;j++){const spark=new T.Sprite(this.white);spark.position.set(Math.cos(j*2.1)*.8,Math.sin(j*2.1)*.8,.3);spark.scale.set(.14,.55,1);g.add(spark);}
  const origin=p.clone();let found=false;
  for(let j=0;j<80;j++){const a=index*2.399+j*1.71,r=6+(j%12)*2,x=T.MathUtils.clamp(p.x+Math.cos(a)*r,-208,208),z=T.MathUtils.clamp(p.z+Math.sin(a)*r,-208,208);if(sceneryClearance(x,z,2)&&obstacles.every(o=>Math.hypot(o.x-x,o.z-z)>5)){origin.set(x,0,z);found=true;break;}}
  if(!found)origin.y=Math.max(0,p.y);
  this.group.add(g);this.stars.set(index,{group:g,origin,claimed:false});
 }
 update(s:StarfallState|undefined,id:string,now:number,p:T.Vector3,scale:number,camera:T.Camera,online:boolean,obstacles:readonly {x:number;z:number}[],claim:(index:number)=>void){
  if(!s){this.hud.hidden=true;return;}
  const phase=starfallPhase(s,now),player=s.players[id],bonus=player?.bonus??0;
  this.hud.hidden=phase==='done'||(!online&&phase==='celebrate');
  if(phase!==this.phase){if(phase==='collect'||phase==='celebrate')this.cheer();this.phase=phase;}
  if(phase==='countdown')this.hud.textContent=`★ ${s.initiator} выполнил все задачи! Звездопад через ${Math.ceil((s.startsAt-now)/1000)} с`;
  if(phase==='collect')this.hud.textContent=`★ Собирай звёзды · ${Math.ceil((s.endsAt-now)/1000)} с · +${bonus}/${STAR_LIMIT} очков`;
  if(phase==='celebrate')this.hud.textContent='★ Спасибо за чудесное приключение!';
  if(phase==='collect'){
   for(let i=0;i<STAR_COUNT;i++){const age=now-s.startsAt-i*STAR_INTERVAL;if(age>=0&&age<STAR_LIFE&&!this.stars.has(i)&&!player?.collected.includes(i)&&bonus<STAR_LIMIT)this.spawn(i,p,obstacles);}
  }
  for(const [i,star] of this.stars){const age=now-s.startsAt-i*STAR_INTERVAL,g=star.group;
   g.visible=phase==='collect'&&age<STAR_LIFE&&!star.claimed&&!player?.collected.includes(i)&&bonus<STAR_LIMIT;if(!g.visible)continue;
   const fall=Math.max(0,1-age/5500);g.position.copy(star.origin);g.position.y+=1.35+fall*fall*15+Math.sin(now*.002+i)*.16;g.rotation.set(.15*Math.sin(i+now*.001),now*.001+i,.13*Math.sin(now*.002+i));g.scale.setScalar((starValue(i)===3?1.05:.72)*Math.min(1,age/500,(STAR_LIFE-age)/1300));
   const target=p.clone().add(new T.Vector3(0,scale,0));
   if(age>=2500&&g.position.distanceTo(target)<3+scale){star.claimed=true;claim(i);this.pickup();}
  }
  this.finale.visible=phase==='celebrate';
  if(phase==='celebrate'){
   if(!this.initialized){this.center.copy(p);this.initialized=true;}
   this.finale.position.copy(this.center).add(new T.Vector3(0,6+scale,0));this.finale.quaternion.copy(camera.quaternion);
   const t=(now-s.endsAt)/1000;this.finale.scale.setScalar(Math.min(1,t*1.5)*Math.min(1,(CELEBRATE_MS/1000-t)*.8));
   for(const o of this.finale.children)if(o.userData.spark!==undefined){const i=o.userData.spark,a=i*2.399,r=3+(t+i*.09)%3;o.position.set(Math.cos(a)*r,Math.sin(a)*r,0);}
  }
  if(online&&phase==='done'&&s.results){
   if(this.resultKey!==String(s.startsAt)){this.resultKey=String(s.startsAt);this.results.replaceChildren();const title=document.createElement('h2');title.textContent='★ Праздник завершён!';this.results.append(title);
    const list=document.createElement('ol');for(const r of s.results){const row=document.createElement('li');row.style.color=KIRBY_VARIANTS[r.variant]?.[1]??'#fff';row.textContent=`${1+s.results.filter(v=>v.points>r.points).length}. ${r.name} — ${r.points} очков (+${r.bonus} за звёзды)`;list.append(row);}this.results.append(list);
    const award=(label:string,winners:typeof s.results)=>{if(!winners.length)return;const el=document.createElement('p');el.textContent=label+': '+winners.map(v=>v.name).join(', ');this.results.append(el);};
    const humans=s.results.filter(r=>r.id!=='npc');const top=[...humans].sort((a,b)=>b.fruits-a.fruits||b.size-a.size)[0];
    if(top)award('🍉 Толстячок',humans.filter(r=>r.fruits===top.fruits&&r.size===top.size));
    const best=Math.max(...humans.map(r=>r.bonus));award('★ Звёздный собиратель',humans.filter(r=>r.bonus===best));
    const adventure=document.createElement('p');adventure.textContent='♥ Любитель приключений: '+s.initiator;this.results.append(adventure);
    const countdown=document.createElement('small');countdown.id='starfall-exit-time';this.results.append(countdown);const button=document.createElement('button');button.textContent='В главное меню';this.results.append(button);this.results.showModal();button.focus();
   }
   this.results.querySelector('small')!.textContent=`Возвращение в меню через ${Math.max(0,Math.ceil((s.endsAt+CELEBRATE_MS+RESULTS_MS-now)/1000))} с`;
  }
 }
}
