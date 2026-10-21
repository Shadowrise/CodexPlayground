# Woodland bark and spruce needles

The approved great oak bark generator now lives in `src/tree-bark.ts`. The great oak retains its relief material. Ordinary woodland trunks share the same colour texture through a matte Lambert material, avoiding per-pixel bump lighting on thousands of trees. Existing broadleaf branch geometry now has uneven radii, flared roots and continuous bark coordinates, with no additional triangles.

Spruces retain the very first model: seven main crown cones and 35 protruding smaller cones, with all original transforms and per-part colours. Both meadow and mountain distance models are restored. Needle detail comes from the generated bitmap, decoded as neutral linear luminance with the original tile's average brightness and contrast. The original colour space and all original green instance colours are retained. The shared 512×512 texture is opaque and mipmapped. Source artwork and the exact built-in imagegen prompt are recorded in `needle-prompt.md`.

Spruce geometry and draw counts match the original model. Spatial instancing, distance culling and all 2,150 meadow / 5,676 mountain tree placements are retained. Mountain instances share the needle and bark textures. Spruce bark retains the original Standard lighting model and uses the shared oak map, without vertex colours because the original cylinder meshes have no colour attribute; instance colours remain unchanged.

Validation: production build; broadleaf, great oak, spruce surface, forest spacing, forest LOD, mountain woodland, tree shadow and prepared environment tests. Browser checks cover all four meadow biomes, mountains, a narrow viewport and night lighting. `game-checks.json` records paired old/new/old render samples and placement validation; `checks.json` records the isolated model gallery. Timings are local Chrome measurements, not a frame-rate guarantee.

Reproduce the texture packing with `node scripts/pack-spruce-needles.mjs`. Run `scripts/tree-surfaces-game-browser.mjs` against the Vite server for in-game checks. The gallery script uses the original cached baseline; do not replace that baseline with the new models.

Final in-game samples (old/new/old median render time, ms): spruce 12.4/12.1/11.5; mountain 9.7/9.9/9.5. No browser errors; all established placements retained. The full-world draw counts also include other current scenery changes. Crown vertex and part-transform fingerprints are checked against the first model in `tests/spruce-surface.test.ts`.
