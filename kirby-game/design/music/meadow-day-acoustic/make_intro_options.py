"""Three melodic introductions, followed by the unchanged revision-3 theme."""
import argparse
from copy import deepcopy
import itertools
import json
from pathlib import Path
import wave

import numpy as np

import arrange as music

RATE = music.RATE
INTRO_BEATS = 16
PREVIEW_SECONDS = 16.8
INTRO_CHORDS = ['D', 'Bm', 'G', 'A']

OPTIONS = [
    {'id': 1, 'title': 'Гитарная миниатюра', 'backing_velocity_scale': .60,
     'instruments': {5: {'name': 'Introduction - solo nylon guitar', 'program': 24,
                        'volume': 112, 'pan': 74, 'reverb': 19}},
     'phrases': [
         (5, [(0, 62, .70), (1, 66, .36), (1.5, 69, .65), (2.5, 74, .65), (3.5, 69, .26)]),
         (5, [(0, 71, .70), (1, 66, .36), (1.5, 62, .65), (2.5, 66, .36), (3, 71, .65)]),
         (5, [(0, 67, .70), (1, 71, .36), (1.5, 74, .65), (2.5, 71, .36), (3, 67, .65)]),
         (5, [(0, 69, .70), (1, 73, .36), (1.5, 76, .65), (2.5, 73, .36), (3, 69, .65)]),
     ]},
    {'id': 2, 'title': 'Лирическое фортепиано', 'backing_velocity_scale': .47,
     'instruments': {5: {'name': 'Introduction - lyrical piano', 'program': 0,
                        'volume': 91, 'pan': 66, 'reverb': 24}},
     'phrases': [
         (5, [(0, 66, 1.20), (1.5, 69, .36), (2, 74, 1.55)]),
         (5, [(0, 74, 1.20), (1.5, 71, .36), (2, 66, 1.15), (3.5, 74, .25)]),
         (5, [(0, 71, .80), (1, 74, .80), (2, 79, 1.00), (3.25, 74, .42)]),
         (5, [(0, 73, .80), (1, 76, .80), (2, 69, 1.15), (3.5, 73, .25)]),
     ]},
    {'id': 3, 'title': 'Перекличка флейты и гитары', 'backing_velocity_scale': .52,
     'instruments': {
         5: {'name': 'Introduction - answering flute', 'program': 73,
             'volume': 90, 'pan': 73, 'reverb': 24},
         6: {'name': 'Introduction - answering guitar', 'program': 24,
             'volume': 110, 'pan': 51, 'reverb': 18}},
     'phrases': [
         (5, [(0, 74, .55), (.75, 78, .55), (1.5, 81, .70), (2.5, 78, .85)]),
         (6, [(0, 71, .55), (.75, 66, .55), (1.5, 74, .70), (2.5, 71, .55), (3.25, 66, .42)]),
         (5, [(0, 79, .80), (1, 83, .75), (2, 86, .55), (2.75, 83, .45), (3.5, 79, .24)]),
         (6, [(0, 69, .35), (.5, 73, .35), (1, 76, .65)]),
     ],
     'pickup': [(5, 3, 2.0, 69, .42), (5, 3, 2.75, 76, .42), (5, 3, 3.5, 73, .25)]},
]


def float_audio(path):
    audio = music.read_float_wav(path)
    audio = audio[:round((music.BARS * 4 * music.BEAT + 3.2) * RATE)]
    return audio - audio.mean(axis=0)


def setup_instrument(channel, instrument):
    music.INSTRUMENTS[channel] = instrument
    music.EVENTS[channel] = []
    music.event(channel, 0, [0xC0 + channel, instrument['program']])
    for number, value in [(7, instrument['volume']), (10, instrument['pan']),
                          (11, 106), (91, instrument['reverb']), (93, 0), (1, 0), (64, 0)]:
        music.control(channel, 0, number, value)
    music.event(channel, 0, [0xE0 + channel, 0, 64])


def quiet_backing(factor):
    # Only the existing guitar attacks in the first four bars are attenuated.
    for n in music.NOTES:
        if n['channel'] == 1 and n['beat'] < INTRO_BEATS:
            n['velocity'] = max(1, round(n['velocity'] * factor))
    new_events = []
    for tick, priority, data in music.EVENTS[1]:
        if tick < INTRO_BEATS * music.PPQ and data[0] == 0x91 and data[2]:
            data = bytes([data[0], data[1], max(1, round(data[2] * factor))])
        new_events.append((tick, priority, data))
    music.EVENTS[1] = new_events


def add_melody(channel, bar, beat, pitch, duration, velocity):
    chord_pcs = {p % 12 for p in music.HARMONY[INTRO_CHORDS[bar]][1]}
    assert pitch % 12 in chord_pcs
    assert beat + duration + .05 < 4
    music.note(channel, pitch, bar * 4 + beat + .03, duration, velocity, jitter=.008)


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    reference_notes = json.loads((args.reference / 'score.json').read_text())
    reference_body = [n for n in reference_notes if n['beat'] >= INTRO_BEATS]
    reference_audio = float_audio(args.reference / 'meadow-day-render-float.wav')
    original_instruments = deepcopy(music.INSTRUMENTS)
    previews, reports = [], []

    for option in OPTIONS:
        music.INSTRUMENTS = deepcopy(original_instruments)
        music.EVENTS = {ch: [] for ch in music.INSTRUMENTS}
        music.MELODY = deepcopy(music.ORIGINAL_MELODY)
        music.CORRECTIONS = []
        music.build_score()
        music.validate_score()
        assert music.NOTES == reference_notes, 'Baseline must match revision 3 before intro edits.'
        original_events = deepcopy(music.EVENTS)
        quiet_backing(option['backing_velocity_scale'])
        for channel, instrument in option['instruments'].items():
            setup_instrument(channel, instrument)
        music.RNG.seed(20261021 + option['id'])
        for bar, (channel, phrase) in enumerate(option['phrases']):
            for beat, pitch, duration in phrase:
                velocity = 86 if option['id'] == 1 else 77 if option['id'] == 2 else 74 if channel == 5 else 85
                velocity += 3 if beat == 0 else -3 if beat % 1 else 0
                add_melody(channel, bar, beat, pitch, duration, velocity)
        for channel, bar, beat, pitch, duration in option.get('pickup', []):
            add_melody(channel, bar, beat, pitch, duration, 69)

        actual_body = [n for n in music.NOTES if n['beat'] >= INTRO_BEATS]
        assert actual_body == reference_body
        for ch in original_events:
            assert [e for e in music.EVENTS[ch] if e[0] >= INTRO_BEATS * music.PPQ] == [e for e in original_events[ch] if e[0] >= INTRO_BEATS * music.PPQ]

        midi = args.output / f"intro-{option['id']}.mid"
        music.midi_file(midi)
        raw = args.work / f"intro-{option['id']}-float.wav"
        music.render(args, midi, raw)
        audio = float_audio(raw)[:round(PREVIEW_SECONDS * RATE)]
        previews.append(audio)
        reports.append({'id': option['id'], 'title': option['title'],
                        'intro_seconds': 9.6, 'preview_seconds': PREVIEW_SECONDS,
                        'added_melody_notes': sum(n['channel'] in option['instruments'] for n in music.NOTES),
                        'unchanged_body_notes': len(actual_body),
                        'all_midi_events_after_intro_identical_to_revision_3': True,
                        'backing_velocity_scale': option['backing_velocity_scale']})
        (args.output / f"intro-{option['id']}-score.json").write_text(json.dumps(music.NOTES, indent=2) + '\n', encoding='utf8')

    common_gain = .79 / max(float(np.max(np.abs(reference_audio))), *(float(np.max(np.abs(a))) for a in previews))
    pcm_previews = []
    for option, audio, report in zip(OPTIONS, previews, reports):
        audio = audio * common_gain
        fade = round(.008 * RATE)
        audio[:fade] *= np.linspace(0, 1, fade)[:, None]
        fade = round(.23 * RATE)
        audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
        rng = np.random.default_rng(391)
        dither = (rng.random(audio.shape) - rng.random(audio.shape)) / 65536
        pcm = np.rint((audio + dither) * 32767).astype('<i2')
        clipped = int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767))
        assert clipped == 0 and np.isfinite(audio).all()
        wav = args.output / f"intro-{option['id']}.wav"
        with wave.open(str(wav), 'wb') as output:
            output.setnchannels(2)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(pcm.tobytes())
        pcm_previews.append(pcm)
        report.update({'file': wav.name, 'peak': round(float(np.max(np.abs(audio))), 6), 'clipped_samples': clipped})
        print(json.dumps(report, ensure_ascii=False), flush=True)

    differences = [float(np.sqrt(np.mean(((a.astype(float)-b.astype(float))/32768)**2))) for a,b in itertools.combinations(pcm_previews, 2)]
    assert min(differences) > .01
    selection_path = Path(__file__).resolve().parent / 'selection.json'
    selection = json.loads(selection_path.read_text(encoding='utf8')) if selection_path.exists() else {}
    chosen_intro = selection.get('selected_intro', {}).get('option')
    (args.output / 'intro-options.json').write_text(json.dumps({
        'baseline_revision': 3, 'main_melody_pitch_edits': 0, 'common_gain': common_gain,
        'theme_begins_seconds': 9.6, 'pairwise_audio_rms_differences': differences,
        'selected_option': chosen_intro, 'options': reports,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fluidsynth', type=Path, required=True)
    parser.add_argument('--soundfont', type=Path, required=True)
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    main(parser.parse_args())
