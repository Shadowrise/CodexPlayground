import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {detectLocale,initializeLocale,getLocale,setLocale,t,LANGUAGE_KEY,onLocaleChange} from '../src/i18n';
import {translations} from '../src/i18n-catalog';
import {sortedTasks,TASK_NAMES} from '../src/tasks';
import {SCORE_ACTIONS,type ScoreAction} from '../src/score';

afterEach(()=>setLocale('ru'));
test('saved choice wins; regional browser preferences are detected, otherwise English',()=>{
 assert.equal(detectLocale('bg',['ru-RU','en-US']),'bg');
 assert.equal(detectLocale(null,['en-US','en','ru-RU','ru']),'en');
 assert.equal(detectLocale(null,['ru-RU','ru','en-US','en']),'ru');
 assert.equal(detectLocale(null,['fr-FR','bg-BG','en-US']),'bg');
 assert.equal(detectLocale(null,['RU-ru']),'ru');
 assert.equal(detectLocale('invalid',['en-GB']),'en');
 assert.equal(detectLocale(null,[]),'en');
 assert.equal(detectLocale(null,['de-DE','fr']),'en');
});
test('choosing a language persists it; unavailable storage never interrupts play',()=>{
 const writes:string[][]=[];setLocale('bg',{setItem:(key,value)=>writes.push([key,value])});
 assert.deepEqual(writes,[[LANGUAGE_KEY,'bg']]);
 assert.equal(initializeLocale({getItem:()=>{throw Error('denied');}},['en-US']),'en');
 assert.doesNotThrow(()=>setLocale('ru',{setItem:()=>{throw Error('quota');}}));
 assert.equal(getLocale(),'ru');
});
test('locale subscribers run once per change, including choosing an already active language',()=>{
 let changes=0;const off=onLocaleChange(()=>changes++);setLocale('en');setLocale('en');setLocale('bg');off();setLocale('ru');assert.equal(changes,2);
});
test('display templates translate nested labels and keep player names verbatim',()=>{
 setLocale('en');
 assert.equal(t('Яблоко съеден! Размер +10% · 110%'),'Apple eaten! Size +10% · 110%');
 assert.equal(t('E — положи золотой мешочек в воронку'),'E — put the golden bag in the funnel');
 assert.equal(t('★ Радуга выполнил все задачи! Звездопад через 5 с'),'★ Радуга completed every task! Starfall in 5 s');
 assert.equal(t('Радуга: это мой текст!'),'Радуга: это мой текст!');
 assert.equal(t('★ Собирай звёзды · {0} с · +{1}/{2} очков',[45,7,30]),'★ Collect stars · 45 s · +7/30 points');
 setLocale('bg');assert.equal(t('E — положи красный мешочек в воронку'),'E — сложи червената торбичка във фунията');
 assert.equal(t('Радуга'),'Дъга');setLocale('ru');assert.equal(t('Радуга'),'Радуга');
});
test('every catalog entry has both translations and preserves all template slots',()=>{
 const slots=(s:string)=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
 for(const [source,values] of Object.entries(translations))for(const value of values){assert(value.trim(),source);assert.deepEqual(slots(value),slots(source),source);}
});
test('tasks sort in the chosen language, keeping completed items below and stable score IDs',()=>{
 const done=new Set<ScoreAction>(['millQuest','firefly']);
 for(const language of ['en','bg'] as const){setLocale(language);const tasks=sortedTasks(done),names=tasks.filter(t=>!t.done).map(t=>t.name);
  assert.deepEqual(names,[...names].sort(new Intl.Collator(language).compare));
  assert.deepEqual(new Set(tasks.map(t=>t.id)),new Set(SCORE_ACTIONS));assert(tasks.slice(-2).every(t=>t.done));assert.equal(TASK_NAMES.millQuest,'Запустить радужную мельницу');
 }
});
