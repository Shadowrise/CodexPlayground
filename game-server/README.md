# One shared Kirby meadow

Cloudflare Worker + one SQLite Durable Object (`main`), up to 14 WebSocket players.
Protocol 2 (`build=meadow-network-4`) is shared with the browser in
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

Joining requires a non-empty `name` in the WebSocket URL. Names are normalized
for whitespace, Unicode compatibility and case; the server reserves the name
as soon as the socket is admitted, before its first actor frame. An already
connected name is rejected without disturbing that player.

On departure, one storage write keeps the last player state under the room ID
and normalized name. Returning during the same occupied session restores the
same player ID, fruit ownership, achievements, size, grounded position,
orientation, sky checkpoint and festival rewards. Temporary star power expires
while away. Rides are released, and a returning rider appears on the ground at
the same horizontal location. The previous colour is restored when free;
otherwise the new selected colour is used. Snapshots survive host migration and
hibernation, but are deleted when the room empties or its results timer expires.
No additional periodic requests or per-frame database writes are introduced.

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

Online is a cooperative meadow with a shared day/night cycle, without PvP. Save/load stays
offline-only. Disconnect returns the player to a visible error/leave control;
rejoining by name restores progress in the current session. If every tab is
hidden, browser simulation is suspended until a player returns. Cosmetic audio
and some ambient/particle animation phases remain local. Host migration may
slightly correct moving objects to their most recent snapshot.

## Admin history

Open `/admin` on the Worker (locally: `http://127.0.0.1:8787/admin`). The History
tab supports exact nickname search, mode/date filters and cursor pagination
through every visit. It records start/end or last contact, visible play time,
starting/current/earned scores, **completed tasks out of the total**, device
category, OS, browser, screen dimensions and selected control scheme. Online
visits also retain room/player IDs, completion and final rank. Reconnecting
creates a separate visit in the same room, retaining the initial score baseline.
An online visit is completed when the player is still connected as results begin.

History lives in the separate SQLite Durable Object `HistoryStore` (`archive`),
created by migration `v2`; deleting a `GameRoom` never deletes the archive.
Online snapshots are batched once per minute using the room's existing alarm,
plus admission/departure/results. Solo clients post a full cumulative snapshot
on entry, every minute, visibility changes and departure. Reports have monotonic
sequence numbers; late packets cannot overwrite final records. Requests time out
after five seconds, errors are caught, and analytics are never awaited by the
game. Abrupt disconnects show the last received data; stale visits are shown as
lost after 150 seconds. Device inference is approximate, not fingerprinting.
Solo reports are client-provided analytics, not anti-cheat records.

Copy `.dev.vars.example` to `.dev.vars` for local use. Choose `ADMIN_PASSWORD`;
the real local file is ignored by Git. For production, run
`npx wrangler secret put ADMIN_PASSWORD` before publishing the new Worker.
There is no default production password: admin data stays inaccessible without
the secret. The password is checked server-side; a signed 12-hour HttpOnly,
SameSite=Strict cookie (Secure on HTTPS) authorizes history reads. Password
rotation invalidates previous sessions. Login attempts are limited to 10 per
minute per IP; solo ingestion is limited to 60 per minute per IP. IP addresses
are used for rate limiting only, not stored in visit rows. Admin responses are
not cached and do not allow cross-origin reads. Logging out removes the cookie.

The admin page is served by the Worker, so it requires no game scene or separate
frontend build. Deploy the Worker and client together to enable collection;
earlier visits cannot be reconstructed. Archive schema version 1 is initialized
on its first use. No D1 resource or database migration command is needed.

### Online administration

The **Online** tab shows the current room ID and connected players (including
the host), refreshed on demand to avoid background polling. Admin actions use
the same signed session and same-origin POST checks as history/login:

- `GET /admin/api/online` — room and player list.
- `POST /admin/api/online/disconnect` with `{roomId, playerId}` — disconnects
  a player without banning them; normal progress/history and host handover apply.
- `POST /admin/api/online/recreate` with `{roomId}` — disconnects everyone,
  clears room progress and prepares a fresh ID. The empty replacement sleeps
  without alarms until someone joins. The permanent history archive is retained.
- `POST /admin/api/online/starfall` with `{roomId}` — starts the usual final
  starfall, using the same scoring and timing as completion of all tasks.
- `POST /admin/api/online/finish` with `{roomId}` — immediately shows the final
  standings, retaining earned star points. Results expire after two minutes.

Stale room/player actions return 409. Destructive controls ask for confirmation.
`/admin/favicon.svg` provides a Kirby-with-shield icon for admin browser tabs.

Local interactive checks: run `npx wrangler dev --port 8791 --persist-to
.wrangler/admin-online-tests` in this directory, then
`node ../kirby-game/scripts/admin-online-browser.mjs`. The script uses a dedicated
local room and never mutates a production room.

### History checks

- `node scripts/history-smoke.mjs` — local auth/API, visit writes, tasks, stale
  packets and history surviving room disposal. Reads the local `.dev.vars`.
- `node ../kirby-game/scripts/history-browser.mjs` — login/table/filters/logout
  and real gameplay continuing with failed telemetry; local fixtures only.

## Game verification

- `npm run check` — generated Worker types and TypeScript.
- `npm test --prefix ../kirby-game` — shared/client regression tests, including
  the actual-world snapshot contract (also writes a temporary snapshot fixture).
- `node scripts/smoke.mjs` — 20 concurrent connections, capacity 14, count API,
  room reuse and freed seats; requires an empty local server.
- `node scripts/multiplayer-smoke.mjs` — two players, fruit contention, vehicle
  lease, full-world late join, host migration, duplicate-name rejection,
  progress restoration and reset after the last player;
  run the client tests first to create the temporary real-world fixture.
- `node ../kirby-game/scripts/network-browser.mjs` — two browser tabs, movement,
  player roster, hidden save controls, exit/rejoin restoration and absence of page errors. Uses
  Chrome on Windows; override `BROWSER_EXECUTABLE` or install Playwright Chromium.

## Publish

`npm run deploy` publishes the Worker; a Git push does not deploy it. Protocol 2 was deployed on 2026-09-24 and verified through the public health
endpoint and a secure WebSocket connection. Worker version:
`fe9ecc10-eb53-4174-ac65-7af42440b902`. Credentials and `.wrangler/` are not tracked.
