# Call the Pick — hands-free drafting

Make the mic button a real drafting tool: speak a pick, see the words appear live, and have the board draft the player automatically when the call is unambiguous.

## How it will work

1. Commissioner presses **Call the Pick**, speaks, presses stop.
2. The words appear on screen as they are recognized.
3. The system pulls the player's name out of the sentence and matches it against the players still available.
4. **Auto-draft** happens only when the spoken call includes both the player's name *and* his NFL club — city and nickname — e.g. "Team Alpha selects Bijan Robinson, Atlanta Falcons". The board then plays the usual celebration.
5. Anything less certain (name only, fuzzy name, several close players) shows the confirm card that exists today, with the best match highlighted and alternatives beneath it.
6. If nothing matched, a clear "didn't catch that" message with the heard text, and typing/tapping still works.

A short "Drafting Bijan Robinson — tap to cancel" bar appears for about 3 seconds before an auto-draft commits, so a mis-hear can be stopped without an undo.

## Accuracy work

- Keep the hosted transcription service already wired up. It is the most accurate option for player names on any laptop and needs no multi-hundred-megabyte model download on draft night. (An on-device open-source option was considered; it is slower and noticeably worse on proper nouns, which is exactly what this feature needs.)
- Bias the transcriber toward the draft: send the remaining player pool and the 32 club names along with the audio as a hint list so names like "Ja'Marr Chase" and "Bijan" come back spelled correctly.
- Add a name-extraction step that strips draft chatter ("with the seventh pick", "I'll take", team manager names) and isolates the player name plus any club words.
- Improve the matcher: nickname/alias table (Bijan, CMC, Hollywood, JSN, etc.), last-name-only handling, phonetic fallback so "Nabors" finds "Nabers", and a confidence score.
- Club words spoken in the call are used as a filter first, then as a scoring boost — so "Chase, Bengals" can never resolve to a different Chase.

## Quality of life

- Mic permission is requested once with a friendly explainer instead of a raw browser error.
- A live level meter while recording, so the speaker knows it is hearing them.
- Spacebar push-to-talk on the board as an alternative to clicking.
- Every voice pick is logged with what was heard and what was matched, so a bad call can be traced.
- Already-drafted players are excluded from matching, and calling one back says so explicitly.

## Technical notes

- Client: `src/lib/recorder.ts` keeps WAV capture; add an audio level callback and a push-to-talk hook.
- Server: `src/routes/api/public/transcribe.ts` keeps streaming SSE transcription via the Lovable AI gateway (`google/gemini-3.5-transcribe`), extended to accept an optional vocabulary hint list posted alongside the audio.
- New `src/lib/voice-pick.functions.ts` server function: takes the final transcript plus the draft code, loads the available pool server-side, runs extraction + matching, and returns `{ status: "auto" | "confirm" | "none", player, alternatives, confidence, heardTeam }`. Matching lives server-side so the board and any future phone client behave identically.
- `src/lib/draft-utils.ts` gains: alias map, club-word extraction (reusing `teamWords` from `src/lib/nfl-teams.ts`), a double-metaphone-style phonetic key, and a combined scorer returning 0..1 confidence.
- Auto-draft rule: `nameConfidence >= 0.8 && spokenClub === player.nfl_team && exactlyOneStrongCandidate`.
- `src/components/draft/VoicePick.tsx` handles the three outcomes, renders the cancel-countdown bar, and calls the existing pick mutation so the celebration and "Now on the Clock" sequence are untouched.
- New `voice_pick_logs` table (draft id, transcript, matched player, confidence, outcome) with the same room-code access as other draft tables.

## Build order

1. Server matching function + alias/phonetic utilities.
2. Vocabulary hints on the transcription route.
3. VoicePick rewired to the server matcher with the three outcomes.
4. Auto-draft with the cancel bar.
5. Level meter, push-to-talk, permission explainer, logging.
