"""Add a clearly audible, warm synthesizer chord bed to the chosen arrangement.

The existing finished audio is retained as the acoustic stem. The pad is a
separate additive-synthesis stem, with a GM Warm Pad track for MIDI editing.
"""
import argparse
import json
import math
from pathlib import Path
import wave

import numpy as np

import arrange as music
import assemble_selected as complete
import make_intro_options as intro
import make_ending_options as ending

RATE = music.RATE
START = 28.8
END = 115.2
VOICINGS = {
    'D': [50, 57, 66, 69], 'A': [49, 57, 64, 69], 'Bm': [50, 59, 66, 71],
    'G': [50, 55, 62, 71], 'Em': [52, 59, 64, 67],
}


def read_pcm(path):
    with wave.open(str(path), 'rb') as audio:
        assert audio.getframerate() == RATE and audio.getnchannels() == 2 and audio.getsampwidth() == 2
        return np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').astype(np.float64).reshape(-1, 2) / 32768


def pad_score():
    harmony = []
    for bar in range(12, 48):
        chord = ending.OPTIONS[1]['chords'][bar - 44] if bar >= 44 else music.section_and_chord(bar)[1]
        harmony.append({'bar': bar, 'chord': chord, 'notes': VOICINGS[chord]})
    voices = []
    for voice in range(4):
        active = None
        for item in harmony:
            pitch, start = item['notes'][voice], item['bar'] * 4 * music.BEAT
            stop = (item['bar'] + 1) * 4 * music.BEAT
            assert pitch % 12 in {p % 12 for p in music.HARMONY[item['chord']][1]}
            if active is not None and active['midi'] == pitch:
                active['end_seconds'] = stop
            else:
                active = {'voice': voice, 'midi': pitch, 'start_seconds': start, 'end_seconds': stop}
                voices.append(active)
    return harmony, voices


def ducking(notes, frames):
    step = .01
    blocks = math.ceil(frames / (step * RATE))
    changes = np.zeros(blocks + 1, dtype=np.int32)
    for n in notes:
        if n['channel'] not in (0, 3, 7, 8):
            continue
        start = max(0, int(n['beat'] * music.BEAT / step))
        stop = min(blocks, math.ceil((n['beat'] + n['duration_beats']) * music.BEAT / step))
        if start < stop:
            changes[start] += 1
            changes[stop] -= 1
    active = np.cumsum(changes[:-1]) > 0
    target = np.where(active, .94, 1.)
    values = np.ones(blocks)
    gain = 1.
    for i, requested in enumerate(target):
        rate = 1 - math.exp(-step / (.045 if requested < gain else .25))
        gain += (requested - gain) * rate
        values[i] = gain
    return np.interp(np.arange(frames) / (step * RATE), np.arange(blocks), values)


def synthesize(voices, notes, frames):
    pad = np.zeros((frames, 2), dtype=np.float64)
    # Open four-note voicings carry their audible colour in the middle register,
    # rather than hiding all three fundamentals under the bass/guitar.
    weights = [.35, .48, .76, .72]
    positions = [-.26, .32, -.44, .44]
    for n in voices:
        start = round(n['start_seconds'] * RATE)
        stop = min(frames, round(n['end_seconds'] * RATE))
        duration = (stop - start) / RATE
        t = np.arange(stop-start) / RATE
        global_t = t + start / RATE
        f = 440 * 2 ** ((n['midi'] - 69) / 12)
        phase = 2 * math.pi * f * global_t + n['voice'] * .71
        # A rounded, filtered oscillator: no pitch detuning or inharmonic partials.
        brightness = .90 + .10 * np.sin(2 * math.pi * .071 * global_t + n['voice'])
        tone = np.sin(phase)
        for harmonic, strength, phase_offset in [(2,.32,.2),(3,.13,-.12),(4,.06,.3),(5,.025,-.3)]:
            lowpass = 1 / math.sqrt(1 + (harmonic*f/1500)**4)
            tone += brightness * strength * lowpass * np.sin(harmonic*phase+phase_offset)
        attack, release = min(.18, duration*.10), min(.23, duration*.10)
        envelope = np.ones(len(t))
        attack_frames, release_frames = round(attack*RATE), round(release*RATE)
        envelope[:attack_frames] = np.sin(np.linspace(0, math.pi/2, attack_frames))**2
        envelope[-release_frames:] = np.cos(np.linspace(0, math.pi/2, release_frames))**2
        tone *= envelope * weights[n['voice']] * (.97 + .03*np.sin(2*math.pi*.113*global_t+n['voice']))
        pan = positions[n['voice']] + .045*np.sin(2*math.pi*.047*global_t + n['voice'])
        pad[start:stop, 0] += tone * np.sqrt((1-pan)/2)
        pad[start:stop, 1] += tone * np.sqrt((1+pan)/2)

    steady = pad[round(30*RATE):round(105*RATE)]
    raw_rms = float(np.sqrt(np.mean(steady*steady)))
    pad *= 10 ** (-21.0 / 20) / raw_rms
    times = np.arange(frames) / RATE
    # The pad stays prominent while piano comping fades from 1:36, then
    # hands over to the selected coda. Its energy stays level until the coda.
    expression = np.interp(times,
        [0, 28.8, 29.05, 47.4, 48.4, 66.6, 67.8, 85.8, 87, 95.85, 96.25, 105.6, 106.2, 110.4, 115.2, 118.4],
        [0, 0, 1, 1, .95, .95, 1.05, 1.05, .78, .78, 1.65, 1.65, .8, .55, 0, 0])
    pad *= (expression * ducking(notes, frames))[:, None]
    assert np.isfinite(pad).all()
    return pad


def export_midi(args, voices, reference_notes):
    complete.selected_base()
    complete.add_energy()
    assert music.NOTES == reference_notes, 'All existing arrangement notes must match.'
    intro.setup_instrument(11, {'name': 'Warm sustained synthesizer pad', 'program': 89,
                               'volume': 85, 'pan': 64, 'reverb': 22})
    music.RNG.seed(2026102128)
    for n in voices:
        music.note(11, n['midi'], n['start_seconds']/music.BEAT,
                   (n['end_seconds']-n['start_seconds'])/music.BEAT, 61, jitter=0)
    for seconds, expression in [(28.8, 0), (29.05, 106), (48, 101), (67.2, 111),
                                (86.4, 84), (96, 127), (105.6, 85), (110.4, 58), (115.2, 0)]:
        music.control(11, seconds/music.BEAT, 11, expression)
    music.control(11, 96/music.BEAT, 7, 100)
    music.control(11, 105.6/music.BEAT, 7, 85)
    assert music.NOTES[:len(reference_notes)] == reference_notes
    music.control(11, 193, 123, 0)
    music.midi_file(args.output / 'meadow-day-with-pad.mid')
    (args.output / 'score.json').write_text(json.dumps(music.NOTES, indent=2)+'\n', encoding='utf8')


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    base = read_pcm(args.base_artifact / 'meadow-day-complete.wav')
    notes = json.loads((args.base_artifact / 'score.json').read_text())
    harmony, voices = pad_score()
    pad = synthesize(voices, notes, len(base))
    mix, reduction = complete.limit_transients(base + pad)
    assert np.array_equal(mix[:round(START*RATE)], base[:round(START*RATE)])
    complete.write_wav(args.output / 'meadow-day-with-pad.wav', mix)
    complete.write_wav(args.output / 'warm-pad-stem.wav', pad)
    excerpt = mix[round(24*RATE):round(43.2*RATE)].copy()
    fade = round(.06*RATE)
    excerpt[:fade] *= np.linspace(0,1,fade)[:,None]
    fade = round(.25*RATE)
    excerpt[-fade:] *= np.linspace(1,0,fade)[:,None]
    complete.write_wav(args.output / 'pad-entry-preview.wav', excerpt)
    export_midi(args, voices, notes)
    report = {
        'title': 'День на поляне — тёплый синтезаторный пэд',
        'baseline_revision': 3, 'selected_intro': 3, 'selected_ending': 2,
        'main_melody_and_existing_instruments_preserved': True,
        'existing_notes_verified': len(notes), 'pad_start_seconds': START,
        'pad_end_seconds': END, 'duration_seconds': len(base)/RATE,
        'pad_voice_notes': len(voices), 'pad_revision': 3,
        'featured_pad_section_seconds': [96.0, 105.6],
        'featured_pad_gain_increase_db': round(20*math.log10(1.65/.78),2),
        'featured_pad_rms_dbfs': complete.rms_db(pad[round(96.3*RATE):round(105.6*RATE)]),
        'pad_character': 'Clearly audible warm synth chord bed, open four-note voicings, richer midrange, no detuning',
        'ducking_during_lead_db': round(20*math.log10(.94),2),
        'pad_active_rms_dbfs': complete.rms_db(pad[round(30*RATE):round(105*RATE)]),
        'mix_rms_dbfs': complete.rms_db(mix),
        'peak_dbfs': round(20*math.log10(float(np.max(np.abs(mix)))),2),
        'additional_peak_control_max_db': reduction, 'clipped_samples': 0,
        'audio_before_28_8_seconds_preserved': True,
        'midi_pad_preset': 'GM Pad 2 (Warm), program 89; approximate editing timbre',
        'exact_pad_audio_stem': 'warm-pad-stem.wav',
    }
    (args.output / 'pad-score.json').write_text(json.dumps({'harmony':harmony,'voices':voices},indent=2)+'\n', encoding='utf8')
    (args.output / 'render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n', encoding='utf8')
    print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-artifact',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    main(parser.parse_args())
