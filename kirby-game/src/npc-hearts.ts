import {Vector3,type Camera} from 'three';
import type {KirbyNpc} from './npcs';
export class NpcHearts {
 private rows=new Map<KirbyNpc,{health:number;remaining:number;element:HTMLDivElement}>();
 private anchor=new Vector3();
 constructor(private onSleep:(npc:KirbyNpc)=>void=()=>{}){}
 update(npcs:readonly KirbyNpc[],dt:number,camera:Camera,visible=true){
  for(const [npc,row] of this.rows)if(!npcs.includes(npc)){row.element.remove();this.rows.delete(npc);}
  for(const npc of npcs){let row=this.rows.get(npc);if(!row){const element=document.createElement('div');element.className='npc-hearts';element.hidden=true;element.setAttribute('role','img');document.body.append(element);row={health:3,remaining:0,element};this.rows.set(npc,row);}
   row.remaining=Math.max(0,row.remaining-dt);
   if(row.health!==npc.health){if(row.health>npc.health){row.remaining=npc.health===0?2.5:5;if(npc.health===0)this.onSleep(npc);}else row.remaining=0;
    row.health=npc.health;row.element.setAttribute('aria-label',`${npc.variant[0]}: ${npc.health} из 3 жизней`);
    row.element.innerHTML=Array.from({length:3},(_,i)=>`<svg viewBox="0 0 32 30" class="${i<npc.health?'full':'empty'}" aria-hidden="true"><path class="heart" d="M16 27C12 23 2 17 2 9a7 7 0 0 1 14-2A7 7 0 0 1 30 9c0 8-10 14-14 18Z"/><path class="shine" d="M6 10c0-3 3-5 5-3"/></svg>`).join('');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)row.element.animate([{scale:'1.18'},{scale:'1'}],{duration:220,easing:'ease-out'});
   }
   this.anchor.copy(npc.actor.position);this.anchor.y+=(npc.isDown?2.5:3.3)*npc.actor.scale.x;this.anchor.project(camera);
   row.element.hidden=!visible||row.remaining===0||this.anchor.z< -1||this.anchor.z>1||Math.abs(this.anchor.x)>1.1||Math.abs(this.anchor.y)>1.1;
   row.element.style.left=`${(this.anchor.x*.5+.5)*innerWidth}px`;row.element.style.top=`${(-this.anchor.y*.5+.5)*innerHeight}px`;
  }
 }
}
