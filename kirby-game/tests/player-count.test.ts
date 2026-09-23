import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchPlayerCount} from '../src/player-count';
test('player count requests only a read-only snapshot and accepts zero',async()=>{
 let calls=0;
 const request:typeof fetch=async(url,options)=>{calls++;assert.equal(url,'https://example.com/players');assert.equal(options?.cache,'no-store');return Response.json({players:0});};
 assert.equal(await fetchPlayerCount('https://example.com/',request),0);assert.equal(calls,1);
});
test('invalid or unavailable counts are rejected rather than reported as zero',async()=>{
 for(const value of [{players:-1},{players:1.5},{players:'2'},{},null])await assert.rejects(fetchPlayerCount('https://example.com',async()=>Response.json(value)));
 await assert.rejects(fetchPlayerCount('https://example.com',async()=>new Response('down',{status:503})));
 assert.equal(await fetchPlayerCount('https://example.com',async()=>Response.json({players:14})),14);
});
