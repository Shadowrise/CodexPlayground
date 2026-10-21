# Third-party assets

## Meadow Day background music

- Game file: `public/audio/meadow-day.wav` — the approved acoustic arrangement of the original project melody, 118.4 seconds, stereo 44.1 kHz PCM 16-bit.
- Sampled flute, nylon guitar, acoustic bass, piano and drums: **GeneralUser GS v2.0.3**, S. Christian Collins, rendered with FluidSynth 2.6.1.
- Sound bank source: https://schristiancollins.com/generaluser and https://github.com/mrbumpy409/GeneralUser-GS.
- Bank license v2.0: copy in `public/audio/meadow-day-LICENSE.txt`. The sound bank itself is not distributed with the game.
- Original arrangement, synthesized warm pad and mixing: `design/music/meadow-day-acoustic/`. Approved MIDI and score: `design/music/meadow-day-acoustic/approved/`.
- Selected intro 3, ending 2, sparse middle drums without shaker, and a gradual piano fade under the pad from 1:36. Installed on 2026-10-21.

## Musical flower bells

- Game file: `public/audio/flower-bells.wav` — seven notes, one cached download.
- Recordings: **Versilian Community Sample Library**, Versilian Studios LLC.
- Source: https://github.com/sgossner/VCSL/tree/master/Idiophones/Struck%20Idiophones/Glockenspiel
- License: **CC0 1.0 Universal**; copy in `public/audio/flower-bells-LICENSE.txt`.
- Edits: soft C5/G5/C6 recordings retuned into C5–B5, level matched, trimmed,
  gentle attack/release, converted to mono 32 kHz PCM and packed together.
- Further provenance: `public/audio/flower-bells-CREDITS.md`.
- Retrieved: 2026-10-13.

## Musical flower finale scores

- Game notation: `src/musical-flower-melodies.ts`. Original monophonic bell arrangements of the ten public-domain tunes, with one complete verse/theme and its written repeats. Jingle Bells includes its verse and complete refrain.
- Melody and rhythm references: [PrintableGarden sheet music](https://www.printablegarden.com/sheet-music/), individual pages for Twinkle Twinkle Little Star, Mary Had a Little Lamb, Frère Jacques, London Bridge, Ode to Joy, Au Clair de la Lune, Hot Cross Buns, Row Row Row Your Boat, Yankee Doodle and Jingle Bells.
- Jingle Bells verse reference: [Music for Music Teachers](https://www.music-for-music-teachers.com/jingle-bells.html). Only the historical melody is transcribed; the modern piano accompaniment, engraving and lyrics are not distributed.
- Performed with the existing CC0 flower bell samples. Octave changes and F-sharp use sample playback rate; no new third-party recordings or downloads in the game.
- References checked: 2026-10-14.

## Apple bite sound

Game file: `public/audio/apple-bite.wav`

- Original recording: **apple bite**, by **sonicmariobrotha**
  - https://freesound.org/people/sonicmariobrotha/sounds/333825/
- Short excerpt: **Apple Bite**, by **AntumDeluge**
  - https://opengameart.org/content/apple-bite
  - Download: https://opengameart.org/sites/default/files/apple_bite_0.ogg
- License: **Creative Commons CC0 1.0 Universal** (both original and excerpt)
  - https://creativecommons.org/publicdomain/zero/1.0/
- Retrieved: 2026-10-03
- Game edits: converted to mono PCM WAV at 22050 Hz for browser compatibility,
  trimmed quiet edges, set peak to 0.55, added short fade-in and fade-out.
  Final length approximately 0.788 seconds. Used only for eating fruit.

CC0 permits copying, modifying and redistributing the recording, including in
commercial projects. Attribution is kept here for provenance.

## Shiba

- Game file: `public/models/shiba.glb`
- Author: zixisun02 (https://sketchfab.com/zixisun51)
- Source: https://sketchfab.com/3d-models/shiba-faef9fe5ace445e7b2989d1c1ece361c
- License: Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/)
- Changes: uniformly scaled and placed in a procedural dog house; resting haunches, animated tail/muzzle morphs, lip seam, mouth interior and tongue added; original texture preserved.
- Attribution is also displayed in the game's controls panel and supplied in `public/models/shiba-LICENSE.txt`.

## Pigeon

- Game file: `public/models/pigeon-animated.glb`.
- Original procedural model, painted texture, rig and 31 animation clips created for this project from its approved pigeon sketch (`design/pigeon/concept.png`).
- Five original pigeon coos: `public/audio/pigeon-{hello,joy,fear,anger,sad}.wav`.
- Voices are synthesized by `scripts/make-pigeon-coos.py` using resonant harmonics, breath and pitch phrasing; no third-party recordings.

## Shiba bark

- Game file: `public/audio/shiba-bark.wav`
- Sound: **Tiny Dog Bark**, by **qubodup** (https://freesound.org/people/qubodup/sounds/813120/).
- Original recording: **Dog Shih Tzu Bark Single 06.wav**, by **Glitchedtones** (https://freesound.org/people/Glitchedtones/sounds/372527/).
- Both sound pages specify **CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/).
- Downloaded the official public high-quality MP3 preview on 2026-10-07.
- Converted to mono PCM WAV, 22050 Hz, normalized to peak 0.65, with 3 ms onset and 8 ms ending fades; duration approximately 0.223 seconds.
- Played once as Shiba opens her mouth, with distance attenuation, stereo panning and the existing sound toggle/volume.

## Meta Knight duel music and sounds

- Game file: `public/audio/meta-knight-duel.wav` — original score “Galaxia — Knight of the Stars”, generated for this project by `scripts/make-meta-knight-music.cjs`.
- D minor, 144 BPM, 64 bars, 106.667 seconds, stereo PCM WAV at 44100 Hz. Theme, answer, reprise, lyrical bridge, bridge variation, return and two-part finale; instrument tails wrap into the loop.
- Original combat sound palette synthesized by `src/meta-knight-sounds.ts` with metallic partials, filtered noise and stereo echoes.
- Countdown uses three original short wooden knocks and a bright layered starting bell from the same synthesizer.
- The crystal assault adds original layered crystal bells, an ascending constellation arpeggio and an airy spiral cue. Phase-three music eases to 110% tempo while preserving pitch and the existing mute/volume controls.
- The crystal shield adds original resonant glass, pressure-wave sweeps and a layered crystal-shattering chime; synthesized in the same sound palette without external samples. Dome, segmented/full pressure waves, violet crystal flares and rubble are procedural Three.js geometry and shaders.
- Both the music and combat sounds use synthesis without third-party recordings or samples.

## Spruce needle surface

- Original texture generated for this project with the built-in imagegen tool on 2026-10-21.
- Source and exact prompt: `design/tree-surfaces/spruce-needles-source.png` and `design/tree-surfaces/needle-prompt.md`.
- `scripts/pack-spruce-needles.mjs` exports the shared opaque 512×512 game tile as compact indexed pixels in `src/generated/spruce-needle-image.ts`.
