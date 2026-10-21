The great oak, treehouse and rope swing now have crafted static models. These screenshots show the actual game after the bark and branch revisions.

The existing crown and its approved leaves are unchanged. The trunk and bough have outward-facing rounded geometry, irregular bark plates, branching cracks and a separate relief map. The swing limb leaves the trunk at a shallow angle and splits into six smaller branches, with twelve thin shoots and sixty folded leaves. Its rope saddles retain the original world coordinates, with no foliage below the swinging pivot.

The cabin has textured siding, framed shutters, flowers, a writing desk, books, a chest, a rimmed telescope and lantern housings. Its smaller sign sits in the gable so the interior remains visible. The ladder and bench retain their interaction coordinates. Knots, ropes, worn seat boards and their underside supports all move with the original swing pivot; its seat contact surface is unchanged.

Static details are merged by finish. New foliage reuses the crown material and vein map. Bark uses two shared 256×512 maps; all other new surfaces use the existing small crafted maps. No lights, sprites or per-frame decoration work were added. The complete attraction, including the dormant leaf burst, stays below the original 111,100-triangle budget. Additional materials increase draw submissions; the interleaved local Chrome comparison in checks.json showed roughly 0.1–0.3 ms additional render time with shadows. This is a local comparison, not a phone FPS measurement.

The maze's decorative boulders and their trail reservations were removed. Its paving and gateway remain, and the sign backing no longer hides the lettering.

Validation: 40 relevant tests passed, covering treehouse rides and networking, exact pigeon foot contact, native characters, bench placement, terrain paths, maze movement, prepared scenery, foliage and model budgets. The geometry tests were rerun after the final branch changes. The production build and actual-game checks passed: swing mount/dismount, climbing, balcony access, jumping into leaves, removed stones, narrow viewport and no WebGL/page errors.

Reproduce with `node scripts/treehouse-detail-browser.mjs` and `node scripts/treehouse-detail-game-browser.mjs`. Both use GAME_URL or localhost:5187. The first compares against HEAD, including a before/after/control sequence with shadow draws counted. Its timing sample precedes the final small change lowering the branch's root; the geometry budget is unchanged.
