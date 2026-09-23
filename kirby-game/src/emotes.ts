import {Object3D} from 'three';
export const EMOTES=[{id:'Hello',name:'Привет',icon:'👋'},{id:'Joy',name:'Радость',icon:'✨'},{id:'Fear',name:'Испуг',icon:'😳'},{id:'Anger',name:'Гнев',icon:'💢'},{id:'Sad',name:'Грусть',icon:'💧'}] as const;
export type Emote=typeof EMOTES[number]['id'];
export function emoteSector(x:number,y:number){if(Math.hypot(x,y)<.4)return undefined;return Math.round((Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2)/(Math.PI*2/5))%5;}
export class EmotePose {
 elapsed=0;
 private restore:(()=>void)[]=[];
 constructor(readonly kind:Emote,private root:Object3D){}
 clear(){for(const restore of this.restore)restore();this.restore=[];}
 private node(name:string){return this.root.getObjectByName(name)??this.root.getObjectByName(name.replaceAll('_',' '));}
 update(dt:number){
  this.elapsed+=dt;const t=this.elapsed,duration=this.kind==='Hello'?2.7:2.4;
  const e=Math.min(1,t/.18)*Math.min(1,Math.max(0,(duration-t)/.3));
  const nodes=[this.root,this.node('Left_shoulder'),this.node('Right_shoulder'),this.node('Left_foot_pivot'),this.node('Right_foot_pivot')];
  for(const n of nodes)if(n){const p=n.position.clone(),q=n.quaternion.clone();this.restore.push(()=>{n.position.copy(p);n.quaternion.copy(q);});}
  const [root,left,right,lf,rf]=nodes;
  if(this.kind==='Hello'){root!.position.y+=Math.max(0,Math.sin(Math.min(1,t/.7)*Math.PI))*.45*e;right?.rotateZ((1.05+.3*Math.sin(t*17))*e);}
  if(this.kind==='Joy'){root!.position.y+=Math.abs(Math.sin(t*Math.PI*2.2))*.55*e;left?.rotateZ(-1.1*e);right?.rotateZ(1.1*e);root!.rotateZ(Math.sin(t*8)*.08*e);}
  if(this.kind==='Fear'){root!.position.y+=Math.max(0,Math.sin(Math.min(1,t/.55)*Math.PI))*.35;root!.rotateX(-.14*e);left?.rotateY(1.1*e);right?.rotateY(-1.1*e);left?.rotateZ(-.65*e);right?.rotateZ(.65*e);root!.rotateZ(Math.sin(t*38)*.035*e);}
  if(this.kind==='Anger'){root!.rotateX(.12*e);root!.position.y+=Math.abs(Math.sin(t*12))*.06*e;if(lf)lf.position.y+=Math.max(0,Math.sin(t*12))*.19*e;if(rf)rf.position.y+=Math.max(0,-Math.sin(t*12))*.19*e;left?.rotateZ(-.55*e);right?.rotateZ(.55*e);}
  if(this.kind==='Sad'){root!.rotateX(.28*e);root!.position.y-=.1*e;left?.rotateZ(.25*e);right?.rotateZ(-.25*e);}
  return t>=duration;
 }
}
export class EmoteWheel {
 readonly element=document.createElement('div');
 private choices:HTMLElement[]=[];
 open=false;
 selected:number|undefined;
 constructor(){
  this.element.className='emote-wheel';this.element.hidden=true;this.element.setAttribute('role','dialog');this.element.setAttribute('aria-label','Выбор эмоции');
  const center=document.createElement('div');center.className='emote-center';center.textContent='Эмоции';this.element.append(center);
  EMOTES.forEach((emote,i)=>{const item=document.createElement('div');item.className='emote-choice';item.textContent=`${emote.icon} ${emote.name}`;const a=i*Math.PI*2/5;item.style.left=`${50+34*Math.sin(a)}%`;item.style.top=`${50-34*Math.cos(a)}%`;this.element.append(item);this.choices.push(item);});
  const help=document.createElement('p');help.textContent='Стик — выбрать · отпусти LB — показать · B — отмена';this.element.append(help);document.body.append(this.element);
 }
 update(held:boolean,x:number,y:number,cancel=false):Emote|undefined{
  if(cancel){this.close();return;}
  if(held){this.open=true;this.element.hidden=false;this.selected=emoteSector(x,y);this.choices.forEach((c,i)=>c.classList.toggle('selected',i===this.selected));return;}
  const result=this.open && this.selected!==undefined?EMOTES[this.selected].id:undefined;this.close();return result;
 }
 close(){this.open=false;this.selected=undefined;this.element.hidden=true;}
}
