"""Render three auditions of the user-marked phrase near 0:20.

Uses revision 3 as the baseline; does not select or overwrite a full arrangement.
"""
import argparse
from copy import deepcopy
import json
from pathlib import Path
import wave

import numpy as np

import arrange as music

OPTIONS = [
    {'id': 1, 'title': 'Восходящий ход', 'triplet_midi': [76, 79, 83],
     'notes': 'ми5 — соль5 — си5'},
    {'id': 2, 'title': 'Небольшая вершина', 'triplet_midi': [79, 83, 79],
     'notes': 'соль5 — си5 — соль5'},
    {'id': 3, 'title': 'Высокая вершина', 'triplet_midi': [83, 88, 83],
     'notes': 'си5 — ми6 — си5'},
]
START, END = 19.10, 21.60
RATE = music.RATE


def prepare_float(path):
    samples = music.read_float_wav(path)
    samples = samples[:round((music.BARS * 4 * music.BEAT + 3.2) * RATE)]
    samples -= samples.mean(axis=0)
    fade = round(.008 * RATE)
    samples[:fade] *= np.linspace(0, 1, fade)[:, None]
    fade = round(1.3 * RATE)
    samples[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return samples


def write_clip(output, clip):
    fade = round(.020 * RATE)
    clip = clip.copy()
    clip[:fade] *= np.linspace(0, 1, fade)[:, None]
    clip[-fade:] *= np.linspace(1, 0, fade)[:, None]
    # Repeat each phrase, with an identical short gap, for easier comparison.
    clip = np.concatenate([clip, np.zeros((round(.65 * RATE), 2)), clip])
    peak = float(np.max(np.abs(clip)))
    assert np.isfinite(clip).all() and peak < .99
    rng = np.random.default_rng(391)
    dither = (rng.random(clip.shape) - rng.random(clip.shape)) / 65536
    pcm = np.rint((clip + dither) * 32767).astype('<i2')
    with wave.open(str(output), 'wb') as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(pcm.tobytes())
    return {'duration_seconds': len(clip) / RATE, 'peak': round(peak, 6),
            'clipped_samples': int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767))}


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    reference_notes = json.loads((args.reference / 'score.json').read_text())
    reference_audio = prepare_float(args.reference / 'meadow-day-render-float.wav')
    common_gain = .79 / float(np.max(np.abs(reference_audio)))
    baseline = deepcopy(music.ORIGINAL_MELODY)
    results = []

    for option in OPTIONS:
        music.MELODY = deepcopy(baseline)
        # The marked three eighths are B5, A5, G5 at 20.117, 20.421, 20.715 s.
        for eighth, pitch in zip((3, 4, 5), option['triplet_midi']):
            music.MELODY[4][eighth] = pitch
        music.CORRECTIONS = [(4, eighth, pitch) for eighth, pitch in enumerate(music.MELODY[4])
                             if pitch != baseline[4][eighth]]
        assert all(p % 12 in {4, 7, 11} for p in option['triplet_midi'])
        music.build_score()
        music.validate_score()

        changes = []
        assert len(music.NOTES) == len(reference_notes)
        for previous, current in zip(reference_notes, music.NOTES):
            assert {k:v for k,v in previous.items() if k != 'midi'} == {k:v for k,v in current.items() if k != 'midi'}
            if previous['midi'] != current['midi']:
                bar = int(current['beat'] // 4)
                eighth = round((current['beat'] % 4) * 2)
                assert bar in (8, 24, 32) and eighth in (3, 4, 5)
                changes.append({'seconds': round(current['beat'] * .6, 3),
                                'from_midi': previous['midi'], 'to_midi': current['midi']})

        midi = args.output / f"option-{option['id']}.mid"
        music.midi_file(midi)
        raw = args.work / f"option-{option['id']}-float.wav"
        music.render(args, midi, raw)
        audio = prepare_float(raw)
        clip = audio[round(START * RATE):round(END * RATE)] * common_gain
        wav = args.output / f"option-{option['id']}.wav"
        metrics = write_clip(wav, clip)
        assert metrics['clipped_samples'] == 0
        assert [n for n in music.NOTES if n['beat'] < 16] == [n for n in reference_notes if n['beat'] < 16]
        results.append({**option, 'file': wav.name, **metrics, 'changes_in_midi': changes,
                        'accompaniment_timing_and_dynamics_identical_to_v3': True})
        print(json.dumps({'option': option['id'], 'file': str(wav), **metrics}), flush=True)

    report = {'reference_revision': 3, 'source_clip_seconds': [START, END],
              'repeat_gap_seconds': .65, 'common_gain': common_gain,
              'full_version_selected': False, 'options': results}
    (args.output / 'options.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fluidsynth', type=Path, required=True)
    parser.add_argument('--soundfont', type=Path, required=True)
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    main(parser.parse_args())
