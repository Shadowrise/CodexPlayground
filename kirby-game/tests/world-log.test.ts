import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chatText,emoteMessage,EMOTE_MESSAGES,pidgieScareLog,pidgieInterestLog,pidgieFriendLog} from '../src/world-log';
import {EMOTES,PIGEON_EMOTES} from '../src/emotes';

test('feeding announcement preserves the player name and names the new friendship',()=>{
 const entry=pidgieFriendLog('Радуга $&');assert.equal(entry.text,'Радуга $& угостил дикого Пиджи хлебушком, теперь Пиджи его лучший друг.');assert.equal(entry.name,'');assert.equal(entry.chat,false);
});
test('chat normalizes whitespace, limits length and rejects non-text input',()=>{
 assert.equal(chatText('  Привет\nмир!  '),'Привет мир!');assert.equal(chatText('x'.repeat(300)).length,255);assert.equal(chatText({}), '');assert.equal(chatText('   '),'');
});
test('all playable emotions have descriptive messages and invalid names are ignored',()=>{
 assert.deepEqual(Object.keys(EMOTE_MESSAGES),PIGEON_EMOTES.map(emote=>emote.id));
 for(const {id} of EMOTES)assert(emoteMessage(id)!.split(/\s+/).length>=6);
 assert.equal(emoteMessage('Peck'),'наклоняется и деловито клюёт землю.');assert.equal(emoteMessage('toString'),undefined);
});

test('Pidgie hint is a system narrative with the player name kept literally inside the approved phrase',()=>{
 const entry=pidgieScareLog('Радуга $&');
 assert.equal(entry.text,'Дикий Пиджи окинул Радуга $& голодным взглядом. Хлебушка не заметил, испугался и улетел на другую полянку.');
 assert.equal(entry.name,'');assert.equal(entry.chat,false);assert.notEqual(entry.id,pidgieScareLog('Радуга $&').id);
});

test('Pidgie interest announcement uses the approached player name as literal system text',()=>{
 const entry=pidgieInterestLog('Радуга $&');assert.equal(entry.text,'Дикий Пиджи внимательно смотрит на Радуга $&. Что-то его очень заинтересовало.');
 assert.equal(entry.name,'');assert.equal(entry.chat,false);
});
