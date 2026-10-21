import {drawLocalizedText,localizedCanvasTexture} from './localized-sign';
import { awardFirst } from './score';
import * as T from 'three';
import type { CharacterController } from './controller';
import { MAZE_SITE, MAZE_CELL, MAZE_HALF, mazeLayout, farthestMazeCell, mazeDistances } from './maze-layout';
import {makeMazeEntrance} from './maze-entrance-model';
import {makeCollectibleStar} from './collectible-star';
import {makeFruitMist} from './fruit-mist';
import {makeMazeMasonry,type MazeWall} from './maze-masonry';
type Wall=MazeWall;
export class HedgeMaze {
  readonly group=new T.Group();
  readonly walls:Wall[]=[];
  readonly layout=mazeLayout();
  readonly rewardCell=farthestMazeCell(this.layout);
  readonly rewardPosition=new T.Vector3(-30+(this.rewardCell%7)*10,0,-30+Math.floor(this.rewardCell/7)*10);
  private star=makeCollectibleStar('#ffd35a',1.45,{color:'#ffd12a',opacity:.34});
  private aura?:T.Group;
  private sparkles?:T.InstancedMesh;
  private clock=0;
  private glowMaterials=new Map<T.MeshStandardMaterial|T.MeshLambertMaterial,{color:T.Color;intensity:number}>();
  private dummy=new T.Object3D();
  constructor(){
    const root=this.group;root.name='Stone maze and golden star';root.position.set(MAZE_SITE.x,0,MAZE_SITE.z);
    const distances=mazeDistances(this.layout),maxDistance=Math.max(...distances);
    const rainbow=['#9444d2','#424bc6','#36b7e5','#46a548','#e6cc39','#eb8a2d','#d94048'].map(c=>new T.Color(c));
    const cellColor=(cell:number,shade=1)=>{
      const progress=distances[cell]/maxDistance*6,index=Math.min(5,Math.floor(progress));
      return '#'+rainbow[index].clone().lerp(rainbow[index+1],progress-index).multiplyScalar(shade).getHexString();
    };
    const wall=(x:number,z:number,hx:number,hz:number,cell:number,neighbor:number)=>{this.walls.push({x,z,hx,hz,cell,neighbor});};
    for(let z=0;z<7;z++)for(let x=0;x<7;x++){
      const cx=-30+x*10,cz=-30+z*10,w=this.layout[z*7+x];
      const cell=z*7+x;
      if(w[0])wall(cx,cz-5,5,.7,cell,z>0?cell-7:-1);if(w[3])wall(cx-5,cz,.7,5,cell,x>0?cell-1:-1);
      if(x===6&&w[1])wall(cx+5,cz,.7,5,cell,-1);if(z===6&&w[2])wall(cx,cz+5,5,.7,cell,-1);
    }
    root.add(makeMazeMasonry(this.walls,cell=>new T.Color(cellColor(cell))));
    // Open stone gateway with brass lanterns.
    root.add(makeMazeEntrance());
    const arrowShape=new T.Shape();arrowShape.moveTo(-2.7,-.25);arrowShape.lineTo(.8,-.25);arrowShape.lineTo(.8,-.75);arrowShape.lineTo(2.5,0);arrowShape.lineTo(.8,.75);arrowShape.lineTo(.8,.25);arrowShape.lineTo(-2.7,.25);arrowShape.closePath();
    const arrowGeometry=new T.ShapeGeometry(arrowShape),arrowMaterial=new T.MeshBasicMaterial({color:'#ffe291'});
    // Each arrow follows the perimeter toward the south entrance, never through a hedge.
    for(const [x,z,yaw,direction] of [[0,-37,Math.PI,-1],[37,0,Math.PI/2,-1],[-37,0,-Math.PI/2,1],[-18,37,0,1],[18,37,0,-1]]){
      const marker=new T.Group();marker.name='Entrance direction';marker.position.set(x,3.4,z);marker.rotation.y=yaw;
      const plaque=new T.Mesh(new T.BoxGeometry(7,2.8,.16),new T.MeshStandardMaterial({color:'#294c38',roughness:.85}));marker.add(plaque);
      const arrow=new T.Mesh(arrowGeometry,arrowMaterial);arrow.position.set(0,-.5,.1);arrow.rotation.z=direction<0?Math.PI:0;marker.add(arrow);
      if(typeof document!=='undefined'){
        const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#294c38';ctx.fillRect(0,0,384,96);ctx.fillStyle='#fff1bd';ctx.textAlign='center';ctx.font='bold 66px sans-serif';drawLocalizedText(ctx,'ВХОД',192,73);const label=new T.Mesh(new T.PlaneGeometry(3.6,.9),new T.MeshBasicMaterial({map:localizedCanvasTexture(canvas)}));label.position.set(0,.75,.1);marker.add(label);}
      }
      root.add(marker);
    }
    const pedestal=new T.Mesh(new T.CylinderGeometry(2.1,2.4,.3,32),new T.MeshStandardMaterial({color:'#d1bd85',roughness:.8}));pedestal.position.copy(this.rewardPosition);pedestal.position.y=.15;pedestal.receiveShadow=true;root.add(pedestal);
    this.star.position.copy(this.rewardPosition);
    this.star.name='Maze golden collectible star';root.add(this.star);
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#294c38';ctx.fillRect(0,0,768,192);ctx.strokeStyle='#e4c67b';ctx.lineWidth=8;ctx.strokeRect(6,6,756,180);ctx.fillStyle='#fff1bd';ctx.textAlign='center';ctx.font='bold 48px sans-serif';ctx.textBaseline='middle';drawLocalizedText(ctx,'ЗВЁЗДНЫЙ ЛАБИРИНТ',384,96);const sign=new T.Mesh(new T.PlaneGeometry(10,2.5),new T.MeshBasicMaterial({map:localizedCanvasTexture(canvas)}));sign.position.set(0,8.3,37);root.add(sign);}
    }

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
    player.actor.traverse(o=>{if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if((m instanceof T.MeshStandardMaterial||m instanceof T.MeshLambertMaterial)&&!this.glowMaterials.has(m))this.glowMaterials.set(m,{color:m.emissive.clone(),intensity:m.emissiveIntensity});}});
    const mist=makeFruitMist(0);mist.material=mist.material.clone();mist.material.color.set('#ffe6a1');mist.material.opacity=.22;mist.position.y=1;mist.scale.set(3.8,4,1);this.aura.add(mist);
    this.sparkles=new T.InstancedMesh(new T.OctahedronGeometry(.07),new T.MeshBasicMaterial({color:'#fff0a2'}),28);this.sparkles.frustumCulled=false;this.aura.add(this.sparkles);
  }
  reset(){
    for(const [m,original] of this.glowMaterials){m.emissive.copy(original.color);m.emissiveIntensity=original.intensity;}
    this.glowMaterials.clear();
    if(this.sparkles){this.sparkles.geometry.dispose();this.sparkles.dispose();}
    const materials=new Set<T.Material>();
    this.aura?.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Sprite)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
    for(const material of materials)material.dispose();this.aura?.removeFromParent();
    this.aura=undefined;this.sparkles=undefined;this.star.visible=true;
  }
  update(dt:number,player?:CharacterController,available=true){
    this.clock+=dt;this.star.position.y=2.25+Math.sin(this.clock*1.7)*.25;this.star.rotation.y=this.clock*.65;
    if(!player)return false;let collected=false;
    player.starRemaining=Math.max(0,player.starRemaining-dt);player.starCooldown=Math.max(0,player.starCooldown-dt);
    if(player.starCooldown===0 && available && player.actor.position.y<.5 && Math.hypot(player.actor.position.x-MAZE_SITE.x-this.rewardPosition.x,player.actor.position.z-MAZE_SITE.z-this.rewardPosition.z)<2){awardFirst(player,'star');player.starBlessed=true;player.activateStarPower();player.starCooldown=120;collected=true;}
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
