import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Static details are baked once and shared by local and remote characters.
// Only materials belong to an actor, matching the normal Kirby lifecycle.
const skins=new WeakMap<T.BufferGeometry,T.BufferGeometry>();
const irises=new WeakMap<T.BufferGeometry,T.BufferGeometry>();
let face:T.DataTexture|undefined,cloth:T.DataTexture|undefined,wood:T.DataTexture|undefined;
let hatGeometry:T.BufferGeometry|undefined,spearGeometry:T.BufferGeometry|undefined;

function texture(size:number,pixel:(x:number,y:number)=>number[]){
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)data.set([...pixel(x,y),255],(y*size+x)*4);
 const map=new T.DataTexture(data,size,size);map.colorSpace=T.SRGBColorSpace;
 map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;
 return map;
}

function faceTexture(){
 return face??=texture(512,(px,py)=>{
  const x=px/511*2-1,y=py/511*1.92+.21,v=(y-1.13)/.76;
  const width=.79-.105*Math.tanh(v*2),edge=1-(x/width)**2-v*v;
  const cream=T.MathUtils.smoothstep(edge,-.012,.012);
  const blush=Math.exp(-(((Math.abs(x)-.55)/.18)**2+((y-1.13)/.10)**2)*1.5)*.66*cream;
  return [244+(255-244)*cream,122+(224-122)*cream-69*blush,40+(166-40)*cream-94*blush];
 });
}

function fabricTexture(){
 return cloth??=texture(128,(x,y)=>{
  // A woven pattern, kept subtle and mipmapped so it does not shimmer.
  const thread=((x%4)<2?2:-2)+((y%4)<2?2:-2),grain=Math.sin(x*2.13+y*3.37)*1.5;
  return [46+thread+grain,75+thread+grain,196+thread+grain];
 });
}

function woodTexture(){
 return wood??=texture(128,(x,y)=>{
  const grain=Math.sin(x*.35+Math.sin(y*.07)*.9)*8+Math.sin(x*1.1+y*.025)*3;
  return [132+grain,89+grain*.75,45+grain*.45];
 });
}

function skinGeometry(source:T.BufferGeometry){
 let result=skins.get(source);
 if(!result){
  result=source.clone();const p=result.getAttribute('position'),uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){
   uv[i*2]=p.getZ(i)>0?(p.getX(i)+1)/2:0;
   uv[i*2+1]=(p.getY(i)-.21)/1.92;
  }
  result.setAttribute('uv',new T.BufferAttribute(uv,2));skins.set(source,result);
 }
 return result;
}

function amberIris(source:T.BufferGeometry){
 let result=irises.get(source);
 if(!result){
  result=source.clone();const p=result.getAttribute('position'),colors=new Float32Array(p.count*3);
  const upper=new T.Color('#182334'),lower=new T.Color('#b47713');
  for(let i=0;i<p.count;i++){
   const color=upper.clone().lerp(lower,T.MathUtils.smoothstep(1.52-p.getY(i),0,.20));
   colors.set([color.r,color.g,color.b],i*3);
  }
  result.setAttribute('color',new T.BufferAttribute(colors,3));irises.set(source,result);
 }
 return result;
}

function bakedMesh(parts:T.BufferGeometry[],geometry:T.BufferGeometry,matrix?:T.Matrix4){
 if(matrix)geometry.applyMatrix4(matrix);
 parts.push(geometry);
}

function ellipsoid(parts:T.BufferGeometry[],x:number,y:number,z:number,sx:number,sy:number,sz:number,rotation=0){
 const g=new T.SphereGeometry(1,20,12);g.scale(sx,sy,sz);g.rotateZ(rotation);g.translate(x,y,z);parts.push(g);
}

/** A rounded fabric ribbon with a raised fold, rather than a flat triangle. */
function ribbon(points:T.Vector3[],width:number){
 const curve=new T.CatmullRomCurve3(points),vertices:number[]=[],uv:number[]=[],indices:number[]=[];
 const steps=18,across=6;
 for(let i=0;i<=steps;i++){
  const t=i/steps,p=curve.getPoint(t),tangent=curve.getTangent(t);
  const side=new T.Vector3(tangent.y,-tangent.x,0).normalize();
  const w=width*Math.pow(Math.sin(Math.PI*(.08+.92*t)),.65);
  for(let j=0;j<=across;j++){
   const s=j/across*2-1,q=p.clone().addScaledVector(side,s*w);
   q.z+=Math.cos(s*Math.PI/2)*width*.18+Math.sin(t*Math.PI*2)*s*width*.07;
   vertices.push(q.x,q.y,q.z);uv.push(j/across,t);
   if(i<steps&&j<across){const a=i*(across+1)+j,b=a+across+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function bandanaGeometry(){
 if(hatGeometry)return hatGeometry;
 const pieces:T.BufferGeometry[]=[],p:number[]=[],uv:number[]=[],indices:number[]=[];
 const around=56,rings=18;
 const edge=(a:number)=>1.10-.23*Math.cos(a);
 const point=(a:number,t:number)=>{
  const theta=edge(a)*t,r=1+.016*Math.sin(a*5)*Math.sin(theta)**2;
  return new T.Vector3(Math.sin(a)*1.04*r*Math.sin(theta),.025+1.02*Math.cos(theta),Math.cos(a)*.885*r*Math.sin(theta));
 };
 for(let j=0;j<=rings;j++)for(let i=0;i<=around;i++){
  const a=i/around*Math.PI*2,q=point(a,j/rings);p.push(q.x,q.y,q.z);uv.push(i/around*3,j/rings*2);
  if(j<rings&&i<around){const v=j*(around+1)+i;indices.push(v,v+around+1,v+1,v+1,v+around+1,v+around+2);}
 }
 const cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(p,3));cap.setAttribute('uv',new T.Float32BufferAttribute(uv,2));cap.setIndex(indices);cap.computeVertexNormals();pieces.push(cap);
 const rimPoints=Array.from({length:57},(_,i)=>point(i/56*Math.PI*2,1));
 bakedMesh(pieces,new T.TubeGeometry(new T.CatmullRomCurve3(rimPoints,true),56,.032,8,true));
 ellipsoid(pieces,.91,.47,-.22,.17,.13,.14,-.22);
 pieces.push(ribbon([new T.Vector3(.99,.5,-.24),new T.Vector3(1.22,.66,-.22),new T.Vector3(1.35,.92,-.17),new T.Vector3(1.40,1.08,-.10)],.17));
 pieces.push(ribbon([new T.Vector3(1,.44,-.24),new T.Vector3(1.27,.38,-.18),new T.Vector3(1.52,.48,-.12),new T.Vector3(1.67,.61,-.06)],.18));
 hatGeometry=mergeGeometries(pieces)!;hatGeometry.computeBoundingSphere();pieces.forEach(g=>g.dispose());return hatGeometry;
}

function vertexColor(g:T.BufferGeometry,color:string){
 const c=new T.Color(color),values=new Float32Array(g.getAttribute('position').count*3);
 for(let i=0;i<values.length;i+=3)values.set([c.r,c.g,c.b],i);g.setAttribute('color',new T.BufferAttribute(values,3));return g;
}

function spearDetails(){
 if(spearGeometry)return spearGeometry;
 const pieces:T.BufferGeometry[]=[];
 const add=(g:T.BufferGeometry,color:string)=>{g.deleteAttribute('uv');pieces.push(vertexColor(g.index?g.toNonIndexed():g,color));};
 // Four forged faces, with distinct silver tones and a ridge down the blade.
 const tip=new T.Vector3(0,2.22,0),ring=[new T.Vector3(-.19,1.61,0),new T.Vector3(0,1.69,.082),new T.Vector3(.19,1.61,0),new T.Vector3(0,1.69,-.082)];
 for(let i=0;i<4;i++){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...ring[i].toArray(),...tip.toArray(),...ring[(i+1)%4].toArray()],3));g.computeVertexNormals();add(g,['#cae0e5','#9cb9c8','#819ca9','#d9e5e2'][i]);
 }
 const bottom=new T.BufferGeometry();bottom.setAttribute('position',new T.Float32BufferAttribute([...ring[0].toArray(),...ring[3].toArray(),...ring[2].toArray(),...ring[0].toArray(),...ring[2].toArray(),...ring[1].toArray()],3));bottom.computeVertexNormals();add(bottom,'#879eaa');
 const collar=new T.CylinderGeometry(.082,.068,.11,12);collar.translate(0,1.59,0);add(collar,'#d7b033');
 const wrap=new T.CylinderGeometry(.087,.087,.16,14);wrap.translate(0,1.43,0);add(wrap,'#d84545');
 const knot=new T.SphereGeometry(.085,12,8);knot.scale(1.12,.7,.78);knot.translate(-.077,1.44,.015);add(knot,'#e85850');
 add(ribbon([new T.Vector3(-.09,1.47,0),new T.Vector3(-.31,1.44,.04),new T.Vector3(-.42,1.27,.04),new T.Vector3(-.45,1.13,.04)],.095),'#da4647');
 add(ribbon([new T.Vector3(-.09,1.42,.02),new T.Vector3(-.22,1.31,.03),new T.Vector3(-.29,1.14,.07),new T.Vector3(-.37,1.04,.10)],.078),'#f06c58');
 spearGeometry=mergeGeometries(pieces)!;spearGeometry.computeBoundingSphere();pieces.forEach(g=>g.dispose());return spearGeometry;
}

let shaft:T.BufferGeometry|undefined;
export function applyBandana(model:T.Object3D){
 model.traverse(object=>{
  if(!(object instanceof T.Mesh))return;
  const name=object.name.replaceAll('_',' '),materials=Array.isArray(object.material)?object.material:[object.material];
  if(name.startsWith('Body •')){
   const m=(materials[0] as T.MeshLambertMaterial).clone();m.color.set('#ffffff');m.map=faceTexture();object.material=m;object.geometry=skinGeometry(object.geometry);
  }
  for(const m of materials){
   if(m.name.startsWith('Feet'))(m as T.MeshLambertMaterial).color.set('#f6cf32');
  }
  if(name.includes('blue iris'))object.geometry=amberIris(object.geometry);
  if(name.includes('cheek')||name==='Open smiling mouth'||name==='Rounded tongue'||name.includes('small catchlight'))object.visible=false;
 });
 const body=model.getObjectByName('Body_motion')??model.getObjectByName('Body motion');
 if(!body)return;
 const clothMaterial=new T.MeshLambertMaterial({map:fabricTexture(),side:T.DoubleSide});clothMaterial.map!.wrapS=clothMaterial.map!.wrapT=T.RepeatWrapping;
 const hat=new T.Mesh(bandanaGeometry(),clothMaterial);hat.name='Bandana cloth';body.add(hat);
 const shoulder=model.getObjectByName('Left_shoulder')??model.getObjectByName('Left shoulder');
 if(shoulder){
  const spear=new T.Group();spear.name='Bandana spear';spear.position.set(-.18,0,.12);spear.rotation.z=-.13;
  if(!shaft){shaft=new T.CylinderGeometry(.044,.054,2.25,12,1);shaft.translate(0,.465,0);}
  const handle=new T.Mesh(shaft,new T.MeshLambertMaterial({map:woodTexture()}));handle.name='Spear wooden shaft';
  const blade=new T.Mesh(spearDetails(),new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}));blade.name='Spear blade and ribbons';
  spear.add(handle,blade);shoulder.add(spear);
 }
 // Details cast the same stable character shadow; no new lights or live cloth.
 for(const root of [hat,shoulder?.getObjectByName('Bandana spear')])root?.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
}
