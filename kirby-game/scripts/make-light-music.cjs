const fs = require('node:fs');
const path = require('node:path');
// Two light festive songs with their own metre, melody and timbre.
const songs = [
  {
    id: 'accordion-stroll', bpm: 104, bars: 48,
    form: 'IIIIAAAAAAAAAAAAAAAA BBBBBBBBAAAAAAAA BBBBBBBBEEEE'.replaceAll(' ', ''),
    phrases: {
      A: [[79, 83, 86, 83], [81, 79, 76, 74], [76, 78, 79, 83], [81, 79, 0, 0], [74, 78, 81, 79], [78, 76, 74, 71], [72, 74, 76, 78], [79, 0, 0, 0]],
      B: [[86, 84, 83, 81], [83, 84, 86, 0], [88, 86, 84, 83], [81, 79, 78, 76], [79, 81, 83, 86], [84, 83, 81, 79], [78, 76, 74, 76], [79, 0, 0, 0]],
      E: [[79, 83, 86, 91], [91, 0, 0, 0], [86, 83, 79, 0], [79, 0, 0, 0]],
    },
    chords: {
      A: ['G', 'Em', 'G', 'G', 'D', 'Em', 'C', 'G'],
      B: ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G'],
      E: ['G', 'G', 'D', 'G'],
    },
    lead: 'violin', harmony: 'accordion', bass: true, block: true,
  },
  {
    id: 'shore-whistle', bpm: 92, bars: 42,
    form: 'IIAAAAAAAAAAAAAAAA BBBBBBBBAAAAAAAAAAAAAAAA'.replaceAll(' ', ''),
    phrases: {
      A: [[76, 78, 81, 0], [80, 78, 76, 0], [73, 74, 76, 0], [76, 0, 0, 0], [81, 83, 85, 0], [86, 85, 83, 0], [81, 78, 76, 0], [81, 0, 0, 0]],
      B: [[85, 83, 81, 83], [85, 86, 85, 0], [88, 86, 85, 83], [81, 80, 78, 76], [76, 78, 81, 83], [85, 83, 81, 78], [76, 74, 73, 74], [81, 0, 0, 0]],
    },
    chords: {
      A: ['A', 'A', 'D', 'A', 'A', 'D', 'A', 'A'],
      B: ['A', 'D', 'E', 'A', 'D', 'A', 'E', 'A'],
    },
    lead: 'whistle', harmony: 'uke', bass: false, block: false,
  },
];
const chords = {
  F: [65, 69, 72], C: [72, 76, 79], Bb: [70, 74, 77],
  D: [62, 66, 69], G: [67, 71, 74], Em: [64, 67, 71],
  A: [69, 73, 76], E: [64, 68, 71],
};
const scale = {
  F: new Set([5, 7, 9, 10, 0, 2, 4]),
  C: new Set([0, 2, 4, 5, 7, 9, 11]),
  Bb: new Set([10, 0, 2, 3, 5, 7, 9]),
  D: new Set([2, 4, 6, 7, 9, 11, 1]),
  G: new Set([7, 9, 11, 0, 2, 4, 6]),
  Em: new Set([4, 6, 7, 9, 11, 0, 2]),
  A: new Set([9, 11, 1, 2, 4, 6, 8]),
  E: new Set([4, 6, 8, 9, 11, 1, 3]),
};
function below(midi, name) {
  const pcs = scale[name];
  for (const step of [3, 4, 8, 9]) if (pcs.has((midi - step + 120) % 12)) return midi - step;
  return midi - 12;
}
for (const song of songs) {
  if (song.form.length !== song.bars) throw Error(song.id + ' form ' + song.form.length);
  const rate = 22050, beat = 60 / song.bpm, seconds = song.bars * 4 * beat, length = Math.round(seconds * rate);
  const L = new Float32Array(length), R = new Float32Array(length);
  let seed = 9001 + song.bars * 17;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  function mix(start, duration, fn, volume, pan = 0) {
    const offset = Math.round(start * rate), n = Math.ceil(duration * rate), lg = Math.sqrt((1 - pan) / 2), rg = Math.sqrt((1 + pan) / 2);
    for (let i = 0; i < n; i++) {
      const j = offset + i; if (j >= length) break;
      const v = fn(i / rate, duration) * volume;
      L[j] += v * lg; R[j] += v * rg;
    }
  }
  function tone(kind, f, t) {
    const s = Math.sin(2 * Math.PI * f * t);
    switch (kind) {
      case 'glock': return s * Math.exp(-t * 4.4) + .32 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 9) + .07 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 16);
      case 'clarinet': return (s + .42 * Math.sin(2 * Math.PI * f * 3 * t) + .16 * Math.sin(2 * Math.PI * f * 5 * t)) * (.9 + .1 * Math.sin(t * 5.2)) * Math.min(1, t / .06);
      case 'kalimba': return (s + .55 * Math.sin(2 * Math.PI * f * 2.03 * t) * Math.exp(-t * 7) + .12 * Math.sin(2 * Math.PI * f * 4.2 * t) * Math.exp(-t * 14) + (t < .004 ? (random() * 2 - 1) * .4 : 0)) * Math.exp(-t * 2.6);
      case 'flute': return (s * (1 + .04 * Math.sin(t * 6)) + .08 * (random() * 2 - 1) * Math.exp(-t * 3)) * Math.min(1, t / .09);
      case 'violin': return (Math.sin(2 * Math.PI * f * t + .045 * Math.sin(t * 31)) + .18 * Math.sin(4 * Math.PI * f * t)) * Math.min(1, t / .11);
      case 'accordion': return (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.004 * t)) * .5 * (.9 + .1 * Math.sin(t * 28)) * Math.min(1, t / .05);
      case 'uke': return (s + .34 * Math.sin(2 * Math.PI * f * 2 * t) + .12 * Math.sin(2 * Math.PI * f * 3 * t)) * Math.exp(-t * 8);
      case 'whistle': return Math.sin(2 * Math.PI * f * t + (t > .12 ? .03 * Math.sin((t - .12) * 28) : 0)) * Math.min(1, t / .045);
      case 'bass': return (s + .2 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-t * 3.2);
      default: return s * Math.exp(-t * 3);
    }
  }
  function note(midi, start, duration, kind, volume, pan) {
    const f = 440 * 2 ** ((midi - 69) / 12);
    mix(start, duration + .05, (t, d) => tone(kind, f, t) * Math.min(1, (d - t) / .07), volume, pan);
    if (kind === 'glock' || kind === 'whistle') mix(start + .16, duration * .7, (t, d) => tone(kind, f, t) * Math.min(1, (d - t) / .07) * .22, volume, -pan);
  }
  function hit(at, volume) {
    mix(at, .05, (t, d) => (random() * 2 - 1) * Math.exp(-t * 70) * Math.min(1, t * 800) * Math.min(1, (d - t) * 80), volume, .4);
  }
  let phraseBar = 0, phrase = song.form[0];
  for (let bar = 0; bar < song.bars; bar++) {
    const mark = song.form[bar];
    if (mark !== phrase) { phrase = mark; phraseBar = 0; }
    const start = bar * 4 * beat;
    const chordRow = song.chords[phrase] ?? [song.chords.A[0]];
    const name = chordRow[phraseBar % chordRow.length];
    const chord = chords[name], melody = song.phrases[phrase], line = melody ? melody[phraseBar % melody.length] : [0, 0, 0, 0];
    const late = bar > song.bars * .55, early = bar < 4;
    if (song.bass) {
      note(chord[0] - 24, start, beat * 1.3, 'bass', .055, 0);
      note(chord[2] - 24, start + 2 * beat, beat * 1.1, 'bass', .04, 0);
    }
    if (song.block) {
      for (const at of [1, 3]) chord.forEach((midi, j) => note(midi, start + at * beat + j * .012, beat * .7, 'accordion', .02, (j - 1) * .35));
    }
    if (song.id === 'shore-whistle') {
      chord.forEach((midi, j) => note(midi, start + j * .02, beat * .45, 'uke', .03, .2));
      chord.forEach((midi, j) => note(midi, start + 2 * beat + j * .018, beat * .35, 'uke', .022, -.15));
    }
    if (phrase !== 'I') line.forEach((midi, i) => {
      if (!midi) return;
      const at = start + i * beat, dur = (line[i + 1] ? .92 : 1.7) * beat;
      note(midi, at, dur, song.lead, .078, -.12);
      if (late) note(below(midi, name), at, dur, song.harmony, .032, .28);
    });
    if (phrase === 'E') chord.forEach((midi, j) => note(midi + 12, start + j * .04, beat * 3, song.lead === 'violin' ? 'accordion' : song.lead, .03, (j - 1) * .3));
    phraseBar++;
  }
  let meanL = 0, meanR = 0;
  for (let i = 0; i < length; i++) { meanL += L[i]; meanR += R[i]; }
  meanL /= length; meanR /= length;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, i / (rate * .12), (length - 1 - i) / (rate * 1.3));
    L[i] = Math.tanh((L[i] - meanL) * 1.2) * fade;
    R[i] = Math.tanh((R[i] - meanR) * 1.2) * fade;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const gain = .68 / peak, data = Buffer.alloc(length * 4);
  let energy = 0;
  for (let i = 0; i < length; i++) {
    const l = L[i] * gain, r = R[i] * gain;
    energy += (l * l + r * r) / 2;
    data.writeInt16LE(Math.round(l * 32767), i * 4);
    data.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.resolve(__dirname, `../public/audio/${song.id}.wav`), Buffer.concat([h, data]));
  console.log(JSON.stringify({ track: song.id, seconds: Math.round(seconds * 1000) / 1000, rms: Math.sqrt(energy / length) }));
}
