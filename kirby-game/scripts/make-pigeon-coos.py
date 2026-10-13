"""Create the pigeon's five original, deterministic, nonverbal emotion calls.

Run with Python 3, no third-party packages. Voices use softly driven harmonic
syrinx tones, breath noise, irregular throat tremolo and rounded syllables.
The calls share one vocal identity; their phrasing and inflection express the
emotion. These are authored sound effects, not recordings of a real bird.
"""
from array import array
from dataclasses import dataclass
import json
import math
from pathlib import Path
import random
import sys
import wave


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio"
DESIGN = ROOT / "design" / "pigeon"
RATE = 44100
TAU = math.tau


@dataclass(frozen=True)
class Coo:
    start: float
    length: float
    pitch: float
    fall: float = 0
    swell: float = 14
    amplitude: float = 1
    throat: float = .12
    tremble: float = 2.2
    breath: float = .045


# Non-musical contours: a friendly three-part greeting, a bouncing excited
# phrase, a startled tremulous reply, four grumbly challenges, a fading sigh.
CALLS = {
    "hello": (2.10, [
        Coo(.09, .33, 390, -26, 27, .76, .08),
        Coo(.49, .31, 407, -30, 20, .81, .11),
        Coo(.88, .87, 418, -87, 22, 1, .17, 2.7),
    ]),
    "joy": (2.04, [
        Coo(.08, .29, 408, 7, 24, .81, .10),
        Coo(.44, .30, 442, 12, 29, .88, .12),
        Coo(.80, .43, 468, -16, 22, 1, .20, 3.2),
        Coo(1.29, .42, 446, -61, 16, .83, .19, 2.8),
    ]),
    "fear": (1.54, [
        Coo(.05, .22, 539, -69, 38, .93, .23, 6.1, .072),
        Coo(.31, .21, 515, -47, 30, .90, .25, 6.7, .063),
        Coo(.59, .51, 480, -82, 27, .76, .36, 5.9, .075),
    ]),
    "anger": (2.07, [
        Coo(.07, .29, 352, -34, 8, .94, .38, 2.8, .062),
        Coo(.41, .33, 343, -30, 6, 1, .41, 3.2, .063),
        Coo(.80, .31, 363, -41, 12, .96, .36, 3.1, .053),
        Coo(1.17, .57, 330, -51, 13, .85, .40, 3.5, .071),
    ]),
    "sad": (2.32, [
        Coo(.10, .62, 355, -49, 9, .83, .07, 2.2, .082),
        Coo(.88, .94, 339, -73, 8, .71, .11, 2.6, .103),
        Coo(1.90, .19, 284, -24, 2, .31, .12, 2.1, .128),
    ]),
}


def smooth(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def voice(syllable, index, seed):
    """A closed-beak coo with a small rolled, breathy tail."""
    rng = random.Random(seed + index * 107)
    count = math.ceil(syllable.length * RATE)
    samples = [0.] * count
    phase = 0
    low_noise = 0
    throat_phase = rng.uniform(0, TAU)
    shift = rng.uniform(-.3, .3)
    for i in range(count):
        t = i / RATE
        u = t / syllable.length
        # Gently bowed notes and imperfect, continuous throat movement avoid
        # stepped pitches, equal pulses and the sound of a game oscillator.
        bow = syllable.swell * math.sin(math.pi * u)
        vibrato = syllable.tremble * (
            math.sin(TAU * (5.3 * t + .28 * t * t) + shift)
            + .43 * math.sin(TAU * 8.71 * t + .9)
        )
        roll_weight = smooth((u - .25) / .42) * (1 - .46 * smooth((u - .83) / .17))
        roll = math.sin(TAU * (23.7 * t + 3.8 * t * t) + throat_phase)
        hz = syllable.pitch + syllable.fall * smooth(u) + bow + vibrato
        hz += roll * syllable.throat * roll_weight * 8
        phase += TAU * hz / RATE
        # Light octave/sub-octave components give the coo a chest resonance.
        # The changing overtone strength follows a very small opening of the
        # throat rather than making an artificial vowel or consonant.
        roughness = syllable.throat * roll_weight
        harmonic = .80 * math.sin(phase)
        harmonic += (.135 + .10 * roughness) * math.sin(phase * 2 + .10)
        harmonic += (.046 + .09 * roughness) * math.sin(phase * 3 + .36)
        harmonic += .055 * math.sin(phase * .5 + .23) * roughness
        jitter = .019 * math.sin(TAU * 11.73 * t + .7)
        flutter = 1 - roughness * .50 + roughness * .50 * roll
        low_noise = low_noise * .79 + rng.uniform(-1, 1) * .21
        breath = low_noise * syllable.breath * (1 + 1.4 * smooth((u - .60) / .40))
        onset = smooth(t / min(.065, syllable.length * .23))
        release = smooth((syllable.length - t) / min(.13, syllable.length * .34))
        belly = (.72 + .28 * math.sin(math.pi * u)) * (1 + jitter)
        samples[i] = (harmonic * flutter + breath) * onset * release * belly * syllable.amplitude
    return samples


def render(name, duration, syllables, seed):
    samples = [0.] * math.ceil(duration * RATE)
    for index, syllable in enumerate(syllables):
        offset = round(syllable.start * RATE)
        for i, sample in enumerate(voice(syllable, index, seed)):
            if offset + i < len(samples):
                samples[offset + i] += sample
    # A small body resonance, not a room effect. Reflections are quiet and
    # shorter than the silent tail so the game can stop the call cleanly.
    dry = samples[:]
    for delay, gain in [(.014, .042), (.029, .026), (.053, .014)]:
        shift = round(delay * RATE)
        for i in range(shift, len(samples)):
            samples[i] += dry[i - shift] * gain
    # Remove DC and normalize gently. Shared headroom prevents overlap clipping
    # when the game mixes the protected emotion voice with a footstep.
    previous = high_pass = 0.
    for i, value in enumerate(samples):
        high_pass = value - previous + .9987 * high_pass
        previous = value
        samples[i] = high_pass
    peak = max(abs(x) for x in samples)
    gain = {"hello": .58, "joy": .64, "fear": .56, "anger": .68, "sad": .42}[name] / peak
    for i in range(len(samples)):
        samples[i] *= gain * smooth(i / (RATE * .022)) * smooth((len(samples) - 1 - i) / (RATE * .12))
    # Quantization naturally removes the already inaudible filter residue.
    return array("h", (round(max(-1., min(1., x)) * 32767) for x in samples))


def write_wav(path, pcm):
    data = array("h", pcm)
    if sys.byteorder != "little":
        data.byteswap()
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(data.tobytes())


def check(pcm, name):
    peak = max(abs(v) for v in pcm) / 32767
    rms = math.sqrt(sum((v / 32767) ** 2 for v in pcm) / len(pcm))
    duration = len(pcm) / RATE
    assert .30 < peak < .72, (name, "peak", peak)
    assert .08 < rms < .35, (name, "RMS", rms)
    assert not any(pcm[:round(.020 * RATE)]), (name, "non-silent lead")
    assert not any(pcm[-round(.100 * RATE):]), (name, "non-silent tail")
    assert max(abs(pcm[i] - pcm[i-1]) for i in range(1, len(pcm))) < 5000, (name, "sharp discontinuity")
    return {"duration": round(duration, 3), "peak": round(peak, 5), "rms": round(rms, 5)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    DESIGN.mkdir(parents=True, exist_ok=True)
    report = {"sampleRate": RATE, "encoding": "PCM 16-bit mono", "sounds": {}}
    demo = array("h", [0]) * round(.35 * RATE)
    silence = array("h", [0]) * round(.45 * RATE)
    for index, (name, (duration, syllables)) in enumerate(CALLS.items()):
        pcm = render(name, duration, syllables, 7301 + index * 31)
        report["sounds"][name] = check(pcm, name)
        write_wav(OUT / f"pigeon-{name}.wav", pcm)
        demo.extend(pcm)
        demo.extend(silence)
    write_wav(DESIGN / "coos-demo.wav", demo)
    (DESIGN / "coos-analysis.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
