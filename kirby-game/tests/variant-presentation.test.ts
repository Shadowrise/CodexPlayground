import assert from 'node:assert/strict';
import {test} from 'node:test';
import {KIRBY_VARIANTS,remainingVariants,styleVariant} from '../src/variants';

test('Meta Knight appends to saved variant IDs and preserves fourteen ambient NPCs',()=>{
 assert.equal(KIRBY_VARIANTS[16][0],'Бандана');assert.equal(KIRBY_VARIANTS[17][0],'Пиджи');
 const metaKnight=KIRBY_VARIANTS[18];assert.equal(metaKnight[0],'Meta Knight');
 const ambient=remainingVariants(metaKnight);
 assert.equal(ambient.length,14);assert(!ambient.some(variant=>variant[0]==='Meta Knight'));
 assert.deepEqual(ambient,remainingVariants(KIRBY_VARIANTS[17]));
});

test('reused selection and unlock portraits switch cleanly between character styles',()=>{
 const classes=new Set<string>(),properties=new Map<string,string>();
 const portrait={
  style:{setProperty:(key:string,value:string)=>properties.set(key,value)},
  classList:{toggle:(name:string,on:boolean)=>on?classes.add(name):classes.delete(name)},
 } as unknown as HTMLElement;
 const named=(name:string)=>KIRBY_VARIANTS.find(variant=>variant[0]===name)!;
 for(const name of ['Радуга','Бандана','Пиджи','Meta Knight','Классический']){
  styleVariant(portrait,named(name));assert.equal(properties.get('--kirby-color'),named(name)[1]);
  assert.deepEqual([...classes],name==='Meta Knight'?['meta-knight-character']:name==='Пиджи'?['pigeon-character']:name==='Бандана'?['bandana-kirby']:name==='Радуга'?['rainbow-kirby']:[]);
 }
});
