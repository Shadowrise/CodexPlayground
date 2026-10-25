"""Small MIDI/FluidSynth/PCM helpers, reused from the approved acoustic workflow."""
import math
import struct
import subprocess
import wave

import numpy as np

RATE, BPM, PPQ, SEED = 44100, 92, 960, 1193
BARS, FRAMES = 48, round((48*4*60/92+3)*RATE)
INSTRUMENTS, EVENTS = {}, {}


def event(channel, beat, data, priority=1):
    EVENTS[channel].append((round(beat*PPQ), priority, bytes(data)))


def cc(channel, beat, controller, value):
    event(channel, beat, [0xB0+channel, controller, value])


def varlen(value):
    value = int(value)
    result = [value & 127]
    while value >> 7:
        value >>= 7
        result.insert(0, (value & 127) | 128)
    return bytes(result)


def chunk(kind, data):
    return kind+struct.pack('>I', len(data))+data


def meta(kind, payload):
    return bytes([0xFF, kind])+varlen(len(payload))+payload


def write_midi(path, channels=None):
    conductor = b'\0'+meta(0x51, round(60_000_000/BPM).to_bytes(3, 'big'))
    conductor += b'\0'+meta(0x58, bytes([4, 2, 24, 8]))
    conductor += b'\0'+meta(0x59, bytes([0, 0]))+b'\0'+meta(0x2F, b'')
    chunks = [chunk(b'MTrk', conductor)]
    for ch, events in EVENTS.items():
        if channels is not None and ch not in channels:
            continue
        data = b'\0'+meta(3, INSTRUMENTS[ch][0].encode('ascii'))
        previous = 0
        for tick, priority, message in sorted(events, key=lambda e: (e[0], e[1])):
            data += varlen(tick-previous)+message
            previous = tick
        end = round((BARS*4+8)*PPQ)
        data += varlen(max(0, end-previous))+meta(0x2F, b'')
        chunks.append(chunk(b'MTrk', data))
    path.write_bytes(chunk(b'MThd', struct.pack('>HHH', 1, len(chunks), PPQ))+b''.join(chunks))


def read_float(path):
    raw = path.read_bytes()
    at, samples = 12, None
    while at+8 <= len(raw):
        kind, size = raw[at:at+4], struct.unpack_from('<I', raw, at+4)[0]
        if kind == b'fmt ':
            fmt, channels, rate = struct.unpack_from('<HHI', raw, at+8)
            assert (fmt, channels, rate, struct.unpack_from('<H', raw, at+22)[0]) == (3, 2, RATE, 32)
        if kind == b'data':
            samples = np.frombuffer(raw, dtype='<f4', count=size//4, offset=at+8)
        at += 8+size+size % 2
    assert samples is not None and np.isfinite(samples).all()
    audio = samples.reshape(-1, 2).astype(np.float64)
    assert len(audio) >= FRAMES
    return audio[:FRAMES].copy()


def render(args, midi, target):
    command = [str(args.fluidsynth), '-ni', '-F', str(target), '-T', 'wav', '-O', 'float',
               '-r', str(RATE), '-g', '.46', '-C', '0', '-R', '1',
               '-o', 'synth.reverb.engine=dat', '-o', 'synth.reverb.room-size=.28',
               '-o', 'synth.reverb.damp=.60', '-o', 'synth.reverb.width=65',
               '-o', 'synth.reverb.level=.18', '-o', 'synth.polyphony=256',
               str(args.soundfont), str(midi)]
    subprocess.run(command, check=True, capture_output=True)
    return read_float(target)


def rms_db(audio):
    return round(20*math.log10(max(1e-12, float(np.sqrt(np.mean(audio*audio))))), 2)


def band_tone(audio, freqs, gains):
    fft_size, taps = 2048, 129
    response = 10**(np.interp(np.fft.rfftfreq(fft_size, 1/RATE), freqs, gains)/20)
    impulse = np.fft.fftshift(np.fft.irfft(response, n=fft_size))
    center = fft_size//2
    kernel = impulse[center-taps//2:center+taps//2+1]*np.kaiser(taps, 6)
    kernel /= kernel.sum()
    return np.column_stack([np.convolve(audio[:, ch], kernel, mode='same') for ch in range(2)])


def limit(audio, ceiling=.79):
    block = round(.005*RATE)
    count = math.ceil(len(audio)/block)
    peaks = np.pad(np.max(np.abs(audio), axis=1), (0, count*block-len(audio))).reshape(count, block).max(axis=1)
    required = np.minimum(1, ceiling/np.maximum(peaks, 1e-12))
    edges = np.ones(count+1)
    edges[:-1] = required
    edges[1:] = np.minimum(edges[1:], required)
    release = 1-math.exp(-(block/RATE)/.080)
    for i in range(1, len(edges)):
        edges[i] = min(edges[i], edges[i-1]+(1-edges[i-1])*release)
    curve = np.interp(np.arange(len(audio))/block, np.arange(len(edges)), edges)
    return audio*curve[:, None], round(-20*math.log10(float(edges.min())), 2)


def write_wav(path, audio):
    assert np.isfinite(audio).all() and np.max(np.abs(audio)) < .99
    rng = np.random.default_rng(SEED)
    dither = (rng.random(audio.shape)-rng.random(audio.shape))/65536
    pcm = np.rint((audio+dither)*32767).astype('<i2')
    assert not np.any(np.abs(pcm.astype(np.int32)) >= 32767)
    with wave.open(str(path), 'wb') as wav:
        wav.setparams((2, 2, RATE, len(pcm), 'NONE', 'not compressed'))
        wav.writeframes(pcm.tobytes())
