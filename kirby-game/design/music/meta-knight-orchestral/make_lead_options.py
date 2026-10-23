"""Audition three non-violin lead sounds over the unchanged orchestral backing."""
import argparse
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct

import numpy as np

import arrange as base

OPTIONS = [
    {'id': 1, 'slug': 'flute', 'title': 'Мягкая флейта', 'program': 73,
     'name': 'Warm flute - replacement lead', 'volume': 80,
     'transpose': 0, 'velocity_scale': .86,
     'eq_freq': [0, 1400, 2800, 5000, 8000, 22050], 'eq_db': [0, 0, -.5, -2, -3, -3],
     'description': 'Воздушный духовой тембр, исходный регистр мелодии.'},
    {'id': 2, 'slug': 'clarinet', 'title': 'Тёплый кларнет', 'program': 71,
     'name': 'Warm clarinet - replacement lead', 'volume': 100,
     'transpose': -12, 'velocity_scale': .78,
     'eq_freq': [0, 1000, 1800, 3000, 5000, 22050], 'eq_db': [0, 0, -1, -2, -3.5, -3.5],
     'description': 'Более низкий и округлый духовой звук; партия скрипки на октаву ниже.'},
    {'id': 3, 'slug': 'electric-piano', 'title': 'Тёплое электропиано', 'program': 4,
     'name': 'Warm electric piano - replacement lead', 'volume': 110,
     'transpose': 0, 'velocity_scale': .67,
     'eq_freq': [0, 1800, 3000, 5000, 8000, 22050], 'eq_db': [0, 0, -1, -3, -5, -5],
     'description': 'Округлый клавишный тембр с мягким ударом, исходный регистр мелодии.'},
]


def tracks(path):
    raw = path.read_bytes()
    cursor = 8+struct.unpack_from('>I', raw, 4)[0]
    result = []
    while cursor < len(raw):
        assert raw[cursor:cursor+4] == b'MTrk'
        end = cursor+8+struct.unpack_from('>I', raw, cursor+4)[0]
        result.append(raw[cursor:end])
        cursor = end
    return result


def tone(audio, option):
    fft_size, taps = 2048, 129
    response = 10**(np.interp(np.fft.rfftfreq(fft_size, 1/base.RATE),
                             option['eq_freq'], option['eq_db'])/20)
    impulse = np.fft.fftshift(np.fft.irfft(response, n=fft_size))
    middle = fft_size//2
    kernel = impulse[middle-taps//2:middle+taps//2+1]*np.kaiser(taps, 6)
    kernel /= kernel.sum()
    result = np.empty_like(audio)
    for channel in range(2):
        result[:, channel] = np.convolve(audio[:, channel], kernel, mode='same')
    return result


def excerpt(audio, start, stop):
    result = audio[round(start*base.RATE):round(stop*base.RATE)].copy()
    fade = round(.025*base.RATE)
    result[:fade] *= np.linspace(0, 1, fade)[:, None]
    result[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return result


def finish_loop(mixed, margin):
    audio = mixed[margin:margin+base.FRAMES].copy()
    seam = round(.025*base.RATE)
    weight = np.sin(np.linspace(0, math.pi/2, seam))**2
    audio[-seam:] = audio[-seam:]*(1-weight[:,None])+mixed[margin-seam:margin]*weight[:,None]
    tiled, reduction = base.limit(np.tile(audio*base.REFERENCE_GAIN, (3,1)))
    audio = tiled[base.FRAMES:2*base.FRAMES].copy()
    difference = audio[0]-audio[-1]
    if np.max(np.abs(difference)) > .025:
        audio[-seam:] += difference*np.linspace(0,1,seam)[:,None]
    assert np.isfinite(audio).all() and np.max(np.abs(audio)) < .8
    return audio, reduction


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    base.build()
    assert base.validate() == 438
    original_instruments = deepcopy(base.INSTRUMENTS)
    baseline_notes = deepcopy(base.NOTES)
    baseline_tracks = tracks(args.reference/'meta-knight-orchestral.mid')
    seam = round(.025*base.RATE)
    margin = seam+129
    start = base.FRAMES-margin
    stop = base.FRAMES*2+margin
    raw = base.float_audio(args.accompaniment)
    accompaniment = raw[start:stop].copy()
    del raw
    raw = base.float_audio(args.violin_reference)
    reference = raw[start:stop].copy()
    # Match the overall lead level of the softer violin version, not its harsh
    # high-frequency energy. Each candidate keeps the same backing and gain.
    target_rms = np.sqrt(np.mean(reference*reference))*10**(-1/20)
    del raw, reference
    manifest = {
        'date': '2026-10-23', 'status': 'auditions_no_choice_yet_game_unchanged',
        'bpm': 144, 'lead_notes_replaced': 290, 'total_main_melody_notes': 438,
        'preview_segments_seconds': [[0, 6.6666666667], [93.3333333333, 100]],
        'pause_seconds': .6, 'reference_master_gain': base.REFERENCE_GAIN,
        'accompaniment_source': str(args.accompaniment),
        'accompaniment_sha256': hashlib.sha256(args.accompaniment.read_bytes()).hexdigest(),
        'options': [],
    }

    for option in OPTIONS:
        print('Rendering '+option['slug']+' lead...', flush=True)
        output = args.output/f"option-{option['id']}-{option['slug']}"
        work = args.work/option['slug']
        output.mkdir(exist_ok=True)
        work.mkdir(exist_ok=True)
        base.INSTRUMENTS = deepcopy(original_instruments)
        base.INSTRUMENTS[0] = (option['name'], option['program'], option['volume'], 52, 23)
        base.EVENTS = {channel: [] for channel in base.INSTRUMENTS}
        base.build()
        assert base.validate() == 438
        transpose = option['transpose']
        velocity = lambda v: max(1, min(127, round(v*option['velocity_scale'])))
        for n in base.NOTES:
            if n['channel'] == 0:
                n['midi'] += transpose
                n['velocity'] = velocity(n['velocity'])
        events = []
        for tick, priority, data in base.EVENTS[0]:
            if data[0] & 0xF0 in (0x80, 0x90):
                data = bytes([data[0], data[1]+transpose, velocity(data[2]) if data[2] else 0])
            events.append((tick, priority, data))
        base.EVENTS[0] = events
        for before, after in zip(baseline_notes, base.NOTES):
            expected = dict(before)
            if before['channel'] == 0:
                expected.update(midi=before['midi']+transpose, velocity=velocity(before['velocity']))
            assert after == expected
        assert len(base.NOTES) == len(baseline_notes) == 2585
        full_midi = output/'meta-knight-lead.mid'
        base.midi_file(full_midi)
        candidate_tracks = tracks(full_midi)
        assert candidate_tracks[0] == baseline_tracks[0]
        assert candidate_tracks[2:] == baseline_tracks[2:]

        original_events = base.EVENTS.copy()
        base.EVENTS = {0: original_events[0]}
        stem_midi = work/'lead-three-cycles.mid'
        base.midi_file(stem_midi, cycles=3)
        base.EVENTS = original_events
        raw_path = base.render(args, stem_midi, work/'lead-float.wav')
        raw = base.float_audio(raw_path)
        lead = raw[start:stop].copy()
        del raw
        lead = tone(lead, option)
        lead_gain = float(target_rms/np.sqrt(np.mean(lead*lead)))
        lead *= lead_gain
        lead_rms = base.rms_db(lead[margin:margin+base.FRAMES]*base.REFERENCE_GAIN)
        mixed = accompaniment+lead
        del lead
        audio, reduction = finish_loop(mixed, margin)
        del mixed
        full_wav = output/'meta-knight-lead.wav'
        base.write_wav(full_wav, audio)
        demo = np.concatenate([
            excerpt(audio, 0, 6.6666666667), np.zeros((round(.6*base.RATE),2)),
            excerpt(audio, 93.3333333333, 100),
        ])
        preview = args.output/f"option-{option['id']}.wav"
        base.write_wav(preview, demo)
        entry = {
            **{k:v for k,v in option.items() if k not in ('eq_freq','eq_db')},
            'preview_path': preview.as_posix(), 'audio_path': full_wav.as_posix(),
            'midi_path': full_midi.as_posix(), 'duration_seconds': len(audio)/base.RATE,
            'preview_duration_seconds': len(demo)/base.RATE,
            'unchanged_midi_tracks': len(candidate_tracks)-1,
            'other_note_events_byte_identical': True,
            'lead_equalization_gain': lead_gain, 'lead_stem_rms_dbfs': lead_rms,
            'mix_rms_dbfs': base.rms_db(audio),
            'peak_dbfs': round(20*math.log10(float(np.max(np.abs(audio)))),2),
            'peak_control_max_db': reduction, 'clipped_samples': 0,
            'audio_sha256': hashlib.sha256(full_wav.read_bytes()).hexdigest(),
        }
        (output/'score.json').write_text(json.dumps(base.NOTES,indent=2)+'\n',encoding='utf8')
        (output/'render-report.json').write_text(json.dumps(entry,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        manifest['options'].append(entry)
        print(json.dumps({k:entry[k] for k in ('id','title','mix_rms_dbfs','lead_stem_rms_dbfs','peak_control_max_db')},
                         ensure_ascii=False), flush=True)
        del audio, demo

    manifest_path = args.output/'lead-options.json'
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    source = Path(__file__).resolve().parent
    selection_path = source/'selection.json'
    selection = json.loads(selection_path.read_text(encoding='utf8'))
    selection.update({
        'revision': 3, 'status': 'auditioning_replacement_leads_not_installed',
        'violin_status': 'rejected_even_after_softening', 'selected_lead_option': None,
        'rejected_audio_path': selection.pop('audio_path', selection.get('rejected_audio_path')),
        'reference_midi_path': selection.pop('midi_path', selection.get('reference_midi_path')),
        'lead_options_manifest': manifest_path.as_posix(),
        'lead_options': manifest['options'],
        'notes': 'User rejects the violin timbre even after softening. Audition flute, lower clarinet and warm electric piano on the 290 formerly violin-led notes. Keep the approved orchestral backing, main tune intervals/rhythm and master gain. Clarinet is explicitly one octave lower; the other variants retain exact original pitches. Game audio remains unchanged.',
    })
    selection.pop('violin_stem_path', None)
    selection.pop('violin_softening', None)
    data = json.dumps(selection,ensure_ascii=False,indent=2)+'\n'
    if selection.get('game_installation') is None:
        selection_path.write_text(data,encoding='utf8')
    (args.output/'selection.json').write_text(data,encoding='utf8')
    shutil.copy2(source/'GeneralUser-GS-LICENSE.txt', args.output/'GeneralUser-GS-LICENSE.txt')
    shutil.copy2(Path(__file__), args.output/'make_lead_options.py')
    print('Three matched lead auditions ready: '+str(manifest_path), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('fluidsynth','soundfont','accompaniment','violin-reference','reference','output','work'):
        parser.add_argument('--'+flag, type=Path, required=True)
    main(parser.parse_args())
