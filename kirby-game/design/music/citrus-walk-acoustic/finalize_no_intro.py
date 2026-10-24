"""Remove the approved revision-3 introduction without re-rendering its sound.

Keep the finished body/coda byte-for-byte after a 5 ms click-prevention ramp.
Shift the corresponding editable score, and optionally install the approved track.
"""
import argparse
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import shutil
import wave

import numpy as np

import arrange as midi_tools


def read_json(path):
    return json.loads(path.read_text(encoding='utf8'))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf8')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_pcm(path):
    with wave.open(str(path), 'rb') as wav:
        assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (2, 2, 44100)
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').reshape(-1, 2).copy()


def rms_db(pcm):
    return round(20*math.log10(max(1e-12, float(np.sqrt(np.mean((pcm.astype(float)/32768)**2))))), 2)


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    source_dir = Path(__file__).resolve().parent
    original_report = read_json(args.source/'render-report.json')
    assert original_report['revision'] == 3
    source_wav = args.source/'citrus-walk-soft.wav'
    assert sha(source_wav) == original_report['audio_sha256']
    assert sha(source_dir/'original-make-music.cjs') == original_report['source_sha256']
    full = read_pcm(source_wav)
    rate, beat = 44100, 60/original_report['bpm']
    removed = round(original_report['main_melody_start_seconds']*rate)
    pcm = full[removed:].copy()
    # Removing audio at a bar boundary can expose a non-zero waveform edge.
    ramp = round(.005*rate)
    pcm[:ramp] = np.rint(pcm[:ramp]*np.linspace(0, 1, ramp)[:, None]).astype('<i2')
    assert len(pcm) == 5228300 and removed == 392000
    assert np.array_equal(pcm[ramp:], full[removed+ramp:])
    assert not pcm[0].any() and np.max(np.abs(pcm.astype(np.int32))) < 32767
    audio = args.output/'citrus-walk.wav'
    with wave.open(str(audio), 'wb') as wav:
        wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(rate)
        wav.writeframes(pcm.astype('<i2').tobytes())

    original_score = read_json(args.source/'score.json')
    removed_beats = original_report['intro_bars']*4
    score = [deepcopy(n) for n in original_score if n['beat'] >= removed_beats]
    for n in score:
        n['beat'] -= removed_beats
        assert n['beat'] >= 0
    assert sum('source_index' in n for n in score) == 1828
    assert sum(n['role'] == 'lead' for n in score) == 308
    assert all(not n['role'].startswith('intro') for n in score)
    assert min(n['beat'] for n in score if n['role'] == 'lead') == 0
    instruments = {int(ch): tuple(instrument) for ch, instrument in read_json(args.source/'instruments.json').items()}
    midi_tools.INSTRUMENTS = instruments
    midi_tools.NOTES = score
    midi_tools.BARS = original_report['source_bars']+original_report['coda_bars']
    midi_tools.EVENTS = {ch: [] for ch in instruments}
    for ch, (_, program, volume, pan, reverb) in instruments.items():
        midi_tools.event(ch, 0, [0xC0+ch, program])
        for cc, value in [(7, volume), (10, pan), (11, 106), (91, reverb), (93, 0), (1, 0), (64, 0)]:
            midi_tools.cc(ch, 0, cc, value)
        midi_tools.event(ch, 0, [0xE0+ch, 0, 64])
    for n in score:
        ch, pitch = n['channel'], n['midi']
        midi_tools.event(ch, n['beat'], [0x90+ch, pitch, n['velocity']], 2)
        midi_tools.event(ch, n['beat']+n['duration_beats'], [0x80+ch, pitch, 0], 0)
    midi = args.output/'citrus-walk.mid'
    midi_tools.write_midi(midi)
    report = deepcopy(original_report)
    report.update({
        'revision': 4, 'status': 'approved_by_user_no_introduction',
        'title': 'Цитрусовая прогулка — мягкая гитара, без вступления',
        'base_revision': 3, 'base_artifact': args.source.as_posix(),
        'source_render_sha256': sha(source_wav), 'removed_intro_seconds': removed/rate,
        'removed_intro_frames': removed, 'start_safety_ramp_frames': ramp,
        'start_safety_ramp_seconds': ramp/rate, 'intro_bars': 0, 'intro_harmony': [],
        'duration_seconds': len(pcm)/rate, 'main_melody_start_seconds': 0,
        'flute_middle_start_seconds': original_report['flute_middle_start_seconds']-removed/rate,
        'guitar_return_seconds': original_report['guitar_return_seconds']-removed/rate,
        'coda_start_seconds': original_report['coda_start_seconds']-removed/rate,
        'rms_dbfs': rms_db(pcm), 'body_rms_dbfs': rms_db(pcm[:round(48*4*beat*rate)]),
        'peak_dbfs': round(20*math.log10(float(np.max(np.abs(pcm.astype(float))))/32768), 2),
        'body_and_ending_after_start_ramp_exactly_preserved': True,
        'score_note_events': len(score), 'audio_sha256': sha(audio), 'midi_sha256': sha(midi),
    })
    report.pop('intro_and_ending_preview_seconds', None)
    validation = {
        'passed': True, 'sample_rate': rate, 'channels': 2, 'bits': 16,
        'duration_seconds': len(pcm)/rate, 'original_events_preserved': 1828,
        'original_main_melody_notes_preserved': 308, 'main_melody_first_beat': 0,
        'introduction_notes_removed': len(original_score)-len(score),
        'score_note_events': len(score), 'piano_parts': 0, 'clipped_samples': 0,
        'body_and_ending_pcm_exact_after_first_5_ms': True,
        'approved_ending_pcm_exact': bool(np.array_equal(pcm[round(report['coda_start_seconds']*rate):],
                                                       full[round(original_report['coda_start_seconds']*rate):])),
        'audio_sha256': sha(audio), 'midi_sha256': sha(midi),
    }
    assert validation['approved_ending_pcm_exact']
    write_json(args.output/'render-report.json', report)
    write_json(args.output/'validation.json', validation)
    write_json(args.output/'score.json', score)
    write_json(args.output/'instruments.json', instruments)
    for name in ('GeneralUser-GS-LICENSE.txt', 'finalize_no_intro.py', 'arrange.py',
                 'arrange_faithful.py', 'arrange_soft.py', 'extract_original.cjs', 'original-make-music.cjs'):
        shutil.copyfile(source_dir/name, args.output/name)

    previous = read_json(source_dir/'selection.json')
    selection = {
        'date': '2026-10-24', 'revision': 4, 'status': 'approved_by_user',
        'track_id': 'citrus-walk', 'playlist_position': 2, 'intro_bars': 0,
        'renderer': 'finalize_no_intro.py', 'approved_source_revision': 3,
        'approved_source_artifact': args.source.as_posix(),
        'audio_path': audio.as_posix(), 'midi_path': midi.as_posix(),
        'report_path': (args.output/'render-report.json').as_posix(),
        'rejected_revision': 1, 'rejected_audio_path': previous.get('rejected_audio_path'),
        'notes': 'User approves revision 3 and requests removal of its entire introduction, immediate original-theme start, unchanged soft instruments/body and retained ending. Trim the approved mastered audio by exactly four bars; only the first 5 ms receive a click-prevention ramp. Shift retained MIDI notes by 16 beats. No further remix or re-render.',
    }
    if args.install:
        game = source_dir.parents[2]
        approved = source_dir/'approved'
        approved.mkdir(exist_ok=True)
        public_audio = game/'public/audio/citrus-walk.wav'
        shutil.copyfile(audio, public_audio)
        shutil.copyfile(source_dir/'GeneralUser-GS-LICENSE.txt', game/'public/audio/citrus-walk-LICENSE.txt')
        selection.update({
            'status': 'approved_by_user_installed_in_game',
            'audio_path': public_audio.as_posix(),
            'midi_path': (approved/'citrus-walk.mid').as_posix(),
            'report_path': (approved/'render-report.json').as_posix(),
            'game_installation': {
                'date': '2026-10-24', 'track_id': 'citrus-walk', 'playlist_position': 2,
                'audio': 'public/audio/citrus-walk.wav',
                'midi': 'design/music/citrus-walk-acoustic/approved/citrus-walk.mid',
                'license': 'public/audio/citrus-walk-LICENSE.txt',
                'sha256': sha(audio), 'duration_seconds': len(pcm)/rate,
                'sample_rate': rate, 'channels': 2, 'bits': 16,
                'cache_revision': 'acoustic-soft-20261024',
                'approved_ending_exactly_preserved': True,
            },
        })
        for name in ('citrus-walk.mid', 'score.json', 'instruments.json', 'render-report.json',
                     'validation.json', 'GeneralUser-GS-LICENSE.txt'):
            shutil.copyfile(args.output/name, approved/name)
        write_json(approved/'selection.json', selection)
        write_json(source_dir/'selection.json', selection)
        assert sha(public_audio) == sha(audio)
    write_json(args.output/'selection.json', selection)
    print(json.dumps({'audio': selection['audio_path'], **validation}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--install', action='store_true')
    main(parser.parse_args())
