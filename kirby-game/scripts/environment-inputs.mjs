import {readFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';

export async function environmentInputs(root){
 const found=new Set(),queue=['forest','meadow-decor','landmarks','mountains','environment-format'].map(name=>resolve(root,'src',name+'.ts'));
 while(queue.length){
  const path=queue.pop();if(found.has(path))continue;found.add(path);
  const source=await readFile(path,'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\.?\/[^'"]+)['"]/g)){
   const target=resolve(dirname(path),match[1]);if(!/\.[a-z]+$/i.test(target))queue.push(target+'.ts');else if(target.endsWith('.ts'))queue.push(target);
  }
 }
 for(const name of ['bake-environment.ts','environment-inputs.mjs'])found.add(resolve(root,'scripts',name));
 const paths=[...found].sort(),hash=createHash('sha256');
 for(const path of paths){hash.update(relative(root,path).replaceAll('\\','/'));hash.update(await readFile(path));}
 hash.update(await readFile(resolve(root,'package-lock.json')));
 return {paths,hash:hash.digest('hex').slice(0,16)};
}
