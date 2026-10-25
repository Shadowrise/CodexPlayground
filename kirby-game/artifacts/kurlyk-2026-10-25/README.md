# Курлык

`kurlyk.png`: native playable model with a continuous seven-colour feather wash, gold crown and ordinary pigeon legs.

`admin-flock.png`: the same model in the actual GPU instancing path used by summoned pigeons, including animated wings and the crown.

`kurlyk-crown-fit.png` and `admin-flock-crown-fit.png`: revised narrower crown, lowered onto the rounded head. The oval band is 25% narrower across and 36% narrower front to back. All 56 sampled rim points contact the feather surface, with 0.009–0.034 m of shallow overlap. Nine existing model/integration tests, the production build and native/instanced browser rendering passed after this adjustment.

Names: Курлык (RU), Coo King (EN), Гуругурко (BG). Solo unlock command: `/unlock coo-king`.

Validation completed:

- `npm test`: 901 passed, zero failures.
- `npm run build`: passed.
- `npx tsc --noEmit` in `game-server`: passed.
- `node scripts/pigeon-plumages-browser.mjs`: five world pigeons, targeted feeding, independent persistent unlocks, save/load and playable models passed. Actual world snapshot: 8,528 bytes, valid under the existing limit.
- `node scripts/pigeon-plumages-browser.mjs --commands-only`: autocomplete, solo gating, idempotency, no friendship reward from cheats and persistent menu selection passed.
- `node scripts/pigeon-plumages-browser.mjs --textures-only`: native and instanced rendering passed without WebGL/shader errors; all three menu languages verified.

The native model retains all 32 original animation clips. The crown follows the animated `Head`; existing beak, eye, leg and foot vertex paint is unchanged. Automated server coverage checks actual admin random selection, targeted feeding, rejection of forged friendship achievements, late joins, host changes and room persistence.
