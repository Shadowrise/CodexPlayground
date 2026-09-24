import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackgroundMusic, MUSIC_TRACKS } from '../src/music';
import { readFileSync } from 'node:fs';

test('all fourteen stereo tracks exist, main is triple length, audio has headroom', () => {
  assert.equal(MUSIC_TRACKS.length,14);
  for (const [index, [file]] of MUSIC_TRACKS.entries()) {
    const wav = readFileSync(new URL(`../public/audio/${file}.wav`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt16LE(22), 2);
    const duration = wav.readUInt32LE(40) / wav.readUInt32LE(28);
    assert(duration > 100 && duration < 130);
    if (index === 0) assert(Math.abs(duration - 38.4 * 3) < .001);
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)));
    assert(peak > 10000 && peak < 30000);
  }
});

test('fourteen tracks advance and wrap in both directions while preserving mute and volume', async () => {
  class FakeElement extends EventTarget {
    value = ''; textContent = ''; title = ''; hidden = false;
    attributes = new Map<string, string>();
    setAttribute(k: string, v: string) { this.attributes.set(k, v); }
  }
  let audio: FakeAudio;
  class FakeAudio extends EventTarget {
    src = ''; loop = false; preload = ''; volume = 1; paused = true;
    constructor() { super(); audio = this; }
    pause() { this.paused = true; }
    async play() { this.paused = false; }
  }
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = new FakeElement(), button = new FakeElement(), volume = new FakeElement();
  const previous = new FakeElement(), next = new FakeElement(), label = new FakeElement();
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  try {
    const music = new BackgroundMusic(button as unknown as HTMLButtonElement, volume as unknown as HTMLInputElement,
      previous as unknown as HTMLButtonElement, next as unknown as HTMLButtonElement, label as unknown as HTMLElement);
    assert(audio!.paused); assert(!audio!.loop);
    music.start(); await Promise.resolve(); assert(!audio!.paused);
    volume.value = '37'; volume.dispatchEvent(new Event('input'));
    const first = MUSIC_TRACKS.findIndex(([file]) => audio!.src.split('?')[0].endsWith(`${file}.wav`));
    assert(first >= 0);assert(label.textContent.includes('/ 14 ·'));
    for (let i = 0; i < MUSIC_TRACKS.length; i++) {
      assert(audio!.src.split('?')[0].endsWith(`${MUSIC_TRACKS[(first + i) % MUSIC_TRACKS.length][0]}.wav`));
      audio!.dispatchEvent(new Event('ended'));
    }
    assert(audio!.src.split('?')[0].endsWith(`${MUSIC_TRACKS[first][0]}.wav`));
    previous.dispatchEvent(new Event('click'));
    assert(audio!.src.split('?')[0].endsWith(`${MUSIC_TRACKS[(first + MUSIC_TRACKS.length - 1) % MUSIC_TRACKS.length][0]}.wav`));
    next.dispatchEvent(new Event('click'));
    assert(audio!.src.split('?')[0].endsWith(`${MUSIC_TRACKS[first][0]}.wav`));
    button.dispatchEvent(new Event('click')); assert(audio!.paused);
    next.dispatchEvent(new Event('click'));
    assert(audio!.paused); assert(!audio!.loop); assert.equal(audio!.volume, .37);
    button.dispatchEvent(new Event('click')); await Promise.resolve(); assert(!audio!.paused);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); assert(audio!.paused);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); assert(!audio!.paused);
  } finally {
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio); else Reflect.deleteProperty(globalThis, 'Audio');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document');
  }
});

