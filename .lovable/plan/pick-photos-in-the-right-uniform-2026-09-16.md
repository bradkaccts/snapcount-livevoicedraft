# Pick photos in the right uniform

Right now a player's action photo is chosen by picking the largest matching image from the free photo library, with no sense of when it was taken or which team the player was on. That is why college and all-star game shots keep winning — those photos are often the biggest ones available.

## What changes

1. **Search with the team, not just the name.** Run several searches per player — name plus current NFL team name, name plus team city, and name alone — and pool the results instead of relying on one generic query.

2. **Score every candidate instead of taking the biggest.** Each photo gets a score built from:
   - Strong bonus if the photo's title or description mentions the player's current NFL team (full name, city, or nickname).
   - Bonus scaled by how recent the photo is, using the capture/upload year from the photo's metadata and any year written in its title. Anything from the last three seasons ranks highest.
   - Penalty for college, university, high school, combine, draft-day, all-star and all-American wording, and for any other NFL team's name appearing in the title (a photo from a former team).
   - Small bonus for image size and landscape shape, so a good match still looks sharp full-screen — size becomes a tiebreaker, not the deciding factor.

3. **Reject bad matches outright.** If the best-scoring photo still looks like college or a former team, no action photo is used and the celebration falls back to the team-colored treatment it already has. A wrong-uniform photo is worse than none.

4. **Same treatment for the round headshot,** preferring the current-team portrait when one exists.

5. **Cache the decision with its score and reasoning**, so a player's photo is looked up once and stays stable through the draft. Existing cached entries chosen by the old logic are refreshed once so bad picks already saved get re-evaluated.

## Honest limits

The free photo library skews old for many players — some simply have no recent NFL-uniform photo available. For those, expect the fallback look rather than a wrong-uniform photo. If you later want guaranteed current-season action shots for every player, that needs a licensed sports photo feed, which is a separate paid integration.

## Technical notes

- `src/lib/player-media.functions.ts`: multi-query Commons search, request `extmetadata` alongside `imageinfo` for DateTimeOriginal and description, add a `scoreCandidate` helper, apply a minimum score threshold before accepting a URL.
- `src/lib/nfl-teams.ts`: extend the team map with `city`, `nickname`, and search aliases so scoring can match team wording; build a set of all other teams' names for the former-team penalty.
- `player_media` table: add nullable `score` and `chosen_at`/version marker so old cached rows are recomputed once on next lookup.
- Celebration UI in `src/routes/draft.$code.tsx` is unchanged — it already handles a null action photo.
