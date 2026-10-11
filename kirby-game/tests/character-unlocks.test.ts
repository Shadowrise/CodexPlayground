import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CharacterUnlocks,BANDANA_UNLOCK_KEY} from '../src/character-unlocks';
import {SCORE_ACTIONS} from '../src/score';

function storage(){const values=new Map<string,string>();return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};}

test('Bandana starts locked and only all current adventures unlock it',()=>{
 const saved=storage(),progress=new CharacterUnlocks(saved);
 assert(progress.isLocked('Бандана'));assert(!progress.isLocked('Радуга'));
 assert(!progress.complete(new Set()));
 assert(!progress.complete(new Set([...SCORE_ACTIONS.slice(1),'swim','mill','trampoline'])),'retired adventures cannot replace a missing one');
 assert(!saved.values.has(BANDANA_UNLOCK_KEY));
 assert(progress.complete(new Set(SCORE_ACTIONS)));assert(!progress.isLocked('Бандана'));
 assert.equal(saved.values.get(BANDANA_UNLOCK_KEY),'1');
 assert(!progress.complete(SCORE_ACTIONS),'celebrate only on the first unlock');
 assert(!new CharacterUnlocks(saved).isLocked('Бандана'));
});

test('future adventures join the condition automatically; already earned unlocks stay earned',()=>{
 const required=SCORE_ACTIONS as unknown as string[],done=new Set<string>(required),earned=new CharacterUnlocks();
 assert(earned.complete(done));
 required.push('future-adventure');
 try{
  const fresh=new CharacterUnlocks();assert(!fresh.complete(done));done.add('future-adventure');assert(fresh.complete(done));
  assert(!earned.isLocked('Бандана'));assert(!earned.complete(done));
 }finally{required.pop();}
});

test('solo saves and online resumes use only their own achievements',()=>{
 const solo=new CharacterUnlocks(storage()),online=new CharacterUnlocks(storage());
 assert(!solo.complete(SCORE_ACTIONS.slice(0,-1)));assert(solo.complete(SCORE_ACTIONS));
 assert(!online.complete(SCORE_ACTIONS.slice(0,-1)));assert(online.complete(SCORE_ACTIONS));
 const other=new CharacterUnlocks();assert(other.isLocked('Бандана'));
});

test('explicit Bandana unlock persists once without completing adventures',()=>{
 const saved=storage(),progress=new CharacterUnlocks(saved);
 assert(!progress.complete([]));assert(progress.unlockBandana());assert(!progress.isLocked('Бандана'));
 assert.equal(saved.values.get(BANDANA_UNLOCK_KEY),'1');assert(!progress.unlockBandana());assert(!progress.complete(SCORE_ACTIONS));
 assert(!new CharacterUnlocks(saved).isLocked('Бандана'));
});

test('denied or missing local storage does not prevent earning an unlock or cause repeat announcements',()=>{
 const denied={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};
 for(const saved of [undefined,denied]){
  const progress=new CharacterUnlocks(saved);assert(progress.isLocked('Бандана'));
  assert(progress.complete(SCORE_ACTIONS));assert(!progress.isLocked('Бандана'));assert(!progress.complete(SCORE_ACTIONS));
 }
 const malformed=new CharacterUnlocks({getItem:()=> 'true',setItem:()=>{}});assert(malformed.isLocked('Бандана'));
});
