"""Track 2 with the original complete arrangement and connected sample voices.

Uses the source's guitar/flute/guitar form, every melodic layer, register and
onset. Adds only a two-bar introduction. There is no piano part.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import wave

import numpy as np

import arrange as audio_tools

RATE, BPM, BEAT = 44100, 108, 60/108
INTRO_BARS, SOURCE_BARS, BARS = 2, 48, 50
OFFSET = INTRO_BARS*4*BEAT
BODY_SECONDS = SOURCE_BARS*4*BEAT
SECONDS = BARS*4*BEAT+3
FRAMES = round(SECONDS*RATE)
INSTRUMENTS = {
    0: ('Nylon guitar - original first and final themes', 24, 112, 54, 20),
    1: ('Soft flute - original middle melody', 73, 98, 54, 22),
    2: ('Flute - original answering voice', 73, 90, 83, 23),
    3: ('Nylon guitar - original strummed chords', 24, 105, 26, 17),
    4: ('Nylon guitar - original upper answering arpeggio', 24, 105, 92, 19),
    5: ('Marimba - original light interlocking notes', 12, 92, 103, 17),
    6: ('Acoustic bass - original register and pulse', 32, 102, 59, 9),
    7: ('Soft string ensemble - original sustained notes', 49, 87, 64, 22),
    8: ('Original warm chord texture - approximate GM editing sound', 89, 93, 64, 20),
    9: ('Original quiet percussion - approximate GM editing sound', 0, 82, 64, 8),
}


def channel_for(n):
    if n['role'] == 'lead':
        return 0 if n['voice'] == 'nylon' else 1
    return {'flute-counter': 2, 'guitar-chords': 3, 'guitar-counter': 4,
            'marimba': 5, 'bass': 6, 'string-bed': 7, 'warm-bed': 8, 'drums': 9}[n['role']]


def add(channel, pitch, seconds, duration, velocity, role, source_index=None):
    beat, length = seconds/BEAT, duration/BEAT
    velocity = max(1, min(127, round(velocity)))
    audio_tools.event(channel, beat, [0x90+channel, pitch, velocity], 2)
    audio_tools.event(channel, beat+length, [0x80+channel, pitch, 0], 0)
    audio_tools.NOTES.append({'channel': channel, 'midi': pitch, 'beat': beat,
        'duration_beats': length, 'velocity': velocity, 'role': role,
        **({'source_index': source_index} if source_index is not None else {})})


def build(original):
    audio_tools.INTRO_BARS, audio_tools.CODA_BARS = INTRO_BARS, 0
    audio_tools.BARS, audio_tools.FRAMES = BARS, FRAMES
    audio_tools.INSTRUMENTS = INSTRUMENTS
    audio_tools.EVENTS = {ch: [] for ch in INSTRUMENTS}
    audio_tools.NOTES = []
    for ch, (_, program, volume, pan, reverb) in INSTRUMENTS.items():
        audio_tools.event(ch, 0, [0xC0+ch, program])
        for controller, value in [(7, volume), (10, pan), (11, 106), (91, reverb), (93, 0), (1, 0), (64, 0)]:
            audio_tools.cc(ch, 0, controller, value)
        audio_tools.event(ch, 0, [0xE0+ch, 0, 64])

    # Independent parts stay on separate channels, so releasing a backing
    # guitar note cannot stop the same pitch in the melody.
    future = defaultdict(list)
    for index, n in enumerate(original):
        future[(channel_for(n), n['midi'])].append((n['time_seconds'], index))
    next_same = {}
    for values in future.values():
        values.sort()
        for current, following in zip(values, values[1:]):
            next_same[current[1]] = following[0]
    adjustments = 0
    for index, n in enumerate(original):
        ch = channel_for(n)
        duration = n['duration_seconds']
        # Let the plucked strings ring. Only a repeated identical key needs
        # its MIDI note-off before the next attack; do not gate every eighth.
        if ch <= 7 and index in next_same:
            requested = max(.035, next_same[index]-n['time_seconds']-.006)
            if duration > requested:
                duration = requested
                adjustments += 1
        if n['voice'] == 'nylon':
            velocity = 84*math.sqrt(n['amplitude']/.12)
        elif n['voice'] == 'flute':
            velocity = 72*math.sqrt(n['amplitude']/.065)
        else:
            velocity = {'marimba': 58, 'bass': 67, 'strings': 49, 'pad': 55,
                        'kick': 52, 'snare': 40, 'soft-stroke': 28}[n['voice']]
        add(ch, n['midi'], OFFSET+n['time_seconds'], duration, velocity,
            n['role'], source_index=index)

    # A small introduction quotes the opening's actual A/F# minor colours.
    # It does not replace or shorten any of the original 48 bars.
    for bar, pitches in enumerate([[57, 61, 64], [57, 61, 66]]):
        for i, pitch in enumerate(pitches):
            add(3, pitch, bar*4*BEAT+i*.025, 1.8, 42-i, 'intro_chord')
        add(6, [45, 42][bar], bar*4*BEAT+.02, 1.75, 49, 'intro_bass')
    for beat, pitch, length in [(0, 57, .85), (1.25, 73, 1.9),
                                (4, 73, .95), (5, 69, .9), (6, 78, 1.45)]:
        add(0, pitch, beat*BEAT+.025, length*BEAT, 65, 'intro_hint')
    return adjustments


def validate(original):
    captured = {n['source_index']: n for n in audio_tools.NOTES if 'source_index' in n}
    assert len(captured) == len(original) == 1828
    for index, before in enumerate(original):
        after = captured[index]
        assert after['midi'] == before['midi'] and after['channel'] == channel_for(before)
        assert abs(after['beat']*BEAT-OFFSET-before['time_seconds']) < 1e-8
        assert after['duration_beats']*BEAT <= before['duration_seconds']+1e-8
    lead = [captured[i] for i, n in enumerate(original) if n['role'] == 'lead']
    assert len(lead) == 308
    assert Counter(n['channel'] for n in lead) == {0: 205, 1: 103}
    assert all(ch == 9 or inst[1] not in range(8) for ch, inst in INSTRUMENTS.items())
    return len(lead)


def source_texture(path):
    raw = path.read_bytes()
    assert struct.unpack_from('<HHI', raw, 20) == (3, 2, 22050)
    samples = np.frombuffer(raw, dtype='<f4', offset=44).reshape(-1, 2)
    assert len(samples) == round(BODY_SECONDS*22050)
    # The source is band-limited at 22.05 kHz; this preserves its exact rhythm
    # and texture while joining the sampled instruments at 44.1 kHz.
    positions = np.arange(len(samples)*2)/2
    old = np.arange(len(samples))
    upsampled = np.column_stack([np.interp(positions, old, samples[:, ch]) for ch in range(2)])
    result = np.zeros((FRAMES, 2))
    first = round(OFFSET*RATE)
    result[first:first+len(upsampled)] = upsampled
    if 'warm-bed' in path.name:
        # The source chord texture was cyclic. Let its final A chord release
        # into the standalone tail, rather than cutting the loop at full level.
        tail = round(.55*RATE)
        release = np.cos(np.linspace(0, math.pi/2, tail))**2
        result[first+len(upsampled):first+len(upsampled)+tail] = upsampled[:tail]*release[:, None]
    return result


def original_echo(audio):
    result = audio.copy()
    for seconds, amount, cross in [(.3, .15, True), (.6, .065, False)]:
        delay = round(seconds*RATE)
        result[delay:] += audio[:-delay, ::-1] * amount if cross else audio[:-delay]*amount
    return result


def read_original_pcm(path):
    with wave.open(str(path), 'rb') as wav:
        assert wav.getnchannels() == 2 and wav.getsampwidth() == 2
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').reshape(-1, 2).astype(float)/32768


def active_samples(audio, windows):
    return np.concatenate([audio[round((OFFSET+first*4*BEAT)*RATE):round((OFFSET+last*4*BEAT)*RATE)]
                           for first, last in windows])


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    source_dir = Path(__file__).resolve().parent
    # The extractor is read-only toward the original game files.
    if not args.reuse_reference:
        subprocess.run([str(args.node), str(source_dir/'extract_original.cjs'), '--output', str(args.reference)],
                       check=True, capture_output=True)
    original = json.loads((args.reference/'original-complete-score.json').read_text())
    levels = json.loads((args.reference/'original-stem-levels.json').read_text())['roles']
    adjustments = build(original)
    melody_notes = validate(original)
    midi = args.output/'citrus-walk-faithful.mid'
    audio_tools.write_midi(midi)
    mix = source_texture(args.reference/'original-warm-bed.wav')
    mix += source_texture(args.reference/'original-drums.wav')
    groups = [
        ('guitar-lead', [0], 'lead', [(0, 16), (32, 48)], [0, 2]),
        ('flute-lead', [1], 'lead', [(16, 32)], [1]),
        ('flute-counter', [2], 'flute-counter', [(16, 48)], [1, 2]),
        ('guitar-chords', [3], 'guitar-chords', [(0, 48)], [0, 1, 2]),
        ('guitar-counter', [4], 'guitar-counter', [(0, 48)], [0, 1, 2]),
        ('marimba', [5], 'marimba', [(0, 48)], [0, 1, 2]),
        ('bass', [6], 'bass', [(0, 48)], [0, 1, 2]),
        ('string-bed', [7], 'string-bed', [(0, 48)], [0, 1, 2]),
    ]
    stem_reports = []
    for name, channels, role, windows, source_sections in groups:
        print('Rendering '+name+'...', flush=True)
        stem_midi = args.work/(name+'.mid')
        audio_tools.write_midi(stem_midi, channels=channels)
        audio = audio_tools.render(args, stem_midi, args.work/(name+'-float.wav'))
        if name == 'string-bed':
            audio = audio_tools.band_tone(audio, [0, 1000, 2200, 4000, 7000, 22050], [0, 0, -2, -5, -7, -7])
        elif name != 'bass':
            audio = audio_tools.band_tone(audio, [0, 1300, 2800, 5000, 9000, 22050], [0, 0, -.5, -1.6, -2.5, -2.5])
        if name not in ('bass', 'string-bed'):
            audio = original_echo(audio)
        target = math.sqrt(sum(levels[role]['section_rms'][i]**2 for i in source_sections)/len(source_sections))
        active = active_samples(audio, windows)
        gain = float(target/np.sqrt(np.mean(active*active)))
        audio *= gain
        mix += audio
        stem_reports.append({'name': name, 'channels': channels, 'gain': gain,
                             'source_target_rms_dbfs': round(20*math.log10(target), 2)})
        del audio, active

    reference = read_original_pcm(audio_tools.GAME/'public/audio/citrus-walk.wav')
    reference_rms = float(np.sqrt(np.mean(reference*reference)))
    body = active_samples(mix, [(0, 48)])
    gain = float(reference_rms/np.sqrt(np.mean(body*body)))
    audio, reduction = audio_tools.limit(mix*gain, ceiling=.76)
    if reduction > 3.5:
        gain *= 10**(-(reduction-3.5)/20)
        audio, reduction = audio_tools.limit(mix*gain, ceiling=.76)
    first, last = round(.012*RATE), round(.35*RATE)
    audio[:first] *= np.linspace(0, 1, first)[:, None]
    audio[-last:] *= np.linspace(1, 0, last)[:, None]
    output = args.output/'citrus-walk-faithful.wav'
    audio_tools.write_wav(output, audio)
    report = {
        'date': '2026-10-24', 'revision': 2, 'status': 'review_only_not_installed',
        'title': 'Цитрусовая прогулка — ближе к оригиналу',
        'source': audio_tools.SOURCE.as_posix(),
        'source_sha256': hashlib.sha256(audio_tools.SOURCE.read_bytes()).hexdigest(),
        'original_audio_sha256': hashlib.sha256((audio_tools.GAME/'public/audio/citrus-walk.wav').read_bytes()).hexdigest(),
        'bpm': BPM, 'key': 'E major', 'intro_bars': INTRO_BARS, 'source_bars': SOURCE_BARS,
        'duration_seconds': len(audio)/RATE, 'sample_rate': RATE, 'channels': 2, 'bits': 16,
        'original_main_melody_notes_verified': melody_notes,
        'original_complete_note_events_verified': len(original),
        'all_source_pitches_registers_and_onsets_preserved': True,
        'source_form': '16 bars nylon guitar, 16 bars flute, 16 bars nylon guitar',
        'piano_parts': 0, 'original_melody_offset_seconds': OFFSET,
        'guitar_note_gate_seconds_before_repeated_key_adjustment': 1.7,
        'flute_melody_gate_seconds': .55*BEAT,
        'midi_repeated_key_duration_adjustments': adjustments,
        'original_soft_percussion_and_warm_chord_texture_retained': True,
        'original_echo_seconds': [.3, .6], 'stems': stem_reports,
        'master_gain': gain, 'original_rms_dbfs': audio_tools.rms_db(reference),
        'body_rms_dbfs': audio_tools.rms_db(active_samples(audio, [(0, 48)])),
        'rms_dbfs': audio_tools.rms_db(audio),
        'peak_dbfs': round(20*math.log10(float(np.max(np.abs(audio)))), 2),
        'maximum_peak_reduction_db': reduction, 'clipped_samples': 0,
        'soundfont': 'GeneralUser GS v2.0.3, S. Christian Collins', 'renderer': 'FluidSynth 2.6.1',
        'sections': [{'source_section': i, 'start_seconds': OFFSET+i*64*BEAT,
                      'rms_dbfs': audio_tools.rms_db(active_samples(audio, [(i*16, (i+1)*16)]))}
                     for i in range(3)],
        'audio_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    (args.output/'score.json').write_text(json.dumps(audio_tools.NOTES, indent=2)+'\n', encoding='utf8')
    (args.output/'instruments.json').write_text(json.dumps(INSTRUMENTS, indent=2)+'\n', encoding='utf8')
    (args.output/'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    for name in ('original-complete-score.json', 'original-stem-levels.json'):
        shutil.copyfile(args.reference/name, args.output/name)
    shutil.copyfile(source_dir/'GeneralUser-GS-LICENSE.txt', args.output/'GeneralUser-GS-LICENSE.txt')
    for name in ('arrange.py', 'arrange_faithful.py', 'extract_original.cjs'):
        shutil.copyfile(source_dir/name, args.output/name)
    selection_path = source_dir/'selection.json'
    previous = json.loads(selection_path.read_text(encoding='utf8'))
    selection = {
        'date': '2026-10-24', 'revision': 2, 'status': 'faithful_revision_for_listening_not_installed',
        'track_id': 'citrus-walk', 'playlist_position': 2,
        'audio_path': output.as_posix(), 'midi_path': midi.as_posix(),
        'report_path': (args.output/'render-report.json').as_posix(),
        'renderer': 'arrange_faithful.py', 'rejected_revision': 1,
        'rejected_audio_path': previous.get('rejected_audio_path', previous.get('audio_path')),
        'notes': 'User wants the original arrangement and dislikes the exposed, detached piano. Restore the complete original guitar/flute/guitar form, all answering arpeggios, marimba, original bass register, quiet percussion and chord texture. Sampled instruments ring naturally with the original short echoes. No piano and no added energetic rewrite. Only a short two-bar intro is added. Preserve all 1828 original events and 308 main melody pitches/onsets. Game audio unchanged.',
    }
    data = json.dumps(selection, ensure_ascii=False, indent=2)+'\n'
    if previous.get('game_installation') is None and previous.get('revision', 2) <= 2:
        selection_path.write_text(data, encoding='utf8')
    (args.output/'selection.json').write_text(data, encoding='utf8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('fluidsynth', 'soundfont', 'output', 'work', 'reference'):
        parser.add_argument('--'+flag, type=Path, required=True)
    parser.add_argument('--node', type=Path, default=Path('node'))
    parser.add_argument('--reuse-reference', action='store_true')
    main(parser.parse_args())
