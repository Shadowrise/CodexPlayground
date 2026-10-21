"""Chosen arrangement with sparse drums and piano fading under the pad from 1:36."""
import argparse
from copy import deepcopy
import json
import math
from pathlib import Path
import wave

import numpy as np

import arrange as music
import make_intro_options as intro
import make_ending_options as ending

RATE = music.RATE
ENERGY_FIRST = 36 * 4
PIANO_LEAD_END = 40 * 4
ENERGY_END = 44 * 4
SECONDS = 118.4
LIGHT_BEAT_FIRST = 20 * 4
LIGHT_BEAT_END = 28 * 4
PIANO_RIGHT = {
    'D': [57, 62, 66], 'A': [57, 61, 64], 'Bm': [54, 59, 62],
    'G': [55, 59, 62], 'Em': [55, 59, 64],
}


def selected_base():
    music.MELODY = deepcopy(music.ORIGINAL_MELODY)
    music.CORRECTIONS = []
    music.build_score()
    music.validate_score()
    ending.selected_intro()
    music.NOTES = [n for n in music.NOTES if n['beat'] < ending.CODA_BEAT]
    music.EVENTS = {ch: [e for e in events if e[0] < ending.CODA_BEAT * music.PPQ]
                    for ch, events in music.EVENTS.items()}
    intro.setup_instrument(7, {'name': 'Ending - solo nylon guitar', 'program': 24,
                              'volume': 107, 'pan': 58, 'reverb': 19})
    intro.setup_instrument(8, {'name': 'Piano - bright melody and ending', 'program': 0,
                              'volume': 82, 'pan': 70, 'reverb': 16})
    option = ending.OPTIONS[1]
    music.RNG.seed(20261102)
    music.control(0, ending.CODA_BEAT, 11, 101)
    ending.backing(option)
    for local_bar, (channel, phrase) in enumerate(option['phrases']):
        for beat, pitch, duration in phrase:
            ending.add_note(channel, pitch, local_bar, beat, duration, 70, option['chords'])
    for channel, bar, beat, pitch, duration, velocity in option.get('extra', []):
        ending.add_note(channel, pitch, bar, beat, duration, velocity, option['chords'])
    for channel in music.INSTRUMENTS:
        music.control(channel, music.BARS * 4, 64, 0)
        music.control(channel, music.BARS * 4 + 3, 123, 0)


def in_section(beat):
    return ENERGY_FIRST <= beat < ENERGY_END


def energetic_note(channel, pitch, bar, beat, duration, velocity):
    _, chord = music.section_and_chord(bar)
    assert pitch % 12 in {n % 12 for n in music.HARMONY[chord][1]}
    assert beat + duration + .05 < 4
    music.note(channel, pitch, bar * 4 + beat + .02, duration, velocity, jitter=.007)


def add_energy():
    # Move the existing tune, with its exact pitches and timing, to the piano
    # for four bars. Controllers on the flute remain ready for its return.
    transferred = 0
    for n in music.NOTES:
        if n['channel'] == 0 and ENERGY_FIRST <= n['beat'] < PIANO_LEAD_END:
            n['channel'] = 8
            n['velocity'] = min(127, n['velocity'] + 4)
            transferred += 1
    flute_events = []
    for tick, priority, data in music.EVENTS[0]:
        if ENERGY_FIRST * music.PPQ <= tick < PIANO_LEAD_END * music.PPQ and data[0] & 0xF0 in (0x80, 0x90):
            status = (data[0] & 0xF0) + 8
            velocity = min(127, data[2] + 4) if status == 0x98 and data[2] else data[2]
            music.EVENTS[8].append((tick, priority, bytes([status, data[1], velocity])))
        else:
            flute_events.append((tick, priority, data))
    music.EVENTS[0] = flute_events
    music.control(8, ENERGY_FIRST, 7, 106)
    music.control(8, ENERGY_END, 7, 82)

    # Replace the light arpeggio and the occasional quiet piano answers only in
    # the new section. Bass, lead melody and the chosen ending stay intact.
    music.NOTES = [n for n in music.NOTES if not (n['channel'] in (1, 4) and in_section(n['beat']))]
    for channel in (1, 4):
        music.EVENTS[channel] = [e for e in music.EVENTS[channel]
                                 if not (ENERGY_FIRST * music.PPQ <= e[0] < ENERGY_END * music.PPQ
                                         and e[2][0] & 0xF0 in (0x80, 0x90))]
    intro.setup_instrument(10, {'name': 'Piano - rhythmic left and right hand', 'program': 0,
                               'volume': 76, 'pan': 63, 'reverb': 16})
    music.RNG.seed(202610216)
    # Keep the last two bars at full playing strength. The former .90/.68
    # taper made the passage sound as though its volume fader was pulled down.
    levels = [.82, .95, 1.00, 1.04, 1.06, 1.10, 1.06, 1.04]
    for bar in range(36, 44):
        _, chord = music.section_and_chord(bar)
        root, shape = music.HARMONY[chord]
        level = levels[bar - 36]
        guitar_attacks = [(0, .55, 66), (.75, .45, 58), (1.5, .48, 62),
                          (2.5, .50, 65), (3.25, .38, 59)]
        if bar == 43:
            guitar_attacks = guitar_attacks[:-1]
        for attack, (beat, duration, velocity) in enumerate(guitar_attacks):
            voicing = shape if beat == 0 else shape[1:]
            if attack % 2:
                voicing = list(reversed(voicing))
            for i, pitch in enumerate(voicing):
                energetic_note(1, pitch, bar, beat + i * .014, duration,
                               round((velocity - i * 2) * level))

        left = root + 12
        if left < 43:
            left += 12
        # Sustain only the harmonic comping, not the original melody's passing
        # notes; release well before every chord change.
        music.control(10, bar * 4 + .10, 64, 100)
        music.control(10, bar * 4 + (3.20 if bar == 43 else 3.78), 64, 0)
        for beat, pitch in [(0, left), (2, left + 7)]:
            energetic_note(10, pitch, bar, beat, .33, round(69 * level))
        piano_beats = [.5, 1.5, 2.5] if bar == 43 else [.5, 1.5, 2.5, 3.5]
        for beat in piano_beats:
            for i, pitch in enumerate(PIANO_RIGHT[chord]):
                energetic_note(10, pitch, bar, beat + i * .008, .27,
                               round((73 + (4 if beat in (1.5, 3.5) else 0) - i * 2) * level))
        # A few upper accents bind the rhythmic piano to the guitar, without
        # quoting the alternative third ending's melody.
        if bar in (37, 39, 41):
            energetic_note(10, PIANO_RIGHT[chord][-1] + 12, bar, 3.5, .25, round(60 * level))
    music.control(10, ENERGY_END, 64, 0)
    music.control(10, ENERGY_END + .5, 123, 0)
    # Continue the complete chord part instead of cutting it at 1:36.
    # Its piano and doubled guitar fade while the pad carries the harmony.
    fade_chord_backing()
    add_drum_groove()
    return transferred


def piano_channels():
    # Channel 10 (zero-based 9) is the drum kit even though its program is 0.
    return {channel for channel, inst in music.INSTRUMENTS.items()
            if channel != 9 and 0 <= inst['program'] <= 7}


def fade_chord_backing():
    # Give the later guitar chords their own expression channel so the
    # selected coda can keep its original accompaniment and dynamics.
    instrument = deepcopy(music.INSTRUMENTS[1])
    instrument['name'] = 'Nylon guitar - fading energetic chords'
    intro.setup_instrument(12, instrument)
    for n in music.NOTES:
        if n['channel'] == 1 and PIANO_LEAD_END <= n['beat'] < ENERGY_END:
            n['channel'] = 12
    guitar_events = []
    for tick, priority, data in music.EVENTS[1]:
        if (PIANO_LEAD_END * music.PPQ <= tick < ENERGY_END * music.PPQ
                and data[0] & 0xF0 in (0x80, 0x90)):
            music.EVENTS[12].append((tick, priority, bytes([(data[0] & 0xF0) + 12, *data[1:]])))
        else:
            guitar_events.append((tick, priority, data))
    music.EVENTS[1] = guitar_events
    # FluidSynth's conventional MIDI expression curve is approximately
    # squared in amplitude. This gives a gentle 12-dB retreat over four bars.
    previous = None
    for step in range(161):
        progress = step / 160
        expression = round(106 * 10 ** (-12 * progress / 40))
        if expression != previous:
            for channel in (10, 12):
                music.control(channel, PIANO_LEAD_END + (ENERGY_END-PIANO_LEAD_END)*progress,
                              11, expression)
            previous = expression
    music.control(12, ENERGY_END + 3, 123, 0)


def add_drum_groove():
    # MIDI channel 10 is the General MIDI acoustic drum kit. Keep a dry,
    # clearly audible kick/backbeat and light eighth-note closed hi-hats.
    intro.setup_instrument(9, {'name': 'Acoustic drums - energetic groove', 'program': 0,
                              'volume': 90, 'pan': 64, 'reverb': 8})
    music.RNG.seed(202610219)
    for bar in range(36, 44):
        hits = [(0, 36, 68), (2, 36, 64), (1, 38, 59), (3, 38, 62)]
        if bar in (37, 39, 41):
            hits.append((2.75, 36, 51))
        hats = range(7) if bar == 43 else range(8)
        for eighth in hats:
            hits.append((eighth / 2, 42, 44 if eighth % 2 == 0 else 36))
        if bar == 43:
            # A small snare/tom pickup hands over to the chosen ending; no
            # volume automation or multi-bar diminuendo precedes it.
            hits.extend([(3.25, 38, 42), (3.5, 47, 55), (3.75, 45, 59)])
        for beat, pitch, velocity in sorted(hits):
            music.note(9, pitch, bar * 4 + beat + .012, .10, velocity, jitter=.005)
    music.control(9, ENERGY_END + .4, 123, 0)
    # Keep the approved kick/cross-stick hits in the middle passage. Generate
    # the previous pattern before dropping the shaker, so the seeded timing
    # and velocities of every remaining drum hit stay exactly the same.
    music.RNG.seed(2026102148)
    for bar in range(20, 28):
        hits = [(0, 36, 48), (2.5, 36, 39), (1, 37, 40), (3, 37, 42)]
        for eighth in range(8):
            hits.append((eighth / 2, 82, 38 if eighth % 2 == 0 else 30))
        for beat, pitch, velocity in sorted(hits):
            music.note(9, pitch, bar * 4 + beat + .012, .10, velocity, jitter=.005)
    music.NOTES = [n for n in music.NOTES if not (n['channel'] == 9 and n['midi'] == 82)]
    music.EVENTS[9] = [e for e in music.EVENTS[9]
                       if not (e[2][0] & 0xF0 in (0x80, 0x90) and e[2][1] == 82)]
    music.control(9, LIGHT_BEAT_END + .4, 123, 0)


def write_wav(path, audio):
    assert np.isfinite(audio).all() and np.max(np.abs(audio)) < .99
    rng = np.random.default_rng(391)
    dither = (rng.random(audio.shape) - rng.random(audio.shape)) / 65536
    pcm = np.rint((audio + dither) * 32767).astype('<i2')
    assert not np.any(np.abs(pcm.astype(np.int32)) >= 32767)
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())


def rms_db(audio):
    return round(20 * math.log10(max(1e-12, float(np.sqrt(np.mean(audio * audio))))), 2)


def limit_transients(audio, ceiling=.79):
    """Stereo-linked, 5-ms look-ahead gain limiting with an 80-ms release.

    Retains the established body level; gain changes only around new peaks.
    The shared gain envelope avoids clipping or stereo-image changes.
    """
    block = round(.005 * RATE)
    count = math.ceil(len(audio) / block)
    peaks = np.pad(np.max(np.abs(audio), axis=1), (0, count * block - len(audio)))
    peaks = peaks.reshape(count, block).max(axis=1)
    required = np.minimum(1, ceiling / np.maximum(peaks, 1e-12))
    boundaries = np.ones(count + 1)
    boundaries[:-1] = required
    boundaries[1:] = np.minimum(boundaries[1:], required)
    release = 1 - math.exp(-(block / RATE) / .080)
    for i in range(1, len(boundaries)):
        boundaries[i] = min(boundaries[i], boundaries[i-1] + (1-boundaries[i-1]) * release)
    envelope = np.interp(np.arange(len(audio)) / block, np.arange(len(boundaries)), boundaries)
    limited = audio * envelope[:, None]
    assert np.max(np.abs(limited)) <= ceiling + 1e-8
    return limited, round(-20 * math.log10(float(envelope.min())), 2)


def main(args):
    args.output.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)
    selected_base()
    expected = json.loads((args.selected_ending / 'ending-2-score.json').read_text())
    assert music.NOTES == expected, 'Reproduce chosen intro 3 and ending 2 exactly.'
    baseline_events = deepcopy(music.EVENTS)
    baseline_lead = [deepcopy(n) for n in music.NOTES if n['channel'] in (0, 3) and 16 <= n['beat'] < 176]
    transferred = add_energy()
    actual_lead = [n for n in music.NOTES if n['channel'] in (0, 3, 8) and 16 <= n['beat'] < 176]
    assert len(actual_lead) == len(baseline_lead)
    for a, b in zip(baseline_lead, actual_lead):
        assert a['midi'] == b['midi'] and a['beat'] == b['beat'] and a['duration_beats'] == b['duration_beats']
    assert [n for n in music.NOTES if n['beat'] < ENERGY_FIRST and n['channel'] != 9] == [n for n in expected if n['beat'] < ENERGY_FIRST]
    assert [n for n in music.NOTES if n['beat'] >= ENERGY_END] == [n for n in expected if n['beat'] >= ENERGY_END]
    for channel, events in baseline_events.items():
        for first, last in [(0, ENERGY_FIRST * music.PPQ), (ENERGY_END * music.PPQ, 9999999)]:
            actual = [e for e in music.EVENTS[channel] if first <= e[0] < last]
            original = [e for e in events if first <= e[0] < last]
            # CC7 restores the original piano level exactly at the coda boundary.
            if channel == 8 and first == ENERGY_END * music.PPQ:
                actual = [e for e in actual if not (e[0] == first and e[2] == bytes([0xB8, 7, 82]))]
            assert actual == original

    midi = args.output / 'meadow-day-complete.mid'
    music.midi_file(midi)
    raw = args.work / 'meadow-day-complete-float.wav'
    music.render(args, midi, raw)
    audio = intro.float_audio(raw)[:round(SECONDS * RATE)]
    assert any(n['channel'] == 10 and PIANO_LEAD_END <= n['beat'] < ENERGY_END for n in music.NOTES)
    fade = round(.008 * RATE)
    audio[:fade] *= np.linspace(0, 1, fade)[:, None]
    fade = round(1.3 * RATE)
    audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
    reference = json.loads((args.selected_ending / 'ending-options.json').read_text(encoding='utf8'))
    gain = reference['common_gain']
    audio, reduction = limit_transients(audio * gain)
    output = args.output / 'meadow-day-complete.wav'
    write_wav(output, audio)
    excerpt = audio[round(84 * RATE):round(108 * RATE)].copy()
    fade = round(.035 * RATE)
    excerpt[:fade] *= np.linspace(0, 1, fade)[:, None]
    fade = round(.25 * RATE)
    excerpt[-fade:] *= np.linspace(1, 0, fade)[:, None]
    write_wav(args.output / 'piano-guitar-section.wav', excerpt)
    report = {
        'title': 'День на поляне — полная акустическая аранжировка',
        'baseline_revision': 3, 'selected_intro': 3, 'selected_ending': 2,
        'duration_seconds': len(audio) / RATE, 'sample_rate': RATE, 'channels': 2, 'bits': 16,
        'main_melody_pitch_and_rhythm_edits': 0,
        'main_melody_notes_verified': len(actual_lead), 'notes_transferred_to_piano': transferred,
        'intro_and_selected_ending_preserved': True,
        'piano_guitar_section_seconds': [86.4, 105.6], 'piano_lead_seconds': [86.4, 96.0],
        'flute_returns_seconds': 96.0, 'energy_revision': 5,
        'piano_fade_seconds': [96.0, 105.6],
        'piano_fade_target_db': -12,
        'piano_expression_start_end': [106, 53],
        'piano_notes_after_96': sum(n['channel'] == 10 and n['beat'] >= PIANO_LEAD_END for n in music.NOTES),
        'piano_channels': sorted(piano_channels()),
        'piano_and_guitar_tails_preserved': True,
        'rhythmic_guitar_fades_with_piano': True,
        'chord_backing_after_96': 'Prominent sustained pad plus gradually fading piano and guitar',
        'featured_pad_section_seconds': [96.0, 105.6],
        'piano_chord_volume_cc7': 76, 'previous_piano_chord_volume_cc7': 96,
        'drum_groove_seconds': [86.4, 105.6],
        'drum_hits': sum(n['channel'] == 9 for n in music.NOTES),
        'light_drum_groove_seconds': [48.0, 67.2],
        'light_drum_hits': sum(n['channel'] == 9 and n['beat'] < ENERGY_FIRST for n in music.NOTES),
        'light_drum_revision': 2,
        'light_drum_character': 'Sparse individual soft kick and cross-stick hits; shaker removed',
        'energy_end_volume_fade': False,
        'peak_dbfs': round(20 * math.log10(float(np.max(np.abs(audio)))), 2),
        'established_reference_gain_retained': gain,
        'maximum_transient_gain_reduction_db': reduction,
        'rms_dbfs': rms_db(audio), 'clipped_samples': 0,
        'body_67_86_rms_dbfs': rms_db(audio[round(67.2*RATE):round(86.4*RATE)]),
        'piano_lead_rms_dbfs': rms_db(audio[round(86.4*RATE):round(96*RATE)]),
        'flute_energy_rms_dbfs': rms_db(audio[round(96*RATE):round(100.8*RATE)]),
        'energy_last_two_bars_rms_dbfs': rms_db(audio[round(100.8*RATE):round(105.6*RATE)]),
        'coda_rms_dbfs': rms_db(audio[round(105.6*RATE):round(115.2*RATE)]),
    }
    (args.output / 'score.json').write_text(json.dumps(music.NOTES, indent=2) + '\n', encoding='utf8')
    (args.output / 'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fluidsynth', type=Path, required=True)
    parser.add_argument('--soundfont', type=Path, required=True)
    parser.add_argument('--selected-ending', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    main(parser.parse_args())
