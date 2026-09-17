# Snapcount — Live Fantasy Football Draft Simulator & Tracker

Snapcount turns a fantasy football draft from a spreadsheet slog into a live, broadcast-style event. Create a draft room, share the join code, and run the entire draft on one screen: picks land on the board in real time, selections are announced with a full-screen stadium celebration, and drafters can **call their pick out loud** — Snapcount hears it, finds the player, and puts him on the clock.

## What makes it different

### 🎙️ Call the Pick — voice-driven drafting

Press the mic (or hit spacebar) and speak naturally — *"Team 12 selects Nico Collins, Houston Texans."* Snapcount streams the speech to text live, shows each word on screen like a movie subtitle as it's spoken, then matches the transcript against the player pool.

- **Smart matching**: auto-commits the pick when two of three identifiers are heard (player name, NFL city, or team nickname); a player name alone asks for a quick confirmation.
- **Defense-aware**: saying *"Houston Texans defense"* or *"Houston DST"* resolves straight to the team defense.
- **Robust to noise**: junk-filtered transcripts, sliding-window name matching with phonetic and alias handling, and a near-silence detector that tells you when the mic isn't picking you up.

### 🏟️ Broadcast-grade pick announcements

Every selection gets the full pomp and circumstance: a blackout spotlight sweep, metallic gold-and-team-colored confetti with a pulsing glint, a "The pick is in" banner, round/pick/overall details, and a high-resolution action photo plus headshot of the player, themed in his NFL team's colors. The celebration runs its course automatically, hands off to a **"Now on the Clock"** announcement for the next drafter, and the pick clock starts fresh — no clicking required, the show runs itself.

### 📈 Live previous-picks ticker

A bottom-screen stock ticker scrolls every prior selection — round, pick, player, NFL team — color-coded by drafting team. It loops continuously, pauses on hover, and respects reduced-motion settings.

### 🛰️ Live player data from Sleeper

Player listings, rankings, ADP, and stat lines sync from the [Sleeper API](https://docs.sleeper.app) — free, open, and key-less. A built-in seeded player pool stands by as a fallback if the feed is unavailable, and open draft boards automatically refresh ranks and stat lines whenever the feed updates. (Note: Sleeper's data is free to use but not open-source licensed.)

## Everything a live draft needs

- **Shared draft rooms** — 4 to 16 teams join with a short code; custom team names, managers, and colors.
- **Flexible formats** — snake or linear ordering, configurable rounds, roster size, and pick clock, with randomized draft order.
- **A board that scales** — Comfortable/Compact density modes keep every team column visible even at 16 teams, with horizontal-scroll shading.
- **Player browsing** — search, filter, and scroll the pool with modern list interactions.
- **Draft controls** — pause/resume, undo and edit picks, autosave, and resume a draft where you left off.
- **Draft history** — a post-draft review page with per-team rosters, a chronological timeline, search and position filters, and stat details for every pick.
- **Export** — download draft results as CSV.
- **Player media** — action photos and headshots resolved per player, scored for recency and current-team accuracy, with team-colored fallbacks.

## Tech stack

- **TanStack Start** (React 19, SSR) + TanStack Router and TanStack Query
- **Tailwind CSS v4** with a dark, broadcast-style design system
- **Lovable Cloud** (Supabase) for persistence and realtime room sync
- **Lovable AI Gateway** for streamed speech-to-text
- **Motion** for the announcement choreography

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building. The project is connected to GitHub, so every change made in Lovable is committed straight to this repository, and changes pushed here sync back into Lovable.
