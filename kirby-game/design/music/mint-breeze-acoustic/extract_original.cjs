// Capture the complete original track, including its interlocking answers.
// The VM stops before the generator's file-writing/mastering code. Its fs
// interface cannot write files. Only this script writes into --output.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const output=process.argv[process.argv.indexOf('--output')+1];
assert(output&&process.argv.includes('--output'));
fs.mkdirSync(output,{recursive:true});
const archived=path.resolve(__dirname,'original-make-music.cjs');
const source=fs.existsSync(archived)?archived:path.resolve(__dirname,'../../../scripts/make-music.cjs');
let code=fs.readFileSync(source,'utf8');
const rate=22050,beat=60/92,frames=Math.round(48*4*beat*rate);
const groups=new Map(),notes=[];
function replaceOnce(before,after){assert.equal(code.split(before).length,2,before);code=code.replace(before,after);}
replaceOnce('for (const [trackIndex, [name, bpm, transpose, initialSeed]] of tracks.entries()) {',
 'for (const [trackIndex, [name, bpm, transpose, initialSeed]] of tracks.entries()) {\nif(name!=="mint-breeze")continue;let synthRole="warm-bed";');
replaceOnce('function mix(start, seconds, sample, volume, pan=0, echo=false) {',
 'function mix(start, seconds, sample, volume, pan=0, echo=false) {const {left,right}=route(synthRole);');
for(const [name,voice,seconds,amplitude] of [
 ['pluck','nylon','1.7','velocity'],['flute','flute','seconds','volume'],['marimba','marimba','.75','volume'],
]){
 const headers={pluck:'function pluck(midi, when, velocity=.16, pan=0) {',
  flute:'function flute(midi, when, seconds, volume, pan) {',
  marimba:'function marimba(midi, when, volume, pan) {'};
 replaceOnce(headers[name],headers[name]+`captureNote(synthRole,"${voice}",midi,when,${seconds},${amplitude},pan);`);
}
replaceOnce('    const f=hz(midi);','    captureNote(synthRole,"pad",midi,start,4*beat+.22,.027,(j-1)*.45);const f=hz(midi);');
replaceOnce('      const f=hz(midi+12);','      captureNote(synthRole,"strings",midi+12,start,4*beat+.3,.014,(j-1)*.65);const f=hz(midi+12);');
replaceOnce('  const start=bar*4*beat,c=chords[chordIndex].map(n => n + transpose);',
 '  const start=bar*4*beat,c=chords[chordIndex].map(n => n + transpose);synthRole="warm-bed";');
replaceOnce('  if (section !== 0 || trackIndex % 2 === 1) {','  synthRole="string-bed";if (section !== 0 || trackIndex % 2 === 1) {');
replaceOnce('  for (const b of [0, 2])','  synthRole="guitar-chords";for (const b of [0, 2])');
replaceOnce('  if (section > 0) {','  synthRole="flute-counter";if (section > 0) {');
replaceOnce('    if(b%2===0) mix(start+b*beat,.46,',
 '    synthRole="bass";if(b%2===0)captureNote(synthRole,"bass",c[0]+(b===2?7:0),start+b*beat,.46,.12,-.08);if(b%2===0) mix(start+b*beat,.46,');
replaceOnce('    if(b===0||b===2) mix(start+b*beat,.16,',
 '    synthRole="drums";if(b===0||b===2)captureNote(synthRole,"kick",36,start+b*beat,.16,.075,0);if(b===0||b===2) mix(start+b*beat,.16,');
replaceOnce('    mix(start+(b+.5)*beat,.085,',
 '    captureNote(synthRole,"soft-stroke",42,start+(b+.5)*beat,.085,.021,.35);mix(start+(b+.5)*beat,.085,');
replaceOnce('    if (b % 2 === 1) mix(start+b*beat,.12,',
 '    if(b%2===1)captureNote(synthRole,"snare",38,start+b*beat,.12,.023,-.25);if (b % 2 === 1) mix(start+b*beat,.12,');
replaceOnce('    if (section === 2 && b === 3) marimba','    synthRole="marimba";if (section === 2 && b === 3) marimba');
replaceOnce('    if (note) {','    synthRole="lead";if (note) {');
replaceOnce('    if(n%2===1) pluck','    synthRole="guitar-counter";if(n%2===1) pluck');
replaceOnce('    if (n % 2 === (trackIndex % 2)) marimba','    synthRole="marimba";if (n % 2 === (trackIndex % 2)) marimba');
assert(code.includes('// Soft saturation'));
code=code.slice(0,code.indexOf('// Soft saturation'))+'\n}';
const safeRequire=name=>{
 if(name==='node:fs')return{existsSync:fs.existsSync};
 if(name==='node:path')return path;
 throw new Error('Unexpected source dependency: '+name);
};
vm.runInNewContext(code,{
 require:safeRequire,__dirname:path.dirname(source),
 route(role){if(!groups.has(role))groups.set(role,{left:new Float32Array(frames),right:new Float32Array(frames)});return groups.get(role);},
 captureNote(role,voice,midi,time,seconds,amplitude,pan){notes.push({role,voice,midi,time_seconds:time,duration_seconds:seconds,amplitude,pan});},
});
assert.equal(notes.filter(n=>n.role==='lead').length,307);
const rms=(group,start,stop)=>{
 let sum=0;for(let i=start;i<stop;i++)sum+=group.left[i]**2+group.right[i]**2;
 return Math.sqrt(sum/((stop-start)*2));
};
const report={rate,frames,bpm:92,notes:notes.length,roles:{}};
function writeFloat(name,group){
 const data=Buffer.alloc(frames*8);
 for(let i=0;i<frames;i++){data.writeFloatLE(group.left[i],i*8);data.writeFloatLE(group.right[i],i*8+4);}
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(data.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(3,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*8,28);h.writeUInt16LE(8,32);h.writeUInt16LE(32,34);h.write('data',36);h.writeUInt32LE(data.length,40);
 fs.writeFileSync(path.join(output,name+'.wav'),Buffer.concat([h,data]));
}
for(const [role,group] of groups){
 const levels=[0,1,2].map(section=>rms(group,Math.round(section*64*beat*rate),Math.round((section+1)*64*beat*rate)));
 report.roles[role]={rms:rms(group,0,frames),section_rms:levels,section_rms_dbfs:levels.map(r=>Math.round(2000*Math.log10(Math.max(1e-12,r)))/100)};
 // Keep the original low chord bed and percussion as exact source textures.
 if(['warm-bed','drums'].includes(role))writeFloat('original-'+role,group);
}
fs.writeFileSync(path.join(output,'original-complete-score.json'),JSON.stringify(notes,null,2)+'\n');
fs.writeFileSync(path.join(output,'original-stem-levels.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
