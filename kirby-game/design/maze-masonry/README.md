# Maze masonry

The maze retains its original seven-colour route palette, with independent colours on the two sides of each wall. Shared instanced bricks have rounded corners, smoothly shaded rims and a plain matte finish. Exposed end bricks have closed curved returns. Coping stones, mortar and footings use darker shades of the same passage colour, independently on each side. All trim now has rounded edges and corners across three axes, including top surfaces and vertical ends. The entrance stepping boards are removed. Worn modular paving uses one two-triangle plane and 512px colour/relief textures. Collision layout and reward behaviour are unchanged.

One shared stone material has roughness 1, metalness 0 and no colour or bump textures. The former mineral pattern and per-brick brightness variation are removed; lighting alone shades the rounded surfaces. Each ordinary rounded face uses 22 triangles nearby and six at distance; returning end bricks use 36 and 12 respectively. The recessed mortar closes the back and is set slightly behind the returns at exposed ends. Rounded trim uses shared 58-triangle open halves nearby and 30 at distance. Wider coping stones keep the geometry budget below 250,000 triangles. Spatial LOD retains every brick. Visible masonry totals 239,400 triangles nearby, compared with 243,936 in the first angular brick revision and 222,264 before rounding the trim and closing the ends. Five spatial instance batches share the same stone material. Continuous rounded shadow proxies avoid drawing individual bricks into the shadow maps. There are no new lights or animated effects.

`performance.json` compares the original foliage walls and the textured rounded revision in the same isolated Chrome scene, including shadow rendering. The entrance view drops from 759,129 to 259,139 triangles, with draw calls increasing from 35 to 50. Median measured render time is 0.9ms before and 1.0ms after; the overview is 1.2ms for both. The extra rounding and closed returns add eight draws relative to the preceding brick revision. Recessing the backing at free ends and removing the masonry textures do not change the geometry or draw counts. These local measurements are not a mobile frame-rate guarantee.

Validation of the rounded revision: 12 focused tests cover geometry budgets, smooth normals, three-axis trim curvature, darker passage-coloured trim, LOD continuity, maze traversal, collision, rewards and trampoline access. Geometry and LOD checks were rerun after adding the closed returns. Production build passed. The game browser check collected the star without runtime or shader errors and captured daytime, night, narrow viewport and close top/end views. Its frozen-frame capture updates the prepared shadows before rendering, matching the game loop. Images here show the original bright palette.

- `entrance.png`: entrance and coloured brick faces in the game.
- `overview.png`: complete maze.
- `floor.png`: paving and close wall detail.
- `reward.png`: collectible star area.
- `mobile.png`: narrow viewport entrance.
- `rounded-top.png`: rounded coping and top edges.
- `rounded-end.png`: closed curved brick returns and rounded vertical wall end.
- `matte-wall.png`: close view after removing the patterned texture, bump mapping and brightness variation; production build and game browser check passed for this revision.

Browser capture scripts: `scripts/maze-materials-game-browser.mjs` and `scripts/maze-materials-browser.mjs`. The comparison script uses the original source snapshot saved in its local cache before implementation.
