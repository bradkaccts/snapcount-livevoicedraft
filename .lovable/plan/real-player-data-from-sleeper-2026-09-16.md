# Real player data from Sleeper

Replace the hand-seeded player pool with live NFL player data from Sleeper's public API. No source picker — Sleeper is the single integration, and the existing built-in list stays as the automatic fallback if Sleeper is unreachable.

## Cost and openness

Sleeper's read API is genuinely free and public: no account, no API key, no OAuth, documented and rate-limited to a generous ceiling (they ask for under 1000 calls per minute). The player list is one call that returns every NFL player with position, pro team, and status. Trending/ADP-style ordering comes from their public trending endpoint plus search rank. Nothing here costs money and nothing needs the admin to register anything.

Caveat worth naming: Sleeper's player dump is a large payload and their terms ask that it be called at most once per day — so the app caches it server-side and refreshes on a schedule rather than per draft.

## What the admin sees

The League setup panel gains a small, quiet status line under the league fields:

- "Player list: 1,247 players, updated 2 hours ago" with a "Refresh" link.
- If Sleeper is unreachable: "Using the built-in player list — couldn't reach the live player feed." Drafting still works exactly as today.

No provider choice, no configuration. Everything else in setup is unchanged.

## How it works

- Add columns to `players`: `source` ('sleeper' | 'builtin'), `external_id`, `active`, `updated_at`, with a unique key on (source, external_id). Existing seeded rows are marked `builtin` so nothing currently working breaks.
- Add a `player_sync` table holding the last successful sync time, row count, and last error.
- New server function `syncPlayers()`:
  - Fetch Sleeper's NFL players collection, keep active players at the fantasy positions the app supports (QB, RB, WR, TE, K, DEF), and map DEF rows to the app's `DST` position with the club name so voice DST calls keep working.
  - Fetch bye weeks and derive ranking/ADP ordering from Sleeper's search rank, refined by their trending-adds endpoint.
  - Build a short stat line from the available player fields (team, position, age/experience, injury status when set).
  - Validate every row with Zod, skip malformed entries instead of aborting, and upsert on (source, external_id). Players no longer listed are flagged inactive rather than deleted, so historical picks keep resolving.
  - Record the result in `player_sync`.
- Sync runs on demand from the Refresh link and automatically when the cache is older than 24 hours; a draft never waits on a cold fetch.
- Draft room, player search, voice matcher and history read active Sleeper players when a successful sync exists, otherwise the built-in rows — one shared query helper so all surfaces agree.
- Team abbreviations pass through the existing `nfl-teams.ts` helpers so team colors, player media lookup and DST matching stay correct.

## Build order

1. Schema: provider columns on `players`, `player_sync` table, backfill existing rows as `builtin`.
2. Sleeper sync server function with mapping, DST normalization, ranking and validation.
3. Shared "active player pool" query helper; point the draft board, search, voice matching and history at it.
4. Setup panel status line with count, last-updated and Refresh, plus the fallback message.
5. Verify a full draft on live Sleeper data: search, a voice pick, a DST voice call, celebration media, ticker, CSV export — then verify the same with the feed forced to fail so the fallback path is proven.
