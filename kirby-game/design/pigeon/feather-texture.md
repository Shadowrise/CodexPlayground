# Pidgie feather texture

`pigeon-feather-atlas.png` was created with the built-in image_gen edit tool.
It preserves the original Pidgie palette and the layered feather style, refined
to smaller, softer body feathers and very fine, close-fitting head plumage.
The existing atlas UV layout is unchanged; the icon is unchanged.

Inputs:

- `../snowball/snowball-paint-atlas.png`: edit target and feather detail.
- `pigeon-paint-atlas.png`: original grey-blue, green and lilac colour reference.

Run `npx tsx scripts/make-pigeon.ts` from `kirby-game` to embed this PNG in
`public/models/pigeon-animated.glb`. The generated GLB uses the original rig,
geometry, vertex colours and all 32 animation clips. No recolouring shader is used.

## Initial generation prompt

```text
Use case: precise-object-edit.
Asset type: production opaque base-colour UV texture atlas for the existing stylized Pidgie pigeon game model.
Input image 1 (white Snowball feather atlas) is the EDIT TARGET and feather-detail reference. Input image 2 (original grey Pidgie atlas) is the COLOUR REFERENCE.
Primary request: recolour image 1 into the original Pidgie colours from image 2, preserving the same beautiful layered feather structure, fine barbs, shafts, feather scale and overlapping feather tips as image 1. The user wants Snowball's readable feather texture on Pidgie while retaining Pidgie's familiar grey-blue plumage and subdued green/lilac neck.
Keep the EXACT normalized atlas layout: the large body tile occupies the upper-left 75% x 75% square; the rightmost 25%-wide column has four equal-height tiles: wing, tail, shared details, eyes. Unused bottom-left stays near-white. Preserve tile boundaries, feather flow, wing shapes and tail locations precisely. Do not draw a whole bird or change the UV layout.
Recolour head and body to the muted slate grey-blue of image 2 (body approximately #7f8999, head #647389), with a slightly lighter neutral grey belly around #9c9ba2; wings range #59687c to #939dab, tail #57677c. Preserve natural small light/dark feather-edge variation and visible layering without turning the plumage white or saturated blue. The result must read as the same grey pigeon as image 2.
Keep the iridescent neck band in exactly the same body position as the references, roughly y=15%..37% of the whole image. Recolour the pastel-white Snowball collar to muted sage green #6e8983 and dusty lilac/plum #887695 on the grey feather base, matching image 2's restrained green-over-lilac hue placement. Soft organic transitions between individual feathers, no hard horizontal stripe, no peach/pink white Snowball bib.
Shared detail and eye tiles remain near-white as in both images because beak, feet and eyes receive separate model vertex colours.
Style: tactile hand-painted matte albedo matching the fine feathers of image 1. Flat unlit texture, no baked specular shine, metallic effects, directional scene lighting or shadows. Square PNG, fully opaque, no labels, text, border, watermark or grid. Change only feather colours; preserve feather detail and exact atlas composition.
```

## Final refinement prompt

Edited the initial `pigeon-feather-atlas.png` with the built-in image_gen tool
to reduce feather size and edge contrast, especially on the head. Snowball's atlas
and both character icons are unchanged.

```text
Use case: precise-object-edit.
Asset type: opaque production albedo UV atlas for the existing stylized Pidgie pigeon 3D game model.
Input image 1 is the EDIT TARGET: the current grey-blue feather atlas. Retain its palette, UV layout, colour regions and hand-painted style. The user's correction is that its feathers look much too large and high-contrast on the actual bird, especially its head.
Repaint feather detail at a MUCH FINER, more natural scale. In the large upper-left body tile, make body feathers about ONE THIRD of the current length and width (roughly 3 times as many across and down). Make neck feathers about ONE QUARTER of their current size, and head feathers especially tiny: about ONE SIXTH of their current size. The head region is the top 15% of the whole image within the large body tile. It must read as dense fine, close-fitting pigeon head plumage with tiny soft directional strokes, almost velvety at game scale, smoothly transitioning into the small neck feathers. No large individual leaf-shaped or scale-shaped plates on the head.
Soften feather-edge contrast substantially across the body, neck and head: reduce the present light/dark feather contrast to around 35-40% of the reference. Retain fine shafts and soft layered feather texture at close range, with gentle edge shading instead of dark outlines or white rims. The grey plumage should be calm and cohesive at a distance. Do not simply blur the existing oversized pattern: redraw it with many more, much smaller feathers.
Preserve the exact muted slate-grey/grey-blue base colours and the slightly lighter grey belly, with the same subdued sage-green and dusty-lilac neck band in the same location (approximately full-image y=15%..37%). Preserve overall mean colours; soften the contrast within each colour region. No change to the grey beak or pink feet, which are vertex-coloured separately.
Keep the EXACT normalized atlas composition: body tile upper-left 75% width and 75% height; rightmost 25%-wide column with four equal-height tiles: wing at top, tail second, shared details third, eyes fourth. Keep every boundary precisely aligned. Refine the small coverts in the wing tile to about half their current size and soften their contrast; retain the original directional long flight-feather and tail structure needed for the model silhouette. Shared detail and eye tiles stay near-white, unchanged. Unused bottom-left stays near-white.
Flat unlit matte base colour, hand-painted fine plumage, no glossy or metallic highlights, no cast shadows, no scene, no drawn bird, no text, watermark, border or grid. Square PNG, fully opaque. Only refine feather scale and contrast. Do not change atlas layout or palette.
```
