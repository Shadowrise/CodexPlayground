import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ClientUpdates} from '../src/client-updates';

function fixture(responses:unknown[]){
 const changes:(string|undefined)[]=[],calls:{url:string;options?:RequestInit}[]=[];
 const checker=new ClientUpdates('release-a','https://example.com/game/client-version.json',version=>changes.push(version),async(url,options)=>{
  calls.push({url:String(url),options});
  const next=responses.shift();if(next instanceof Error)throw next;
  return next instanceof Response?next:Response.json(next);
 });
 return {checker,changes,calls};
}

test('the current release stays quiet; a new client release is announced once',async()=>{
 const {checker,changes,calls}=fixture([{version:'release-a'},{version:'release-b'},{version:'release-b'}]);
 await checker.check();assert.deepEqual(changes,[]);
 await checker.check();await checker.check();assert.deepEqual(changes,['release-b']);
 assert.equal(checker.availableVersion,'release-b');
 const url=new URL(calls[0].url);assert.equal(url.pathname,'/game/client-version.json');assert(url.searchParams.has('_'));
 assert.equal(calls[0].options?.cache,'no-store');assert.equal(calls[0].options?.credentials,'omit');assert(calls[0].options?.signal instanceof AbortSignal);
});

test('closing suppresses that release through future checks, while a later release can appear',async()=>{
 const {checker,changes}=fixture([{version:'release-b'},{version:'release-b'},{version:'release-b'},{version:'release-c'},{version:'release-c'},{version:'release-b'}]);
 await checker.check();checker.dismiss();checker.dismiss();
 await checker.check();await checker.check();assert.deepEqual(changes,['release-b',undefined]);assert.equal(checker.availableVersion,undefined);
 await checker.check();assert.equal(checker.availableVersion,'release-c');checker.dismiss();
 await checker.check();await checker.check();assert.deepEqual(changes,['release-b',undefined,'release-c',undefined]);
});

test('unavailable, incomplete and malformed manifests cannot interrupt play or announce a release',async()=>{
 const invalid=[null,{},[],{version:''},{version:42},{version:'<html>'},{version:'x'.repeat(129)},new Response('missing',{status:404}),new Response('down',{status:503}),new Response('<html>Deploying</html>'),new Error('offline')];
 const {checker,changes}=fixture([...invalid,{version:'release-b'}]);
 for(const _ of invalid)await checker.check();assert.deepEqual(changes,[]);
 await checker.check();assert.deepEqual(changes,['release-b']);
});

test('temporary network failures preserve a known available update',async()=>{
 const {checker,changes}=fixture([{version:'release-b'},new Error('offline'),new Response('down',{status:503}),{version:'release-b'}]);
 for(let i=0;i<4;i++)await checker.check();
 assert.equal(checker.availableVersion,'release-b');assert.deepEqual(changes,['release-b']);
});

test('rolling the site back to the running release removes an obsolete notice',async()=>{
 const {checker,changes}=fixture([{version:'release-b'},{version:'release-a'}]);
 await checker.check();await checker.check();assert.equal(checker.availableVersion,undefined);assert.deepEqual(changes,['release-b',undefined]);
});

test('overlapping timer, visibility and online checks share a single request',async()=>{
 let calls=0,complete!:(response:Response)=>void;
 const changes:(string|undefined)[]=[];
 const checker=new ClientUpdates('release-a','https://example.com/client-version.json',version=>changes.push(version),()=>{calls++;return new Promise(resolve=>{complete=resolve;});});
 const pending=checker.check();await checker.check();await checker.check();assert.equal(calls,1);
 complete(Response.json({version:'release-b'}));await pending;
 assert.deepEqual(changes,['release-b']);
});
