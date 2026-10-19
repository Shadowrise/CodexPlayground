import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {batchRigidMeshes} from './rigid-batch';
import {onLocaleChange,t} from './i18n';

/** A small freestanding terminal; the screen repaints only when its reading changes. */
export class MillPressureMonitor {
 readonly group=new T.Group();
 readonly screen:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
 private readonly led:T.Mesh<T.SphereGeometry,T.MeshBasicMaterial>;
 private readonly context:CanvasRenderingContext2D|null;
 private readonly texture?:T.CanvasTexture;
 private displayed=-1;
 private state=-1;
 get percent(){return this.displayed;}

 constructor(){
  this.group.name='Mill pressure monitor';this.group.position.set(50.95,0,40.35);
  const materials=new Map<string,T.MeshStandardMaterial>();
  const part=(geometry:T.BufferGeometry,color:string,x:number,y:number,z:number)=>{
   if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.72}));
   const mesh=new T.Mesh(geometry,materials.get(color));mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);return mesh;
  };
  const box=(color:string,x:number,y:number,z:number,w:number,h:number,d:number,r=.035)=>part(new RoundedBoxGeometry(w,h,d,2,r),color,x,y,z);
  const disc=(color:string,x:number,y:number,z:number,r:number,d:number)=>{const mesh=part(new T.CylinderGeometry(r,r,d,12),color,x,y,z);mesh.rotation.x=Math.PI/2;return mesh;};
  // A broad oak foot, a solid neck and a collar physically support the housing.
  box('#624631',0,.13,0,1.14,.26,.92,.07);
  box('#aa8150',0,.25,0,1.06,.1,.84);
  box('#354f4d',0,.77,-.11,.26,1.12,.3,.05);
  box('#c5a568',0,.38,-.11,.36,.1,.4);
  box('#354f4d',0,1.85,0,1.9,1.5,.62,.13);
  box('#54877a',0,1.86,.22,1.86,1.44,.22,.1);
  box('#dfcba2',0,1.93,.335,1.74,1.27,.1,.075);
  box('#142f31',0,1.95,.39,1.6,1.1,.1,.055);
  for(const x of [-.8,.8])for(const y of [1.38,2.48])disc('#a58a58',x,y,.398,.023,.015);
  // Side vents and a brass power button make the silhouette read as a computer.
  for(let i=0;i<5;i++)box('#213d3d',.947,1.68+i*.1,-.035,.018,.035,.28,.006);
  for(let i=0;i<3;i++)box('#213d3d',-.46+i*.11,1.24,.345,.065,.023,.02,.005);
  disc('#c5a568',.64,1.25,.35,.067,.04);disc('#354f4d',.64,1.25,.378,.042,.026);
  batchRigidMeshes(this.group);

  this.context=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
  if(this.context){
   this.context.canvas.width=512;this.context.canvas.height=336;
   this.texture=new T.CanvasTexture(this.context.canvas);this.texture.colorSpace=T.SRGBColorSpace;this.texture.anisotropy=2;
   onLocaleChange(()=>this.paint());
  }
  this.screen=new T.Mesh(new T.PlaneGeometry(1.5,1),new T.MeshBasicMaterial({map:this.texture??null,color:this.texture?'#ffffff':'#102c30',toneMapped:false}));
  this.screen.name='Mill pressure screen';this.screen.position.set(0,1.95,.446);this.group.add(this.screen);
  this.led=new T.Mesh(new T.SphereGeometry(.028,10,6),new T.MeshBasicMaterial({color:'#68908d',toneMapped:false}));
  this.led.position.set(.42,1.25,.357);this.led.scale.z=.45;this.group.add(this.led);
  this.update(0);
 }

 update(flow:number){
  const percent=Math.round(T.MathUtils.clamp(flow,0,1.5)*100);
  if(percent===this.displayed)return;
  this.displayed=percent;this.state=percent===0?0:percent<65?1:percent<=120?2:3;
  this.led.material.color.set(['#68908d','#75c6f0','#8fe1ac','#f18b78'][this.state]);
  this.paint();
 }

 private paint(){
  const ctx=this.context;if(!ctx)return;
  const color=['#91b7b5','#87d3f4','#9aefb8','#ffa18a'][this.state];
  const background=ctx.createLinearGradient(0,0,0,336);background.addColorStop(0,'#102f34');background.addColorStop(1,'#071c22');
  ctx.fillStyle=background;ctx.fillRect(0,0,512,336);
  ctx.strokeStyle='#24464b';ctx.lineWidth=2;ctx.strokeRect(12,12,488,312);
  ctx.strokeStyle='#183a40';ctx.lineWidth=1;
  for(let x=36;x<480;x+=32){ctx.beginPath();ctx.moveTo(x,64);ctx.lineTo(x,149);ctx.stroke();}
  for(let y=72;y<150;y+=24){ctx.beginPath();ctx.moveTo(28,y);ctx.lineTo(484,y);ctx.stroke();}
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.font='bold 21px monospace';ctx.fillStyle='#a0ccc6';ctx.fillText(t('НАПОР'),32,39,390);
  // A water drop marks the terminal without a separate label or texture.
  ctx.fillStyle='#78c9cf';ctx.beginPath();ctx.moveTo(470,25);ctx.bezierCurveTo(463,36,454,44,460,50);ctx.bezierCurveTo(475,62,487,47,479,38);ctx.closePath();ctx.fill();
  ctx.textAlign='center';ctx.font='bold 78px monospace';ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=5;ctx.fillText(`${this.displayed}%`,256,111,420);ctx.shadowBlur=0;
  ctx.fillStyle='#193d40';ctx.beginPath();ctx.roundRect(130,160,252,34,10);ctx.fill();
  ctx.font='bold 18px monospace';ctx.fillStyle=color;ctx.fillText(t(['НЕТ ПОТОКА','НИЗКИЙ','НОРМА','ВЫСОКИЙ'][this.state]),256,178,228);
  // The green zone and a crisp pointer retain the existing lever puzzle cue.
  const barX=36,barY=224,barWidth=440;
  for(let i=0;i<30;i++){
   const value=(i+.5)*5,zone=value<65?0:value<=120?1:2;
   ctx.fillStyle=(value<=this.displayed?['#6ebce3','#86dba5','#ee8b76']:['#234d62','#285545','#603e3a'])[zone];
   ctx.fillRect(barX+i*barWidth/30,barY,barWidth/30-3,23);
  }
  const pointer=barX+this.displayed/150*barWidth;
  ctx.fillStyle='#fff0cb';ctx.beginPath();ctx.moveTo(pointer-7,210);ctx.lineTo(pointer+7,210);ctx.lineTo(pointer,220);ctx.closePath();ctx.fill();
  ctx.font='16px monospace';ctx.fillStyle='#92b5b4';
  for(const value of [0,50,100,150]){
   const x=barX+value/150*barWidth;ctx.fillRect(x,255,1,6);ctx.fillText(String(value),x,279);
  }
  ctx.font='13px monospace';ctx.fillStyle='#648e8d';ctx.fillText(t('НОРМА — 100%'),256,309,440);
  this.texture!.needsUpdate=true;
 }
}
