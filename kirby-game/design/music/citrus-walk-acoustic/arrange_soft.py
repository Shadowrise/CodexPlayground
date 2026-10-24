"""Revision 3: softer lead, melodic call-and-answer opening and resolved coda.

The preferred revision-2 body retains all original pitches, onsets and parts.
Only the lead guitar's touch/tone changes; new phrases frame the 48-bar body.
"""
import argparse
from collections import defaultdict
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import shutil

import numpy as np

import arrange as audio_tools
import arrange_faithful as music

RATE, BEAT = 44100, 60/108
INTRO_BARS, SOURCE_BARS, CODA_BARS = 4, 48, 4
BARS = INTRO_BARS+SOURCE_BARS+CODA_BARS
OFFSET, CODA_START = INTRO_BARS*4*BEAT, (INTRO_BARS+SOURCE_BARS)*4*BEAT
FRAMES = round((BARS*4*BEAT+3)*RATE)
SOFT_VELOCITY = .80
LEAD_LEVEL_CHANGE_DB = -1.0
SOFT_FREQS = [0, 700, 1300, 1900, 2600, 3600, 5500, 9000, 22050]
SOFT_GAINS = [0, 0, -.5, -2, -4.5, -7, -9, -11, -11]
SHAPES = {
    'E': [52, 59, 64, 68], 'C#m': [49, 56, 61, 64],
    'F#m': [42, 57, 61, 66], 'A': [45, 57, 61, 64],
    'B7': [47, 57, 63, 66],
}


def add(ch, pitch, bar, beat, duration, velocity, role, chord):
    music.add(ch, pitch, (bar*4+beat)*BEAT, duration*BEAT, velocity, role)
    audio_tools.NOTES[-1]['chord'] = chord


def framing_backing(bar, chord, final=False):
    shape = SHAPES[chord]
    ending = bar >= 52
    for local in ([0] if final else [0, 2]):
        for i, pitch in enumerate(shape[1:]):
            add(3, pitch, bar, local+i*.04, 3.65-i*.04 if final else 1.7,
                (42 if ending else 39)-i, 'framing_guitar', chord)
    for local in ([0] if final else [0, 2]):
        pitch = shape[0]+(7 if local == 2 else 0)
        add(6, pitch, bar, local+.025, 3.6 if final else 1.65,
            52 if ending else 48, 'framing_bass', chord)
    # Low original-style chord texture and a quiet sampled string layer.
    for i, pitch in enumerate(shape[1:]):
        add(8, pitch, bar, 0, 4+.22/BEAT, 51,
            'framing_warm_bed', chord)
        if bar != 0:
            add(7, pitch+12, bar, .035, 3.72, 42 if final else 44,
                'framing_strings', chord)


def compose_frames():
    intro_chords = ['E', 'C#m', 'F#m', 'A']
    coda_chords = ['A', 'B7', 'E', 'E']
    for bar, chord in enumerate(intro_chords):
        framing_backing(bar, chord)
    for local, chord in enumerate(coda_chords):
        framing_backing(52+local, chord, final=local == 3)
    # Ascending guitar calls and descending flute replies anticipate the
    # source arpeggios, while giving the opening a distinct little melody.
    intro = [
        (0, [( .25, 71, .80), (1.25, 76, 1.00), (2.50, 80, 1.20)]),
        (1, [( .25, 80, .80), (1.25, 76, .90), (2.50, 73, 1.25)]),
        (0, [( .25, 73, .65), (1.00, 78, 1.10), (2.50, 81, 1.20)]),
        (1, [(0, 76, .85), (1.00, 73, .85), (2.00, 69, 1.60)]),
    ]
    for bar, (ch, phrase) in enumerate(intro):
        for beat, pitch, duration in phrase:
            add(ch, pitch, bar, beat, duration, 61 if ch == 0 else 67,
                'intro_melody', intro_chords[bar])
    for beat, pitch, duration in [(3.25, 73, .40), (3.65, 76, .30)]:
        add(0, pitch, 3, beat, duration, 57, 'intro_pickup', 'A')
    coda = [
        (0, [(0, 69, .65), (.75, 73, .65), (1.50, 76, 1.10), (3, 73, .80)]),
        (1, [(0, 78, .80), (1, 75, .80), (2, 71, .80), (3, 69, .65)]),
        (0, [(.25, 68, .70), (1, 71, .80), (2.25, 76, 1.40)]),
        (0, [(0, 71, .80), (1, 68, .80), (2, 64, 1.80)]),
    ]
    for local, (ch, phrase) in enumerate(coda):
        for beat, pitch, duration in phrase:
            add(ch, pitch, 52+local, beat, duration, 60 if ch == 0 else 67,
                'coda_melody', coda_chords[local])
    add(1, 76, 55, 0, 3.15, 62, 'coda_flute_resolution', 'E')
    for bar, beat, pitch in [(54, 3.25, 71), (55, 2.05, 76)]:
        add(5, pitch, bar, beat, .65, 40, 'coda_marimba', 'E')


def build(original):
    music.INTRO_BARS, music.BARS = INTRO_BARS, BARS
    music.OFFSET, music.FRAMES = OFFSET, FRAMES
    music.INSTRUMENTS = deepcopy(music.INSTRUMENTS)
    music.INSTRUMENTS[0] = ('Soft fingered nylon guitar - original melody', 24, 112, 54, 20)
    music.build(original)
    audio_tools.CODA_BARS = CODA_BARS
    # Replace the earlier small introduction. Preserve every source event.
    audio_tools.NOTES = [n for n in audio_tools.NOTES if 'source_index' in n]
    for n in audio_tools.NOTES:
        if n['channel'] == 0:
            n['velocity'] = round(n['velocity']*SOFT_VELOCITY)
    compose_frames()
    # Reconcile repeated keys across the new framing/body boundaries. The
    # sustain of different notes remains free to overlap, just as in revision 2.
    by_key = defaultdict(list)
    for n in audio_tools.NOTES:
        by_key[(n['channel'], n['midi'])].append(n)
    for values in by_key.values():
        values.sort(key=lambda n: n['beat'])
        for current, following in zip(values, values[1:]):
            requested = following['beat']-current['beat']-.006/BEAT
            if requested > 0 and current['duration_beats'] > requested:
                current['duration_beats'] = requested
    for ch, events in audio_tools.EVENTS.items():
        audio_tools.EVENTS[ch] = [e for e in events if e[2][0] & 0xF0 not in (0x80, 0x90)]
    for n in audio_tools.NOTES:
        ch, pitch = n['channel'], n['midi']
        audio_tools.event(ch, n['beat'], [0x90+ch, pitch, n['velocity']], 2)
        audio_tools.event(ch, n['beat']+n['duration_beats'], [0x80+ch, pitch, 0], 0)


def validate(original, baseline_score):
    baseline = {n['source_index']: n for n in baseline_score if 'source_index' in n}
    source = {n['source_index']: n for n in audio_tools.NOTES if 'source_index' in n}
    assert len(source) == len(baseline) == len(original) == 1828
    for index, before in enumerate(original):
        after = source[index]
        assert after['midi'] == before['midi'] and after['channel'] == music.channel_for(before)
        assert abs(after['beat']*BEAT-OFFSET-before['time_seconds']) < 1e-8
        expected_velocity = round(baseline[index]['velocity']*SOFT_VELOCITY) if after['channel'] == 0 else baseline[index]['velocity']
        assert after['velocity'] == expected_velocity
    assert sum(n['role'] == 'lead' for n in source.values()) == 308
    assert all(ch == 9 or inst[1] not in range(8) for ch, inst in music.INSTRUMENTS.items())
    for n in audio_tools.NOTES:
        assert n['beat'] >= 0 and n['duration_beats'] > 0
        if 'chord' in n:
            assert n['midi'] % 12 in {p % 12 for p in SHAPES[n['chord']]}, n


def soften_attack(audio):
    before, after = round(.003*RATE), round(.028*RATE)
    envelope = np.ones(len(audio))
    for n in audio_tools.NOTES:
        if n['channel'] != 0:
            continue
        onset = round(n['beat']*BEAT*RATE)
        first, stop = max(0, onset-before), min(len(audio), onset+after)
        position = np.arange(first, stop)-onset
        curve = np.where(position < 0,
            1-.45*np.sin(np.clip((position+before)/before, 0, 1)*math.pi/2)**2,
            .55+.45*np.sin(np.clip(position/after, 0, 1)*math.pi/2)**2)
        envelope[first:stop] = np.minimum(envelope[first:stop], curve)
    return audio*envelope[:, None]


def framing_pad():
    result = np.zeros((FRAMES, 2))
    for n in audio_tools.NOTES:
        if n['role'] != 'framing_warm_bed':
            continue
        start = round(n['beat']*BEAT*RATE)
        length = round(n['duration_beats']*BEAT*RATE)
        t = np.arange(length)/RATE
        duration = length/RATE
        frequency = 440*2**((n['midi']-69)/12)
        # Same gentle chord oscillator/colour as the preserved original bed.
        tone = (.75*np.sin(2*math.pi*frequency*t)+.2*np.sin(2*math.pi*frequency*1.0015*t))
        tone *= np.minimum(1, t/.15)*np.minimum(1, (duration-t)/.4)*.027
        index = SHAPES[n['chord']][1:].index(n['midi'])
        pan = (index-1)*.45
        result[start:start+length, 0] += tone*math.sqrt((1-pan)/2)
        result[start:start+length, 1] += tone*math.sqrt((1+pan)/2)
    return result


def band_energy(audio, low=2500, high=6500):
    size, hop = 4096, 2048
    frequencies = np.fft.rfftfreq(size, 1/RATE)
    selected = (frequencies >= low) & (frequencies < high)
    window = np.hanning(size)
    total = 0.
    for start in range(0, len(audio)-size+1, hop):
        spectrum = np.fft.rfft(audio[start:start+size]*window[:, None], axis=0)
        total += float(np.sum(np.abs(spectrum[selected])**2))
    return total


def excerpt(audio, start, stop):
    result = audio[round(start*RATE):round(stop*RATE)].copy()
    length = round(.025*RATE)
    result[:length] *= np.linspace(0, 1, length)[:, None]
    result[-length:] *= np.linspace(1, 0, length)[:, None]
    return result


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    original = json.loads((args.reference/'original-complete-score.json').read_text())
    levels = json.loads((args.reference/'original-stem-levels.json').read_text())['roles']
    baseline = json.loads((args.base/'render-report.json').read_text(encoding='utf8'))
    assert baseline['revision'] == 2
    assert hashlib.sha256(audio_tools.SOURCE.read_bytes()).hexdigest() == baseline['source_sha256']
    build(original)
    validate(original, json.loads((args.base/'score.json').read_text()))
    midi = args.output/'citrus-walk-soft.mid'
    audio_tools.write_midi(midi)
    mix = music.source_texture(args.reference/'original-warm-bed.wav')
    mix += music.source_texture(args.reference/'original-drums.wav')
    mix += framing_pad()
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
    stems, softness = [], {}
    for name, channels, role, windows, sections in groups:
        print('Rendering '+name+'...', flush=True)
        stem_midi = args.work/(name+'.mid')
        audio_tools.write_midi(stem_midi, channels=channels)
        raw = audio_tools.render(args, stem_midi, args.work/(name+'-float.wav'))
        if name == 'guitar-lead':
            raw = soften_attack(raw)
            audio = audio_tools.band_tone(raw, SOFT_FREQS, SOFT_GAINS)
        elif name == 'string-bed':
            audio = audio_tools.band_tone(raw, [0, 1000, 2200, 4000, 7000, 22050], [0, 0, -2, -5, -7, -7])
        elif name != 'bass':
            audio = audio_tools.band_tone(raw, [0, 1300, 2800, 5000, 9000, 22050], [0, 0, -.5, -1.6, -2.5, -2.5])
        else:
            audio = raw
        if name not in ('bass', 'string-bed'):
            audio = music.original_echo(audio)
        target = math.sqrt(sum(levels[role]['section_rms'][i]**2 for i in sections)/len(sections))
        if name == 'guitar-lead':
            target *= 10**(LEAD_LEVEL_CHANGE_DB/20)
        active = music.active_samples(audio, windows)
        gain = float(target/np.sqrt(np.mean(active*active)))
        audio *= gain
        mix += audio
        stems.append({'name': name, 'gain': gain, 'source_target_rms_dbfs': round(20*math.log10(target), 2)})
        if name == 'guitar-lead':
            # Compare the same four source bars at their different intro offsets.
            # The reference has a shorter introduction and no added coda.
            current_frames = audio_tools.FRAMES
            try:
                audio_tools.FRAMES = round(baseline['duration_seconds']*RATE)
                old_raw = audio_tools.read_float(args.base_work/'guitar-lead-float.wav')
            finally:
                audio_tools.FRAMES = current_frames
            old = audio_tools.band_tone(old_raw, [0, 1300, 2800, 5000, 9000, 22050], [0, 0, -.5, -1.6, -2.5, -2.5])
            old = music.original_echo(old)
            old *= next(s['gain'] for s in baseline['stems'] if s['name'] == 'guitar-lead')
            old_start, new_start = round(baseline['original_melody_offset_seconds']*RATE), round(OFFSET*RATE)
            length = round(16*BEAT*RATE)
            softness = {
                'velocity_scale': SOFT_VELOCITY, 'attack_rounding_ms': 28,
                'lead_overall_level_change_db': LEAD_LEVEL_CHANGE_DB,
                'eq_frequencies_hz': SOFT_FREQS, 'eq_gains_db': SOFT_GAINS,
                'opening_2500_6500_hz_change_vs_revision_2_db': round(10*math.log10(
                    band_energy(audio[new_start:new_start+length])/band_energy(old[old_start:old_start+length])), 2),
            }
            audio_tools.write_wav(args.output/'soft-guitar-stem.wav', audio*baseline['master_gain'])
            del old_raw, old
        del raw, audio, active

    # Preserve the preferred version's master gain and all backing levels.
    gain = baseline['master_gain']
    audio, reduction = audio_tools.limit(mix*gain, ceiling=.76)
    fade_in, fade_out = round(.012*RATE), round(.35*RATE)
    audio[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    audio[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    output = args.output/'citrus-walk-soft.wav'
    audio_tools.write_wav(output, audio)
    preview = np.concatenate([excerpt(audio, 0, OFFSET), np.zeros((round(.6*RATE), 2)),
                              excerpt(audio, CODA_START, FRAMES/RATE)])
    audio_tools.write_wav(args.output/'intro-and-ending.wav', preview)
    report = {
        'date': '2026-10-24', 'revision': 3, 'status': 'review_only_not_installed',
        'title': 'Цитрусовая прогулка — мягкая гитара, новая перекличка и финал',
        'base_revision': 2, 'base_artifact': args.base.as_posix(),
        'source_sha256': baseline['source_sha256'], 'bpm': 108, 'key': 'E major',
        'duration_seconds': len(audio)/RATE, 'intro_bars': 4, 'source_bars': 48, 'coda_bars': 4,
        'main_melody_start_seconds': OFFSET, 'flute_middle_start_seconds': OFFSET+64*BEAT,
        'guitar_return_seconds': OFFSET+128*BEAT, 'coda_start_seconds': CODA_START,
        'main_melody_notes_preserved': 308, 'original_complete_events_preserved': 1828,
        'source_pitches_registers_onsets_unchanged': True,
        'other_original_note_velocities_unchanged': True, 'piano_parts': 0,
        'soft_guitar': softness, 'stem_balance': stems, 'master_gain': gain,
        'sample_rate': RATE, 'channels': 2, 'bits': 16,
        'rms_dbfs': audio_tools.rms_db(audio), 'body_rms_dbfs': audio_tools.rms_db(music.active_samples(audio, [(0, 48)])),
        'peak_dbfs': round(20*math.log10(float(np.max(np.abs(audio)))), 2),
        'maximum_peak_reduction_db': reduction, 'clipped_samples': 0,
        'intro_harmony': ['E', 'C#m', 'F#m', 'A'], 'ending_harmony': ['A', 'B7', 'E', 'E'],
        'intro_and_ending_preview_seconds': len(preview)/RATE,
        'soundfont': 'GeneralUser GS v2.0.3', 'renderer': 'FluidSynth 2.6.1',
        'audio_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    }
    (args.output/'score.json').write_text(json.dumps(audio_tools.NOTES, indent=2)+'\n', encoding='utf8')
    (args.output/'instruments.json').write_text(json.dumps(music.INSTRUMENTS, indent=2)+'\n', encoding='utf8')
    (args.output/'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    source_dir = Path(__file__).resolve().parent
    for name in ('arrange.py', 'arrange_faithful.py', 'arrange_soft.py', 'extract_original.cjs', 'GeneralUser-GS-LICENSE.txt'):
        shutil.copyfile(source_dir/name, args.output/name)
    selection_path = source_dir/'selection.json'
    previous = json.loads(selection_path.read_text(encoding='utf8'))
    selection = {
        'date': '2026-10-24', 'revision': 3, 'status': 'softer_lead_and_new_framing_for_listening_not_installed',
        'track_id': 'citrus-walk', 'playlist_position': 2,
        'preferred_base_revision': 2, 'preferred_base_artifact': args.base.as_posix(),
        'audio_path': output.as_posix(), 'midi_path': midi.as_posix(),
        'report_path': (args.output/'render-report.json').as_posix(), 'renderer': 'arrange_soft.py',
        'rejected_revision': 1, 'rejected_audio_path': previous.get('rejected_audio_path'),
        'notes': 'User prefers revision 2 but requests a softer, lighter lead and more interesting introduction and ending. Keep the entire source body and original voice form. Lower nylon-guitar velocity, round the first 28 ms and reduce the upper partials with body-level compensation; original lead RMS recedes only 1 dB. Add four-bar guitar/flute call-and-answer opening and four-bar A-B7-E-E ending. No piano. Full review version, not installed.',
    }
    data = json.dumps(selection, ensure_ascii=False, indent=2)+'\n'
    if previous.get('game_installation') is None and previous.get('revision', 3) <= 3:
        selection_path.write_text(data, encoding='utf8')
    (args.output/'selection.json').write_text(data, encoding='utf8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('fluidsynth', 'soundfont', 'output', 'work', 'reference', 'base', 'base-work'):
        parser.add_argument('--'+flag, type=Path, required=True)
    main(parser.parse_args())
