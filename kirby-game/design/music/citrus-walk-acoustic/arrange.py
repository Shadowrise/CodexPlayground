"""Citrus Walk: review-only sampled acoustic arrangement of playlist track 2.

Preserves all 308 original melody pitches, eighth-note onsets and rests.
Articulation, accompaniment, four-bar introduction and coda are new.
Requires Python/numpy, FluidSynth and GeneralUser GS. Never writes game audio.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import random
import re
import shutil
import struct
import subprocess
import wave

import numpy as np

GAME = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().with_name('original-make-music.cjs')
if not SOURCE.exists():
    SOURCE = GAME/'scripts/make-music.cjs'
SOURCE_TEXT = SOURCE.read_text(encoding='utf8')
TRACKS = ast.literal_eval(re.search(r'const tracks = (\[.*?\]);', SOURCE_TEXT, re.S)[1])
SOURCE_CHORDS = ast.literal_eval(re.search(r'const chords = (\[.*?\]);', SOURCE_TEXT, re.S)[1])
MOTIFS = ast.literal_eval(re.search(r'const motifs = (\[.*?\]);', SOURCE_TEXT, re.S)[1])
TRACK_INDEX = next(i for i, row in enumerate(TRACKS) if row[0] == 'citrus-walk')
_, BPM, TRANSPOSE, SEED = TRACKS[TRACK_INDEX]
assert (TRACK_INDEX, BPM, TRANSPOSE, SEED) == (1, 108, 2, 721)
RATE, PPQ = 44100, 960
BEAT = 60/BPM
INTRO_BARS, MAIN_BARS, CODA_BARS = 4, 48, 4
BARS = INTRO_BARS+MAIN_BARS+CODA_BARS
TAIL = 3.0
FRAMES = round((BARS*4*BEAT+TAIL)*RATE)
RNG = random.Random(SEED)
LABELS = ['E', 'B', 'C#m', 'A', 'F#m', 'B', 'A', 'B7']
# Low, playable guitar shapes; the lead retains the original wider register.
HARMONY = {
    'E': (40, [52, 59, 64, 68], [52, 59, 64, 68]),
    'B': (35, [47, 54, 59, 63], [51, 59, 66, 71]),
    'C#m': (37, [49, 56, 61, 64], [52, 56, 61, 68]),
    'A': (33, [45, 52, 57, 61], [52, 57, 61, 69]),
    'F#m': (30, [42, 49, 57, 61], [54, 57, 61, 69]),
    'B7': (35, [47, 54, 57, 63], [51, 57, 66, 71]),
}
INSTRUMENTS = {
    0: ('Nylon guitar - original melody and responses', 24, 112, 58, 20),
    1: ('Grand piano - original melody and ending', 0, 106, 70, 18),
    2: ('Concert flute - short answering phrases', 73, 82, 79, 23),
    3: ('Nylon guitar - fingerpicking and rhythmic chords', 24, 101, 42, 16),
    4: ('Acoustic double bass', 32, 104, 62, 10),
    5: ('Grand piano - gently retreating energetic chords', 0, 80, 74, 16),
    7: ('Warm sustained pad - approximate GM editing sound', 89, 100, 64, 20),
    9: ('Acoustic drums - individual hits, no shaker', 0, 90, 64, 9),
}
EVENTS = {ch: [] for ch in INSTRUMENTS}
NOTES = []


def original_theme():
    """Execute the exact track-2 indexing rules, not track 1's melody array."""
    result = []
    for bar in range(MAIN_BARS):
        section = bar//16
        chord_index = (bar+[0, 3, 6, 2, 4, 1, 5][TRACK_INDEX]+section*2) % 8
        shape = [n+TRANSPOSE for n in SOURCE_CHORDS[chord_index]]
        for eighth in range(8):
            if (eighth+bar+TRACK_INDEX) % 5 == 0:
                continue
            pitch = shape[MOTIFS[TRACK_INDEX-1][(eighth+section*2+bar % 2) % 8]]+12
            result.append({'source_bar': bar, 'eighth': eighth, 'midi': pitch,
                           'beat': bar*4+eighth*.5, 'chord': LABELS[chord_index]})
    assert len(result) == 308
    return result


ORIGINAL = original_theme()


def chord_at(bar):
    if bar < INTRO_BARS:
        return ['E', 'B', 'E', 'A'][bar]
    if bar >= INTRO_BARS+MAIN_BARS:
        return ['A', 'B7', 'E', 'E'][bar-INTRO_BARS-MAIN_BARS]
    source_bar = bar-INTRO_BARS
    return LABELS[(source_bar+3+(source_bar//16)*2) % 8]


def event(channel, beat, data, priority=1):
    EVENTS[channel].append((max(0, round(beat*PPQ)), priority, bytes(data)))


def cc(channel, beat, controller, value):
    event(channel, beat, [0xB0+channel, controller, max(0, min(127, round(value)))])


def note(channel, pitch, beat, duration, velocity, role, chord=None, exact=False, **extra):
    onset = beat if exact else max(math.floor(beat/4)*4+.003, beat+RNG.uniform(-.008, .008))
    velocity = max(1, min(127, round(velocity+RNG.uniform(-2, 2))))
    event(channel, onset, [0x90+channel, pitch, velocity], 2)
    event(channel, onset+duration, [0x80+channel, pitch, 0], 0)
    NOTES.append({'channel': channel, 'midi': pitch, 'beat': round(onset, 6),
                  'duration_beats': duration, 'velocity': velocity, 'role': role,
                  **({'chord': chord} if chord else {}), **extra})


def add_backing(bar):
    chord = chord_at(bar)
    root, shape, _ = HARMONY[chord]
    start = bar*4
    energy = 36 <= bar < 52
    ending = bar >= 52
    if bar == 55:
        for i, pitch in enumerate(shape):
            note(3, pitch, start+i*.025, 3.65-i*.025, 57-i, 'guitar_backing', chord)
    elif energy:
        for attack, (beat, level) in enumerate([(0, 64), (.75, 56), (1.5, 61), (2.5, 63), (3.25, 57)]):
            voicing = shape if attack == 0 else shape[1:]
            if attack % 2:
                voicing = list(reversed(voicing))
            for i, pitch in enumerate(voicing):
                note(3, pitch, start+beat+i*.015, min(.48, 3.79-beat-i*.015),
                     level-i*2, 'guitar_backing', chord)
    else:
        pattern = [(0, shape[0], 56), (.75, shape[2], 46), (1.5, shape[1], 49),
                   (2, shape[0]+7, 52), (2.75, shape[3], 47), (3.5, shape[2], 43)]
        if ending:
            pattern = pattern[:4]
        for beat, pitch, level in pattern:
            note(3, pitch, start+beat+.014, min(.75, 3.79-beat), level, 'guitar_backing', chord)

    if bar == 0:
        return
    bass = [(0, root, 1.55, 65), (2.05, root+7, 1.45, 58)]
    if energy:
        bass = [(0, root, .83, 72), (1.5, root, .46, 61),
                (2, root+7, .9, 67), (3.5, root+12, .30, 61)]
    if bar == 55:
        bass = [(0, root, 3.65, 63)]
    for beat, pitch, duration, level in bass:
        note(4, pitch, start+beat+.015, duration, level, 'bass', chord)

    # A separate piano part can fade without changing the lead or whole mix.
    if energy:
        for beat in (.5, 1.5, 2.5, 3.5):
            for i, pitch in enumerate(shape[1:]):
                note(5, pitch, start+beat+i*.009, .25, 66-i*3, 'piano_comping', chord)


def add_intro_and_coda():
    intro = [
        (2, [(0, 76, .82), (1, 80, .72), (2, 83, 1.42)]),
        (0, [(.5, 78, .64), (1.25, 75, .55), (2, 71, 1.40)]),
        (2, [(0, 80, .70), (1, 83, .55), (2, 76, 1.45)]),
        (0, [(0, 76, .65), (.75, 73, .63), (1.5, 69, .63), (2.5, 73, .92)]),
    ]
    # All introductory pitches are chord tones; the repetition in bar 3 gives
    # the flute a simple recognisable answer rather than an unrelated scale.
    for bar, (channel, phrase) in enumerate(intro):
        for beat, pitch, length in phrase:
            note(channel, pitch, bar*4+beat+.025, length, 68 if channel == 2 else 78,
                 'intro_melody', chord_at(bar))
    coda = [
        (0, [(0, 76, .64), (.75, 73, .62), (1.5, 69, 1.1), (3, 73, .7)]),
        (2, [(0, 78, .78), (1, 75, .76), (2, 71, 1.42)]),
        (1, [(0, 76, .78), (1, 80, .72), (2, 83, 1.50)]),
        (0, [(0, 80, .76), (1, 76, 2.70)]),
    ]
    for local, (channel, phrase) in enumerate(coda):
        bar = 52+local
        for beat, pitch, length in phrase:
            note(channel, pitch, bar*4+beat+.02, length, 75 if channel != 2 else 67,
                 'coda_melody', chord_at(bar))
    # A small piano response resolves the same E major chord as the guitar.
    for beat, pitch, length in [(0, 64, 3.5), (.035, 68, 3.45), (.07, 71, 3.4)]:
        note(1, pitch, 55*4+beat+.025, length, 58, 'coda_harmony', 'E')


def add_main_melody():
    for original in ORIGINAL:
        bar, eighth, pitch = original['source_bar'], original['eighth'], original['midi']
        channel = 1 if 16 <= bar < 40 else 0
        # Original note onsets and rests stay on the exact eighth-note grid.
        # Short articulation stops the old 1.7-second plucked notes from
        # ringing over a different chord. The note's sampled release remains.
        next_eighth = next((n['eighth'] for n in ORIGINAL
                            if n['source_bar'] == bar and n['eighth'] > eighth), 8)
        duration = min(.83, (next_eighth-eighth)*.5-.075, 3.86-eighth*.5)
        arch = [1., 1.03, 1.06, .97][bar % 4]
        level = (85 if channel == 0 else 84)+(4 if eighth in (0, 4) else -4 if eighth % 2 else 0)
        if bar >= 32:
            level += 4
        note(channel, pitch, INTRO_BARS*4+original['beat'], duration,
             level*arch, 'original_melody', original['chord'], exact=True,
             source_bar=bar, source_eighth=eighth)

    # Flute replies use the source rests, with no octave-transposition of the
    # main tune. Its low F#3 notes remain on guitar/piano, within their range.
    for source_bar in range(4, MAIN_BARS):
        if source_bar % 4 != 3 and not (16 <= source_bar < 32 and source_bar % 4 == 1):
            continue
        bar = INTRO_BARS+source_bar
        rests = [i for i in range(8) if (i+source_bar+1) % 5 == 0]
        chord = chord_at(bar)
        shape = HARMONY[chord][1]
        for i, eighth in enumerate(rests[-1:]):
            pitch = shape[-1]+12
            note(2, pitch, bar*4+eighth*.5+.025, min(.36, 3.86-eighth*.5),
                 62+i*2, 'flute_answer', chord)


def add_drums():
    for bar in range(20, 52):
        energy = bar >= 36
        hits = ([(0, 36, 67), (1, 38, 53), (2, 36, 63), (3, 38, 57)] if energy
                else [(0, 36, 46), (2, 37, 40)])
        if energy and bar % 4 == 1:
            hits.append((2.75, 36, 47))
        if bar == 51:
            hits.extend([(3.25, 38, 42), (3.5, 47, 51), (3.75, 45, 53)])
        for beat, pitch, velocity in hits:
            note(9, pitch, bar*4+beat+.01, .10, velocity, 'drums')


def add_pad():
    for voice in range(4):
        active = None
        for bar in range(12, BARS):
            chord = chord_at(bar)
            pitch = HARMONY[chord][2][voice]
            if active is not None and active['midi'] == pitch:
                active['duration_beats'] += 4
            else:
                active = {'voice': voice, 'midi': pitch, 'beat': bar*4,
                          'duration_beats': 4, 'channel': 7, 'velocity': 60,
                          'role': 'warm_pad'}
                NOTES.append(active)
    # This MIDI track is an editing approximation. The exact audible pad is
    # rendered separately, with harmonic (not detuned) additive oscillators.
    for n in NOTES:
        if n['channel'] == 7:
            event(7, n['beat'], [0x97, n['midi'], n['velocity']], 2)
            event(7, n['beat']+n['duration_beats']-.15, [0x87, n['midi'], 0], 0)


def build():
    RNG.seed(SEED)
    NOTES.clear()
    for events in EVENTS.values():
        events.clear()
    for channel, (_, program, volume, pan, reverb) in INSTRUMENTS.items():
        event(channel, 0, [0xC0+channel, program])
        for controller, value in [(7, volume), (10, pan), (11, 106), (91, reverb), (93, 0), (1, 0), (64, 0)]:
            cc(channel, 0, controller, value)
        event(channel, 0, [0xE0+channel, 0, 64])
    for bar in range(BARS):
        add_backing(bar)
    add_intro_and_coda()
    add_main_melody()
    add_drums()
    add_pad()
    for step in range(161):
        position = step/160
        cc(5, 44*4+32*position, 11, 106*10**(-8*position/40))
        cc(3, 44*4+32*position, 11, 106*10**(-4*position/40))
    # Reset after the phrase so the final guitar cadence has its own dynamics.
    cc(3, 52*4, 11, 106)
    for ch in INSTRUMENTS:
        cc(ch, BARS*4, 64, 0)


def validate():
    lead = [n for n in NOTES if n['role'] == 'original_melody']
    actual = [(n['midi'], round(n['beat']-INTRO_BARS*4, 6)) for n in lead]
    assert actual == [(n['midi'], n['beat']) for n in ORIGINAL]
    assert len(lead) == 308
    for n in NOTES:
        assert 0 <= n['midi'] <= 127 and 1 <= n['velocity'] <= 127
        assert n['beat'] >= 0 and n['beat']+n['duration_beats'] <= BARS*4+.001
        if n['channel'] == 9:
            assert n['midi'] in (36, 37, 38, 45, 47)
            continue
        if n['channel'] == 2:
            assert 60 <= n['midi'] <= 96
        # Check sustained common pad tones against every crossed harmony.
        bars = range(int(n['beat']//4), math.ceil((n['beat']+n['duration_beats'])/4))
        for bar in bars:
            pitches = {p % 12 for p in HARMONY[chord_at(bar)][1]}
            assert n['midi'] % 12 in pitches, (n, chord_at(bar))
    return len(lead)


def varlen(value):
    value = int(value)
    result = [value & 127]
    while value >> 7:
        value >>= 7
        result.insert(0, (value & 127) | 128)
    return bytes(result)


def chunk(kind, data):
    return kind+struct.pack('>I', len(data))+data


def meta(kind, payload):
    return bytes([0xFF, kind])+varlen(len(payload))+payload


def write_midi(path, channels=None, original=False):
    conductor = b'\0'+meta(0x51, round(60_000_000/BPM).to_bytes(3, 'big'))
    conductor += b'\0'+meta(0x58, bytes([4, 2, 24, 8]))
    conductor += b'\0'+meta(0x59, bytes([4, 0]))+b'\0'+meta(0x2F, b'')
    chunks = [chunk(b'MTrk', conductor)]
    if original:
        original_events = [(0, 1, bytes([0xC0, 24]))]
        for n in ORIGINAL:
            duration = .55 if n['source_bar']//16 == 1 else 1.7/BEAT
            original_events.extend([
                (round(n['beat']*PPQ), 2, bytes([0x90, n['midi'], 82])),
                (round((n['beat']+duration)*PPQ), 0, bytes([0x80, n['midi'], 0])),
            ])
        rows = [(0, original_events)]
    else:
        rows = [(ch, ev) for ch, ev in EVENTS.items() if channels is None or ch in channels]
    for ch, ev in rows:
        data = b'\0'+meta(3, INSTRUMENTS[ch][0].encode('ascii'))
        previous = 0
        for tick, priority, message in sorted(ev, key=lambda e: (e[0], e[1])):
            data += varlen(tick-previous)+message
            previous = tick
        end = round(((MAIN_BARS if original else BARS)*4+8)*PPQ)
        data += varlen(max(0, end-previous))+meta(0x2F, b'')
        chunks.append(chunk(b'MTrk', data))
    path.write_bytes(chunk(b'MThd', struct.pack('>HHH', 1, len(chunks), PPQ))+b''.join(chunks))


def read_float(path):
    raw = path.read_bytes()
    at, samples = 12, None
    while at+8 <= len(raw):
        kind, size = raw[at:at+4], struct.unpack_from('<I', raw, at+4)[0]
        if kind == b'fmt ':
            fmt, channels, rate = struct.unpack_from('<HHI', raw, at+8)
            assert (fmt, channels, rate, struct.unpack_from('<H', raw, at+22)[0]) == (3, 2, RATE, 32)
        if kind == b'data':
            samples = np.frombuffer(raw, dtype='<f4', count=size//4, offset=at+8)
        at += 8+size+size % 2
    assert samples is not None and np.isfinite(samples).all()
    audio = samples.reshape(-1, 2).astype(np.float64)
    assert len(audio) >= FRAMES
    return audio[:FRAMES].copy()


def render(args, midi, target):
    command = [str(args.fluidsynth), '-ni', '-F', str(target), '-T', 'wav', '-O', 'float',
               '-r', str(RATE), '-g', '.46', '-C', '0', '-R', '1',
               '-o', 'synth.reverb.engine=dat', '-o', 'synth.reverb.room-size=.28',
               '-o', 'synth.reverb.damp=.60', '-o', 'synth.reverb.width=65',
               '-o', 'synth.reverb.level=.18', '-o', 'synth.polyphony=256',
               str(args.soundfont), str(midi)]
    subprocess.run(command, check=True, capture_output=True)
    return read_float(target)


def rms_db(audio):
    return round(20*math.log10(max(1e-12, float(np.sqrt(np.mean(audio*audio))))), 2)


def band_tone(audio, freqs, gains):
    fft_size, taps = 2048, 129
    response = 10**(np.interp(np.fft.rfftfreq(fft_size, 1/RATE), freqs, gains)/20)
    impulse = np.fft.fftshift(np.fft.irfft(response, n=fft_size))
    center = fft_size//2
    kernel = impulse[center-taps//2:center+taps//2+1]*np.kaiser(taps, 6)
    kernel /= kernel.sum()
    return np.column_stack([np.convolve(audio[:, ch], kernel, mode='same') for ch in range(2)])


def limit(audio, ceiling=.79):
    block = round(.005*RATE)
    count = math.ceil(len(audio)/block)
    peaks = np.pad(np.max(np.abs(audio), axis=1), (0, count*block-len(audio))).reshape(count, block).max(axis=1)
    required = np.minimum(1, ceiling/np.maximum(peaks, 1e-12))
    edges = np.ones(count+1)
    edges[:-1] = required
    edges[1:] = np.minimum(edges[1:], required)
    release = 1-math.exp(-(block/RATE)/.080)
    for i in range(1, len(edges)):
        edges[i] = min(edges[i], edges[i-1]+(1-edges[i-1])*release)
    curve = np.interp(np.arange(len(audio))/block, np.arange(len(edges)), edges)
    return audio*curve[:, None], round(-20*math.log10(float(edges.min())), 2)


def write_wav(path, audio):
    assert np.isfinite(audio).all() and np.max(np.abs(audio)) < .99
    rng = np.random.default_rng(SEED)
    dither = (rng.random(audio.shape)-rng.random(audio.shape))/65536
    pcm = np.rint((audio+dither)*32767).astype('<i2')
    assert not np.any(np.abs(pcm.astype(np.int32)) >= 32767)
    with wave.open(str(path), 'wb') as wav:
        wav.setparams((2, 2, RATE, len(pcm), 'NONE', 'not compressed'))
        wav.writeframes(pcm.tobytes())


def synth_pad():
    pad = np.zeros((FRAMES, 2))
    weights, positions = [.36, .48, .73, .68], [-.30, .30, -.44, .44]
    for n in NOTES:
        if n['channel'] != 7:
            continue
        start = round(n['beat']*BEAT*RATE)
        stop = round((n['beat']+n['duration_beats'])*BEAT*RATE)
        t = np.arange(stop-start)/RATE
        global_t = t+start/RATE
        frequency = 440*2**((n['midi']-69)/12)
        phase = 2*math.pi*frequency*global_t+n['voice']*.71
        tone = np.sin(phase)
        for harmonic, strength in [(2, .32), (3, .13), (4, .06), (5, .025)]:
            lowpass = 1/math.sqrt(1+(harmonic*frequency/1500)**4)
            tone += strength*lowpass*np.sin(harmonic*phase+harmonic*.09)
        envelope = np.ones(len(t))
        attack, release = round(.18*RATE), round(.23*RATE)
        envelope[:attack] = np.sin(np.linspace(0, math.pi/2, attack))**2
        envelope[-release:] = np.cos(np.linspace(0, math.pi/2, release))**2
        tone *= envelope*weights[n['voice']]*(.97+.03*np.sin(2*math.pi*.113*global_t+n['voice']))
        pan = positions[n['voice']]+.04*np.sin(2*math.pi*.047*global_t+n['voice'])
        pad[start:stop, 0] += tone*np.sqrt((1-pan)/2)
        pad[start:stop, 1] += tone*np.sqrt((1+pan)/2)
    active = pad[round(28*RATE):round(78*RATE)]
    pad *= 10**(-21/20)/np.sqrt(np.mean(active*active))
    seconds = np.arange(FRAMES)/RATE
    # A prominent, steady chord bed; only the instrumental comping retreats.
    expression = np.interp(seconds,
        [0, 12*4*BEAT, 12*4*BEAT+.3, 44*4*BEAT-.1, 44*4*BEAT+.3,
         52*4*BEAT, 52*4*BEAT+.7, 54*4*BEAT, BARS*4*BEAT, FRAMES/RATE],
        [0, 0, 1, 1, 1.35, 1.35, .85, .75, .55, .55])
    return pad*expression[:, None]


GROUPS = [
    ('nylon-lead', [0], -20.0, [(4, 20), (44, 52)]),
    ('piano-lead', [1], -20.5, [(20, 44)]),
    ('flute', [2], -24.0, [(0, 3)]),
    ('nylon-backing', [3], -27.5, [(4, 36)]),
    ('bass', [4], -25.0, [(4, 52)]),
    ('piano-comping', [5], -25.5, [(36, 44)]),
    ('drums', [9], -27.5, [(36, 52)]),
]


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    build()
    checked = validate()
    midi = args.output/'citrus-walk-acoustic.mid'
    write_midi(midi)
    write_midi(args.output/'citrus-walk-original-melody.mid', original=True)
    (args.output/'original-melody.json').write_text(json.dumps(ORIGINAL, indent=2)+'\n', encoding='utf8')
    mix = np.zeros((FRAMES, 2))
    stems = []
    for name, channels, target_rms, windows in GROUPS:
        print('Rendering '+name+'...', flush=True)
        stem_midi = args.work/(name+'.mid')
        write_midi(stem_midi, channels=channels)
        audio = render(args, stem_midi, args.work/(name+'-float.wav'))
        if name in ('nylon-lead', 'piano-lead', 'flute'):
            audio = band_tone(audio, [0, 1200, 2600, 4500, 8000, 22050],
                              [0, 0, -.7, -2.2, -3.0, -3.0])
        active = np.concatenate([audio[round(first*4*BEAT*RATE):round(last*4*BEAT*RATE)]
                                 for first, last in windows])
        gain = float(10**(target_rms/20)/np.sqrt(np.mean(active*active)))
        audio *= gain
        mix += audio
        stems.append({'name': name, 'channels': channels, 'gain': gain,
                      'active_target_rms_dbfs': target_rms, 'calibration_bars': windows})
        del audio, active
    pad = synth_pad()
    mix += pad
    core = mix[round(INTRO_BARS*4*BEAT*RATE):round(52*4*BEAT*RATE)]
    gain = float(10**(-16.5/20)/np.sqrt(np.mean(core*core)))
    audio, reduction = limit(mix*gain)
    if reduction > 4.5:
        gain *= 10**(-(reduction-4.5)/20)
        audio, reduction = limit(mix*gain)
    fade_in, fade_out = round(.010*RATE), round(.35*RATE)
    audio[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    audio[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    output = args.output/'citrus-walk-acoustic.wav'
    write_wav(output, audio)
    write_wav(args.output/'warm-pad-stem.wav', pad*gain)
    sections = [('Вступление: флейта и гитара', 0, 4), ('Тема: нейлоновая гитара', 4, 20),
                ('Фортепианная середина с редкими ударами', 20, 36),
                ('Энергичный дуэт фортепиано и гитары', 36, 44),
                ('Возвращение гитары с явным пэдом', 44, 52), ('Заключительная перекличка', 52, 56)]
    report = {
        'date': '2026-10-24', 'revision': 1, 'status': 'review_only_not_installed',
        'title': 'Цитрусовая прогулка — акустическая аранжировка',
        'style': 'Sunny acoustic folk with light bossa-like guitar syncopation',
        'source': SOURCE.as_posix(), 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'bpm': BPM, 'key': 'E major', 'bars': BARS, 'original_theme_bars': MAIN_BARS,
        'intro_bars': INTRO_BARS, 'coda_bars': CODA_BARS,
        'original_melody_notes_verified': checked, 'main_pitch_edits': 0,
        'main_grid_and_rests_preserved': True, 'main_articulation_changed': True,
        'main_theme_offset_seconds': INTRO_BARS*4*BEAT,
        'duration_seconds': len(audio)/RATE, 'sample_rate': RATE, 'channels': 2, 'bits': 16,
        'rms_dbfs': rms_db(audio), 'peak_dbfs': round(20*math.log10(float(np.max(np.abs(audio)))), 2),
        'peak_reduction_max_db': reduction, 'master_gain': gain, 'clipped_samples': 0,
        'no_chorus_or_pitch_detuning': True, 'no_shaker_maracas_or_hihat': True,
        'notes_by_role': dict(Counter(n['role'] for n in NOTES)), 'stems': stems,
        'pad': {'start_seconds': 12*4*BEAT, 'featured_seconds': [44*4*BEAT, 52*4*BEAT],
                'exact_sound': 'warm-pad-stem.wav', 'midi_sound': 'approximate GM program 89'},
        'soundfont': 'GeneralUser GS v2.0.3, S. Christian Collins', 'renderer': 'FluidSynth 2.6.1',
        'sections': [{'title': title, 'start_seconds': first*4*BEAT, 'end_seconds': last*4*BEAT,
                      'rms_dbfs': rms_db(audio[round(first*4*BEAT*RATE):round(last*4*BEAT*RATE)])}
                     for title, first, last in sections],
        'audio_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    (args.output/'score.json').write_text(json.dumps(NOTES, indent=2)+'\n', encoding='utf8')
    (args.output/'instruments.json').write_text(json.dumps(INSTRUMENTS, indent=2)+'\n', encoding='utf8')
    (args.output/'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    license_path = args.soundfont.with_name('GeneralUser-GS-LICENSE.txt')
    shutil.copyfile(license_path, args.output/'GeneralUser-GS-LICENSE.txt')
    shutil.copyfile(Path(__file__), args.output/'arrange.py')
    selection = {'date': '2026-10-24', 'revision': 1, 'status': 'audition_full_arrangement_not_installed',
                 'track_id': 'citrus-walk', 'playlist_position': 2,
                 'audio_path': output.as_posix(), 'midi_path': midi.as_posix(),
                 'report_path': (args.output/'render-report.json').as_posix(),
                 'original_melody_notes_preserved': checked,
                 'notes': 'Full acoustic review version. Original track-2 melody indexing and pitches retained; fresh articulation and backing. Melodic four-bar intro, audible warm pad, sparse middle kick/cross-stick, later piano/guitar energy, gradual comping retreat under pad, and a resolved ending. No shaker or artificial detuning. Game audio is untouched.'}
    source_selection = Path(__file__).resolve().with_name('selection.json')
    current_selection = json.loads(source_selection.read_text(encoding='utf8')) if source_selection.exists() else {}
    if current_selection.get('game_installation') is None and current_selection.get('revision', 1) <= 1:
        source_selection.write_text(json.dumps(selection, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    (args.output/'selection.json').write_text(json.dumps(selection, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('fluidsynth', 'soundfont', 'output', 'work'):
        parser.add_argument('--'+flag, type=Path, required=True)
    main(parser.parse_args())
