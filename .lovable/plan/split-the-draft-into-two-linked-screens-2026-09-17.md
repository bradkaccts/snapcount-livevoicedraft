# Split the draft into two linked screens

Today one page does everything: the full board, the player list, voice picking, the celebration, and the "Now on the Clock" announcement. That page gets crowded, and the board squeezes every team into a narrow column.

The plan splits it into two screens that share the same live draft and can be open at the same time (two windows, two monitors, or a TV plus a laptop).

## Screen 1 — The Big Board (new, `/board/CODE`)

A presentation screen meant for a TV or projector.

- Full grid of every team and every pick made so far, with room to breathe.
- Round/pick header, who is on the clock, and the countdown clock.
- The full-screen pick celebration (fireworks, confetti, player photo, team colors) plays here.
- The "Now on the Clock" announcement plays here.
- The previous-picks ticker stays along the bottom.
- No player list, no voice controls, no admin buttons — it is view-only.
- Auto-scrolls the board sideways so the drafting team stays in view.

## Screen 2 — The Drafting Console (the current page, edited)

Stays at `/draft/CODE` and keeps everything a drafter uses: player search/list, Call the Pick, undo, pause, setup, export.

Changes to its board area:

- Shows only 5 team columns at a time instead of all of them.
- The team currently on the clock sits in the center slot, with the two teams before and after it on either side.
- The center column is visibly larger and highlighted (bigger type, stronger border, team color accent).
- The window slides automatically as the pick advances, with manual left/right arrows to peek at other teams.
- Every pick shows the player's full name (no truncation), position, and NFL team.
- The celebration and on-the-clock overlays are suppressed here when a Big Board window is detected, so the console stays usable; otherwise they still play as they do today.

## Linking the two

- A "Open Big Board" button on the console opens Screen 1 in a new tab for the same draft code.
- The Big Board has a small link back to the console.
- Both read the same live draft data, so picks, the clock, and celebrations stay in sync across windows.

## Technical notes

- New route `src/routes/board.$code.tsx` reusing `useDraftRoom` for state, with its own `head()` metadata.
- Extract the shared pieces out of `src/routes/draft.$code.tsx` into `src/components/draft/`: `BoardGrid`, `PickCelebration` (spotlight + fireworks + confetti), `OnTheClockOverlay`, `PicksTicker`. Both routes render these; celebration timing, motion budget, and reduced-motion behavior carry over unchanged.
- `BoardGrid` gains a `windowSize` prop (`all` for the Big Board, `5` for the console) and a `focusTeamId`, computing the visible slice around the drafting team with clamping at the start/end of the order.
- Cross-window coordination for suppressing the overlay uses a `BroadcastChannel` keyed on the draft code, with a heartbeat from the Big Board; fallback is showing overlays on both.
- Existing density toggle, responsive column floors, and horizontal scroll fallback stay in place for the Big Board.
