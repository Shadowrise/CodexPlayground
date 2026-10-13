import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {EMOTES} from '../src/emotes';
import {PIGEON_EMOTE_SOUNDS, loadPigeonEmoteBuffers, playPigeonEmoteBuffer, preloadPigeonEmoteSounds} from '../src/pigeon-voice';

test('every numbered emotion has its own padded, unclipped pigeon coo recording', () => {
  assert.deepEqual(Object.keys(PIGEON_EMOTE_SOUNDS), EMOTES.map(emote => emote.id));
  const hashes = new Set<string>(), peaks = new Map<string, number>();
  for (const [kind, sound] of Object.entries(PIGEON_EMOTE_SOUNDS)) {
    const file = readFileSync(new URL(`../public/audio/${sound.file}`, import.meta.url));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF');
    assert.equal(file.toString('ascii', 8, 12), 'WAVE');
    assert.equal(file.readUInt16LE(20), 1, 'PCM recording');
    assert.equal(file.readUInt16LE(22), 1, 'mono voice');
    assert.equal(file.readUInt16LE(34), 16);
    const sampleRate = file.readUInt32LE(24), frames = file.readUInt32LE(40) / 2;
    assert.equal(sampleRate, 44100);
    assert(Math.abs(frames / sampleRate - sound.duration) < 1 / sampleRate);
    const samples = Array.from({length: frames}, (_, i) => file.readInt16LE(44 + i * 2));
    let peak = 0, jump = 0;
    for (let i = 0; i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]));
      if (i) jump = Math.max(jump, Math.abs(samples[i] - samples[i-1]));
    }
    assert(peak > 9000 && peak < 24000, `${kind}: audible with mixer headroom`);
    assert(jump < 5000, `${kind}: no discontinuous waveform clicks`);
    assert(samples.slice(0, Math.round(.02 * sampleRate)).every(n => n === 0));
    assert(samples.slice(-Math.round(.10 * sampleRate)).every(n => n === 0));
    hashes.add(createHash('sha256').update(file).digest('hex'));
    peaks.set(kind, peak);
  }
  assert.equal(hashes.size, 5, 'distinct audio, rather than five filenames sharing one voice');
  assert(peaks.get('Sad')! < peaks.get('Hello')!);
});

test('coos preload once, decode once per caller context, and tolerate an unavailable sound', async () => {
  const originalFetch = globalThis.fetch, requests: string[] = [];
  globalThis.fetch = (async input => {
    requests.push(String(input));
    return new Response(String(input).includes('pigeon-fear') ? '' : 'original-coo-bytes', {
      status: String(input).includes('pigeon-fear') ? 404 : 200,
    });
  }) as typeof fetch;
  let decodes = 0;
  const fakeContext = () => ({decodeAudioData: async (data: ArrayBuffer) => {
    decodes++;
    assert.equal(new TextDecoder().decode(data), 'original-coo-bytes');
    // Browser decoding detaches its input. Both contexts must retain an intact copy.
    structuredClone(data, {transfer: [data]});
    return {duration: 2} as AudioBuffer;
  }}) as unknown as BaseAudioContext;
  try {
    const first = preloadPigeonEmoteSounds('/pigeon-audio-test');
    assert.equal(first, preloadPigeonEmoteSounds('/pigeon-audio-test/'));
    const context = fakeContext(), pending = loadPigeonEmoteBuffers(context, '/pigeon-audio-test');
    assert.equal(pending, loadPigeonEmoteBuffers(context, '/pigeon-audio-test/'));
    const buffers = await pending;
    assert.equal(requests.length, 5);
    assert.equal(decodes, 4);
    assert.equal(buffers.size, 4);
    assert(!buffers.has('Fear'));
    await loadPigeonEmoteBuffers(fakeContext(), '/pigeon-audio-test');
    assert.equal(requests.length, 5);
    assert.equal(decodes, 8);
  } finally { globalThis.fetch = originalFetch; }
});

test('pigeon preview playback obeys caller mute and never unlocks a suspended context', () => {
  let nodes = 0;
  const context = {state: 'suspended', createBufferSource: () => {nodes++;}} as unknown as AudioContext;
  assert.equal(playPigeonEmoteBuffer(context, {} as AudioNode, {} as AudioBuffer), undefined);
  assert.equal(nodes, 0);
  const running = {...context, state: 'running'} as AudioContext;
  assert.equal(playPigeonEmoteBuffer(running, {} as AudioNode, {} as AudioBuffer, {enabled: false}), undefined);
  assert.equal(nodes, 0);
});
