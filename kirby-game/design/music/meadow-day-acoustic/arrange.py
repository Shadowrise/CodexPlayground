"""A review-only acoustic arrangement; never overwrites the game's soundtrack.

Requires Python + numpy, FluidSynth 2.6.1 and GeneralUser GS 2.0.3.
Run with --fluidsynth PATH --soundfont PATH --output DIRECTORY.
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

PPQ = 960
BPM = 100
BEAT = 60 / BPM
BARS = 48
RATE = 44100
RNG = random.Random(391)
GAME = Path(__file__).resolve().parents[3]
SOURCE = GAME / 'scripts' / 'make-music.cjs'
ORIGINAL_MELODY = ast.literal_eval(re.search(r'const melody = (\[.*?\]);', SOURCE.read_text(encoding='utf-8'), re.S)[1])
MELODY = [row.copy() for row in ORIGINAL_MELODY]

# The user selected revision 3 as the baseline and explicitly kept its melody.
# Revisions 4 and the phrase auditions are archived; no pitch edits are active.
CORRECTIONS = []
for bar, eighth, pitch in CORRECTIONS:
    MELODY[bar][eighth] = pitch

# Guitar shapes remain within a playable E2..F#4 register.
HARMONY = {
    'D': (38, [50, 57, 62, 66]),
    'A': (33, [45, 52, 57, 61]),
    'Bm': (35, [47, 54, 59, 62]),
    'G': (31, [43, 50, 55, 59]),
    'Em': (28, [40, 47, 55, 59]),
}
PROGRESSION = ['D', 'A', 'Bm', 'G', 'Em', 'A', 'G', 'A']
INSTRUMENTS = {
    0: {'name': 'Concert flute', 'program': 73, 'volume': 94, 'pan': 71, 'reverb': 27},
    1: {'name': 'Fingerpicked nylon guitar', 'program': 24, 'volume': 104, 'pan': 46, 'reverb': 16},
    2: {'name': 'Acoustic double bass', 'program': 32, 'volume': 96, 'pan': 63, 'reverb': 9},
    3: {'name': 'Nylon guitar - melody', 'program': 24, 'volume': 105, 'pan': 75, 'reverb': 19},
    4: {'name': 'Soft piano responses', 'program': 0, 'volume': 69, 'pan': 84, 'reverb': 22},
}
EVENTS = {channel: [] for channel in INSTRUMENTS}
NOTES = []


def section_and_chord(bar):
    if bar < 4:
        return 'intro', ['D', 'Bm', 'G', 'A'][bar]
    if bar < 20:
        return 'theme', PROGRESSION[(bar - 4) % 8]
    if bar < 28:
        return 'interlude', PROGRESSION[(bar - 20) % 8]
    if bar < 44:
        return 'reprise', PROGRESSION[(bar - 28) % 8]
    return 'outro', ['G', 'Em', 'A', 'D'][bar - 44]


def event(channel, beat, data, priority=1):
    EVENTS[channel].append((max(0, round(beat * PPQ)), priority, bytes(data)))


def control(channel, beat, number, value):
    event(channel, beat, [0xB0 + channel, number, max(0, min(127, round(value)))])


def note(channel, midi, beat, duration, velocity, jitter=.010, phrase=1.0):
    onset = max(.02, beat + RNG.uniform(-jitter, jitter))
    duration = max(.06, duration)
    velocity = max(1, min(127, round(velocity * phrase + RNG.uniform(-3, 3))))
    event(channel, onset, [0x90 + channel, midi, velocity], 2)
    event(channel, onset + duration, [0x80 + channel, midi, 0], 0)
    NOTES.append({'channel': channel, 'midi': midi, 'beat': round(onset, 5), 'duration_beats': round(duration, 5), 'velocity': velocity})


def accompaniment(bar, chord_name, section, last=False):
    root, shape = HARMONY[chord_name]
    start = 4 * bar
    # One fingerpicked part, rather than several competing high arpeggiators.
    pattern = [(0, shape[0], 67), (.5, shape[2], 55), (1, shape[1], 58),
               (1.5, shape[3], 53), (2, shape[0] + 7, 61),
               (2.5, shape[2], 56), (3, shape[1], 57), (3.5, shape[3], 51)]
    scale = .88 if section == 'intro' else 1.0 if section == 'reprise' else .94
    if last:
        for j, pitch in enumerate(shape):
            note(1, pitch, start + j * .028, 3.5 - j * .028, 60, phrase=.95)
    else:
        for eighth, pitch, velocity in pattern:
            # Leave 150 ms for the sample's release before changing harmony.
            duration = min(1.15 if eighth in (0, 2) else .83, 3.73 - eighth)
            note(1, pitch, start + eighth + .012, duration, velocity, phrase=scale)
    if bar < 2:
        return
    note(2, root, start + .015, 3.6 if last else 1.63, 64 if section != 'reprise' else 70, jitter=.007)
    if not last:
        # Root/fifth movement follows the current chord, with no octave clash.
        fifth = root + 7
        note(2, fifth, start + 2.025, 1.45, 54 if section != 'reprise' else 60, jitter=.008)


def play_theme(bar, phrase_bar, channel, reprise=False):
    row = MELODY[phrase_bar]
    offset = -12 if channel == 3 else 0
    # Four-bar arches, a slightly lifted reprise, and a breath at phrase ends.
    arch = [1.0, 1.03, 1.055, .94][phrase_bar % 4]
    if reprise:
        arch *= 1.035
    for eighth, pitch in enumerate(row):
        if not pitch:
            continue
        until_next = next((j for j in range(eighth + 1, 8) if row[j]), 8)
        available = (until_next - eighth) / 2
        duration = min(available - .075, .92 if channel == 0 else 1.0)
        if eighth == 7:
            duration = .28
        velocity = (76 if channel == 0 else 75) + (3 if eighth % 2 == 0 else -5)
        onset = bar * 4 + eighth / 2 + .025
        note(channel, pitch + offset, onset, duration, velocity, jitter=.012, phrase=arch)
        if channel == 0:
            # Breath/expression changes amplitude, not pitch; no detuning chorus.
            control(0, onset - .01, 11, 102 + (3 if reprise else 0))
            if duration > .6:
                control(0, onset + duration * .5, 11, 111)
                control(0, onset + duration * .87, 11, 96)


def build_score():
    RNG.seed(391)
    NOTES.clear()
    for events in EVENTS.values():
        events.clear()
    for channel, inst in INSTRUMENTS.items():
        event(channel, 0, [0xC0 + channel, inst['program']])
        for number, value in [(7, inst['volume']), (10, inst['pan']), (11, 106),
                              (91, inst['reverb']), (93, 0), (1, 0), (64, 0)]:
            control(channel, 0, number, value)
        # Explicit centered pitch bend and conventional equal-tempered tuning.
        event(channel, 0, [0xE0 + channel, 0, 64])

    for bar in range(BARS):
        section, chord = section_and_chord(bar)
        accompaniment(bar, chord, section, last=bar == 47)

        if section == 'theme':
            play_theme(bar, bar - 4, 0)
        elif section == 'interlude':
            play_theme(bar, bar - 20, 3)
        elif section == 'reprise':
            play_theme(bar, bar - 28, 0, reprise=True)
            # Sparse piano answers, all chord tones, placed around breath gaps.
            if (bar - 28) % 4 == 3:
                _, shape = HARMONY[chord]
                for i, pitch in enumerate([shape[1] + 12, shape[2] + 12, shape[3] + 12]):
                    note(4, pitch, bar * 4 + 3.0 + i * .22, .45, 43 - i * 3)
        elif section == 'outro':
            coda = [
                [(79, 0, .8), (83, 1, .8), (86, 2, .4), (83, 2.5, .4), (79, 3, .6)],
                [(76, 0, .8), (79, 1, .8), (83, 2, .4), (79, 2.5, 1.0)],
                [(73, 0, .8), (76, 1, .8), (81, 2, 1.0)],
                [(78, 0, .8), (81, 1, .8), (74, 2, 1.6)],
            ][bar - 44]
            for pitch, beat, duration in coda:
                note(0, pitch, bar * 4 + beat + .025, duration, 68 if bar != 47 else 62, jitter=.009)

    for channel in INSTRUMENTS:
        control(channel, BARS * 4, 64, 0)
        control(channel, BARS * 4 + 3, 123, 0)


def validate_score():
    """Allow exactly the user-marked pitch edits and preserve the original grid."""
    allowed = {(bar, eighth): pitch for bar, eighth, pitch in CORRECTIONS}
    for bar, row in enumerate(MELODY):
        for eighth, pitch in enumerate(row):
            assert pitch == allowed.get((bar, eighth), ORIGINAL_MELODY[bar][eighth])
    for n in NOTES:
        # The final strum can anticipate its notated downbeat by < 10 ms.
        bar = int((n['beat'] + .02) // 4)
        section, chord = section_and_chord(bar)
        assert n['beat'] + n['duration_beats'] < (bar + 1) * 4, n
        if n['channel'] in (1, 2, 4):
            assert n['midi'] % 12 in {p % 12 for p in HARMONY[chord][1]}, n
    checked = 0
    for first_bar, bars, channel, offset in [(4, 16, 0, 0), (20, 8, 3, -12), (28, 16, 0, 0)]:
        played = sorted((n for n in NOTES if n['channel'] == channel
                         and first_bar * 4 <= n['beat'] < (first_bar + bars) * 4), key=lambda n: n['beat'])
        expected = [(first_bar * 4 + bar * 4 + eighth / 2,
                     allowed.get((bar, eighth), pitch) + offset)
                    for bar in range(bars) for eighth, pitch in enumerate(ORIGINAL_MELODY[bar]) if pitch]
        assert len(played) == len(expected)
        for actual, (beat, pitch) in zip(played, expected):
            assert actual['midi'] == pitch and abs(actual['beat'] - (beat + .025)) <= .01201
            checked += 1
    return {'checked_notes': len(NOTES), 'melody_notes_checked': checked,
            'original_melody_rests_and_grid_preserved': True,
            'only_timestamp_marked_pitch_edits': True,
            'unique_edited_score_positions': len(allowed)}


def varlen(value):
    output = [value & 127]
    while value >> 7:
        value >>= 7
        output.insert(0, 128 | (value & 127))
    return bytes(output)


def meta(kind, payload):
    return bytes([255, kind]) + varlen(len(payload)) + payload


def chunk(kind, payload):
    return kind + struct.pack('>I', len(payload)) + payload


def midi_file(path):
    conductor = b'\0' + meta(3, b'Meadow Day - acoustic chamber folk')
    conductor += b'\0' + meta(0x51, (600000).to_bytes(3, 'big'))
    conductor += b'\0' + meta(0x58, bytes([4, 2, 24, 8]))
    conductor += b'\0' + meta(0x59, bytes([2, 0]))  # D major
    conductor += varlen(BARS * 4 * PPQ) + meta(0x2F, b'')
    tracks = [chunk(b'MTrk', conductor)]
    for channel, events in EVENTS.items():
        data = b'\0' + meta(3, INSTRUMENTS[channel]['name'].encode('ascii'))
        previous = 0
        for tick, _, message in sorted(events, key=lambda item: (item[0], item[1])):
            data += varlen(tick - previous) + message
            previous = tick
        end = (BARS * 4 + 4) * PPQ
        data += varlen(end - previous) + meta(0x2F, b'')
        tracks.append(chunk(b'MTrk', data))
    path.write_bytes(chunk(b'MThd', struct.pack('>HHH', 1, len(tracks), PPQ)) + b''.join(tracks))


def render(args, midi, raw):
    command = [str(args.fluidsynth), '-ni', '-F', str(raw), '-T', 'wav', '-O', 'float',
               '-r', str(RATE), '-g', '.46', '-C', '0', '-R', '1',
               '-o', 'synth.reverb.engine=dat', '-o', 'synth.reverb.room-size=.24',
               '-o', 'synth.reverb.damp=.5', '-o', 'synth.reverb.width=60',
               '-o', 'synth.reverb.level=.20', '-o', 'synth.polyphony=256',
               str(args.soundfont), str(midi)]
    print('Rendering sampled instruments...', flush=True)
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    print(result.stdout[-1500:], flush=True)
    if result.stderr:
        print(result.stderr[-1500:], flush=True)


def read_float_wav(path):
    data = path.read_bytes()
    assert data[:4] == b'RIFF' and data[8:12] == b'WAVE'
    pos = 12
    fmt = None
    samples = None
    while pos + 8 <= len(data):
        kind, size = struct.unpack_from('<4sI', data, pos)
        if kind == b'fmt ':
            fmt = struct.unpack_from('<HHIIHH', data, pos + 8)
        if kind == b'data':
            samples = np.frombuffer(data, dtype='<f4', count=size // 4, offset=pos + 8).copy()
        pos += 8 + size + size % 2
    assert fmt and fmt[0] == 3 and fmt[1] == 2 and fmt[2] == RATE and fmt[5] == 32, fmt
    assert samples is not None and np.isfinite(samples).all()
    return samples.reshape(-1, 2).astype(np.float64)


def master(raw, output, soundfont):
    audio = read_float_wav(raw)
    # Retain the natural decay, but make the listening artifact a definite length.
    length = round((BARS * 4 * BEAT + 3.2) * RATE)
    audio = audio[:length]
    audio -= audio.mean(axis=0)
    audio[:int(.008 * RATE)] *= np.linspace(0, 1, int(.008 * RATE))[:, None]
    fade = int(1.3 * RATE)
    audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
    gain = .79 / np.max(np.abs(audio))
    audio *= gain
    dither_rng = np.random.default_rng(391)
    dither = (dither_rng.random(audio.shape) - dither_rng.random(audio.shape)) / 65536
    pcm = np.clip(np.rint((audio + dither) * 32767), -32768, 32767).astype('<i2')
    with wave.open(str(output), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    windows = []
    for start in range(0, len(audio) - RATE + 1, RATE):
        window = audio[start:start + RATE]
        windows.append(float(np.sqrt(np.mean(window * window))))
    report = {
        'title': 'День на поляне — акустическая версия',
        'revision': 3,
        'style': 'Instrumental acoustic chamber folk',
        'key': 'D major', 'bpm': BPM, 'bars': BARS,
        'form': '4-bar intro / 16-bar flute theme / 8-bar guitar interlude / 16-bar flute reprise / 4-bar coda',
        'duration_seconds': len(audio) / RATE, 'sample_rate': RATE, 'channels': 2, 'bits': 16,
        'peak_dbfs': round(20 * math.log10(float(np.max(np.abs(audio)))), 2),
        'rms_dbfs': round(20 * math.log10(float(np.sqrt(np.mean(audio * audio)))), 2),
        'clipped_samples': int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767)),
        'minimum_body_1s_rms_dbfs': round(20 * math.log10(min(windows[5:113])), 2),
        'stereo_correlation': round(float(np.corrcoef(audio.T)[0, 1]), 4),
        'note_count_by_instrument': {INSTRUMENTS[c]['name']: n for c, n in Counter(n['channel'] for n in NOTES).items()},
        'melody_corrections': [{'source_bar': bar + 1, 'eighth': eighth + 1, 'from_midi': ORIGINAL_MELODY[bar][eighth], 'to_midi': pitch} for bar, eighth, pitch in CORRECTIONS],
        'score_validation': validate_score(),
        'soundfont_sha256': hashlib.sha256(soundfont.read_bytes()).hexdigest(),
        'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    }
    assert report['clipped_samples'] == 0
    assert all(n['midi'] % 12 in {1, 2, 4, 6, 7, 9, 11} for n in NOTES)
    assert all(n['duration_beats'] > 0 for n in NOTES)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fluidsynth', type=Path, required=True)
    parser.add_argument('--soundfont', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    build_score()
    validate_score()
    midi = args.output / 'meadow-day-acoustic.mid'
    midi_file(midi)
    raw = args.output / 'meadow-day-render-float.wav'
    render(args, midi, raw)
    output = args.output / 'meadow-day-acoustic.wav'
    report = master(raw, output, args.soundfont)
    (args.output / 'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (args.output / 'score.json').write_text(json.dumps(NOTES, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
