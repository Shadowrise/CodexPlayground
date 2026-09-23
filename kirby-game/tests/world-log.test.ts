import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chatText,emoteMessage,EMOTE_MESSAGES} from '../src/world-log';
test('chat normalizes whitespace, limits length and rejects non-text input',()=>{
 assert.equal(chatText('  Привет\nмир!  '),'Привет мир!');assert.equal(chatText('x'.repeat(300)).length,255);assert.equal(chatText({}), '');assert.equal(chatText('   '),'');
});
test('all five emotions have descriptive messages and invalid names are ignored',()=>{
 assert.equal(Object.keys(EMOTE_MESSAGES).length,5);for(const key of Object.keys(EMOTE_MESSAGES))assert(emoteMessage(key)!.split(/\s+/).length>=6);assert.equal(emoteMessage('toString'),undefined);
});
