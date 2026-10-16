import {MILL_BAKERY_TABLE,MILL_BAKERY_OVEN} from './mill-bakery-site';
/** Shared mill quest rules: used unchanged by solo play and the authoritative room. */
export const MILL_TABLE=[MILL_BAKERY_TABLE.x,0,MILL_BAKERY_TABLE.z+2] as const;
export const MILL_OVEN=[MILL_BAKERY_OVEN.x,0,MILL_BAKERY_OVEN.z+3] as const;
export const MILL_BAKE_MS=10000,MILL_KNEAD_MS=450;
export const MILL_QUEST_LEVER=[49,0,40.5] as const;
export const MILL_INTAKE=[42.8,-.12,37.7] as const;
export const MILL_BRANCHES=[[42.8,-.12,34.5],[42.8,-.12,37.5],[42.8,-.12,40.5]] as const;
export const MILL_BAGS=[[80,0,40],[53,0,65],[76,0,69]] as const;
export const MILL_HOPPER=[56.5,0,39] as const;
export const MILL_COLORS=['#ef6579','#f4c64c','#61b9ee'] as const;
export const MILL_COLOR_NAMES=['красный','золотой','голубой'] as const;
export const MILL_RUN_MS=60000,MILL_IDLE_MS=180000;
export type MillStage='idle'|'clear'|'flow'|'bags'|'knead'|'bake'|'running';
export type MillQuest={stage:MillStage;owner:string;startedAt:number;updatedAt:number;branches:number[];gate:number;steadyAt:number;order:number[];delivered:number;deliveredAt:number;carried:number;rejected:number;rejectedAt:number;runningUntil:number;kneadStep:number;bakeAt:number;completedAt:number};
export type MillAction={kind:'start'|'gate'|'deliver'|'flour'|'mix'|'knead'|'load'|'collect'}|{kind:'push'|'pick';index:number};
export type MillActor={id:string;p:readonly number[];yaw:number;size:number;available?:boolean};
export const newMillQuest=():MillQuest=>({stage:'idle',owner:'',startedAt:0,updatedAt:0,branches:[0,0,0],gate:0,steadyAt:0,order:[0,1,2],delivered:0,deliveredAt:0,carried:-1,rejected:-1,rejectedAt:0,runningUntil:0,kneadStep:0,bakeAt:0,completedAt:0});
export const millWorking=(q:MillQuest)=>['knead','bake','running'].includes(q.stage);
export const millCarrying=(q:MillQuest|undefined,id:string)=>q?.owner===id&&(q.carried>=0||q.stage==='knead'&&q.kneadStep===1||q.stage==='bake'&&!q.bakeAt);
export function millNear(a:MillActor,p:readonly number[],radius=3.5){return a.available!==false&&Math.hypot(a.p[0]-p[0],a.p[2]-p[2])<radius+Math.min(14,a.size*.7)&&Math.abs(a.p[1]-p[1])<3;}
export function advanceMill(q:MillQuest,now:number,ownerPresent=true):MillQuest{
 if(q.stage==='idle')return q;
 if(q.stage==='running')return now>=q.runningUntil?newMillQuest():q;
 if(!ownerPresent||!(q.stage==='bake'&&q.bakeAt>0)&&now-q.updatedAt>=MILL_IDLE_MS)return newMillQuest();
 if(q.stage==='flow'&&q.gate===1&&q.steadyAt>0&&now-q.steadyAt>=3000)return {...q,stage:'bags',updatedAt:now};
 return q;
}
export function millPushTarget(q:MillQuest,a:MillActor){
 if(q.stage!=='clear'||q.owner!==a.id)return -1;
 return MILL_BRANCHES.findIndex((p,i)=>{const dx=p[0]-a.p[0],dz=p[2]-a.p[2],d=Math.hypot(dx,dz);return !q.branches[i]&&millNear(a,p,2.6+Math.min(3,a.size))&&(d<.5||(dx*Math.sin(a.yaw)+dz*Math.cos(a.yaw))/d>.3);});
}
export function applyMill(q:MillQuest,action:MillAction,a:MillActor,now:number):MillQuest{
 q=advanceMill(q,now);
 if(action.kind==='start'){
  if(q.stage!=='idle'||!millNear(a,MILL_QUEST_LEVER))return q;
  const orders=[[0,2,1],[1,0,2],[2,1,0],[0,1,2],[2,0,1],[1,2,0]];
  return {...newMillQuest(),stage:'clear',owner:a.id,startedAt:now,updatedAt:now,order:orders[Math.floor(now/1000)%6].slice()};
 }
 if(q.owner!==a.id||a.available===false)return q;
 if(action.kind==='push'&&millPushTarget(q,a)===action.index&&action.index>=0){
  const branches=q.branches.slice();branches[action.index]=now;
  return {...q,branches,stage:branches.every(Boolean)?'flow':'clear',updatedAt:now};
 }
 if(action.kind==='gate'&&q.stage==='flow'&&millNear(a,MILL_QUEST_LEVER)){
  // First low, then excessive, then balanced: observe the gauge, rather than hold E.
  const gate=q.gate===0?2:q.gate===2?1:0;
  return {...q,gate,steadyAt:gate===1?now:0,updatedAt:now};
 }
 if(action.kind==='pick'&&q.stage==='bags'&&q.carried<0&&Number.isInteger(action.index)&&action.index>=0&&action.index<3&&!q.order.slice(0,q.delivered).includes(action.index)&&millNear(a,MILL_BAGS[action.index],1.4)&&now-q.rejectedAt>1200)return {...q,carried:action.index,updatedAt:now};
 if(action.kind==='deliver'&&q.stage==='bags'&&q.carried>=0&&millNear(a,MILL_HOPPER)){
  if(q.carried!==q.order[q.delivered])return {...q,rejected:q.carried,rejectedAt:now,carried:-1,updatedAt:now};
  const delivered=q.delivered+1;
  return {...q,delivered,deliveredAt:now,carried:-1,stage:delivered===3?'knead':'bags',updatedAt:now};
 }
 if(q.stage==='knead'){
  if(action.kind==='flour'&&q.kneadStep===0&&millNear(a,MILL_HOPPER,2))return {...q,kneadStep:1,updatedAt:now};
  if(!millNear(a,MILL_TABLE,1.65))return q;
  if(action.kind==='mix'&&q.kneadStep===1)return {...q,kneadStep:2,updatedAt:now};
  if(action.kind==='knead'&&q.kneadStep>=2&&q.kneadStep<5&&now-q.updatedAt>=MILL_KNEAD_MS){
   const kneadStep=q.kneadStep+1;return {...q,kneadStep,stage:kneadStep===5?'bake':'knead',updatedAt:now};
  }
 }
 if(q.stage==='bake'&&millNear(a,MILL_OVEN,1.65)){
  if(action.kind==='load'&&!q.bakeAt)return {...q,bakeAt:now,updatedAt:now};
  if(action.kind==='collect'&&q.bakeAt>0&&now-q.bakeAt>=MILL_BAKE_MS)return {...q,stage:'running',completedAt:now,runningUntil:now+MILL_RUN_MS,updatedAt:now};
 }
 return q;
}

/** Saved timers pause while the solo game is closed. */
export function restoreMillQuest(q:MillQuest,savedAt:number,now:number){
 const shift=Math.max(0,now-savedAt),next={...q};
 for(const key of ['startedAt','updatedAt','steadyAt','deliveredAt','rejectedAt','runningUntil','bakeAt','completedAt'] as const)if(next[key]>0)next[key]+=shift;
 next.branches=q.branches.map(t=>t>0?t+shift:0);return next;
}
export function validMillQuest(value:unknown):value is MillQuest{
 const q=value as MillQuest,integer=(v:number,min:number,max:number)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(!q||!['idle','clear','flow','bags','knead','bake','running'].includes(q.stage)||typeof q.owner!=='string'||q.owner.length>80)return false;
 if(!['startedAt','updatedAt','steadyAt','deliveredAt','rejectedAt','runningUntil','bakeAt','completedAt'].every(k=>Number.isFinite(q[k as keyof MillQuest])&&Number(q[k as keyof MillQuest])>=0))return false;
 return Array.isArray(q.branches)&&q.branches.length===3&&q.branches.every(t=>Number.isFinite(t)&&t>=0)&&Array.isArray(q.order)&&q.order.length===3&&new Set(q.order).size===3&&q.order.every(n=>integer(n,0,2))&&integer(q.gate,0,2)&&integer(q.delivered,0,3)&&integer(q.carried,-1,2)&&integer(q.rejected,-1,2)&&integer(q.kneadStep,0,5)&&(!['knead','bake','running'].includes(q.stage)||q.delivered===3)&&(q.stage!=='bake'||q.kneadStep===5)&&(q.stage!=='running'||q.completedAt>0&&q.bakeAt>0)&&(q.stage==='idle'||q.owner.length>0);
}
