// Arena: cold compile+link time of every arena shader program, one by one. Anything above ~1 s is a defect.
const {cosmicArena:A,c,renderer,THREE:T}=__api,out=[],gl=renderer.getContext();
const before=new Set(renderer.info.programs.map(p=>p.id));
// time the environment capture separately
const proto=T.PMREMGenerator.prototype,from=proto.fromScene;let pm='';
proto.fromScene=function(...a){const n=renderer.info.programs.length,t=performance.now();const r=from.apply(this,a);pm='PMREM fromScene: '+(performance.now()-t).toFixed(0)+' ms, programs '+n+' -> '+renderer.info.programs.length;return r;};
const t0=performance.now();await A.enter(c);out.push('enter ms '+(performance.now()-t0).toFixed(0),pm);proto.fromScene=from;
await __sleep(500);
const added=renderer.info.programs.filter(p=>!before.has(p.id));
const lights=A.scene?(()=>{const n={};A.scene.traverse(o=>{if(o.isLight)n[o.type+(o.castShadow?'+shadow':'')]=(n[o.type+(o.castShadow?'+shadow':'')]??0)+1;});return n;})():{};
out.push('lights in arena scene: '+JSON.stringify(lights));
const rows=[];let salt=0;
for(const p of added){
 const vs=gl.getShaderSource(p.vertexShader),fs=gl.getShaderSource(p.fragmentShader);if(!vs||!fs)continue;
 const mk=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src+'\n// cold '+(++salt)+' '+Math.random());gl.compileShader(s);return s;};
 const t=performance.now(),a=mk(gl.VERTEX_SHADER,vs),b=mk(gl.FRAGMENT_SHADER,fs),prog=gl.createProgram();gl.attachShader(prog,a);gl.attachShader(prog,b);gl.linkProgram(prog);
 const ok=gl.getProgramParameter(prog,gl.LINK_STATUS);const ms=performance.now()-t;gl.deleteProgram(prog);gl.deleteShader(a);gl.deleteShader(b);
 rows.push({name:p.name,ms,fs:fs.length,vs:vs.length,ok,point:(fs.match(/pointLights\[ ?\d+ ?\]/g)||[]).length>0?new Set(fs.match(/pointLights\[ ?(\d+) ?\]/g)).size:0,dirShadow:new Set(fs.match(/directionalShadowMap\[ ?(\d+) ?\]/g)||[]).size,env:/envMap/.test(fs)&&/USE_ENVMAP/.test(fs)});
}
const total=rows.reduce((a,r)=>a+r.ms,0);out.push('cold compile+link of '+rows.length+' arena programs, one by one: '+total.toFixed(0)+' ms');
const by=new Map();for(const r of rows){const e=by.get(r.name)??{n:0,ms:0,fs:0};e.n++;e.ms+=r.ms;e.fs+=r.fs;by.set(r.name,e);}
for(const [k,e] of [...by].sort((a,b)=>b[1].ms-a[1].ms))out.push('  '+String(e.n).padStart(3)+' × '+k.padEnd(24)+' '+e.ms.toFixed(0).padStart(6)+' ms total, '+(e.ms/e.n).toFixed(0).padStart(4)+' ms each, fragment '+Math.round(e.fs/e.n/1024)+' KB avg');
out.push('SLOWEST');for(const r of [...rows].sort((a,b)=>b.ms-a.ms).slice(0,12))out.push('  '+r.ms.toFixed(0).padStart(5)+' ms '+r.name.padEnd(22)+' fs '+Math.round(r.fs/1024)+'KB pointLights '+r.point+' dirShadows '+r.dirShadow+' env '+r.env);
return out.join('\n');
