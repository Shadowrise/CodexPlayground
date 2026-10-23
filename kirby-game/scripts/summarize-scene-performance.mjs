import {readFile,readdir,writeFile} from 'node:fs/promises';
const folder=new URL('../artifacts/scene-performance-2026-10-23/',import.meta.url);
const files=(await readdir(folder)).filter(f=>/^report-\d+\.json$/.test(f)).sort();
const reports=await Promise.all(files.map(async file=>({file,data:JSON.parse(await readFile(new URL(file,folder),'utf8'))})));
const quant=(a,p=.5)=>{if(!a.length)return null;const v=[...a].sort((a,b)=>a-b),at=(v.length-1)*p,i=Math.floor(at);return v[i]+(v[Math.ceil(at)]-v[i])*(at-i);};
const round=v=>v===null?null:Math.round(v*100)/100;
const survey=reports.find(r=>r.data.live.length)?.data;
const live=survey.live.map(run=>{
 const f=run.frames,dt=f.slice(1).map((v,i)=>v.raf-f[i].raf),costNames=[...new Set(f.flatMap(r=>Object.keys(r.costs)))];
 const bins=Array.from({length:24},(_,i)=>{const frames=f.filter(v=>v.at>=run.start+i*500&&v.at<run.start+(i+1)*500);return frames.length>=2?1000*(frames.length-1)/(frames.at(-1).raf-frames[0].raf):null;});
 return {id:run.id,hour:run.hour,rotate:run.rotate,ratio:run.ratio,frames:f.length,fps:round(1000*(f.length-1)/(f.at(-1).raf-f[0].raf)),frameMs:round(quant(dt)),p95FrameMs:round(quant(dt,.95)),p99FrameMs:round(quant(dt,.99)),updateMs:round(quant(f.map(r=>r.updateMs))),p95UpdateMs:round(quant(f.map(r=>r.updateMs),.95)),renderCpuMs:round(quant(f.map(r=>r.renderMs))),p95RenderCpuMs:round(quant(f.map(r=>r.renderMs),.95)),gpuMs:round(quant(f.map(r=>r.gpuMs).filter(v=>v!==null))),p95GpuMs:round(quant(f.map(r=>r.gpuMs).filter(v=>v!==null),.95)),longTasks:run.longTasks.length,bins:bins.map(round),costs:costNames.map(name=>({name,medianMs:round(quant(f.map(r=>r.costs[name]??0))),p95Ms:round(quant(f.map(r=>r.costs[name]??0),.95))})).sort((a,b)=>b.medianMs-a.medianMs)};
});
const focusedRows=reports.flatMap(({file,data})=>(data.focused??[]).map(r=>{
 const angle=r.angle??data.metadata.abView.angle;
 // These existing captures predate the explicit counter reset in the sampler.
 // Without GroundShadowPass, Three reset info after CSM, excluding its draws.
 // Recover the exact omitted count from the same frozen run/angle's CSM toggle.
 const mapRows=(data.focused??[]).filter(row=>row.id==='csm-update'&&(row.angle??data.metadata.abView.angle)===angle);
 const omittedCalls=data.metadata.counterMode!=='explicit-all-passes'&&['all-prepared-shadows','coverage-pass'].includes(r.id)?quant(mapRows.map(row=>row.baseline.calls-row.variant.calls)):0;
 const omittedTriangles=omittedCalls?quant(mapRows.map(row=>row.baseline.triangles-row.variant.triangles)):0;
 return {...r,angle,file,counterCorrection:{calls:omittedCalls??0,triangles:omittedTriangles??0},variant:{...r.variant,calls:r.variant.calls+(omittedCalls??0),triangles:r.variant.triangles+(omittedTriangles??0)}};
}));
const focusGroups=[];
for(const angle of [...new Set(focusedRows.map(r=>r.angle))].sort((a,b)=>a-b))for(const id of [...new Set(focusedRows.filter(r=>r.angle===angle).map(r=>r.id))]){
 const all=focusedRows.filter(r=>r.angle===angle&&r.id===id),rows=all.filter(r=>r.stable),values=rows.map(r=>r.savedMs),sample=all[0];
 focusGroups.push({angle,id,name:sample.name,measured:all.length,stable:rows.length,positive:rows.filter(r=>r.savedMs>.2).length,medianMs:round(quant(values)),lowMs:round(Math.min(...values)),highMs:round(Math.max(...values)),medianGain:round(quant(rows.map(r=>r.gain))),baselineMs:round(quant(rows.map(r=>r.referenceMs))),gpuSavedMs:round(quant(rows.map(r=>(r.baseline.gpuMs+r.control.gpuMs)*.5-r.variant.gpuMs))),callsSaved:round(quant(rows.map(r=>r.baseline.calls-r.variant.calls))),trials:all.map(r=>({round:r.round,savedMs:round(r.savedMs),stable:r.stable,baselineMs:round(r.referenceMs),gpuSavedMs:round((r.baseline.gpuMs+r.control.gpuMs)*.5-r.variant.gpuMs),calls:r.baseline.calls,variantCalls:r.variant.calls,triangles:r.baseline.triangles,variantTriangles:r.variant.triangles}))});
}
const inventory=survey.inventory,groups=inventory.groups;
const inventorySummary=[
 {id:'forest',name:'Лес поляны',match:r=>r.name==='Four woodland biomes'},
 {id:'mountains',name:'Горы и лес на склонах',match:r=>r.name==='Continuous square mountain range'},
 {id:'fireflies',name:'Светлячки',match:r=>r.name==='Forty meadow fireflies'},
 {id:'npcs',name:'Персонажи NPC',match:r=>r.name.startsWith('NPC ')},
 {id:'player',name:'Игрок',match:r=>r.name==='Игрок'},
 {id:'fruit',name:'Фрукты',match:r=>r.name==='Фрукты на поляне'},
 {id:'prepared',name:'Подготовленные тени',match:r=>['Тени деревьев','Тени травы','Подготовленные тени предметов'].includes(r.name)},
 {id:'coaster',name:'Американские горки',match:r=>r.name==='Mountain circuit roller coaster'},
].map(({id,name,match})=>{const selected=groups.filter(match),sum=key=>selected.reduce((n,r)=>n+r[key],0);return {id,name,calls:sum('calls'),triangles:sum('triangles'),shadowCalls:selected.filter(r=>r.pass==='shadow').reduce((n,r)=>n+r.calls,0),shadowTriangles:selected.filter(r=>r.pass==='shadow').reduce((n,r)=>n+r.triangles,0)};});
const pipeline=reports.filter(r=>r.data.pipeline).map(({file,data})=>({file,angle:data.metadata.abView.angle,...data.pipeline}));
const telemetry=reports.filter(r=>r.data.gpuTelemetry).map(({file,data})=>{const lines=data.gpuTelemetry.trim().split(/\r?\n/).map(s=>s.split(',').map(s=>s.trim()));return {file,samples:lines.length,coreMin:Math.min(...lines.map(r=>Number(r[3]))),coreMax:Math.max(...lines.map(r=>Number(r[3]))),tempMin:Math.min(...lines.map(r=>Number(r[6]))),tempMax:Math.max(...lines.map(r=>Number(r[6]))),utilMedian:round(quant(lines.map(r=>Number(r[2])))),powerMedian:round(quant(lines.map(r=>Number(r[5]))))};});
const result={date:'23 октября 2026',metadata:survey.metadata,sourceFiles:files,live,focusGroups,inventory:inventorySummary,inventoryTotals:inventory.totals,pipeline,telemetry,surveyAb:survey.ab.map(r=>({id:r.id,name:r.name,savedMs:round(r.savedMs),gain:round(r.gain),stable:r.stable})),angleTime:survey.angleTime,counterNote:'Displayed counts for all-prepared-shadows and coverage-pass include CSM draws omitted by the original Three autoReset path. Exact correction comes from the same frozen run/angle csm-update toggle. Timing and GPU measurements are unchanged. The research sampler now resets counters explicitly for future captures.',quality:{focusedTrials:focusedRows.length,stableTrials:focusedRows.filter(r=>r.stable).length,glErrors:focusedRows.filter(r=>r.glError).length,runtimeErrors:reports.flatMap(r=>r.data.errors)}};
await writeFile(new URL('summary.json',folder),JSON.stringify(result,null,2));
console.log(JSON.stringify({quality:result.quality,live:live.map(({bins,costs,...r})=>r),focus:focusGroups.map(({trials,...r})=>r),inventory:inventorySummary,pipeline:pipeline.map(({frames,...r})=>r),telemetry},null,2));
