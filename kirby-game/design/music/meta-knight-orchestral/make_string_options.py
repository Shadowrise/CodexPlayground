"""Three string-family auditions over the unchanged Meta Knight backing.

Keeps the tune's rhythm and intervals. Only the viola alternative changes
register (one octave down). Audio processing is confined to the lead stem.
"""
import argparse
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import shutil

import numpy as np

import arrange as base
from make_lead_options import excerpt, finish_loop, tone, tracks


OPTIONS = [
    {
        'id': 1, 'slug': 'chamber-strings', 'title': 'Мягкий скрипичный ансамбль',
        'program': 48, 'name': 'Warm bowed string ensemble - lead', 'volume': 112,
        'transpose': 0, 'velocity_scale': .82,
        'eq_freq': [0, 1000, 2200, 3300, 5000, 9000, 22050],
        'eq_db': [0, 0, -2, -4, -5, -6, -6],
        'description': 'Ансамбль смычковых вместо одной близко звучащей скрипки; исходный регистр.',
    },
    {
        'id': 2, 'slug': 'warm-viola', 'title': 'Бархатный альт',
        'program': 41, 'name': 'Warm viola - lead one octave lower', 'volume': 119,
        'transpose': -12, 'velocity_scale': .88,
        'eq_freq': [0, 900, 1800, 2800, 4500, 8000, 22050],
        'eq_db': [0, 0, -1.5, -3, -4, -4.5, -4.5],
        'description': 'Более тёмный сольный смычковый тембр; ведущая партия на октаву ниже.',
    },
    {
        'id': 3, 'slug': 'velvet-solo-violin', 'title': 'Сольная скрипка с мягким смычком',
        'program': 40, 'name': 'Soft bowed solo violin - original register', 'volume': 119,
        'transpose': 0, 'velocity_scale': .72,
        'eq_freq': [0, 1000, 1800, 2800, 4000, 6000, 9000, 22050],
        'eq_db': [0, 0, -1.5, -11, -13, -14, -15, -15],
        'description': 'Исходный скрипичный сэмпл с более мягкой динамикой и сильнее сглаженной верхней серединой; исходный регистр.',
    },
]


def band_rms(audio, low, high):
    """Windowed spectral energy; used to verify the solo's upper-mid reduction."""
    nfft, hop = 4096, 2048
    window = np.hanning(nfft)
    freqs = np.fft.rfftfreq(nfft, 1/base.RATE)
    selected = (freqs >= low) & (freqs < high)
    total, count = 0., 0
    for start in range(0, len(audio)-nfft+1, hop):
        spectrum = np.fft.rfft(audio[start:start+nfft]*window[:, None], axis=0)
        total += float(np.sum(np.abs(spectrum[selected])**2))
        count += 1
    return math.sqrt(total/count)


def replace_lead(option, original_instruments, baseline_notes, baseline_tracks, output, work):
    base.INSTRUMENTS = deepcopy(original_instruments)
    base.INSTRUMENTS[0] = (option['name'], option['program'], option['volume'], 52, 23)
    base.EVENTS = {channel: [] for channel in base.INSTRUMENTS}
    base.build()
    assert base.validate() == 438
    transpose = option['transpose']

    def velocity(value):
        return max(1, min(127, round(value*option['velocity_scale'])))

    for note in base.NOTES:
        if note['channel'] == 0:
            note['midi'] += transpose
            note['velocity'] = velocity(note['velocity'])
    events = []
    for tick, priority, data in base.EVENTS[0]:
        if data[0] & 0xF0 in (0x80, 0x90):
            data = bytes([data[0], data[1]+transpose, velocity(data[2]) if data[2] else 0])
        events.append((tick, priority, data))
    base.EVENTS[0] = events

    assert len(base.NOTES) == len(baseline_notes) == 2585
    for before, after in zip(baseline_notes, base.NOTES):
        expected = dict(before)
        if before['channel'] == 0:
            expected.update(midi=before['midi']+transpose, velocity=velocity(before['velocity']))
        assert after == expected

    full_midi = output/'meta-knight-strings.mid'
    base.midi_file(full_midi)
    candidate_tracks = tracks(full_midi)
    assert candidate_tracks[0] == baseline_tracks[0]
    assert candidate_tracks[2:] == baseline_tracks[2:]
    all_events = base.EVENTS.copy()
    base.EVENTS = {0: all_events[0]}
    stem_midi = work/'lead-three-cycles.mid'
    base.midi_file(stem_midi, cycles=3)
    base.EVENTS = all_events
    return full_midi, stem_midi, len(candidate_tracks)-1


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    base.build()
    assert base.validate() == 438
    original_instruments = deepcopy(base.INSTRUMENTS)
    baseline_notes = deepcopy(base.NOTES)
    baseline_tracks = tracks(args.reference/'meta-knight-orchestral.mid')
    margin = round(.025*base.RATE)+129
    start, stop = base.FRAMES-margin, base.FRAMES*2+margin
    raw = base.float_audio(args.accompaniment)
    accompaniment = raw[start:stop].copy()
    del raw
    raw = base.float_audio(args.violin_reference)
    reference = raw[start:stop].copy()
    # Match overall stem energy to the previous softened violin. This lets
    # the user judge timbre without simply making a candidate much quieter.
    target_rms = float(np.sqrt(np.mean(reference*reference))*10**(-1/20))
    reference_band = band_rms(reference[margin:margin+round(6.6666666667*base.RATE)], 2500, 6500)
    del raw, reference
    manifest = {
        'date': '2026-10-23', 'status': 'string_auditions_no_choice_yet_game_unchanged',
        'bpm': 144, 'lead_notes_replaced': 290, 'total_main_melody_notes': 438,
        'preview_segments_seconds': [[0, 6.6666666667], [93.3333333333, 100]],
        'pause_seconds': .6, 'reference_master_gain': base.REFERENCE_GAIN,
        'accompaniment_source': args.accompaniment.as_posix(),
        'accompaniment_sha256': hashlib.sha256(args.accompaniment.read_bytes()).hexdigest(),
        'options': [],
    }

    for option in OPTIONS:
        print('Rendering '+option['slug']+'...', flush=True)
        output = args.output/f"option-{option['id']}-{option['slug']}"
        work = args.work/option['slug']
        output.mkdir(exist_ok=True)
        work.mkdir(exist_ok=True)
        full_midi, stem_midi, unchanged = replace_lead(
            option, original_instruments, baseline_notes, baseline_tracks, output, work)
        raw_path = base.render(args, stem_midi, work/'lead-float.wav')
        raw = base.float_audio(raw_path)
        lead = tone(raw[start:stop].copy(), option)
        del raw
        lead_gain = float(target_rms/np.sqrt(np.mean(lead*lead)))
        lead *= lead_gain
        lead_rms = base.rms_db(lead[margin:margin+base.FRAMES]*base.REFERENCE_GAIN)
        lead_band = band_rms(lead[margin:margin+round(6.6666666667*base.RATE)], 2500, 6500)
        upper_mid_change = round(20*math.log10(lead_band/reference_band), 2)
        audio, reduction = finish_loop(accompaniment+lead, margin)
        # Store the processed lead before the combined mix's peak control;
        # MIDI cannot encode the FIR EQ and stem-level compensation.
        stem, _ = finish_loop(lead, margin)
        base.write_wav(output/'processed-lead-stem.wav', stem)
        del lead, stem
        full_wav = output/'meta-knight-strings.wav'
        base.write_wav(full_wav, audio)
        demo = np.concatenate([
            excerpt(audio, 0, 6.6666666667), np.zeros((round(.6*base.RATE), 2)),
            excerpt(audio, 93.3333333333, 100),
        ])
        preview = args.output/f"option-{option['id']}.wav"
        base.write_wav(preview, demo)
        entry = {
            **option, 'preview_path': preview.as_posix(), 'audio_path': full_wav.as_posix(),
            'midi_path': full_midi.as_posix(),
            'processed_stem_path': (output/'processed-lead-stem.wav').as_posix(),
            'duration_seconds': len(audio)/base.RATE,
            'preview_duration_seconds': len(demo)/base.RATE,
            'unchanged_midi_tracks': unchanged, 'other_note_events_byte_identical': True,
            'lead_equalization_gain': lead_gain, 'lead_stem_rms_dbfs': lead_rms,
            'opening_2500_6500_hz_change_vs_original_violin_db': upper_mid_change,
            'mix_rms_dbfs': base.rms_db(audio),
            'peak_dbfs': round(20*math.log10(float(np.max(np.abs(audio)))), 2),
            'peak_control_max_db': reduction, 'clipped_samples': 0,
            'audio_sha256': hashlib.sha256(full_wav.read_bytes()).hexdigest(),
        }
        (output/'score.json').write_text(json.dumps(base.NOTES, indent=2)+'\n', encoding='utf8')
        (output/'render-report.json').write_text(json.dumps(entry, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
        manifest['options'].append(entry)
        print(json.dumps({k: entry[k] for k in (
            'id', 'title', 'mix_rms_dbfs', 'lead_stem_rms_dbfs',
            'opening_2500_6500_hz_change_vs_original_violin_db', 'peak_control_max_db')},
            ensure_ascii=False), flush=True)
        del audio, demo

    manifest_path = args.output/'string-options.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    source = Path(__file__).resolve().parent
    selection_path = source/'selection.json'
    selection = json.loads(selection_path.read_text(encoding='utf8'))
    previous_manifest = selection.pop('lead_options_manifest',
                                      selection.get('rejected_non_string_options_manifest'))
    selection.pop('lead_options', None)
    selection.update({
        'revision': 4, 'status': 'auditioning_softer_string_timbres_not_installed',
        'violin_status': 'character_liked_original_timbre_too_piercing',
        'selected_lead_option': None,
        'rejected_non_string_options_manifest': previous_manifest,
        'string_options_manifest': manifest_path.as_posix(),
        'string_options': manifest['options'],
        'notes': 'User rejects flute, clarinet and electric-piano replacements and wants the violin character retained without the piercing quality. Compare bowed ensemble, lower viola and a more strongly softened solo violin. Only channel 0 changes; the viola transposes that part by one octave. Remaining melody notes, accompaniment and master gain stay fixed. These are review variants; no option selected or installed in the game.',
    })
    data = json.dumps(selection, ensure_ascii=False, indent=2)+'\n'
    if selection.get('game_installation') is None:
        selection_path.write_text(data, encoding='utf8')
    (args.output/'selection.json').write_text(data, encoding='utf8')
    for file in ('GeneralUser-GS-LICENSE.txt', 'make_string_options.py', 'make_lead_options.py', 'arrange.py'):
        shutil.copy2(source/file, args.output/file)
    print('String auditions ready: '+str(manifest_path), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('fluidsynth', 'soundfont', 'accompaniment', 'violin-reference', 'reference', 'output', 'work'):
        parser.add_argument('--'+flag, type=Path, required=True)
    main(parser.parse_args())
