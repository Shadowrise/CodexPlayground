# One shared Kirby meadow

Cloudflare Worker + one SQLite Durable Object (`main`), up to 14 WebSocket players.
Protocol 2 (`build=meadow-network-1`) is shared with the browser in
`../kirby-game/src/network-protocol.ts`. Deploy client and server together.

## Run locally

Start `npm run dev` in this directory (port 8787) and `npm run dev` in
`../kirby-game` (port 5173). The development client defaults to the local server.
Open two browser tabs, select multiplayer, enter names and choose Kirby colours.
`VITE_GAME_SERVER_URL` overrides the server in either development or production.
Production defaults to https://kirby-game-server.kirby-game-server.workers.dev.

## Room lifetime and traffic

The first connection creates fresh in-memory game state. The last disconnect
clears the state, removes alarms and storage, and releases all object leases.
The fixed Durable Object address remains reusable; there is no idle simulation
or periodic game tick. A 30-second liveness alarm exists only while occupied;
abandoned connections are removed after 75 seconds without traffic/heartbeat.
Clients use a single WebSocket, up to 10 batched frames/sec. The simulation host
includes the world at 5 Hz in these same frames. Stationary idle avatars suppress
unchanged updates. Heartbeats every 15 seconds use the Cloudflare runtime's
WebSocket auto-response and do not wake a hibernating object. Menu presence
is polled only while visible, once per minute.

Runtime WebSocket attachments retain the latest room snapshot and each player's
last state through hibernation. No database write per movement packet. Snapshots
are bounded to stay within attachment limits. The room is cooperative: clients
simulate movement; this is not a competitive anti-cheat server.

## Shared rules and synchronization

The same controllers, NPC AI, fruit pickup/growth, combat, score rules, flight,
and attractions run offline and online. One visible client is elected to simulate
NPCs and the shared world; the server transfers that role on disconnect or when
the host hides its tab and another visible player exists. Remaining clients
continue from the latest snapshot, including NPC health and flight state.

Synced: players (name, colour, pose, position, orientation, size, score), NPCs,
fruit consumption, maze-star cooldown, mill switch, carts, balloons, fireflies,
swing angle and attraction leases. The server arbitrates fruit/star claims and
exclusive leases. Players retain immediate local movement; remote avatars are
smoothed. Transport riders publish the state of their leased vehicle; the host
incorporates it into shared snapshots. Static scenery and fruit layouts use the
same deterministic generation on every client.

Online is currently a daytime cooperative meadow, without PvP. Save/load stays
offline-only. Disconnect returns the player to a visible error/leave control;
rejoining creates a new player, without reconnect reservations. If every tab is
hidden, browser simulation is suspended until a player returns. Cosmetic audio
and some ambient/particle animation phases remain local. Host migration may
slightly correct moving objects to their most recent snapshot.

## Verification

- `npm run check` — generated Worker types and TypeScript.
- `npm test --prefix ../kirby-game` — shared/client regression tests, including
  the actual-world snapshot contract (also writes a temporary snapshot fixture).
- `node scripts/smoke.mjs` — 20 concurrent connections, capacity 14, count API,
  room reuse and freed seats; requires an empty local server.
- `node scripts/multiplayer-smoke.mjs` — two players, fruit contention, vehicle
  lease, full-world late join, host migration and reset after the last player;
  run the client tests first to create the temporary real-world fixture.
- `node ../kirby-game/scripts/network-browser.mjs` — two browser tabs, movement,
  player roster, hidden save controls, exit and absence of page errors. Uses
  Chrome on Windows; override `BROWSER_EXECUTABLE` or install Playwright Chromium.

## Publish

`npm run deploy` publishes the Worker; a Git push does not deploy it. Protocol 2 was deployed on 2026-09-24 and verified through the public health
endpoint and a secure WebSocket connection. Worker version:
`fe9ecc10-eb53-4174-ac65-7af42440b902`. Credentials and `.wrangler/` are not tracked.
