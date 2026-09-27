import {HISTORY_INTERVAL,type DeviceInfo,type SoloReport} from './history-types';
type Snapshot={name:string;variant:number;score:number;tasksDone:number;tasksTotal:number};
/** Best-effort telemetry. No request is awaited by the game or its render loop. */
export class SoloHistory{
 private id=crypto.randomUUID();private startedAt=Date.now();private startScore:number;
 private seq=0;private activeMs=0;private last=performance.now();private visible=!document.hidden;private stopped=false;
 private timer:ReturnType<typeof setInterval>;
 constructor(private base:string,private snapshot:()=>Snapshot,private device:()=>DeviceInfo){
  this.startScore=snapshot().score;
  document.addEventListener('visibilitychange',this.visibility);window.addEventListener('pagehide',this.stop);
  this.timer=setInterval(()=>this.report(false),HISTORY_INTERVAL);this.report(false);
 }
 private visibility=()=>{this.account();this.visible=!document.hidden;this.report(false);};
 private account(){const now=performance.now();if(this.visible)this.activeMs+=Math.max(0,now-this.last);this.last=now;}
 private report(end:boolean){
  try{
   this.account();const a=this.snapshot();
   const report:SoloReport={...a,id:this.id,seq:this.seq++,startedAt:this.startedAt,activeMs:Math.round(this.activeMs),startScore:this.startScore,end,device:this.device()};
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
   // text/plain avoids a CORS preflight and keepalive allows a final report during navigation.
   void fetch(this.base.replace(/\/$/,'')+'/history/solo',{method:'POST',body:JSON.stringify(report),headers:{'Content-Type':'text/plain'},keepalive:true,signal:controller.signal}).catch(()=>{}).finally(()=>clearTimeout(timeout));
  }catch{/* Analytics must never interrupt gameplay, even when serialization or fetch throws. */}
 }
 stop=()=>{if(this.stopped)return;this.stopped=true;clearInterval(this.timer);document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pagehide',this.stop);this.report(true);};
}
