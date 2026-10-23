"""Review-only sampled orchestral arrangement of the original Meta Knight score.

Preserves the original 438 melody notes, 144 BPM and 64-bar loop. Requires
Python/numpy, FluidSynth and GeneralUser GS. Never writes game assets.
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
import struct
import subprocess
import wave

import numpy as np

GAME = Path(__file__).resolve().parents[3]
SOURCE = GAME / 'scripts/make-meta-knight-music.cjs'
TEXT = SOURCE.read_text(encoding='utf8')
THEMES = {key: ast.literal_eval(re.search(r'const '+key+r'=(\[.*?\]);', TEXT, re.S)[1])
          for key in ('themeA', 'themeB', 'themeC')}
BPM, BARS, PPQ, RATE = 144, 64, 960, 44100
BEAT = 60 / BPM
BEATS = BARS * 4
FRAMES = round(BEATS * BEAT * RATE)
FORM = ['themeA', 'themeB', 'themeA', 'themeC', 'themeC', 'themeB', 'themeA', 'themeB']
SECTION_NAMES = ['Sword theme', 'Bright answer', 'String reprise', 'Piano bridge',
                 'Flute bridge variation', 'Theme returns', 'Heroic advance', 'Finale into loop']
LEAD_CHANNELS = [0, 1, 0, 2, 1, 0, 0, 0]
LEAD_LEVELS = [89, 86, 90, 82, 84, 93, 95, 97]
RNG = random.Random(20261023)
# Keep the reference arrangement's gain; softening the violin must not turn
# the rest of the orchestra up through fresh whole-mix normalization.
REFERENCE_GAIN = 6.265592775326211

INSTRUMENTS = {
    0: ('Solo violin - original melody', 40, 119, 52, 23),
    1: ('Concert flute - original melody', 73, 74, 77, 23),
    2: ('Grand piano - bridge and accents', 0, 109, 67, 17),
    3: ('Cello - short bowed ostinato', 42, 88, 38, 15),
    4: ('Pizzicato strings - pulse', 45, 87, 87, 14),
    5: ('French horns - heroic chord accents', 60, 83, 43, 21),
    6: ('String ensemble - harmonic bed', 48, 73, 75, 22),
    7: ('Contrabass - harmonic roots', 43, 98, 57, 12),
    8: ('Glockenspiel - star accents', 9, 65, 86, 22),
    9: ('Acoustic drums - no shaker', 0, 87, 64, 10),
    10: ('Orchestral timpani', 47, 92, 54, 17),
    11: ('Warm sustained synthesizer pad', 89, 112, 64, 23),
}

# Low strings, brass and pads stay below the unchanged high melody.
# The suspended A resolves at beat 1 of bar 7, exactly when the melody reaches C#.
CHORDS = {
    'Dm': (38, [50, 53, 57], [57, 62, 65, 69], [50, 57, 65, 69]),
    'Bb': (34, [46, 50, 53], [53, 58, 62, 65], [50, 58, 65, 70]),
    'F': (41, [53, 57, 60], [57, 60, 65, 69], [53, 60, 65, 69]),
    'C': (36, [48, 52, 55], [55, 60, 64, 67], [52, 55, 64, 67]),
    'Gm': (31, [43, 46, 50], [55, 58, 62, 67], [50, 58, 62, 67]),
    'Asus4': (33, [45, 50, 52], [57, 62, 64, 69], [50, 57, 64, 69]),
    'A7': (33, [45, 49, 52, 55], [55, 61, 64, 69], [49, 55, 64, 69]),
}
PROGRESSION = ['Dm', 'Bb', 'F', 'C', 'Gm', 'Bb', 'Asus4', 'A7']
EVENTS = {channel: [] for channel in INSTRUMENTS}
NOTES = []


def chord_at(bar, beat=0):
    return 'A7' if bar % 8 == 6 and beat >= 1 else PROGRESSION[bar % 8]


def harmonic_segments(bar):
    return [(0, 1, 'Asus4'), (1, 3, 'A7')] if bar % 8 == 6 else [(0, 4, chord_at(bar))]


def event(channel, beat, data, priority=1):
    EVENTS[channel].append((round(beat*PPQ), priority, bytes(data)))


def cc(channel, beat, controller, value):
    event(channel, beat, [0xB0+channel, controller, round(value)])


def note(channel, pitch, beat, duration, velocity, role, chord=None, humanize=True):
    # Keep the lead's exact original grid and length; vary accompaniment by a
    # few milliseconds and all velocities slightly, without pitch detuning.
    onset = max(0, beat + (RNG.uniform(-.007, .007) if humanize and role != 'lead' else 0))
    velocity = max(1, min(127, round(velocity + RNG.uniform(-2, 2))))
    event(channel, onset, [0x90+channel, pitch, velocity], 2)
    event(channel, onset+duration, [0x80+channel, pitch, 0], 0)
    NOTES.append({'channel': channel, 'midi': pitch, 'beat': round(onset, 6),
                  'duration_beats': duration, 'velocity': velocity, 'role': role,
                  **({'chord': chord} if chord else {})})


def build():
    RNG.seed(20261023)
    NOTES.clear()
    for events in EVENTS.values():
        events.clear()
    for channel, (_, program, volume, pan, reverb) in INSTRUMENTS.items():
        event(channel, 0, [0xC0+channel, program])
        for controller, value in [(7, volume), (10, pan), (11, 106), (91, reverb), (93, 0), (1, 0), (64, 0)]:
            cc(channel, 0, controller, value)
        event(channel, 0, [0xE0+channel, 0, 64])

    for bar in range(BARS):
        section, start = bar//8, bar*4
        bridge = section in (3, 4)
        row = THEMES[FORM[section]][bar % 8]
        # Exact note pitches, eighth-note positions, rests and gate lengths.
        for eighth, pitch in enumerate(row):
            if pitch < 0:
                continue
            duration = .96 if eighth+1 < len(row) and row[eighth+1] == -1 else .48
            velocity = LEAD_LEVELS[section] + (3 if eighth in (0, 4) else -3 if eighth % 2 else 0)
            note(LEAD_CHANNELS[section], pitch, start+eighth*.5, duration, velocity, 'lead')

        # One focused low-string ostinato; no competing parallel high melody.
        for eighth in (range(0, 8, 2) if bridge else range(8)):
            local = eighth*.5
            chord = chord_at(bar, local)
            root, shape, _, _ = CHORDS[chord]
            index = [0, 2, 1, 2, 0, 2, 1, 2][eighth]
            note(3, shape[index], start+local+.012, .34 if not bridge else .48,
                 (45 if bridge else 57) + (4 if eighth in (0, 4) else 0), 'cello', chord)
        for beat in ([1.5, 3.5] if bridge else [.5, 1.5, 2.5, 3.5]):
            chord = chord_at(bar, beat)
            shape = CHORDS[chord][1]
            pitch = shape[int(beat) % len(shape)]+12
            note(4, pitch, start+beat+.008, .30, 39 if bridge else 49, 'pizzicato', chord)

        # Original root/fifth support, with space between bass attacks.
        for beat in ([0, 2] if bridge else [0, 1, 2, 3]):
            chord = chord_at(bar, beat)
            root = CHORDS[chord][0]
            pitch = root + (7 if beat == 2 and not bridge else 0)
            note(7, pitch, start+beat+.007, .78 if not bridge else 1.55,
                 57 if bridge else 66, 'bass', chord)

        # Discrete brass gestures keep the theme clear and give it weight.
        horn_beats = [] if section == 3 else ([0] if bridge or section == 0 else [0, 2])
        for beat in horn_beats:
            if section == 0 and bar % 2:
                continue
            chord = chord_at(bar, beat)
            shape = CHORDS[chord][1]
            for i, pitch in enumerate([shape[0]+12, shape[1]+12, shape[2]+12]):
                note(5, pitch, start+beat+i*.008, .66,
                     (44 if bridge else 55+section) - i*2, 'horns', chord)

        # Sustained strings release before changing harmony. The warm synth
        # pad ties common notes across chords, instead of retriggering them.
        for local, length, chord in harmonic_segments(bar):
            strings = CHORDS[chord][2]
            for pitch in strings:
                note(6, pitch, start+local+.006, length-.17,
                     34 if bridge else 39+(section >= 5)*3, 'strings', chord)

        # Piano carries the first bridge intact, then adds a few rhythmic
        # chord accents in the climactic sections; no pedal over passing notes.
        if section in (6, 7):
            for beat in (1.5, 3):
                chord = chord_at(bar, beat)
                for i, pitch in enumerate(CHORDS[chord][2][:3]):
                    note(2, pitch, start+beat+i*.012, .40, 51-i*2, 'piano_accent', chord)
        if bar % 4 == 2 and section in (1, 4, 6, 7):
            chord = chord_at(bar, 3.5)
            note(8, CHORDS[chord][1][2]+24, start+3.5, .46, 42, 'glockenspiel', chord)

        # Pitched timpani and clear snare hits; no shaker or maraca texture.
        for beat in ([0] if bridge else [0, 2]):
            if bridge and bar % 2:
                continue
            chord = chord_at(bar, beat)
            pitch = CHORDS[chord][0]
            if pitch < 38:
                pitch += 12
            note(10, pitch, start+beat+.008, .72, 44 if bridge else 61+section,
                 'timpani', chord)
        hits = [(0, 36, 45 if bridge else 52)]
        if bridge:
            hits.append((2, 37, 36))
        else:
            hits.extend([(1, 38, 45+section), (3, 38, 48+section)])
            if section >= 5:
                hits.append((2, 36, 55))
        if section >= 6:
            hits.extend((beat, 51, 32 if beat % 2 else 37) for beat in range(4))
        if bar % 8 == 0 and not bridge:
            hits.append((0, 49, 38 if section < 5 else 46))
        if bar % 8 == 7:
            hits.extend((3+i*.25, pitch, (35 if bridge else 46)+i*3)
                        for i, pitch in enumerate([47, 45, 43, 41]))
        for beat, pitch, velocity in hits:
            note(9, pitch, start+beat+.01, .12, velocity, 'drums')

    segments = [(bar*4+local, length, chord) for bar in range(BARS)
                for local, length, chord in harmonic_segments(bar)]
    for voice in range(4):
        merged = []
        for start, length, chord in segments:
            pitch = CHORDS[chord][3][voice]
            if merged and merged[-1][0] == pitch:
                merged[-1][2] += length
            else:
                merged.append([pitch, start, length])
        for pitch, start, length in merged:
            note(11, pitch, start, length-.12, 57 if voice >= 2 else 48, 'pad', humanize=False)
    # Arrange the pad by section, not by changing the entire mix's gain.
    for section, level in enumerate([69, 89, 78, 94, 96, 88, 86, 90]):
        cc(11, section*32, 11, level)


def validate():
    expected = []
    for bar in range(BARS):
        row = THEMES[FORM[bar//8]][bar % 8]
        for eighth, pitch in enumerate(row):
            if pitch >= 0:
                duration = .96 if eighth+1 < len(row) and row[eighth+1] == -1 else .48
                expected.append((pitch, bar*4+eighth*.5, duration))
    actual = [(n['midi'], n['beat'], n['duration_beats']) for n in NOTES if n['role'] == 'lead']
    assert actual == expected and len(actual) == 438
    for n in NOTES:
        assert 0 <= n['midi'] <= 127 and 1 <= n['velocity'] <= 127
        assert n['beat'] >= 0 and n['beat']+n['duration_beats'] < BEATS
        if 'chord' in n:
            pcs = {pitch % 12 for pitch in CHORDS[n['chord']][1]}
            assert n['midi'] % 12 in pcs, n
    assert not any(n['channel'] == 9 and n['midi'] in (70, 82) for n in NOTES)
    return len(expected)


def varlen(value):
    value = int(value)
    data = [value & 127]
    while value >> 7:
        value >>= 7
        data.insert(0, (value & 127) | 128)
    return bytes(data)


def chunk(kind, data):
    return kind+struct.pack('>I', len(data))+data


def meta(kind, data):
    return bytes([255, kind])+varlen(len(data))+data


def midi_file(path, cycles=1):
    conductor = b'\0'+meta(3, b'Galaxia - sampled orchestral duel')
    conductor += b'\0'+meta(0x51, round(60_000_000/BPM).to_bytes(3, 'big'))
    conductor += b'\0'+meta(0x58, bytes([4, 2, 24, 8]))
    conductor += b'\0'+meta(0x59, bytes([255, 1]))  # D minor, one flat.
    conductor += varlen(cycles*BEATS*PPQ)+meta(0x2F, b'')
    tracks = [chunk(b'MTrk', conductor)]
    for channel, events in EVENTS.items():
        data = b'\0'+meta(3, INSTRUMENTS[channel][0].encode('ascii'))
        previous = 0
        repeated = [(tick+cycle*BEATS*PPQ, priority, message)
                    for cycle in range(cycles) for tick, priority, message in events]
        for tick, _, message in sorted(repeated, key=lambda item: (item[0], item[1])):
            data += varlen(tick-previous)+message
            previous = tick
        end = (cycles*BEATS+8)*PPQ
        data += varlen(end-previous)+meta(0x2F, b'')
        tracks.append(chunk(b'MTrk', data))
    path.write_bytes(chunk(b'MThd', struct.pack('>HHH', 1, len(tracks), PPQ))+b''.join(tracks))


def float_audio(path):
    raw = path.read_bytes()
    assert raw[:4] == b'RIFF' and raw[8:12] == b'WAVE'
    pos, samples = 12, None
    while pos+8 <= len(raw):
        kind, size = struct.unpack_from('<4sI', raw, pos)
        if kind == b'fmt ':
            fmt = struct.unpack_from('<HHIIHH', raw, pos+8)
            assert fmt[0] == 3 and fmt[1] == 2 and fmt[2] == RATE and fmt[5] == 32
        if kind == b'data':
            samples = np.frombuffer(raw, dtype='<f4', count=size//4, offset=pos+8)
        pos += 8+size+size % 2
    assert samples is not None and np.isfinite(samples).all()
    return samples.reshape(-1, 2).astype(np.float64)


def rms_db(audio):
    return round(20*math.log10(max(1e-12, float(np.sqrt(np.mean(audio*audio))))), 2)


def limit(audio, ceiling=.78):
    block = round(.005*RATE)
    count = math.ceil(len(audio)/block)
    peaks = np.pad(np.max(np.abs(audio), axis=1), (0, count*block-len(audio))).reshape(count, block).max(axis=1)
    required = np.minimum(1, ceiling/np.maximum(peaks, 1e-12))
    boundaries = np.ones(count+1)
    boundaries[:-1] = required
    boundaries[1:] = np.minimum(boundaries[1:], required)
    release = 1-math.exp(-(block/RATE)/.080)
    for i in range(1, len(boundaries)):
        boundaries[i] = min(boundaries[i], boundaries[i-1]+(1-boundaries[i-1])*release)
    envelope = np.interp(np.arange(len(audio))/block, np.arange(len(boundaries)), boundaries)
    return audio*envelope[:, None], round(-20*math.log10(float(envelope.min())), 2)


def write_wav(path, audio):
    assert np.isfinite(audio).all() and np.max(np.abs(audio)) < .99
    rng = np.random.default_rng(23491)
    dither = (rng.random(audio.shape)-rng.random(audio.shape))/65536
    pcm = np.rint((audio+dither)*32767).astype('<i2')
    assert not np.any(np.abs(pcm.astype(np.int32)) >= 32767)
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())


def render(args, midi, raw):
    command = [str(args.fluidsynth), '-ni', '-F', str(raw), '-T', 'wav', '-O', 'float',
               '-r', str(RATE), '-g', '.46', '-C', '0', '-R', '1',
               '-o', 'synth.reverb.engine=dat', '-o', 'synth.reverb.room-size=.28',
               '-o', 'synth.reverb.damp=.55', '-o', 'synth.reverb.width=65',
               '-o', 'synth.reverb.level=.19', '-o', 'synth.polyphony=384',
               str(args.soundfont), str(midi)]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    if result.stderr:
        print(result.stderr[-1000:], flush=True)
    return raw


def soften_violin(audio, window_start):
    """Warm only the violin, retaining its pitch, timing and musical level."""
    frequencies = [0, 1000, 1800, 2300, 3200, 4500, 6000, 10000, RATE/2]
    gains_db = [0, 0, -.5, -2.5, -4.2, -3.7, -3.7, -4.5, -4.5]
    # A short, symmetric FIR gives a broad upper-mid dip and a gentle high
    # shelf. Centered convolution keeps the lead on its original time grid.
    fft_size, taps = 2048, 129
    response = 10**(np.interp(np.fft.rfftfreq(fft_size, 1/RATE), frequencies, gains_db)/20)
    impulse = np.fft.fftshift(np.fft.irfft(response, n=fft_size))
    center = fft_size//2
    kernel = impulse[center-taps//2:center+taps//2+1]*np.kaiser(taps, 6)
    kernel /= kernel.sum()
    soft = np.empty_like(audio)
    for channel in range(2):
        soft[:, channel] = np.convolve(audio[:, channel], kernel, mode='same')

    # Shave the bow's initial edge without changing note lengths. A short
    # lead-in avoids chopping a previous note's ringing release at retriggers.
    pre, attack = round(.004*RATE), round(.022*RATE)
    envelope = np.ones(len(audio))
    for cycle in range(3):
        for n in NOTES:
            if n['channel'] != 0:
                continue
            onset = round((cycle*BEATS+n['beat'])*BEAT*RATE)-window_start
            first, stop = max(0, onset-pre), min(len(audio), onset+attack)
            if first >= stop:
                continue
            relative = np.arange(first, stop)-onset
            curve = np.where(relative < 0,
                1-.28*np.sin(np.clip((relative+pre)/pre, 0, 1)*math.pi/2)**2,
                .72+.28*np.sin(np.clip(relative/attack, 0, 1)*math.pi/2)**2)
            envelope[first:stop] = np.minimum(envelope[first:stop], curve)
    soft *= envelope[:, None]
    # Retain the violin's body and intelligibility: its overall level recedes
    # by just 1 dB, instead of losing several dB along with the harsh partials.
    body_gain = (np.sqrt(np.mean(audio*audio)/np.mean(soft*soft))*10**(-1/20))
    soft *= body_gain
    assert np.isfinite(soft).all()
    # Measure the requested timbre change in the opening, not other instruments.
    first = max(0, -window_start+FRAMES)
    count = round(6.6666667*RATE)
    window = np.hanning(count)
    freq = np.fft.rfftfreq(count, 1/RATE)
    band = (freq >= 2500) & (freq <= 6500)
    before = np.abs(np.fft.rfft(audio[first:first+count].mean(axis=1)*window))**2
    after = np.abs(np.fft.rfft(soft[first:first+count].mean(axis=1)*window))**2
    report = {
        'target': 'Violin channel 0 only, all five violin-led sections',
        'upper_mid_dip_center_hz': 3200, 'upper_mid_dip_db': -4.2,
        'high_shelf_db': -4.5, 'body_makeup_gain_db': round(20*math.log10(float(body_gain)), 2),
        'violin_overall_level_change_db': -1.0,
        'attack_softening_ms': 22, 'attack_minimum_gain': .72,
        'opening_2500_6500_hz_change_db': round(10*math.log10(float(after[band].sum()/before[band].sum())), 2),
        'midi_note_events_unchanged': True,
    }
    return soft, report


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    build()
    checked = validate()
    midi_file(args.output/'meta-knight-orchestral.mid')
    # Render the approved notes as separate violin and accompaniment stems;
    # only the violin receives the timbre and attack changes.
    original_events = EVENTS.copy()
    groups = [('violin', {0: original_events[0]}),
              ('accompaniment', {ch: events for ch, events in original_events.items() if ch != 0})]
    seam = round(.025*RATE)
    margin = seam+129
    window_start = FRAMES-margin
    stems = {}
    for name, events in groups:
        EVENTS.clear()
        EVENTS.update(events)
        render_midi = args.work/f'{name}-three-cycles.mid'
        midi_file(render_midi, cycles=3)
        print(f'Rendering {name}...', flush=True)
        raw = render(args, render_midi, args.work/f'{name}-float.wav')
        continuous = float_audio(raw)
        assert len(continuous) >= FRAMES*3
        stems[name] = continuous[window_start:FRAMES*2+margin].copy()
        del continuous
    EVENTS.clear()
    EVENTS.update(original_events)
    violin, softening = soften_violin(stems['violin'], window_start)
    write_wav(args.output/'soft-violin-stem.wav', violin[margin:margin+FRAMES]*REFERENCE_GAIN)
    mixed = stems['accompaniment']+violin
    del stems, violin
    audio = mixed[margin:margin+FRAMES].copy()
    # Join to the actual predecessor of the opening sample, retaining reverb
    # across the loop. No fade to silence and no change to the loop's length.
    previous_tail = mixed[margin-seam:margin]
    blend = np.sin(np.linspace(0, math.pi/2, seam))**2
    audio[-seam:] = audio[-seam:]*(1-blend[:,None])+previous_tail*blend[:,None]
    gain = REFERENCE_GAIN
    del mixed
    # Limit a repeated buffer and extract its middle to preserve periodic gain.
    tiled, reduction = limit(np.tile(audio*gain, (3,1)))
    audio = tiled[FRAMES:2*FRAMES].copy()
    # Retain the contiguous join even if the final transient changes limiter gain.
    difference = audio[0]-audio[-1]
    if np.max(np.abs(difference)) > .025:
        correction = difference * np.linspace(0,1,seam)[:,None]
        audio[-seam:] += correction
    assert np.max(np.abs(audio)) <= .79
    output = args.output/'meta-knight-orchestral.wav'
    write_wav(output, audio)
    preview = audio[round(66.6666667*RATE):round(93.3333333*RATE)].copy()
    fade = round(.025*RATE)
    preview[:fade] *= np.linspace(0,1,fade)[:,None]
    preview[-fade:] *= np.linspace(1,0,fade)[:,None]
    write_wav(args.output/'heroic-section-preview.wav', preview)
    report = {
        'title': 'Galaxia — Knight of the Stars, sampled orchestral arrangement',
        'date': '2026-10-23', 'revision': 2, 'status': 'review_only_game_unchanged',
        'style': 'Heroic orchestral duel with lyrical piano bridge and warm synth pad',
        'source': str(SOURCE), 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'bpm': BPM, 'key': 'D minor', 'bars': BARS, 'duration_seconds': len(audio)/RATE,
        'sample_rate': RATE, 'channels': 2, 'bits': 16,
        'main_melody_notes_verified': checked, 'main_melody_pitch_and_rhythm_edits': 0,
        'harmonic_adjustment': 'Asus4 resolves to A7 on the second quarter-note beat of each 7th phrase bar, under the original C# melody',
        'no_pitch_detuning_or_chorus': True, 'no_shaker_or_maracas': True,
        'violin_softening': softening,
        'other_instrument_notes_and_levels_unchanged': True,
        'reference_mix_gain_preserved': True,
        'notes': len(NOTES), 'notes_by_role': dict(Counter(n['role'] for n in NOTES)),
        'rms_dbfs': rms_db(audio), 'peak_dbfs': round(20*math.log10(float(np.max(np.abs(audio)))),2),
        'maximum_peak_reduction_db': reduction, 'clipped_samples': 0,
        'loop_boundary_difference': float(np.max(np.abs(audio[0]-audio[-1]))),
        'loop_uses_continuous_reverb_tail': True, 'common_gain': gain,
        'soundfont': 'GeneralUser GS v2.0.3', 'renderer': 'FluidSynth 2.6.1',
        'preview_source_seconds': [66.6666667,93.3333333],
        'sections': [{'title': SECTION_NAMES[i], 'start_seconds': i*32*BEAT,
                      'rms_dbfs': rms_db(audio[round(i*32*BEAT*RATE):round((i+1)*32*BEAT*RATE)])}
                     for i in range(8)],
        'audio_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    (args.output/'score.json').write_text(json.dumps(NOTES,indent=2)+'\n',encoding='utf8')
    (args.output/'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (args.output/'instruments.json').write_text(json.dumps(INSTRUMENTS,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fluidsynth', type=Path, required=True)
    parser.add_argument('--soundfont', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    main(parser.parse_args())
