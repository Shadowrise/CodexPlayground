// Arena: first and second entry time, long tasks, background program readiness and frame pacing meanwhile.
const {cosmicArena:A,c,renderer}=__api,out=[];
const long=[];new PerformanceObserver(l=>long.push(...l.getEntries().map(e=>Math.round(e.duration)))).observe({type:'longtask'});
const frames=[];let last=0,run=true;const tick=()=>{const n=performance.now();if(last)frames.push(n-last);last=n;if(run)requestAnimationFrame(tick);};
const t0=performance.now();await A.enter(c);const enterMs=performance.now()-t0;
out.push('first entry: '+enterMs.toFixed(0)+' ms, active='+A.active+', long tasks >60ms '+JSON.stringify(long.filter(x=>x>60)));
requestAnimationFrame(tick);
const bv=A.battleView,t1=performance.now();let vistaAt=0;
while(bv.late.length&&performance.now()-t1<90000){await __sleep(100);if(!vistaAt&&bv.late.length<2)vistaAt=performance.now()-t1;}
out.push('vista detail arrived after '+vistaAt.toFixed(0)+' ms; all late programs ready after '+(performance.now()-t1).toFixed(0)+' ms; pending '+bv.late.length);
const s=[...frames].sort((a,b)=>a-b);out.push('frames meanwhile: '+frames.length+' median '+s[Math.floor(s.length/2)].toFixed(1)+' ms p95 '+s[Math.floor(s.length*.95)].toFixed(1)+' max '+s.at(-1).toFixed(0)+' ms, >25ms '+frames.filter(x=>x>25).length+', >50ms '+frames.filter(x=>x>50).length);run=false;
out.push('environment set: '+!!A.scene.environment+', programs '+renderer.info.programs.length);
A.leave();await __sleep(1500);long.length=0;
const t2=performance.now();await A.enter(c);out.push('second entry: '+(performance.now()-t2).toFixed(0)+' ms, long tasks >60ms '+JSON.stringify(long.filter(x=>x>60)));
await __sleep(800);
return out.join('\n');
