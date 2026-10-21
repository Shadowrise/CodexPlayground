# Spruce needle texture

Generated with the built-in imagegen tool, 2026-10-21. Source: `spruce-needles-source.png`. This image is original generated game artwork.

The source is resized, given an eight-texel wrap band and packed as a 512×512 tile with sixteen RGB colours by `scripts/pack-spruce-needles.mjs`. Runtime data is in `src/generated/spruce-needle-image.ts`. It becomes one opaque, mipmapped DataTexture shared by meadow and mountain spruces.

The runtime converts the tile to neutral linear luminance, matching the original procedural tile's mean (163.55779266357422/255) and contrast (26.073666488266237/255). Original per-part green instance colours, texture colour space, cone geometry and all 42 crown parts are retained. The bitmap introduces needle detail without a new green tint or an overall brightness change.

Exact generation prompt:

> Use case: photorealistic-natural. Asset type: seamless tileable diffuse/albedo texture for the opaque crown mesh of a spruce tree in a real-time 3D game. Generate a square, edge-to-edge orthographic macro texture of very dense living spruce needles on numerous fine twigs, viewed face-on as a carpet of overlapping evergreen foliage. Hundreds of slender, sharply tapered needles, delicate individual central ridges, convincing natural density and depth, irregular interwoven sprays at varied angles with an overall upward growth tendency. No recognizable tree silhouette, no trunk, no large branches, no isolated fern silhouettes on a flat background, no gaps revealing sky or soil. Physically plausible muted medium forest greens, subtle fresh green tips and darker green depth. Small local occlusion between needles but absolutely no cast shadows or directional illumination, no hot highlights, no gradients or vignette. Seamless horizontally and vertically, uniform detail and scale across the entire image, suitable to repeat over conical foliage meshes without visible grid or stamped motifs. Fill every pixel with real fine spruce needles. High quality realistic natural texture, not a stylized illustration. No text, border, labels or watermark.
