# Player data source: ESPN or Yahoo

Let the league administrator choose where the player pool comes from during league setup, and load real rankings from that provider instead of the built-in seeded list.

## What the admin sees

In the **League setup** panel, a new "Player data" choice with three options:

- **ESPN** — rankings and ADP from ESPN's fantasy football player list.
- **Yahoo** — rankings and ADP from Yahoo Fantasy.
- **Built-in list** — the current seeded pool (always available, used as fallback).

After picking a source, a small "Refresh player list" action fetches the latest pool and shows the count and "last updated" time so the admin knows the board is current. Starting a draft locks that source into the draft room, and the board, search, voice picking and highlights all run off it unchanged.

## Cost and openness — read this before approving

- **ESPN: free, no account, but unofficial.** ESPN publishes no documented public API. There is a public, no-authentication endpoint their own fantasy site uses that returns the full player pool with rankings, ADP, positions, pro team and bye weeks. It works today, is free, but it is not a supported product — ESPN can change or block it without notice. The app will treat it as best-effort and fall back to the built-in list on failure.
- **Yahoo: free to use, but NOT open — it requires credentials.** Yahoo Fantasy Sports data is only available through their official API, which requires an OAuth-registered Yahoo developer app (free to register) and a signed-in Yahoo account to authorize. There is no anonymous public feed. To enable the Yahoo option you (the league owner) must create a Yahoo developer app and provide its client ID and secret, which get stored securely on the server. Until that is done, the Yahoo option will show as "needs setup" rather than silently failing.
- Neither provider's data is open-source or redistributable; it is fetched at the league's request and cached only to keep the draft fast.

If you would rather avoid the Yahoo registration step, a fully open alternative exists (Sleeper's free public API, no key required) and can replace or join Yahoo in the list — say the word and I'll swap it in.

## How it works

- Add a `player_sources` cache table plus provider columns on `players`: `source` ('espn' | 'yahoo' | 'builtin'), `external_id`, and a unique key on (source, external_id). Existing seeded rows become `builtin`, so nothing currently working breaks.
- Add `player_source` to `drafts`. Every player query in the draft room, search panel, voice matcher and history filters on the draft's source.
- New server function `importPlayers({ source })`:
  - ESPN: fetch the public fantasy players feed, map to name / position / pro team abbreviation / bye week / rank / ADP / short stat line, normalize D/ST rows to the app's `DST` position so voice DST calls keep working, then upsert on (source, external_id).
  - Yahoo: OAuth2 client-credentials-style flow against the Yahoo Fantasy API using stored app credentials, paginate the NFL players collection with draft analysis (ADP) and bye weeks, map the same way and upsert. If credentials are absent, return a clear "Yahoo not configured" result.
  - Both paths validate every row with Zod and skip malformed entries rather than aborting the import.
- Results cached in `player_sources` with a fetched-at timestamp; imports only re-run on explicit refresh or when the cache is older than 12 hours, so drafts start instantly.
- Provider failures never block a draft: the setup screen reports the failure in plain language and offers to start on the built-in list.
- Team abbreviation mapping goes through the existing `nfl-teams.ts` helpers so team colors, media lookup and DST matching stay correct across providers.
- Yahoo credentials stored as server secrets (requested through the secure secret form, never in code).

## Build order

1. Schema: provider columns on `players`, `player_sources` cache, `player_source` on `drafts`, backfill existing rows as `builtin`.
2. ESPN importer server function + normalization and mapping helpers.
3. League setup UI: source selector, refresh action, pool count / last-updated, graceful failure copy.
4. Scope draft room, player search, voice matcher and history queries to the draft's source.
5. Yahoo importer behind credentials, with a "needs setup" state until they're provided.
6. Verify a full draft on each source: search, voice pick including a DST call, celebration media, ticker, export.
