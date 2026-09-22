import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAudioSettings, saveAudioSettings } from '../src/audio-settings';

test('audio preferences preserve false and zero independently; invalid or blocked storage is safe', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  } });
  try {
    assert.deepEqual(readAudioSettings('music', .25), { enabled: true, volume: .25 });
    saveAudioSettings('music', false, 0);
    saveAudioSettings('sounds', true, .73);
    assert.deepEqual(readAudioSettings('music', .25), { enabled: false, volume: 0 });
    assert.deepEqual(readAudioSettings('sounds', .45), { enabled: true, volume: .73 });
    data.set('kirby.audio.music', '{broken');
    assert.deepEqual(readAudioSettings('music', .25), { enabled: true, volume: .25 });
    data.set('kirby.audio.music', '{"volume":200,"enabled":"false"}');
    assert.deepEqual(readAudioSettings('music', .25), { enabled: true, volume: 1 });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.doesNotThrow(() => saveAudioSettings('music', false, 0));
    assert.deepEqual(readAudioSettings('sounds', .45), { enabled: true, volume: .45 });
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
