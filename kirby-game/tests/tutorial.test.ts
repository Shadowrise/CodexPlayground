import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TutorialProgress,TUTORIAL_KEY,TUTORIAL_STEPS} from '../src/tutorial-state';
import {setLocale,t} from '../src/i18n';

test('first visit walks through seven steps and remembers completion for future sessions',()=>{
 const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
 const tour=new TutorialProgress(storage);assert(tour.start());assert.equal(tour.step,'welcome');
 for(let i=1;i<TUTORIAL_STEPS.length;i++){tour.next();assert(tour.active);assert.equal(tour.index,i);assert.equal(data.get(TUTORIAL_KEY),undefined);}
 tour.next();assert(!tour.active);assert(tour.completed);assert.equal(data.get(TUTORIAL_KEY),'1');
 assert(!new TutorialProgress(storage).start());
 assert(tour.start(true));assert.equal(tour.step,'welcome');assert(tour.active);
});
test('skip dismisses immediately and remembers the choice; interrupted onboarding remains available',()=>{
 let saved:string|null=null;const storage={getItem:()=>saved,setItem:(_key:string,value:string)=>{saved=value;}};
 const interrupted=new TutorialProgress(storage);interrupted.start();interrupted.next();interrupted.cancel();assert.equal(saved,null);
 const tour=new TutorialProgress(storage);assert(tour.start());tour.skip();assert(!tour.active);assert.equal(saved,'1');
 tour.next();assert.equal(tour.index,0);assert(!new TutorialProgress(storage).start());
});
test('denied browser storage cannot prevent starting, skipping or replaying the tutorial',()=>{
 const tour=new TutorialProgress({getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}});
 assert(tour.start());assert.doesNotThrow(()=>tour.skip());assert(!tour.start());
 assert(tour.start(true));for(let i=0;i<TUTORIAL_STEPS.length;i++)tour.next();assert(!tour.active);
});
test('tutorial speaker, progress and replay are translated in all three languages',()=>{
 try{
  for(const [locale,speaker,replay] of [['ru','Ветерок','Пройти обучение'],['en','Breezy','Take the tutorial'],['bg','Ветрец','Премини обучението']] as const){setLocale(locale);assert.equal(t('Ветерок'),speaker);assert.equal(t('Пройти обучение'),replay);assert(!t('Шаг {0} из {1}',[2,6]).includes('{'));}
 }finally{setLocale('ru');}
});
