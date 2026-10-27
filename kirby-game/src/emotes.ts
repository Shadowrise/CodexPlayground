import {t,onLocaleChange} from './i18n';
import { poseFace } from './emote-face';
import {Object3D} from 'three';
export const EMOTES=[{id:'Hello',name:'Привет',icon:'👋'},{id:'Joy',name:'Радость',icon:'✨'},{id:'Fear',name:'Испуг',icon:'😳'},{id:'Anger',name:'Гнев',icon:'💢'},{id:'Sad',name:'Грусть',icon:'💧'}] as const;
export type Emote=typeof EMOTES[number]['id'];
export const PIGEON_EMOTES=[...EMOTES,{id:'Peck',name:'Клевать с земли',icon:'🌱'}] as const;
export type PlayerEmote=typeof PIGEON_EMOTES[number]['id'];
export const emotesFor=(pigeon=false)=>pigeon?PIGEON_EMOTES:EMOTES;
export function emoteSector(x:number,y:number,count:number=EMOTES.length){if(Math.hypot(x,y)<.4)return undefined;return Math.round((Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2)/(Math.PI*2/count))%count;}
/** Keep the last choice and consume the gesture until the stick returns to neutral. */
export class EmoteWheelSelection {
 open=false;
 selected:number|undefined;
 private waitingForNeutral=false;
 private cancelledUntilRelease=false;
 get blocksMovement(){return this.open||this.waitingForNeutral||this.cancelledUntilRelease;}
 update(held:boolean,x:number,y:number,cancel=false,count:number=EMOTES.length):number|undefined {
  const neutral=Math.hypot(x,y)<.2;
  if(neutral)this.waitingForNeutral=false;
  if(cancel&&(this.open||held)){
   this.open=false;this.selected=undefined;this.waitingForNeutral=!neutral;this.cancelledUntilRelease=held;return;
  }
  if(this.cancelledUntilRelease){if(!held)this.cancelledUntilRelease=false;return;}
  if(held){
   if(!this.open)this.selected=undefined;
   this.open=true;
   const sector=emoteSector(x,y,count);if(sector!==undefined)this.selected=sector;
   return;
  }
  if(!this.open)return;
  const result=this.selected;
  this.open=false;this.selected=undefined;this.waitingForNeutral=!neutral;
  return result;
 }
 reset(){this.open=false;this.selected=undefined;this.waitingForNeutral=this.cancelledUntilRelease=false;}
}
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
  poseFace(this.root,this.kind,e,this.restore);
  return t>=duration;
 }
}
export class EmoteWheel {
 readonly element=document.createElement('div');
 private choices:HTMLElement[]=[];
  private emotes:readonly typeof PIGEON_EMOTES[number][]=EMOTES;
 private selection=new EmoteWheelSelection();
 get open(){return this.selection.open;}
 get selected(){return this.selection.selected;}
 get blocksMovement(){return this.selection.blocksMovement;}
 constructor(){
  this.element.className='emote-wheel';this.element.hidden=true;this.element.setAttribute('role','dialog');this.element.setAttribute('aria-label',t('Выбор эмоции'));
  const center=document.createElement('div');center.className='emote-center';center.textContent=t('Эмоции');this.element.append(center);
  this.renderChoices();
  const help=document.createElement('p');help.textContent=t('Стик — выбрать · отпусти LB — показать · B — отмена');this.element.append(help);document.body.append(this.element);
  onLocaleChange(()=>this.choices.forEach((choice,i)=>choice.textContent=`${this.emotes[i].icon} ${t(this.emotes[i].name)}`));
 }
 private renderChoices(){
  for(const choice of this.choices)choice.remove();this.choices=[];
  this.emotes.forEach((emote,i)=>{const item=document.createElement('div');item.className='emote-choice';item.textContent=`${emote.icon} ${t(emote.name)}`;const a=i*Math.PI*2/this.emotes.length;item.style.left=`${50+34*Math.sin(a)}%`;item.style.top=`${50-34*Math.cos(a)}%`;this.element.append(item);this.choices.push(item);});
 }
 setPigeon(pigeon:boolean){const emotes=emotesFor(pigeon);if(this.emotes===emotes)return;this.close();this.emotes=emotes;this.renderChoices();}
 update(held:boolean,x:number,y:number,cancel=false):PlayerEmote|undefined{
  const index=this.selection.update(held,x,y,cancel,this.emotes.length);
  this.element.hidden=!this.open;this.choices.forEach((choice,i)=>choice.classList.toggle('selected',i===this.selected));
  return index===undefined?undefined:this.emotes[index].id;
 }
 close(){this.selection.reset();this.element.hidden=true;this.choices.forEach(choice=>choice.classList.remove('selected'));}
}
