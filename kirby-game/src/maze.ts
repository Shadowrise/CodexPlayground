import * as T from 'three';
import type { CharacterController } from './controller';
import { MAZE_SITE, MAZE_CELL, MAZE_HALF, mazeLayout, farthestMazeCell, mazeDistances } from './maze-layout';
import { makeFruitMist } from './fruit-mist';
type Wall={x:number;z:number;hx:number;hz:number};
export class HedgeMaze {
  readonly group=new T.Group();
  readonly walls:Wall[]=[];
  readonly layout=mazeLayout();
  readonly rewardCell=farthestMazeCell(this.layout);
  readonly rewardPosition=new T.Vector3(-30+(this.rewardCell%7)*10,0,-30+Math.floor(this.rewardCell/7)*10);
  private star=new T.Group();
  private aura?:T.Group;
  private sparkles?:T.InstancedMesh;
  private clock=0;
  private glowMaterials=new Map<T.MeshStandardMaterial,{color:T.Color;intensity:number}>();
  private dummy=new T.Object3D();
  constructor(){
    const root=this.group;root.name='Hedge maze and golden star';root.position.set(MAZE_SITE.x,0,MAZE_SITE.z);
    const box=new T.BoxGeometry(1,1,1),leaf=new T.IcosahedronGeometry(1,1);
    const parts=new Map<string,{geo:T.BufferGeometry;colors:T.Color[];matrices:T.Matrix4[]}>();
    const put=(geo:T.BufferGeometry,color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,ry=0)=>{
      const key=geo.uuid;if(!parts.has(key))parts.set(key,{geo,colors:[],matrices:[]});this.dummy.position.set(x,y,z);this.dummy.scale.set(sx,sy,sz);this.dummy.rotation.set(0,ry,0);this.dummy.updateMatrix();parts.get(key)!.matrices.push(this.dummy.matrix.clone());parts.get(key)!.colors.push(new T.Color(color));
    };
    const distances=mazeDistances(this.layout),maxDistance=Math.max(...distances);
    const rainbow=['#9444d2','#424bc6','#36b7e5','#46a548','#e6cc39','#eb8a2d','#d94048'].map(c=>new T.Color(c));
    const cellColor=(cell:number,shade=1)=>{
      const progress=distances[cell]/maxDistance*6,index=Math.min(5,Math.floor(progress));
      return '#'+rainbow[index].clone().lerp(rainbow[index+1],progress-index).multiplyScalar(shade).getHexString();
    };
    put(box,'#a9ac70',0,.015,0,70,.035,70);
    const wall=(x:number,z:number,hx:number,hz:number,cell:number,neighbor:number)=>{
      this.walls.push({x,z,hx,hz});put(box,cellColor(cell,.38),x,2.45,z,hx*2,4.9,hz*2);
      const horizontal=hx>hz,length=Math.max(hx,hz)*2;
      // Each face follows its own passage, even when a late corridor borders the entrance.
      const face=(side:number)=>side<0 && neighbor>=0?neighbor:cell;
      for(let i=0;i<Math.ceil(length/.7);i++)for(let row=0;row<4;row++){
        const offset=-length/2+.35+i*.7,y=.65+row*1.25;
        for(const side of [-1,1])put(leaf,cellColor(face(side),[.72,.9,.62][(i+row)%3]),x+(horizontal?offset:side*.65),y,z+(horizontal?side*.65:offset),.59,.85,.59,i*.7);
      }
      for(let i=0;i<Math.ceil(length/.75);i++)for(const side of [-1,1])put(leaf,cellColor(face(side),1.08),x+(horizontal?-length/2+.37+i*.75:side*.4),5,z+(horizontal?side*.4:-length/2+.37+i*.75),horizontal?.8:.45,.5,horizontal?.45:.8,i);
      put(box,'#7d8157',x,.13,z,hx*2+.16,.26,hz*2+.16);
    };
    for(let z=0;z<7;z++)for(let x=0;x<7;x++){
      const cx=-30+x*10,cz=-30+z*10,w=this.layout[z*7+x];
      const cell=z*7+x;
      if(w[0])wall(cx,cz-5,5,.7,cell,z>0?cell-7:-1);if(w[3])wall(cx-5,cz,.7,5,cell,x>0?cell-1:-1);
      if(x===6&&w[1])wall(cx+5,cz,.7,5,cell,-1);if(z===6&&w[2])wall(cx,cz+5,5,.7,cell,-1);
    }
    // Clear entrance framed with stone pillars, golden caps, lanterns and flowers.
    for(const x of [-5,5]){put(box,'#969780',x,1.8,37,1.1,3.6,1.1);put(box,'#d6bf7b',x,3.65,37,1.3,.25,1.3);put(leaf,'#f1d68e',x,4.1,37,.25,.4,.25);}
    for(let i=0;i<8;i++)put(box,'#baaf82',0,.045,36+i*.75,4,.09,.65);
    for(let i=0;i<40;i++){const side=i%2?-1:1,x=side*(6+(i%5)*.6),z=37+Math.floor(i/5)*.5;put(leaf,i%3?'#e1bd54':'#cf87a6',x,.4,z,.2,.3,.2);}
    for(const x of [-5,5])put(box,'#826743',x,5.9,37,.22,4.7,.22);
    const arrowShape=new T.Shape();arrowShape.moveTo(-2.7,-.25);arrowShape.lineTo(.8,-.25);arrowShape.lineTo(.8,-.75);arrowShape.lineTo(2.5,0);arrowShape.lineTo(.8,.75);arrowShape.lineTo(.8,.25);arrowShape.lineTo(-2.7,.25);arrowShape.closePath();
    const arrowGeometry=new T.ShapeGeometry(arrowShape),arrowMaterial=new T.MeshBasicMaterial({color:'#ffe291'});
    // Each arrow follows the perimeter toward the south entrance, never through a hedge.
    for(const [x,z,yaw,direction] of [[0,-37,Math.PI,-1],[37,0,Math.PI/2,-1],[-37,0,-Math.PI/2,1],[-18,37,0,1],[18,37,0,-1]]){
      const marker=new T.Group();marker.name='Entrance direction';marker.position.set(x,3.4,z);marker.rotation.y=yaw;
      const plaque=new T.Mesh(new T.BoxGeometry(7,2.8,.16),new T.MeshStandardMaterial({color:'#294c38',roughness:.85}));marker.add(plaque);
      const arrow=new T.Mesh(arrowGeometry,arrowMaterial);arrow.position.set(0,-.5,.1);arrow.rotation.z=direction<0?Math.PI:0;marker.add(arrow);
      if(typeof document!=='undefined'){
        const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#294c38';ctx.fillRect(0,0,384,96);ctx.fillStyle='#fff1bd';ctx.textAlign='center';ctx.font='bold 66px sans-serif';ctx.fillText('ВХОД',192,73);const label=new T.Mesh(new T.PlaneGeometry(3.6,.9),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)}));label.position.set(0,.75,.1);marker.add(label);}
      }
      root.add(marker);
    }
    const pedestal=new T.Mesh(new T.CylinderGeometry(2.1,2.4,.3,32),new T.MeshStandardMaterial({color:'#d1bd85',roughness:.8}));pedestal.position.copy(this.rewardPosition);pedestal.position.y=.15;pedestal.receiveShadow=true;root.add(pedestal);
    this.star.position.copy(this.rewardPosition);
    const shape=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.62:1.4,x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}shape.closePath();
    const starGeometry=new T.ExtrudeGeometry(shape,{depth:.32,bevelEnabled:true,bevelSize:.12,bevelThickness:.1,bevelSegments:3,steps:1});starGeometry.center();
    const starMesh=new T.Mesh(starGeometry,new T.MeshStandardMaterial({color:'#ffd35a',metalness:.55,roughness:.22,emissive:'#ffb52e',emissiveIntensity:.65}));this.star.add(starMesh);
    const halo=makeFruitMist(0);halo.material=halo.material.clone();halo.material.color.set('#ffdf7c');halo.material.opacity=.45;halo.position.set(0,0,-.2);halo.scale.set(5,5,1);this.star.add(halo);root.add(this.star);
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#294c38';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#e4c67b';ctx.lineWidth=8;ctx.strokeRect(6,6,756,180);ctx.fillStyle='#fff1bd';ctx.textAlign='center';ctx.font='bold 48px sans-serif';ctx.fillText('ЗВЁЗДНЫЙ ЛАБИРИНТ',384,76);ctx.font='28px sans-serif';ctx.fillText('ВХОД ↓ • найди звезду в глубине лабиринта',384,137);const sign=new T.Mesh(new T.PlaneGeometry(10,2.5),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas)}));sign.position.set(0,8.3,37);root.add(sign);}
    }
    for(const p of parts.values()){const mesh=new T.InstancedMesh(p.geo,new T.MeshStandardMaterial({color:'#ffffff',roughness:.95}),p.matrices.length);p.matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,p.colors[i]);});mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);}
  }
  contains(p:T.Vector3,padding=0){return Math.abs(p.x-MAZE_SITE.x)<MAZE_HALF+padding && Math.abs(p.z-MAZE_SITE.z)<MAZE_HALF+padding;}
  private clear(x:number,z:number,r:number){return !this.walls.some(w=>Math.abs(x-w.x)<w.hx+r && Math.abs(z-w.z)<w.hz+r);}
  constrain(p:T.Vector3,size:number,previous?:T.Vector3){
    const start=previous??p;
    if(Math.min(start.x,p.x)>MAZE_SITE.x+45 || Math.max(start.x,p.x)<MAZE_SITE.x-45 || Math.min(start.z,p.z)>MAZE_SITE.z+45 || Math.max(start.z,p.z)<MAZE_SITE.z-45)return;
    const r=Math.min(3.7,.6*size),target=p.clone().sub(new T.Vector3(MAZE_SITE.x,0,MAZE_SITE.z));
    let x=(previous?.x??p.x)-MAZE_SITE.x,z=(previous?.z??p.z)-MAZE_SITE.z;
    if(!this.clear(x,z,r)){
      let best=Infinity;for(let row=0;row<7;row++)for(let col=0;col<7;col++){const cx=-30+col*MAZE_CELL,cz=-30+row*MAZE_CELL,d=(cx-x)**2+(cz-z)**2;if(d<best){best=d;target.x=cx;target.z=cz;}}
      x=target.x;z=target.z;
    }
    const dx=target.x-x,dz=target.z-z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
    for(let i=0;i<steps;i++){if(this.clear(x+dx/steps,z,r))x+=dx/steps;if(this.clear(x,z+dz/steps,r))z+=dz/steps;}
    p.x=MAZE_SITE.x+x;p.z=MAZE_SITE.z+z;
  }
  moveFruitOutside(p:T.Vector3){if(this.contains(p,3)){const a=Math.atan2(p.z-MAZE_SITE.z,p.x-MAZE_SITE.x);p.x=MAZE_SITE.x+Math.cos(a)*56;p.z=MAZE_SITE.z+Math.sin(a)*56;}}
  private bless(player:CharacterController){
    this.aura=new T.Group();this.aura.name='Golden star blessing';player.actor.add(this.aura);
    player.actor.traverse(o=>{if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&!this.glowMaterials.has(m))this.glowMaterials.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});}});
    const mist=makeFruitMist(0);mist.material=mist.material.clone();mist.material.color.set('#ffe6a1');mist.material.opacity=.22;mist.position.y=1;mist.scale.set(3.8,4,1);this.aura.add(mist);
    this.sparkles=new T.InstancedMesh(new T.OctahedronGeometry(.07),new T.MeshBasicMaterial({color:'#fff0a2'}),28);this.sparkles.frustumCulled=false;this.aura.add(this.sparkles);
  }
  update(dt:number,player?:CharacterController,available=true){
    this.clock+=dt;this.star.position.y=2.25+Math.sin(this.clock*1.7)*.25;this.star.rotation.y=this.clock*.65;
    if(!player)return false;let collected=false;
    player.starRemaining=Math.max(0,player.starRemaining-dt);player.starCooldown=Math.max(0,player.starCooldown-dt);
    if(player.starCooldown===0 && available && player.actor.position.y<.5 && Math.hypot(player.actor.position.x-MAZE_SITE.x-this.rewardPosition.x,player.actor.position.z-MAZE_SITE.z-this.rewardPosition.z)<2){player.starBlessed=true;player.starRemaining=30;player.starCooldown=120;collected=true;}
    this.star.visible=player.starCooldown===0;
    if(player.starRemaining>0){
      if(!this.aura)this.bless(player);
      this.aura!.visible=true;
      for(const m of this.glowMaterials.keys()){m.emissive.set('#ffbe4a');m.emissiveIntensity=.25+.07*Math.sin(this.clock*2);}
      for(let i=0;i<28;i++){const a=i*2.399+this.clock*.7,t=(this.clock*.35+i/28)%1;this.dummy.position.set(Math.cos(a)*(1.05+.25*Math.sin(i)),.1+t*2.5,Math.sin(a)*(1.05+.25*Math.sin(i)));this.dummy.rotation.set(this.clock,i,a);this.dummy.scale.setScalar(Math.sin(t*Math.PI)*(.7+.4*Math.sin(this.clock*3+i)**2));this.dummy.updateMatrix();this.sparkles!.setMatrixAt(i,this.dummy.matrix);}this.sparkles!.instanceMatrix.needsUpdate=true;
    }
    if(player.starRemaining===0 && this.aura?.visible){
      this.aura.visible=false;
      for(const [m,original] of this.glowMaterials){m.emissive.copy(original.color);m.emissiveIntensity=original.intensity;}
    }
    return collected;
  }
}
