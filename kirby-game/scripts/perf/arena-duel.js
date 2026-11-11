// Arena: starts a solo duel, forces every phase and reports frame cost and worst frame gaps.
const {cosmicArena:A,c,renderer}=__api,out=[];
await A.enter(c);
const times=[];const upd=A.update.bind(A),ren=A.render.bind(A);let u=0;A.update=(...a)=>{const t=performance.now();try{return upd(...a);}finally{u=performance.now()-t;}};A.render=()=>{const t=performance.now();renderer.info.autoReset=false;renderer.info.reset();try{return ren();}finally{times.push([u,performance.now()-t,renderer.info.render.calls,renderer.info.render.triangles,performance.now()]);renderer.info.autoReset=true;}};
const q=(a,p)=>{a=[...a].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(a.length*p))];};
const sample=async(label,ms)=>{times.length=0;await __sleep(ms);const t=times.slice();if(t.length<3){out.push(label+': no frames');return;}const gaps=t.slice(1).map((x,i)=>x[4]-t[i][4]);out.push(label.padEnd(34)+' fps '+((t.length-1)*1000/(t.at(-1)[4]-t[0][4])).toFixed(1)+' | update '+q(t.map(x=>x[0]),.5).toFixed(1)+' (p95 '+q(t.map(x=>x[0]),.95).toFixed(1)+') render '+q(t.map(x=>x[1]),.5).toFixed(1)+' (p95 '+q(t.map(x=>x[1]),.95).toFixed(1)+', max '+q(t.map(x=>x[1]),1).toFixed(0)+') | calls '+q(t.map(x=>x[2]),.5)+'–'+q(t.map(x=>x[2]),1)+' tris '+(q(t.map(x=>x[3]),.5)/1e3).toFixed(0)+'k | worst frame gap '+q(gaps,1).toFixed(0)+' ms');};
await sample('idle before duel',3000);
const k=A.knight.actor.position;c.actor.position.set(k.x,0,k.z+4);await __sleep(300);A.startBattle();await __sleep(500);A.toggleGodMode();out.push('duel engaged='+A.engaged+' stage='+A.battle?.stage+' late pending='+A.battleView.late.length);
await sample('duel start / countdown',6000);
for(const [phase,sub] of [[1],[2],[3],[4,1],[4,2],[4,3]]){const ok=A.setPhase(phase,sub);await sample('phase '+phase+(sub?'.'+sub:'')+' (set='+ok+', stage '+A.battle?.stage+')',12000);out.push('     stage now '+A.battle?.stage+', god='+A.godMode);}
out.push('late pending at end='+A.battleView.late.length+', programs '+renderer.info.programs.length);
return out.join('\n');
