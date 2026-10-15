import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import polygonClipping from 'polygon-clipping';
import {NUMBER_GARDEN_SITE as SITE,NUMBER_DIGITS,NUMBER_COLORS,NUMBER_KEY_SCALE,NUMBER_EQUATION_SCALE,NUMBER_PRESS_MS,canPressNumber,validNumberDigit} from './number-garden-site';
import {numberAnswer,type NumberGame} from './number-garden-game';
import {drawLocalizedText,localizedCanvasTexture} from './localized-sign';
import {getLocale,t} from './i18n';

const KEY_MODEL_SCALE=.5,KEY_LIFT=.025;

export const NUMBER_GLYPHS:Record<string,readonly string[]>={
 '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],
 '2':['111','001','111','100','111'],'3':['111','001','111','001','111'],
 '4':['101','101','111','001','001'],'5':['111','100','111','001','111'],
 '6':['111','100','111','101','111'],'7':['111','001','011','010','010'],
 '8':['111','101','111','101','111'],'9':['111','101','111','001','111'],
 '+':['000','010','111','010','000'],'−':['000','000','111','000','000'],
 '=':['000','111','000','111','000'],'?':['111','001','011','000','010'],
};
export function numberGlyphGeometry(symbol:string){
 // Union the touching cells before extrusion: every digit is a solid stroke,
 // including its front face. Only the outside silhouette gets a soft bevel.
 const cells:polygonClipping.Polygon[]=[];
 NUMBER_GLYPHS[symbol].forEach((row,y)=>[...row].forEach((on,x)=>{if(on==='1')cells.push([[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]]);}));
 const point=([x,y]:number[])=>new T.Vector2((x-1.5)*.43,(2.5-y)*.43);
 const shapes=polygonClipping.union(cells[0],...cells.slice(1)).map(region=>{
  const shape=new T.Shape(region[0].slice(0,-1).map(point));
  shape.holes=region.slice(1).map(ring=>new T.Path(ring.slice(0,-1).map(point)));return shape;
 });
 const geometry=new T.ExtrudeGeometry(shapes,{depth:.46,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,steps:1,curveSegments:1});
 geometry.translate(0,0,-.23);return geometry;
}
function numberGlyphSeamsGeometry(symbol:string){
 const rows=NUMBER_GLYPHS[symbol],parts:T.BufferGeometry[]=[];
 const seam=(x:number,y:number,vertical:boolean)=>{
  for(const z of [-.245,.245]){const g=new T.BoxGeometry(vertical?.009:.43,vertical?.43:.009,.002);g.translate(x,y,z);parts.push(g);}
 };
 rows.forEach((row,y)=>[...row].forEach((on,x)=>{if(on!=='1')return;
  if(row[x+1]==='1')seam((x-.5)*.43,(2-y)*.43,true);
  if(rows[y+1]?.[x]==='1')seam((x-1)*.43,(1.5-y)*.43,false);
 }));
 const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return geometry;
}
function sign(text:string,width:number,height:number){
 const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*height/width);const ctx=c.getContext('2d')!;
 ctx.fillStyle='#345e64';ctx.beginPath();ctx.roundRect(3,3,c.width-6,c.height-6,32);ctx.fill();ctx.strokeStyle='#efd9a2';ctx.lineWidth=7;ctx.stroke();
 ctx.fillStyle='#fff2cd';ctx.font=`700 ${Math.floor(c.height*.48)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';drawLocalizedText(ctx,text,c.width/2,c.height/2,c.width*.92);
 const map=localizedCanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
 return new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map,transparent:true,side:T.DoubleSide}));
}
type NumberKey={root:T.Group;glyph:T.Mesh;material:T.MeshStandardMaterial;ring:T.Mesh;halo:T.MeshBasicMaterial;playedAt:number;box:T.Box3};
export class NumberGarden {
 readonly group=new T.Group();readonly button=new T.Group();readonly equation=new T.Group();readonly keys:NumberKey[]=[];
 private geometries=Object.fromEntries(Object.keys(NUMBER_GLYPHS).map(s=>[s,numberGlyphGeometry(s)]));
 private outlines=Object.fromEntries(Object.entries(this.geometries).map(([symbol,geometry])=>{
  const source=geometry.clone();source.deleteAttribute('normal');source.deleteAttribute('uv');
  const outline=mergeVertices(source);source.dispose();outline.computeVertexNormals();return [symbol,outline];
 }));
 private seams=Object.fromEntries(Object.keys(NUMBER_GLYPHS).map(s=>[s,numberGlyphSeamsGeometry(s)]));
 private seamMaterial=new T.MeshBasicMaterial({color:'#34485c',transparent:true,opacity:.32,depthWrite:false,toneMapped:false});
 private outlineMaterial=new T.MeshBasicMaterial({color:'#273951',side:T.BackSide,transparent:true,opacity:1,depthWrite:false,toneMapped:false});
 private crossGeometry=new T.BoxGeometry(.085,2.7,.08);
 private centre=new T.Vector3(SITE.x,0,SITE.z);
 private obstacles=[...NUMBER_DIGITS.map(d=>({x:d.x,z:d.z,r:1.08*KEY_MODEL_SCALE,height:3*KEY_MODEL_SCALE+KEY_LIFT})),{x:SITE.buttonX,z:SITE.buttonZ,r:1.3,height:2.7}];
 private equationMaterials:T.Material[]=[];private lastPressed=-Infinity;private equationKey='';
 private buttonCap:T.Mesh;private buttonMaterial=new T.MeshStandardMaterial({color:'#72cfb6',roughness:.3,metalness:.12,emissive:'#6ccba5',emissiveIntensity:.07});
 constructor(){
  this.group.name='Звонкие циферки · Number garden';
  this.outlineMaterial.name='Number glyph dark contour';
  this.outlineMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += normal * .055;');};
  this.outlineMaterial.customProgramCacheKey=()=> 'number-glyph-contour-v1';
  const cream=new T.MeshStandardMaterial({color:'#e6d9b9',roughness:.8}),rim=new T.MeshStandardMaterial({color:'#b6c9c3',roughness:.7}),gold=new T.MeshStandardMaterial({color:'#e3c17d',roughness:.42,metalness:.18});
  const slab=new T.Mesh(new RoundedBoxGeometry(SITE.halfWidth*2,.24,SITE.halfDepth*2,3,.11),rim);slab.position.set(SITE.x,-.105,SITE.z);slab.receiveShadow=true;this.group.add(slab);
  const floor=new T.Mesh(new RoundedBoxGeometry(SITE.halfWidth*2-.45,.1,SITE.halfDepth*2-.45,3,.045),cream);floor.position.set(SITE.x,-.01,SITE.z);floor.receiveShadow=true;this.group.add(floor);
  // Small brass inlays frame the open front; the slab is flush with the lawn.
  const inlays:T.BufferGeometry[]=[];
  for(let i=0;i<10;i++){const g=new T.BoxGeometry(2.6,.018,.055);g.translate(NUMBER_DIGITS[i].x,.05,SITE.z+SITE.halfDepth-.8);inlays.push(g);}
  const trim=new T.Mesh(mergeGeometries(inlays)!,gold);inlays.forEach(g=>g.dispose());this.group.add(trim);
  const title=sign('Звонкие циферки',9.4,1.25);title.position.set(SITE.x,5.7,SITE.equationZ-2.6);this.group.add(title);
  const pedestal=new T.CylinderGeometry(.95,1.12,.22,32),ringGeometry=new T.TorusGeometry(.99,.025,6,40);
  NUMBER_DIGITS.forEach(d=>{
   const root=new T.Group();root.name=`Number bell ${d.digit}`;root.position.set(d.x,KEY_LIFT,d.z);root.scale.setScalar(KEY_MODEL_SCALE);
   const base=new T.Mesh(pedestal,rim);base.position.y=.14;base.scale.set(1.2,1,1.2);root.add(base);
   const band=new T.Mesh(new T.TorusGeometry(.94,.035,6,32),gold);band.rotation.x=-Math.PI/2;band.position.y=.265;band.scale.setScalar(1.2);root.add(band);
   const material=new T.MeshStandardMaterial({color:d.color,roughness:.27,metalness:.08,emissive:d.color,emissiveIntensity:.025});
   const glyph=this.glyph(String(d.digit),material);glyph.position.y=1.58;glyph.scale.setScalar(NUMBER_KEY_SCALE);glyph.castShadow=true;root.add(glyph);
   const halo=new T.MeshBasicMaterial({color:d.color,transparent:true,opacity:0,depthWrite:false,toneMapped:false}),ring=new T.Mesh(ringGeometry,halo);ring.rotation.x=-Math.PI/2;ring.position.y=.28;root.add(ring);
   this.keys.push({root,glyph,material,ring,halo,playedAt:-Infinity,box:new T.Box3().setFromCenterAndSize(new T.Vector3(d.x,1.55*KEY_MODEL_SCALE+KEY_LIFT,d.z),new T.Vector3(2.8,3.1,1.9).multiplyScalar(KEY_MODEL_SCALE))});this.group.add(root);
  });
  this.button.name='Number challenge start button';this.button.position.set(SITE.buttonX,0,SITE.buttonZ);
  const base=new T.Mesh(new T.CylinderGeometry(1.23,1.4,.32,40),rim);base.position.y=.16;this.button.add(base);
  this.buttonCap=new T.Mesh(new T.CylinderGeometry(1.06,1.14,.22,40),this.buttonMaterial);this.buttonCap.position.y=.41;this.button.add(this.buttonCap);
  const label=sign('Начать испытание',2.05,.65);label.rotation.x=-Math.PI/2;label.position.y=.53;this.button.add(label);
  this.group.add(this.button);this.equation.position.set(SITE.x,2.2,SITE.equationZ);this.group.add(this.equation);this.showEquation(undefined);
 }
 private glyph(symbol:string,material:T.MeshStandardMaterial){
  const mesh=new T.Mesh(this.geometries[symbol],material),outline=new T.Mesh(this.outlines[symbol],this.outlineMaterial),seams=new T.Mesh(this.seams[symbol],this.seamMaterial);
  mesh.name=`Solid block glyph ${symbol}`;outline.name='Dark glyph contour';seams.name='Fine block division lines';mesh.add(outline,seams);return mesh;
 }
 target(digit:number){const key=this.keys[digit];return {key,root:this.group,box:key.box};}
 nearest(p:T.Vector3,size:number){let nearest=-1,best=Infinity;NUMBER_DIGITS.forEach(d=>{const distance=Math.hypot(p.x-d.x,p.z-d.z);if(distance<best&&canPressNumber(d.digit,p,size)){nearest=d.digit;best=distance;}});return nearest;}
 prompt(digit:number){return t('E — Нажать цифру {0}',[digit]);}
 press(digit:number,now:number){if(!validNumberDigit(digit)||now-this.lastPressed<NUMBER_PRESS_MS/1000)return false;this.lastPressed=now;this.play(digit,now);return true;}
 play(digit:number,now:number){if(validNumberDigit(digit))this.keys[digit].playedAt=now;}
 showEquation(q:NumberGame|undefined){
  const signature=JSON.stringify([getLocale(),q?.startedAt,q?.round,q?.cursor,q?.stage,q?.wrongDigit]);if(signature===this.equationKey)return;this.equationKey=signature;
  this.equation.clear();this.equationMaterials.forEach(m=>m.dispose());this.equationMaterials=[];if(!q)return;
  const p=q.problems[q.round-1],answer=numberAnswer(p),prefix=`${p.left}${p.operator}${p.right}=`,length=prefix.length+answer.length;
  const leftColor=NUMBER_COLORS[(q.round-1)%10],rightColor=NUMBER_COLORS[(q.round+3)%10],answerColor=NUMBER_COLORS[(q.round+6)%10];
  const scale=NUMBER_EQUATION_SCALE,pitch=2.18*1.3,start=-(length-1)*pitch/2;
  for(let i=0;i<length;i++){
   const slot=i-prefix.length,done=slot>=0&&slot<q.cursor,wrong=q.stage==='error'&&slot===q.cursor;
   const char=i<prefix.length?prefix[i]:done?answer[slot]:wrong?String(q.wrongDigit):'?';
   const color=wrong?'#df6479':slot>=0?answerColor:/^[0-9]$/.test(char)?i<String(p.left).length?leftColor:rightColor:'#ffffff';
   const material=new T.MeshStandardMaterial({color,roughness:.3,emissive:done?'#45a882':color,emissiveIntensity:done?.22:.025});this.equationMaterials.push(material);
   const mesh=this.glyph(char,material);mesh.scale.setScalar(scale);mesh.position.x=start+i*pitch;this.equation.add(mesh);
   if(wrong){for(const angle of [-.55,.55]){const g=new T.Mesh(this.crossGeometry,material);g.scale.setScalar(scale);g.position.set(mesh.position.x,0,.4);g.rotation.z=angle;this.equation.add(g);}}
  }
 }
 update(now:number,q:NumberGame|undefined,camera:T.Camera){
  this.group.visible=camera.position.distanceToSquared(this.centre)<320**2;this.showEquation(q);
  this.buttonCap.position.y=q?.stage&&q.stage!=='answer'?.37:.41;this.buttonMaterial.emissiveIntensity=q?.stage==='celebrate'?.35:.06+.025*Math.sin(now*2);
  for(const key of this.keys){const age=now-key.playedAt,pulse=age>=0&&age<1.2?Math.sin(Math.PI*Math.min(1,age/.85))*Math.exp(-age*2):0;
   const spring=age>=0&&age<1.2?Math.sin(age*15)*Math.exp(-age*5):0;key.glyph.position.y=1.58+Math.max(0,spring)*.13;key.glyph.rotation.z=spring*.045;key.glyph.scale.setScalar(NUMBER_KEY_SCALE*(1+Math.max(0,spring)*.06));
   key.material.emissiveIntensity=.025+Math.max(0,pulse)*.55;key.halo.opacity=Math.max(0,1-age/1.1)*.5;key.ring.visible=age>=0&&age<1.1;key.ring.scale.setScalar(NUMBER_KEY_SCALE*(1+Math.max(0,Math.min(1.1,age))*.45));
  }
 }
 constrain(p:T.Vector3,size:number){
  if(p.y>2.7)return;
  if(Math.abs(p.x-SITE.x)>SITE.halfWidth+3||Math.abs(p.z-SITE.z)>SITE.halfDepth+3)return;
  for(const d of this.obstacles){if(p.y>d.height)continue;const dx=p.x-d.x,dz=p.z-d.z,distance=Math.hypot(dx,dz),radius=d.r+.45*Math.min(3,size);if(distance<radius){p.x=d.x+(distance>.001?dx/distance:0)*radius;p.z=d.z+(distance>.001?dz/distance:1)*radius;}}
 }
 reset(){this.lastPressed=-Infinity;for(const key of this.keys)key.playedAt=-Infinity;this.showEquation(undefined);}
}
