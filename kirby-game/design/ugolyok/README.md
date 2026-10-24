# ugolyok feather paint

`ugolyok-paint-atlas.png` is the opaque albedo atlas for this native pigeon model. Generated and revised with the built-in image_gen tool, using the previous variant as the edit target and Pidgie as the feather-contrast reference. The original UV layout is preserved.

Black and charcoal-grey plumage with softly defined feathers and a green/violet iridescent neck. Local feather contrast now follows Pidgie's gentler paint.

Rebuild both native models with `npx tsx scripts/make-pigeon-plumages.ts`. The generator preserves Pidgie's geometry, skeleton, morph targets and animations, embeds each atlas, and colours the crest and eyelids to match the head.

Visual check: `node scripts/pigeon-plumages-browser.mjs --textures-only` renders the four native models under identical lighting, plus a closer view of the two new variants.

## Current edit prompt

```text
Use case: precise-object-edit. Edit ONLY the local contrast of this opaque game pigeon UV atlas. Image 1 is the target; image 2 is the Pidgie low-contrast style reference. The previous reduction was still far too strong when wrapped on the 3D model: its belly looks like large bright scalloped scales. Make the change DRAMATIC and obvious this time. Across the head, body, wings and tail, ELIMINATE bright feather-tip rims and the dark outlines/gaps between adjacent feathers. Compress individual feather light/dark differences by another 75-80 percent. Use almost uniform charcoal/graphite albedo with very delicate fine feather grain and barely visible soft overlapping tips. Body individual feather tones should sit close together around #383b42 to #46494f, with no silver or pale-grey feather ends and no black crevices. Preserve only gentle broad form gradients and faint tactile feather texture; no embossed/scaly pattern. The target should look subdued and velvety at thumbnail size. Keep the GREEN/TEAL and VIOLET NECK COLOURS, placement and brightness; soften only their local feather-edge relief as well. Keep the EXACT UV layout: body top-left 75% square, right column wing/tail/details/eyes in four stacked quarters; neutral details, eye tiles and unused white bottom area completely unchanged. Do not add blur haze, labels, a bird illustration, lighting, gloss, watermark, scene or new islands. Return the edited square texture.
```

## First contrast revision (superseded)

```text
Use case: precise-object-edit. Production opaque base-colour UV feather atlas for the existing Ugolyok pigeon game model. Image 1 is the EDIT TARGET, Image 2 is the Pidgie reference for the desired SOFT LOW CONTRAST FEATHER STYLE. Edit image 1 only. Preserve its exact square UV tile layout and feather flow: body occupies top-left 75% by 75%; rightmost 25% has wing in top quarter, tail second quarter, neutral details third quarter, eyes bottom quarter; unused bottom-left stays white. Keep Ugolyok BLACK/CHARCOAL GREY, and keep the green/teal and violet iridescent neck in exactly the same location. Main correction: substantially REDUCE LOCAL FEATHER CONTRAST over head, body, wings and tail to match the much gentler definition in Pidgie reference 2. The current target has overemphasized pale feather rims and deep black gaps making it look scaly. Remove these strong rims/grooves: use soft charcoal-on-charcoal layers, delicate matte directional feather grain, subtle overlapping tips with only about one third of the previous light/dark difference. Feather detail must still exist, just much quieter and naturally blended. Retain the overall dark graphite identity; do not turn bird pale grey or blur away all texture. Collar colours remain beautiful iridescent green/purple but their individual feathers also have gentle tonal relief. Flat unlit albedo, no drawn whole bird, no text, no watermark, no scene. EXACT tile boundaries and neutral detail/eye tiles unchanged.
```

## Initial generation prompt (superseded)

```text
Use case: precise-object-edit. Asset type: production base-colour UV texture atlas for an existing stylized pigeon game model. Input image 1 is the EDIT TARGET and exact layout/feather reference; input image 2 is a supporting white collar style reference. Create a separate 2048 x 2048 opaque PNG atlas for Ugolyok, a BLACK AND CHARCOAL GREY pigeon. Preserve the EXACT UV layout and tile boundaries: large body at x=0..1535,y=0..1535; 512px right column wing at y=0..511, tail y=512..1023, shared details y=1024..1535, eyes y=1536..2047. Unused bottom-left remains warm white. Repaint body/head/wing/tail in rich charcoal black, graphite grey and soft ash grey, clearly dark enough to differ from the original blue-grey bird. Preserve readable detailed overlapping feather layers, fine shafts and directional barbs, soft tactile hand-painted feather texture, subtle silver-grey feather rims. Preserve the original green/teal and violet/lilac iridescent collar at the SAME body band around y=300..750, luminous but integrated with dark feathers. Wing bars stay black against graphite. Shared detail/eye tiles remain near white. Flat unlit albedo; no scene, text, labels, grid, watermark, bird illustration, gloss or metallic highlights. Keep exact feather flow and layout.
```
