# Fantasy Football Live Draft Board

A shared-screen draft simulator for in-person drafts: one big board, voice-called picks, instant player highlights, and a clean export at the end. Built so remote drafting can be added later without a rebuild.

## Phase 1 — what we build now

### Draft setup
- Create a draft: league name, number of teams (4-16), roster size, rounds, pick clock length, snake or linear order.
- Add team names (and optional manager name/color).
- Randomize draft order with an on-screen shuffle animation, plus manual reorder by dragging.
- Setup is saved so a draft can be resumed if the page reloads.

### The board
- Full-screen grid: teams across the top, rounds down the side, filled picks shown as player cards.
- Current pick highlighted with a countdown clock, on-the-clock team name, and next-up preview.
- Recent picks ticker and a running "best available" panel.
- Undo last pick, edit a pick, pause/resume the clock.

### Voice picks
- A large mic button on the board. Press, speak the pick ("Bijan Robinson"), release.
- Speech is transcribed and streamed back to the screen live as words are recognized.
- The transcript is matched against the available player pool with fuzzy matching (nicknames, last name only, team/position hints).
- A confirm card shows the matched player with alternatives; the commissioner confirms or corrects with one tap. No pick is ever committed on a guess alone.
- Typing/tapping a pick always works as a fallback.

### Player search and browsing
- Search bar with instant fuzzy results; filters by position, NFL team, and drafted/available.
- Smooth infinite-scroll list with sticky position headers.
- Swipe left to queue a player to a watchlist, swipe right to draft; tap opens the player detail sheet.
- Keyboard shortcuts for the commissioner (arrow keys, Enter to draft, U to undo).

### Highlights
- The moment a pick is confirmed, an assistant searches the web for that player's highlight reel and shows the top result on the board as a celebratory pick card with title, source, and a play link/embed.
- Results are cached per player, so replaying a draft with the same players is instant.
- If nothing suitable is found, the card falls back to the player's stat summary — never a broken embed.

### Player data
- Built-in player pool seeded into the database: name, position, NFL team, bye week, ranking/ADP, and a short stat line.
- Yahoo/ESPN league import is Phase 2 (see below).

### After the draft
- Team-by-team results view with roster slots filled by position.
- Export as CSV and printable/PDF-style sheet; copy-to-clipboard text summary.
- Shareable read-only recap link for the finished draft.

### Quality-of-life
- Autosave every pick; resume a draft mid-session.
- Pick timer with sound cues and auto-pick-best-available option when the clock expires.
- Dark, high-contrast board readable across a room; large type.
- Mobile layout for the search/browse surface so a phone can act as the picking device on the same draft.

## Phase 2 — planned, not built yet
- Remote drafting: each manager joins the room from their own device and picks on the clock, with live sync to the shared board.
- Real league import from Yahoo and ESPN (league settings, teams, keepers) via the league owner authorizing access.
- Optional accounts to save draft history.

Phase 1 is structured for this: drafts live in the database with a room code, and every pick is written as a row, so adding live sync and per-device picking later is additive.

## Technical notes
- Lovable Cloud provides the database, realtime, and server functions. Tables: `drafts`, `draft_teams`, `players`, `picks`, `highlights` (cache). Public read/write scoped by room code since there is no sign-in; all writes go through server functions that validate draft state.
- Player pool seeded via a migration with literal insert statements.
- Speech-to-text: audio captured in the browser as WAV, uploaded to a server function, transcribed with Lovable AI streaming transcription, and deltas streamed back to the board.
- Player matching: server-side fuzzy match against the remaining pool, returning ranked candidates with confidence.
- Highlights: an AI agent with a web-search tool runs server-side after each pick, returns a video title/URL/source, and the result is cached in `highlights`.
- Realtime board updates via Cloud realtime subscriptions on `picks`, so the Phase 2 multi-device step is a client change rather than a backend rewrite.
- Swipe and scroll interactions use gesture handling with motion-based animation; list virtualized for a 500+ player pool.

## Build order
1. Cloud setup, schema, seeded player pool.
2. Draft setup wizard with order randomizer.
3. Draft board with clock, manual picking, undo, autosave.
4. Player search/browse with filters, infinite scroll, swipe actions.
5. Voice picking with live transcript and confirm step.
6. Auto highlight lookup and pick celebration card.
7. Results view, CSV/print export, recap link.
8. Polish: sounds, shortcuts, mobile layout, empty/error states.
