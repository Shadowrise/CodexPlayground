# Snowball feather paint

`snowball-paint-atlas.png` is the separate, opaque albedo atlas for Snowball.
Generated with the built-in image_gen edit tool from the existing pigeon atlas.
The atlas keeps the original UV layout, with matte white feather layers and a
pastel rainbow collar on a white base. The menu SVG is unchanged.

`npx tsx scripts/make-snowball.ts` embeds it in
`public/models/snowball-animated.glb`, preserving the original rig, silhouettes,
skin weights, morphs and all clips. Pink beak, white lids and white crest are
baked into vertex colours. Plumage roughness is 0.97; no recolouring shader is used.

## Generation prompt

```text
Use case: precise-object-edit. Asset type: production base-colour UV texture atlas for the existing stylized pigeon game model.
Input image 1 is the EDIT TARGET and exact UV layout reference. Create a separate Snowball white pigeon atlas as a 2048 x 2048 square PNG.
Preserve the EXACT layout, borders, feather flow and UV island placement: the large body tile covers x=0..1535,y=0..1535; the 512px wide right column holds wing at y=0..511, tail at y=512..1023, shared details at y=1024..1535, eyes at y=1536..2047. The unused bottom-left area stays warm white. Keep the wing and tail feather shapes in their current locations; do not draw a whole bird.
Repaint the body, head, wing and tail as soft MATTE WHITE PLUMAGE with clearly readable overlapping feather edges, delicate warm ivory and cool light-grey shading, small feather shafts and fine directional barbs. White is the dominant base colour, but preserve enough gentle texture contrast that feather layering is visible in a small 3D game character. Hand-painted gouache/coloured-pencil style matching the source, soft and tactile, no glossy or metallic white, no large flat airbrushed white area.
The neck is a luminous WHITE feather base carrying a delicate pastel rainbow/pearlescent wash: mint, aqua, pale lilac, blush pink and a little soft peach. Put this collar in the same body-tile band as the source (approximately body y=300..750), with organically interleaved feather tips and soft transitions to the surrounding white. Remove the grey pigeon undercoat completely from this band: the rainbow colours should tint white feathers, not cover a dark grey or saturated purple bib. No dark charcoal base, no blue-grey head or belly, no hard horizontal stripe.
Shared detail and eye tiles remain near-white as in the reference; the pink beak is coloured separately in model vertex data. Opaque image, no transparency. Flat unlit albedo texture: no specular highlights, no cast shadow, no scene, no text, no watermark, no labels or visible grid. Keep all original atlas tile boundaries precisely aligned.
```
