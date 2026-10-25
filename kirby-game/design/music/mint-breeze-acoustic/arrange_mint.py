"""Mint Breeze: faithful, soft chamber-acoustic listening version of track 3.

Keep all original melodic layers, pitches, registers, onsets and 48-bar form.
Use sampled flute, nylon guitar, marimba, bass, strings and brushed drums.
Start directly with the original theme; leave a natural instrumental tail.
"""
import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import shutil
import wave

import numpy as np

import audio_tools as audio

RATE, BPM, BEAT = 44100, 92, 60/92
BARS, TAIL = 48, 3
BODY_SECONDS = BARS*4*BEAT
FRAMES = round((BODY_SECONDS+TAIL)*RATE)
SOURCE_DIR = Path(__file__).resolve().parent
GAME = SOURCE_DIR.parents[2]
INSTRUMENTS = {
    0: ('Warm flute - original complete main melody', 73, 98, 54, 20),
    1: ('Flute - original answering phrases', 73, 86, 83, 22),
    2: ('Soft nylon guitar - original strummed chords', 24, 96, 26, 16),
    3: ('Soft nylon guitar - original upper arpeggio', 24, 96, 92, 16),
    4: ('Marimba - original interlocking notes', 12, 88, 102, 12),
    5: ('Acoustic bass - original register and pulse', 32, 102, 59, 8),
    6: ('Soft string ensemble - original later sections', 49, 84, 64, 20),
    8: ('Original warm chord texture - approximate GM editing sound', 89, 93, 64, 19),
    9: ('Brushed acoustic drums - original quiet pulse', 40, 82, 64, 7),
}
CHANNELS = {'lead': 0, 'flute-counter': 1, 'guitar-chords': 2,
            'guitar-counter': 3, 'marimba': 4, 'bass': 5,
            'string-bed': 6, 'warm-bed': 8, 'drums': 9}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf8')


def build(original):
    audio.BPM, audio.BARS, audio.FRAMES = BPM, BARS, FRAMES
    audio.INSTRUMENTS, audio.EVENTS = INSTRUMENTS, {ch: [] for ch in INSTRUMENTS}
    for ch, (_, program, volume, pan, reverb) in INSTRUMENTS.items():
        audio.event(ch, 0, [0xC0+ch, program])
        for controller, value in [(7, volume), (10, pan), (11, 106), (91, reverb), (93, 0), (1, 0), (64, 0)]:
            audio.cc(ch, 0, controller, value)
        audio.event(ch, 0, [0xE0+ch, 0, 64])
    by_key = defaultdict(list)
    for index, n in enumerate(original):
        by_key[(CHANNELS[n['role']], n['midi'])].append((n['time_seconds'], index))
    following = {}
    for values in by_key.values():
        values.sort()
        for current, upcoming in zip(values, values[1:]):
            following[current[1]] = upcoming[0]
    score, adjusted = [], 0
    for index, n in enumerate(original):
        ch = CHANNELS[n['role']]
        duration = n['duration_seconds']
        if index in following:
            gate = max(.025, following[index]-n['time_seconds']-.006)
            if duration > gate:
                duration = gate
                adjusted += 1
        if n['voice'] == 'flute':
            velocity = 68*math.sqrt(n['amplitude']/.065)
        elif n['voice'] == 'nylon':
            velocity = 67*math.sqrt(n['amplitude']/.12)
        else:
            velocity = {'marimba': 55, 'bass': 65, 'strings': 45, 'pad': 52,
                        'kick': 48, 'snare': 36, 'soft-stroke': 19}[n['voice']]
        note = {'source_index': index, 'channel': ch, 'midi': n['midi'],
                'beat': n['time_seconds']/BEAT, 'duration_beats': duration/BEAT,
                'velocity': max(1, min(127, round(velocity))), 'role': n['role']}
        score.append(note)
        audio.event(ch, note['beat'], [0x90+ch, n['midi'], note['velocity']], 2)
        audio.event(ch, note['beat']+note['duration_beats'], [0x80+ch, n['midi'], 0], 0)
    assert len(score) == len(original) == 1779
    assert sum(n['role'] == 'lead' for n in score) == 307
    assert min(n['beat'] for n in score if n['role'] == 'lead') == 0
    assert all(ch == 9 or instrument[1] not in range(8) for ch, instrument in INSTRUMENTS.items())
    for before, after in zip(original, score):
        assert after['midi'] == before['midi']
        assert abs(after['beat']*BEAT-before['time_seconds']) < 1e-8
    return score, adjusted


def warm_texture(original):
    # Preserve the original quiet oscillator colour with linear, natural tails.
    # The old game renderer wraps tails to the start of a cyclic buffer.
    # This standalone version releases the actual final G chord after bar 48.
    result = np.zeros((FRAMES, 2))
    for n in original:
        if n['role'] != 'warm-bed':
            continue
        first = round(n['time_seconds']*RATE)
        length = round(n['duration_seconds']*RATE)
        t = np.arange(length)/RATE
        freq = 440*2**((n['midi']-69)/12)
        tone = (.75*np.sin(2*math.pi*freq*t)+.2*np.sin(2*math.pi*freq*1.0015*t))
        tone *= np.minimum(1, t/.15)*np.minimum(1, (n['duration_seconds']-t)/.4)*n['amplitude']
        result[first:first+length, 0] += tone*math.sqrt((1-n['pan'])/2)
        result[first:first+length, 1] += tone*math.sqrt((1+n['pan'])/2)
    return result


def echo(samples):
    result = samples.copy()
    for seconds, level, cross in [(.3, .15, True), (.6, .065, False)]:
        delay = round(seconds*RATE)
        result[delay:] += samples[:-delay, ::-1]*level if cross else samples[:-delay]*level
    return result


def active(samples, sections):
    return np.concatenate([samples[round(section*64*BEAT*RATE):round((section+1)*64*BEAT*RATE)]
                           for section in sections])


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    original = json.loads((args.reference/'original-complete-score.json').read_text())
    levels = json.loads((args.reference/'original-stem-levels.json').read_text())['roles']
    game_audio = GAME/'public/audio/mint-breeze.wav'
    game_hash = sha(game_audio)
    score, adjustments = build(original)
    midi = args.output/'mint-breeze-acoustic.mid'
    audio.write_midi(midi)
    mix = warm_texture(original)
    stems = []
    for role, ch in CHANNELS.items():
        if role == 'warm-bed':
            continue
        print('Rendering '+role+'...', flush=True)
        stem_midi = args.work/(role+'.mid')
        audio.write_midi(stem_midi, channels=[ch])
        samples = audio.render(args, stem_midi, args.work/(role+'-float.wav'))
        if role in ('lead', 'flute-counter'):
            samples = audio.band_tone(samples, [0, 1200, 2400, 3800, 6500, 9000, 22050], [0, 0, -1.2, -2.5, -4, -5, -5])
        elif role.startswith('guitar'):
            samples = audio.band_tone(samples, [0, 700, 1300, 1900, 2600, 3600, 5500, 9000, 22050], [0, 0, -.5, -2, -4.5, -7, -9, -11, -11])
        elif role == 'string-bed':
            samples = audio.band_tone(samples, [0, 1000, 2200, 4000, 7000, 22050], [0, 0, -2, -5, -7, -7])
        elif role == 'marimba':
            samples = audio.band_tone(samples, [0, 1800, 3500, 6500, 22050], [0, 0, -1.5, -4, -5])
        elif role == 'drums':
            samples = audio.band_tone(samples, [0, 1500, 3500, 6500, 22050], [0, 0, -3, -7, -9])
        if role in ('lead', 'flute-counter', 'guitar-chords', 'guitar-counter', 'marimba'):
            samples = echo(samples)
        sections = [1, 2] if role in ('flute-counter', 'string-bed') else [0, 1, 2]
        target = math.sqrt(sum(levels[role]['section_rms'][i]**2 for i in sections)/len(sections))
        if role == 'drums':
            target *= 10**(-1.5/20)
        measured = active(samples, sections)
        gain = float(target/np.sqrt(np.mean(measured*measured)))
        mix += samples*gain
        stems.append({'role': role, 'channel': ch, 'gain': gain,
                      'source_target_rms_dbfs': round(20*math.log10(target), 2)})
        del samples, measured

    with wave.open(str(game_audio), 'rb') as wav:
        reference = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(float)/32768
    original_rms = float(np.sqrt(np.mean(reference*reference)))
    body = mix[:round(BODY_SECONDS*RATE)]
    master_gain = float(original_rms/np.sqrt(np.mean(body*body)))
    final, reduction = audio.limit(mix*master_gain, ceiling=.76)
    if reduction > 3.5:
        master_gain *= 10**(-(reduction-3.5)/20)
        final, reduction = audio.limit(mix*master_gain, ceiling=.76)
    start, stop = round(.005*RATE), round(.25*RATE)
    final[:start] *= np.linspace(0, 1, start)[:, None]
    final[-stop:] *= np.linspace(1, 0, stop)[:, None]
    output = args.output/'mint-breeze-acoustic.wav'
    audio.write_wav(output, final)
    lead = [n for n in score if n['role'] == 'lead']
    report = {
        'date': '2026-10-25', 'revision': 1, 'status': 'review_only_not_installed',
        'track_id': 'mint-breeze', 'playlist_position': 3, 'title': 'Мятный ветерок — мягкая акустическая версия',
        'source': (SOURCE_DIR/'original-make-music.cjs').as_posix(),
        'source_sha256': sha(SOURCE_DIR/'original-make-music.cjs'), 'original_audio_sha256': game_hash,
        'bpm': BPM, 'key': 'C major', 'source_bars': BARS, 'intro_bars': 0, 'added_coda_bars': 0,
        'duration_seconds': len(final)/RATE, 'source_body_seconds': BODY_SECONDS,
        'main_melody_start_seconds': 0, 'original_lead_notes_preserved': len(lead),
        'original_complete_events_preserved': len(score), 'original_pitches_registers_and_onsets_preserved': True,
        'lead_instrument': 'Sampled flute throughout the original 48 bars',
        'lead_pitch_range_midi': [min(n['midi'] for n in lead), max(n['midi'] for n in lead)],
        'source_form': '16 bars flute/guitar/marimba, 16 bars add strings/flute answers, 16 bars reprise with original fills',
        'original_flute_gate_seconds': .55*BEAT, 'repeated_key_duration_adjustments': adjustments,
        'piano_parts': 0, 'new_drum_pattern': False, 'sampled_brush_kit_program': 40,
        'original_quiet_warm_texture_preserved': True, 'final_chord_has_natural_linear_release': True,
        'original_echo_seconds': [.3, .6], 'stem_balance': stems,
        'master_gain': master_gain, 'original_rms_dbfs': audio.rms_db(reference),
        'body_rms_dbfs': audio.rms_db(final[:round(BODY_SECONDS*RATE)]), 'rms_dbfs': audio.rms_db(final),
        'peak_dbfs': round(20*math.log10(float(np.max(np.abs(final)))), 2),
        'maximum_peak_reduction_db': reduction, 'clipped_samples': 0,
        'sample_rate': RATE, 'channels': 2, 'bits': 16,
        'soundfont': 'GeneralUser GS v2.0.3, S. Christian Collins', 'renderer': 'FluidSynth 2.6.1',
        'audio_sha256': sha(output), 'midi_sha256': sha(midi),
    }
    write_json(args.output/'render-report.json', report)
    write_json(args.output/'score.json', score)
    write_json(args.output/'instruments.json', INSTRUMENTS)
    for name in ('original-complete-score.json', 'original-stem-levels.json'):
        shutil.copyfile(args.reference/name, args.output/name)
    for name in ('arrange_mint.py', 'audio_tools.py', 'extract_original.cjs', 'original-make-music.cjs', 'GeneralUser-GS-LICENSE.txt'):
        shutil.copyfile(SOURCE_DIR/name, args.output/name)
    selection = {'date': '2026-10-25', 'revision': 1, 'status': 'review_only_not_installed',
        'track_id': 'mint-breeze', 'playlist_position': 3, 'audio_path': output.as_posix(),
        'midi_path': midi.as_posix(), 'report_path': (args.output/'render-report.json').as_posix(),
        'renderer': 'arrange_mint.py', 'notes': 'Faithful track-3 source form with sampled soft flute, softened nylon guitars, marimba, acoustic bass, quiet strings and brushed drums. No added introduction, piano part, new rhythm or rewritten melody. All 1779 original events and 307 main melody pitches/onsets preserved. Game audio remains unchanged until the user chooses this version.'}
    old_selection = SOURCE_DIR/'selection.json'
    previous = json.loads(old_selection.read_text(encoding='utf8')) if old_selection.exists() else {}
    if previous.get('game_installation') is None and previous.get('revision', 1) <= 1:
        write_json(old_selection, selection)
    write_json(args.output/'selection.json', selection)
    assert sha(game_audio) == game_hash
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('fluidsynth', 'soundfont', 'reference', 'work', 'output'):
        parser.add_argument('--'+name, type=Path, required=True)
    main(parser.parse_args())
