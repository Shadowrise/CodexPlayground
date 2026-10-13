import type {Emote} from './emotes';

/** Original closed-beak coos. All five use one voice with different phrasing. */
export const PIGEON_EMOTE_SOUNDS = {
  Hello: {file: 'pigeon-hello.wav', duration: 2.10, label: 'Привет: мягкое курлы-курлы'},
  Joy: {file: 'pigeon-joy.wav', duration: 2.04, label: 'Радость: весёлое переливчатое курлы'},
  Fear: {file: 'pigeon-fear.wav', duration: 1.54, label: 'Испуг: короткое дрожащее курлы'},
  Anger: {file: 'pigeon-anger.wav', duration: 2.07, label: 'Гнев: низкое ворчливое курлы'},
  Sad: {file: 'pigeon-sad.wav', duration: 2.32, label: 'Грусть: тихое нисходящее курлы'},
} as const satisfies Record<Emote, {file: string; duration: number; label: string}>;

const encoded = new Map<string, Promise<Map<Emote, ArrayBuffer>>>();
const decoded = new WeakMap<BaseAudioContext, Map<string, Promise<Map<Emote, AudioBuffer>>>>();

function normalizedBase(baseUrl: string) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

/** Download once while loading the menu; unavailable voice files stay optional. */
export function preloadPigeonEmoteSounds(baseUrl = import.meta.env.BASE_URL) {
  const base = normalizedBase(baseUrl);
  let pending = encoded.get(base);
  if (!pending) {
    pending = Promise.all((Object.keys(PIGEON_EMOTE_SOUNDS) as Emote[]).map(async kind => {
      try {
        const response = await fetch(`${base}audio/${PIGEON_EMOTE_SOUNDS[kind].file}`);
        return response.ok ? [kind, await response.arrayBuffer()] as const : undefined;
      } catch { return undefined; }
    })).then(items => new Map(items.filter((item): item is readonly [Emote, ArrayBuffer] => !!item)));
    encoded.set(base, pending);
  }
  return pending;
}

/** Decode into the game's own audio context. Never unlock or create a context. */
export function loadPigeonEmoteBuffers(context: BaseAudioContext, baseUrl = import.meta.env.BASE_URL) {
  const base = normalizedBase(baseUrl);
  let byBase = decoded.get(context);
  if (!byBase) { byBase = new Map(); decoded.set(context, byBase); }
  let pending = byBase.get(base);
  if (!pending) {
    pending = preloadPigeonEmoteSounds(base).then(async data => {
      const buffers = new Map<Emote, AudioBuffer>();
      await Promise.all([...data].map(async ([kind, bytes]) => {
        try { buffers.set(kind, await context.decodeAudioData(bytes.slice(0))); }
        catch { /* Other voices remain usable after a partial download/decoder failure. */ }
      }));
      return buffers;
    });
    byBase.set(base, pending);
  }
  return pending;
}

/** Preview helper; the caller owns mute, visibility and lifetime policy. */
export function playPigeonEmoteBuffer(
  context: AudioContext, destination: AudioNode, buffer: AudioBuffer,
  options: {enabled?: boolean; gain?: number; onEnded?: () => void} = {},
) {
  if (options.enabled === false || context.state !== 'running') return undefined;
  const source = context.createBufferSource(), gain = context.createGain();
  source.buffer = buffer;
  const at = context.currentTime, level = Math.max(0, Math.min(1, options.gain ?? .65));
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + .025);
  gain.gain.setValueAtTime(level, at + Math.max(.025, buffer.duration - .10));
  gain.gain.linearRampToValueAtTime(0, at + buffer.duration);
  source.connect(gain); gain.connect(destination);
  source.onended = () => { source.disconnect(); gain.disconnect(); options.onEnded?.(); };
  source.start(at);
  return {source, gain};
}
