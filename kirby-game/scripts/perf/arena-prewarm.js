// Arena: frame pacing on the meadow during background preparation, then entry time.
const {cosmicArena:A,c,renderer}=__api,out=[];
if(window.__PROD)renderer.debug.checkShaderErrors=false;
out.push('checkShaderErrors='+renderer.debug.checkShaderErrors);
const frames=[];let last=0,run=true;const tick=()=>{const n=performance.now();if(last)frames.push(n-last);last=n;if(run)requestAnimationFrame(tick);};requestAnimationFrame(tick);
const stats=label=>{const f=frames.splice(0),s=[...f].sort((a,b)=>a-b);out.push(label+': '+f.length+' frames, median '+s[Math.floor(s.length/2)].toFixed(1)+' ms, p95 '+s[Math.floor(s.length*.95)].toFixed(1)+', max '+s.at(-1).toFixed(0)+' ms; gaps >25ms '+f.filter(x=>x>25).length+', >50ms '+f.filter(x=>x>50).length+', >100ms '+f.filter(x=>x>100).length+', worst five '+s.slice(-5).map(x=>x.toFixed(0)).join('/'));};
await __sleep(4000);stats('meadow baseline (4 s)');
const t0=performance.now();A.prewarm(0);A.prewarm(5000);
while(!A.preparing&&performance.now()-t0<60000)await __sleep(50);
out.push('assets built in small steps after '+(performance.now()-t0).toFixed(0)+' ms');stats('meadow while building assets');
const stage=await A.preparing;out.push('arena scene prepared after '+(performance.now()-t0).toFixed(0)+' ms total, ok='+!!stage);
await __sleep(1500);stats('meadow while preparing scene (+1.5 s)');
const long=[];new PerformanceObserver(l=>long.push(...l.getEntries().map(e=>Math.round(e.duration)))).observe({type:'longtask'});
const t1=performance.now();await A.enter(c);out.push('ENTRY after prewarm: '+(performance.now()-t1).toFixed(0)+' ms, active='+A.active+', long tasks >60ms '+JSON.stringify(long.filter(x=>x>60)));
const t2=performance.now();while(A.battleView.late.length&&performance.now()-t2<60000)await __sleep(50);out.push('detailed worlds and phase-four programs ready '+(performance.now()-t2).toFixed(0)+' ms after entering');
await __sleep(1000);frames.splice(0);await __sleep(3000);stats('arena (3 s)');run=false;
A.leave();await __sleep(1500);long.length=0;const t3=performance.now();await A.enter(c);out.push('second entry: '+(performance.now()-t3).toFixed(0)+' ms, long tasks >60ms '+JSON.stringify(long.filter(x=>x>60)));
return out.join('\n');
