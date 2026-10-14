import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {detectLocale,initializeLocale,getLocale,setLocale,t,LANGUAGE_KEY,onLocaleChange} from '../src/i18n';
import {translations} from '../src/i18n-catalog';
import {pidgieScareLog,pidgieInterestLog,pidgieFriendLog} from '../src/world-log';

test('Pidgie friendship announcement translates while preserving the player name',()=>{
 const {text}=pidgieFriendLog('Радуга');setLocale('en');assert.equal(t(text),'Радуга gave wild Pidgie some bread. Pidgie is now their best friend.');setLocale('ru');
});
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
 assert.equal(t('Яблоко съеден! Скорость от фруктов 120% · 20 с'),'Apple eaten! Fruit speed 120% · 20 s');
 assert.equal(t('Фрукты: скорость 140% · 10 с'),'Fruit speed: 140% · 10 s');
 assert.equal(t('E — положи золотой мешочек в воронку'),'E — put the golden bag in the funnel');
 assert.equal(t('★ Радуга прошёл все приключения! Звездопад через 5 с'),'★ Радуга completed every adventure! Starfall in 5 s');
 assert.equal(t('Радуга: это мой текст!'),'Радуга: это мой текст!');
 assert.equal(t('★ Собирай звёзды · {0} с · +{1}/{2} очков',[45,7,30]),'★ Collect stars · 45 s · +7/30 points');
 setLocale('bg');assert.equal(t('E — положи красный мешочек в воронку'),'E — сложи червената торбичка във фунията');
 assert.equal(t('Радуга'),'Дъга');setLocale('ru');assert.equal(t('Радуга'),'Радуга');
});
test('Tiny Tot nomination is localized in all supported languages',()=>{
 for(const [language,label] of [['ru','Малявка'],['en','Tiny tot'],['bg','Мъниче']] as const){setLocale(language);assert.equal(t('Малявка'),label);}
});

test('Pidgie bread hint translates as a system message without translating the player name',()=>{
 const {text}=pidgieScareLog('Радуга');
 setLocale('en');assert.equal(t(text),'Wild Pidgie gave Радуга a hungry look. Seeing no bread, he got scared and flew off to another clearing.');
 setLocale('bg');assert.equal(t(text),'Дивият Пиджи погледна Радуга гладно. Не видя хлебче, уплаши се и отлетя на друга полянка.');
});

test('Pidgie interest announcement is localized while the player name stays unchanged',()=>{
 const {text}=pidgieInterestLog('Радуга');
 setLocale('en');assert.equal(t(text),'Wild Pidgie watches Радуга closely. Something has really caught his interest.');
 setLocale('bg');assert.equal(t(text),'Дивият Пиджи гледа внимателно Радуга. Нещо силно привлече интереса му.');
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
