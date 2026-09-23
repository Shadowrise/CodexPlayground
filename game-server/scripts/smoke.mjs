import assert from 'node:assert/strict';
const base = process.env.SERVER_URL || 'http://127.0.0.1:8787';
const sockets = [];
const get = async path => {
  const response = await fetch(base + path);
  assert.equal(response.status, 200);
  return response.json();
};
const join = (query = '?variant=14') => new Promise((resolve, reject) => {
  const socket = new WebSocket(base.replace(/^http/, 'ws') + '/ws?build=meadow-network-2' + query.replace('?', '&'));
  sockets.push(socket);
  const timer = setTimeout(() => { socket.close(); reject(new Error('Join timed out')); }, 5000);
  socket.addEventListener('message', event => { clearTimeout(timer);const welcome=JSON.parse(event.data);if(welcome.type==='error')reject(new Error('Join rejected'));else resolve({socket,welcome}); }, { once: true });
  socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Join rejected')); }, { once: true });
});
const waitForCount = async count => {
  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await get('/room')).players === count && (await get('/players')).players === count) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail('Player count did not become ' + count);
};
try {
  assert.equal((await get('/health')).status, 'ok');
  assert.deepEqual(await get('/players'),{players:0});
  const countResponse=await fetch(base+'/players',{headers:{Origin:'http://127.0.0.1:5173'}});
  assert.equal(countResponse.headers.get('Access-Control-Allow-Origin'),'*');
  assert.equal(countResponse.headers.get('Cache-Control'),'no-store');
  assert.equal((await fetch(base+'/players',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/players',{method:'OPTIONS'})).status,204);
  assert.equal((await get('/room')).players, 0, 'Use an empty local server for this test');
  assert.equal((await fetch(base + '/rooms/other')).status, 404);
  assert.equal((await fetch(base + '/ws')).status, 426);
  assert.equal((await fetch(base + '/room', { method: 'POST' })).status, 405);
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => join('?variant='+(i%15))));
  const accepted = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  assert.equal(accepted.length, 14, 'Concurrent joins must not exceed capacity');
  assert.equal(results.filter(result => result.status === 'rejected').length, 6);
  assert.equal(new Set(accepted.map(value => value.welcome.playerId)).size, 14);
  assert.equal(new Set(accepted.map(value=>value.welcome.room.id)).size,1);
  const info=await get('/room');delete info.occupiedVariants;assert.deepEqual(info, { room: 'main', players: 14, capacity: 14, full: true, protocolVersion: 2 });
  assert.deepEqual(await get('/players'),{players:14});
  await assert.rejects(join(), /Join rejected/);
  const before=new Set((await get('/room')).occupiedVariants);accepted[0].socket.close(1000, 'Leaving');
  await waitForCount(13);const after=(await get('/room')).occupiedVariants;
  assert.equal((await join('?variant='+[...before].find(v=>!after.includes(v)))).welcome.players.length,14);
  console.log('Passed: single room, 20 concurrent joins limited to 14, overflow rejection, freed seat and rejoin.');
} finally {
  for (const socket of sockets) if (socket.readyState === WebSocket.OPEN) socket.close();
  await waitForCount(0);
}
