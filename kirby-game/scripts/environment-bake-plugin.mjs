import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {environmentInputs} from './environment-inputs.mjs';
const run=promisify(execFile);

export function environmentBakePlugin(){
 let root,inputs=new Set(),pending=Promise.resolve();
 const bake=()=>pending=pending.catch(()=>{}).then(async()=>{
  const current=await environmentInputs(root);inputs=new Set(current.paths);
  const result=await run(process.execPath,['--import','tsx',resolve(root,'scripts/bake-environment.ts')],{cwd:root,windowsHide:true,maxBuffer:1024*1024});
  if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
 });
 return {name:'prepared-meadow',async configResolved(config){root=config.root;await bake();},
  async handleHotUpdate(context){if(inputs.has(resolve(context.file))){await bake();context.server.ws.send({type:'full-reload'});return [];}}
 };
}
