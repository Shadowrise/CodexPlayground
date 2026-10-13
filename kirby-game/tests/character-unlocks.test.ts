import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CharacterUnlocks,BANDANA_UNLOCK_KEY,PIDGIE_UNLOCK_KEY} from '../src/character-unlocks';
import {SCORE_ACTIONS} from '../src/score';
import {PIDGIE_LOCK_HINT,lockedCharacterHint} from '../src/locked-character-tooltip';
import {setLocale,t} from '../src/i18n';

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

test('Pidgie has a separate durable unlock and completing adventures only unlocks Bandana',()=>{
 const saved=storage(),progress=new CharacterUnlocks(saved);
 assert(progress.isLocked('Пиджи'));assert(progress.isLocked('Бандана'));
 assert(progress.complete(SCORE_ACTIONS));assert(progress.isLocked('Пиджи'));
 assert(!saved.values.has(PIDGIE_UNLOCK_KEY));
 assert(progress.unlockPidgie());assert(!progress.isLocked('Пиджи'));assert(!progress.unlockPidgie());
 assert.equal(saved.values.get(PIDGIE_UNLOCK_KEY),'1');assert.equal(saved.values.get(BANDANA_UNLOCK_KEY),'1');
 const restored=new CharacterUnlocks(saved);assert(restored.pidgieUnlocked);assert(restored.bandanaUnlocked);
 const pidgieOnlySaved=storage(),pidgieOnly=new CharacterUnlocks(pidgieOnlySaved);
 assert(pidgieOnly.unlockPidgie());assert(pidgieOnly.isLocked('Бандана'));
 assert(!pidgieOnlySaved.values.has(BANDANA_UNLOCK_KEY));
 const pidgieOnlyRestored=new CharacterUnlocks(pidgieOnlySaved);
 assert(!pidgieOnlyRestored.isLocked('Пиджи'));assert(pidgieOnlyRestored.isLocked('Бандана'));
});

test('Pidgie remains usable in this session when storage is denied; one failed read does not hide another earned character',()=>{
 const denied={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};
 for(const saved of [undefined,denied]){
  const progress=new CharacterUnlocks(saved);assert(progress.isLocked('Пиджи'));
  assert(progress.unlockPidgie());assert(!progress.isLocked('Пиджи'));assert(!progress.unlockPidgie());
  assert(progress.isLocked('Бандана'));
 }
 const partialRead=new CharacterUnlocks({getItem:key=>{if(key===BANDANA_UNLOCK_KEY)throw Error('denied');return key===PIDGIE_UNLOCK_KEY?'1':null;},setItem:()=>{}});
 assert(partialRead.isLocked('Бандана'));assert(!partialRead.isLocked('Пиджи'));
 const malformed=new CharacterUnlocks({getItem:()=> 'true',setItem:()=>{}});assert(malformed.isLocked('Пиджи'));
});

test('Pidgie lock hint keeps the exact requested wording and localizes without replacing the Bandana hint',()=>{
 assert.equal(PIDGIE_LOCK_HINT,'Пиджи — он неуловимый. Если поймаешь Пиджи, сможешь поиграть за Пиджи.');
 assert.equal(lockedCharacterHint('Пиджи'),PIDGIE_LOCK_HINT);
 assert.equal(lockedCharacterHint('Бандана'),'Пройди все приключения в одиночной или онлайн-игре, чтобы открыть Бандану.');
 try{
  setLocale('ru');assert.equal(t(lockedCharacterHint('Пиджи')),PIDGIE_LOCK_HINT);
  setLocale('en');assert.equal(t('Пиджи'),'Pidgie');assert.match(t(PIDGIE_LOCK_HINT),/catch Pidgie/);
  setLocale('bg');assert.equal(t('Пиджи'),'Пиджи');assert.match(t(PIDGIE_LOCK_HINT),/хванеш Пиджи/);
 }finally{setLocale('ru');}
});

test('denied or missing local storage does not prevent earning an unlock or cause repeat announcements',()=>{
 const denied={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};
 for(const saved of [undefined,denied]){
  const progress=new CharacterUnlocks(saved);assert(progress.isLocked('Бандана'));
  assert(progress.complete(SCORE_ACTIONS));assert(!progress.isLocked('Бандана'));assert(!progress.complete(SCORE_ACTIONS));
 }
 const malformed=new CharacterUnlocks({getItem:()=> 'true',setItem:()=>{}});assert(malformed.isLocked('Бандана'));
});
