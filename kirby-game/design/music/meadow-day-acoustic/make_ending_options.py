"""Three ending auditions with the selected intro #3 and original main theme."""
import argparse
from copy import deepcopy
import itertools
import json
from pathlib import Path
import wave

import numpy as np

import arrange as music
import make_intro_options as intro

RATE = music.RATE
CODA_BEAT = 44 * 4
PREVIEW_START = 42 * 4 * .6
PREVIEW_END = 118.4
OPTIONS = [
    {'id': 1, 'title': 'Мягкое гитарное прощание', 'chords': ['Em', 'A', 'D', 'D'],
     'phrases': [
         (0, [(0, 71, 1.50), (2, 67, 1.30)]),
         (0, [(0, 69, .70), (1, 73, .70), (2, 76, 1.35)]),
         (0, [(0, 78, 1.05), (1.5, 74, 1.65)]),
         (7, [(0, 66, .65), (1, 69, .65), (2, 74, 1.35)]),
     ]},
    {'id': 2, 'title': 'Перекличка, как во вступлении', 'chords': ['G', 'A', 'D', 'D'],
     'phrases': [
         (0, [(0, 79, .65), (1, 83, .55), (2, 86, .42), (2.75, 83, .38), (3.5, 79, .23)]),
         (7, [(0, 69, .40), (.75, 73, .40), (1.5, 76, .60), (2.5, 73, .40), (3.25, 69, .38)]),
         (0, [(0, 74, .55), (.75, 78, .55), (1.5, 81, .65), (2.5, 78, .80)]),
         (7, [(0, 74, .50), (.75, 69, .50), (1.5, 66, .65), (2.5, 62, 1.05)]),
     ], 'extra': [(0, 3, 0, 74, 2.25, 59)]},
    {'id': 3, 'title': 'Светлый финальный акцент', 'chords': ['Bm', 'G', 'A', 'D'],
     'phrases': [
         (0, [(0, 71, .32), (.5, 74, .32), (1, 78, .32), (1.5, 83, .32),
              (2, 78, .32), (2.5, 74, .32), (3, 71, .55)]),
         (0, [(0, 74, .32), (.5, 71, .32), (1, 67, .60), (2, 71, .32),
              (2.5, 74, .32), (3, 79, .55)]),
         (0, [(0, 76, .65), (1, 81, .55), (2, 76, .55), (3, 73, .55)]),
         (0, [(0, 78, .32), (.75, 81, .32), (1.25, 78, .32), (2, 86, 1.15)]),
     ]},
]


def selected_intro():
    option = intro.OPTIONS[2]
    intro.quiet_backing(option['backing_velocity_scale'])
    for channel, instrument in option['instruments'].items():
        intro.setup_instrument(channel, instrument)
    music.RNG.seed(20261024)
    for bar, (channel, phrase) in enumerate(option['phrases']):
        for beat, pitch, duration in phrase:
            velocity = 74 if channel == 5 else 85
            velocity += 3 if beat == 0 else -3 if beat % 1 else 0
            intro.add_melody(channel, bar, beat, pitch, duration, velocity)
    for channel, bar, beat, pitch, duration in option['pickup']:
        intro.add_melody(channel, bar, beat, pitch, duration, 69)


def add_note(channel, pitch, local_bar, beat, duration, velocity, chords):
    assert pitch % 12 in {p % 12 for p in music.HARMONY[chords[local_bar]][1]}
    assert beat + duration + .06 < 4
    music.note(channel, pitch, CODA_BEAT + local_bar * 4 + beat + .03, duration, velocity, jitter=.006)


def backing(option):
    chords = option['chords']
    for local_bar, chord in enumerate(chords):
        root, shape = music.HARMONY[chord]
        if option['id'] == 1:
            if local_bar == 3:
                for i, pitch in enumerate(shape):
                    add_note(1, pitch, local_bar, i * .025, 3.20 - i * .025, 42, chords)
                add_note(2, root, local_bar, 0, 3.20, 43, chords)
            else:
                for beat, index in [(0, 0), (1, 2), (2, 1), (3, 3)]:
                    add_note(1, shape[index], local_bar, beat, .84, 52 - local_bar * 3 - (4 if beat else 0), chords)
                for beat, pitch in [(0, root), (2, root + 7)]:
                    add_note(2, pitch, local_bar, beat, 1.5, 57 - local_bar * 4, chords)
        elif option['id'] == 2:
            before = len(music.NOTES)
            music.accompaniment(44 + local_bar, chord, 'outro', last=local_bar == 3)
            # Taper the backing without affecting the existing earlier notes.
            factor = [.88, .82, .77, .70][local_bar]
            first_tick = (CODA_BEAT + local_bar * 4) * music.PPQ
            last_tick = first_tick + 4 * music.PPQ
            for n in music.NOTES[before:]:
                n['velocity'] = max(1, round(n['velocity'] * factor))
            for channel in (1, 2):
                events = []
                for tick, priority, data in music.EVENTS[channel]:
                    if first_tick - 20 <= tick < last_tick and data[0] == 0x90 + channel and data[2]:
                        data = bytes([data[0], data[1], max(1, round(data[2] * factor))])
                    events.append((tick, priority, data))
                music.EVENTS[channel] = events
        else:
            attacks = [(0, .48, 55), (.75, .35, 49), (1.5, .48, 53), (2.5, .48, 51), (3.25, .35, 47)]
            if local_bar == 3:
                attacks = [(0, .30, 51), (.75, .30, 45), (2, 1.10, 69)]
            for beat, duration, velocity in attacks:
                for i, pitch in enumerate(shape):
                    add_note(1, pitch, local_bar, beat + i * .018, duration, velocity - i * 2, chords)
            bass_beats = [0, 2] if local_bar != 3 else [0, 2]
            for beat in bass_beats:
                add_note(2, root if beat == 0 or local_bar == 3 else root + 7,
                         local_bar, beat, 1.08 if local_bar == 3 else 1.45, 66 if local_bar != 3 else 63, chords)
            if local_bar == 3:
                for i, pitch in enumerate([62, 69, 74]):
                    add_note(8, pitch, 3, 2 + i * .012, 1.10, 66 - i * 3, chords)


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    selected_score = json.loads((args.selected_intro / 'intro-3-score.json').read_text())
    expected_before_coda = [n for n in selected_score if n['beat'] < CODA_BEAT]
    original_instruments = deepcopy(music.INSTRUMENTS)
    previews, reports = [], []
    for option in OPTIONS:
        music.INSTRUMENTS = deepcopy(original_instruments)
        music.EVENTS = {ch: [] for ch in music.INSTRUMENTS}
        music.CORRECTIONS = []
        music.MELODY = deepcopy(music.ORIGINAL_MELODY)
        music.build_score()
        music.validate_score()
        selected_intro()
        assert music.NOTES == selected_score, 'The chosen intro must be reproduced exactly.'
        events_before = {ch: [e for e in events if e[0] < CODA_BEAT * music.PPQ]
                         for ch, events in music.EVENTS.items()}
        music.NOTES = [n for n in music.NOTES if n['beat'] < CODA_BEAT]
        music.EVENTS = {ch: list(events) for ch, events in events_before.items()}
        intro.setup_instrument(7, {'name': 'Ending - solo nylon guitar', 'program': 24,
                                  'volume': 107, 'pan': 58, 'reverb': 19})
        intro.setup_instrument(8, {'name': 'Ending - piano accent', 'program': 0,
                                  'volume': 82, 'pan': 70, 'reverb': 16})
        music.RNG.seed(20261100 + option['id'])
        music.control(0, CODA_BEAT, 11, 101)
        backing(option)
        for local_bar, (channel, phrase) in enumerate(option['phrases']):
            for beat, pitch, duration in phrase:
                velocity = 66 - local_bar * 3 if option['id'] == 1 else 70 if option['id'] == 2 else 77
                add_note(channel, pitch, local_bar, beat, duration, velocity, option['chords'])
        for channel, bar, beat, pitch, duration, velocity in option.get('extra', []):
            add_note(channel, pitch, bar, beat, duration, velocity, option['chords'])
        for channel in music.INSTRUMENTS:
            music.control(channel, music.BARS * 4, 64, 0)
            music.control(channel, music.BARS * 4 + 3, 123, 0)

        assert [n for n in music.NOTES if n['beat'] < CODA_BEAT] == expected_before_coda
        for ch, expected in events_before.items():
            assert [e for e in music.EVENTS[ch] if e[0] < CODA_BEAT * music.PPQ] == expected
        midi = args.output / f"ending-{option['id']}.mid"
        music.midi_file(midi)
        raw = args.work / f"ending-{option['id']}-float.wav"
        music.render(args, midi, raw)
        full = intro.float_audio(raw)
        previews.append(full[round(PREVIEW_START * RATE):round(PREVIEW_END * RATE)])
        report = {'id': option['id'], 'title': option['title'], 'chords': option['chords'],
                  'selected_intro': 3, 'baseline_revision': 3, 'main_melody_pitch_edits': 0,
                  'unchanged_notes_before_coda': len(expected_before_coda),
                  'existing_channel_events_before_coda_identical': True,
                  'coda_begins_seconds': 105.6, 'preview_start_seconds': PREVIEW_START,
                  'preview_end_seconds': PREVIEW_END, 'coda_begins_in_preview_seconds': 4.8}
        reports.append(report)
        (args.output / f"ending-{option['id']}-score.json").write_text(json.dumps(music.NOTES, indent=2) + '\n', encoding='utf8')

    reference_audio = intro.float_audio(args.reference / 'meadow-day-render-float.wav')
    common_gain = .79 / max(float(np.max(np.abs(reference_audio))), *(float(np.max(np.abs(p))) for p in previews))
    pcm_previews = []
    for option, preview, report in zip(OPTIONS, previews, reports):
        audio = preview * common_gain
        fade = round(.018 * RATE)
        audio[:fade] *= np.linspace(0, 1, fade)[:, None]
        fade = round(.90 * RATE)
        audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
        rng = np.random.default_rng(391)
        dither = (rng.random(audio.shape) - rng.random(audio.shape)) / 65536
        assert np.isfinite(audio).all() and np.max(np.abs(audio)) < .99
        pcm = np.rint((audio + dither) * 32767).astype('<i2')
        assert not np.any(np.abs(pcm.astype(np.int32)) >= 32767)
        pcm_previews.append(pcm)
        wav = args.output / f"ending-{option['id']}.wav"
        with wave.open(str(wav), 'wb') as output:
            output.setnchannels(2)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes(pcm.tobytes())
        report.update({'file': wav.name, 'preview_seconds': len(audio) / RATE,
                       'peak': round(float(np.max(np.abs(audio))), 6), 'clipped_samples': 0})
        print(json.dumps(report, ensure_ascii=False), flush=True)
    differences = [float(np.sqrt(np.mean(((a.astype(float)-b.astype(float))/32768)**2)))
                   for a,b in itertools.combinations(pcm_previews, 2)]
    assert min(differences) > .01
    selection_path = Path(__file__).resolve().parent / 'selection.json'
    selection = json.loads(selection_path.read_text(encoding='utf8')) if selection_path.exists() else {}
    chosen_ending = (selection.get('selected_ending') or {}).get('option')
    (args.output / 'ending-options.json').write_text(json.dumps({
        'baseline_revision': 3, 'selected_intro': 3, 'selected_ending': chosen_ending,
        'main_melody_pitch_edits': 0, 'common_gain': common_gain,
        'pairwise_audio_rms_differences': differences, 'options': reports,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fluidsynth', type=Path, required=True)
    parser.add_argument('--soundfont', type=Path, required=True)
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--selected-intro', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    main(parser.parse_args())
