# Dynamic Player Celebration: Photos + Team Colors

Make the "pick is in" celebration feel like a broadcast card built around the drafted player: a big action photo, a circular profile shot, and the whole screen tinted in that player's NFL team colors.

## What the user will see

1. Pick is made. The screen blacks out and the spotlight sweep now glows in the drafted player's team colors instead of gold.
2. A high-res action photo of the player fills the right side of the card (behind a soft gradient so text stays readable), sliding and slowly zooming in.
3. A circular profile headshot pops in next to the name with a colored ring in the team's primary color, plus the team helmet-style color bar.
4. Name, position, NFL team, stat line, and drafting team stay as they are today, recolored to the team palette; confetti uses the team colors.
5. If a photo can't be found, the card falls back to the current look with a colored monogram badge — never a broken image.
6. Everything else (auto-close after the animation, then "Now on the Clock") is unchanged.

## How the photos are found

- Each player gets two images looked up once and then cached, so the second time that player is drafted it is instant.
- A search agent finds an action photo and a headshot for the player, the same way highlights are already found today.
- Lookup starts the moment the pick is recorded and the celebration renders whatever has arrived; late arrivals fade in.

## Technical plan

**Data**
- New migration: `player_media` table (`player_id` unique FK, `action_url`, `headshot_url`, `source`, `created_at`), public SELECT policy, GRANT to anon/authenticated/service_role. Mirrors the `highlights` cache table.

**Team colors**
- New `src/lib/nfl-teams.ts`: static map of all 32 abbreviations (CIN, MIN, ...) plus `DST` handling to `{ name, primary, secondary, accent }` hex values. No network call, no DB change.
- Celebration applies these via inline CSS custom properties (`--team-primary`, `--team-secondary`) on the dialog root; `src/styles.css` celebration rules switch from hardcoded gold to `var(--team-primary, <gold>)` so existing behavior is the fallback.

**Image lookup**
- New `src/lib/player-media.functions.ts`, a `createServerFn` shaped like `findPlayerHighlight`: read cache → on miss run two `searchWeb` image-oriented queries (`"<name>" <team> action photo`, `"<name>" headshot`) → let the Lovable AI Gateway model pick the best direct image URL for each → write cache → return.
- Validate candidates: must be an absolute https URL ending in a known image extension or from a known sports CDN; reject anything else so the UI is not handed HTML pages.

**UI**
- `src/routes/draft.$code.tsx`: extend the `spotlight` state with `media: { actionUrl, headshotUrl } | null`; fire the media lookup alongside the highlight lookup; images render with `onError` clearing that slot so the fallback shows.
- Celebration markup gains the action-photo layer, gradient scrim, and headshot ring; team palette drives confetti, sweep, and accent text.
- `src/styles.css`: add `celebration-photo` (ken-burns zoom), `celebration-scrim`, and `celebration-headshot` (pop-in with colored ring) animations, all disabled under `prefers-reduced-motion`.

**Note on images:** photos come from public web search results, so a given player may occasionally return a lower-quality or missing image. The fallback keeps the card looking intentional either way. If you'd rather have guaranteed-quality photos, a licensed image source can be wired in later.
