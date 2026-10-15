import {NUMBER_GARDEN_SITE as SITE,outsideNumberGarden,canPressNumber} from './number-garden-site';
export const NUMBER_ROUNDS=6,NUMBER_EMPTY_MS=10000,NUMBER_ERROR_MS=1300,NUMBER_ROUND_MS=1100,NUMBER_CELEBRATE_MS=6000;
export type NumberProblem={left:number;right:number;operator:'+'|'−'};
export type NumberActor={id:string;p:readonly number[];size:number;available?:boolean;present?:boolean};
export type NumberGame={startedAt:number;stageAt:number;round:number;cursor:number;stage:'answer'|'error'|'round'|'celebrate';problems:NumberProblem[];players:string[];winners:string[];wrongDigit?:number;emptySince?:number};
export function numberAnswer(p:NumberProblem){return String(p.operator==='+'?p.left+p.right:p.left-p.right);}
export function createNumberProblems(random=Math.random):NumberProblem[]{
 const pick=(min:number,max:number)=>min+Math.floor(Math.max(0,Math.min(.999999999,random()))*(max-min+1));
 const leftSingle=pick(2,9),addTens=pick(1,8),addUnits=pick(0,9);
 const subTens=pick(2,9),subUnits=pick(0,9),carryUnits=pick(1,9),borrowTens=pick(2,9),borrowUnits=pick(0,8);
 return [
  {left:pick(1,9),right:pick(1,9),operator:'+'},
  {left:leftSingle,right:pick(1,leftSingle-1),operator:'−'},
  {left:addTens*10+addUnits,right:pick(1,9-addTens)*10+pick(0,9-addUnits),operator:'+'},
  {left:subTens*10+subUnits,right:pick(1,subTens-1)*10+pick(0,subUnits),operator:'−'},
  {left:pick(1,9)*10+carryUnits,right:pick(1,9)*10+pick(10-carryUnits,9),operator:'+'},
  {left:borrowTens*10+borrowUnits,right:pick(1,borrowTens-1)*10+pick(borrowUnits+1,9),operator:'−'},
 ];
}
export function validNumberProblem(p:NumberProblem,round:number){
 if(!Number.isInteger(round)||round<1||round>NUMBER_ROUNDS)return false;
 const min=round<=2?1:10,max=round<=2?9:99;
 if(!p||!Number.isInteger(p.left)||!Number.isInteger(p.right)||p.left<min||p.left>max||p.right<min||p.right>max||p.operator!==(round%2?'+' : '−')||!(round%2)&&p.left<=p.right)return false;
 if(round===3)return p.left%10+p.right%10<10&&Math.floor(p.left/10)+Math.floor(p.right/10)<10;
 if(round===4)return p.left%10>=p.right%10;
 if(round===5)return p.left%10+p.right%10>=10;
 if(round===6)return p.left%10<p.right%10;
 return true;
}
export function onNumberGarden(a:NumberActor){return a.present!==false&&a.p.length===3&&a.p.every(Number.isFinite)&&Math.abs(a.p[1])<12&&!outsideNumberGarden(a.p[0],a.p[2],6);}
export function nearNumberButton(a:NumberActor){return a.available!==false&&a.present!==false&&a.p.length===3&&[...a.p,a.size].every(Number.isFinite)&&Math.abs(a.p[1])<3.6&&Math.hypot(a.p[0]-SITE.buttonX,a.p[2]-SITE.buttonZ)<2.4+.45*Math.max(.3,Math.min(3,a.size));}
export function startNumberGame(old:NumberGame|undefined,a:NumberActor,now:number,random=Math.random):NumberGame|undefined{
 if(old||!nearNumberButton(a)||!Number.isFinite(now))return old;
 return {startedAt:now,stageAt:now,round:1,cursor:0,stage:'answer',problems:createNumberProblems(random),players:[a.id],winners:[]};
}
export function numberDeadline(q:NumberGame){return Math.min(q.stage==='answer'?Infinity:q.stageAt+(q.stage==='error'?NUMBER_ERROR_MS:q.stage==='round'?NUMBER_ROUND_MS:NUMBER_CELEBRATE_MS),q.emptySince===undefined?Infinity:q.emptySince+NUMBER_EMPTY_MS);}
export function advanceNumberGame(q:NumberGame|undefined,now:number,actors?:readonly NumberActor[]):NumberGame|undefined{
 if(!q)return;
 if(q.stage!=='celebrate'&&actors){const present=actors.some(a=>q!.players.includes(a.id)&&onNumberGarden(a));if(present&&q.emptySince!==undefined)q={...q,emptySince:undefined};else if(!present&&q.emptySince===undefined)q={...q,emptySince:now};}
 if(q.emptySince!==undefined&&now>=q.emptySince+NUMBER_EMPTY_MS)return;
 if(now<numberDeadline(q))return q;
 if(q.stage==='celebrate')return;
 if(q.stage==='error')return {...q,stage:'answer',stageAt:numberDeadline(q),cursor:0,wrongDigit:undefined};
 if(q.stage==='round')return {...q,stage:'answer',stageAt:numberDeadline(q),round:q.round+1,cursor:0};
 return q;
}
export function pressNumberGame(q:NumberGame|undefined,digit:unknown,a:NumberActor,now:number,actors:readonly NumberActor[]=[a]):NumberGame|undefined{
 if(!q||q.stage!=='answer'||a.available===false||!onNumberGarden(a)||!canPressNumber(digit,{x:a.p[0],y:a.p[1],z:a.p[2]},a.size)||!Number.isFinite(now))return q;
 const players=q.players.includes(a.id)?q.players:[...q.players,a.id],answer=numberAnswer(q.problems[q.round-1]);
 const next={...q,players,stageAt:now,emptySince:undefined};
 if(String(digit)!==answer[q.cursor])return {...next,stage:'error',wrongDigit:digit as number};
 const cursor=q.cursor+1;
 if(cursor<answer.length)return {...next,cursor};
 if(q.round<NUMBER_ROUNDS)return {...next,cursor,stage:'round'};
 return {...next,cursor,stage:'celebrate',winners:players.filter(id=>actors.some(a=>a.id===id&&onNumberGarden(a)))};
}
export function validNumberGame(value:unknown):value is NumberGame{
 const q=value as NumberGame;
 if(!q||!Number.isFinite(q.startedAt)||!Number.isFinite(q.stageAt)||!Number.isInteger(q.round)||q.round<1||q.round>6||!['answer','error','round','celebrate'].includes(q.stage)||!Array.isArray(q.problems)||q.problems.length!==6)return false;
 if(!q.problems.every((p,i)=>validNumberProblem(p,i+1)))return false;
 const length=numberAnswer(q.problems[q.round-1]).length;
 return Number.isInteger(q.cursor)&&q.cursor>=0&&q.cursor<=length&&((q.stage==='round'||q.stage==='celebrate')?q.cursor===length:q.cursor<length)&&(q.stage!=='celebrate'||q.round===6)&&(q.stage!=='round'||q.round<6)&&(q.stage!=='error'||Number.isInteger(q.wrongDigit)&&q.wrongDigit!>=0&&q.wrongDigit!<=9)&&(q.emptySince===undefined||Number.isFinite(q.emptySince))&&Array.isArray(q.players)&&q.players.length>0&&q.players.length<=14&&q.players.every(id=>typeof id==='string'&&id.length<=128)&&new Set(q.players).size===q.players.length&&Array.isArray(q.winners)&&q.winners.every(id=>q.players.includes(id));
}
