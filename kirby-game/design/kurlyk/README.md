# Курлык · Coo King · Гуругурко

Native pigeon variant with a continuous seven-colour feather wash from red at the forehead through orange, yellow, green, cyan and blue to violet at the belly. Smooth interpolation and a slight curved variation keep the colours flowing around the body without hard stripe edges. The original feather atlas supplies the same soft feather grain as Pidgie; KHR_materials_iridescence adds a restrained pearlescent sheen. Wings and tail carry the same wash. Beak, eyes, legs and feet retain their original paint.

The seven-point gold crown and seven coloured jewels attach to `Head`, so every authored animation, including pecking, flying, sleeping and emotions, carries the crown with the head. Its narrower oval band follows the head shape, with the lower rim seated into the feathers. The model retains the original geometry, UVs, skeleton, morph targets and all animation tracks.

Rebuild: `npx tsx scripts/make-kurlyk.ts`. Output: `public/models/kurlyk-animated.glb` (self-contained; uses the original embedded feather PNG).

The world NPC uses the shared bread/friendship rules. Feeding unlocks the character permanently and awards the same ten friendship points. Solo command: `/unlock coo-king`. Admin pigeon deliveries choose from all five plumages. Existing save/network variant indices are preserved; Курлык is appended at index 22.
