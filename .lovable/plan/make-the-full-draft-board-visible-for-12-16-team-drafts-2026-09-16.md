# Make the full draft board visible for 12-16 team drafts

## What's happening now

The board gives every team a column at least 140px wide. With 12-16 teams that's wider than the screen, so the extra teams sit off to the right inside a scroll area with no visible scrollbar or edge hint. It looks like only ten teams exist.

## The fix

Three changes, smallest effort first:

1. **Auto-fit the columns to the team count.** Columns shrink as teams are added (down to a readable floor) so 12 teams fit on a normal laptop screen without scrolling and 16 teams fit on a wide screen. Names, position chips and pick labels get slightly tighter type at the smaller widths so nothing clips.

2. **A board density control.** A small "Comfortable / Compact" toggle in the board header. Compact shrinks row height and hides the secondary line (NFL team / pick number) so the whole board fits even on smaller screens. The choice is remembered per browser.

3. **Clear scroll affordance when it still doesn't fit.** On narrow screens the board stays horizontally scrollable, but with a fading edge on the right and left so it's obvious more teams are there, plus the team-name headers stay pinned while scrolling vertically.

## Technical notes

- In `src/routes/draft.$code.tsx`, replace the fixed `minmax(140px, 1fr)` grid template with a computed minimum based on `teams.length` (e.g. 140px at <=10 teams, stepping to ~104px at 16), still `1fr` max so columns stretch when there's room.
- Density state held in the route component, persisted to `localStorage`, applied as a class that drives row padding, font size and visibility of the secondary pick line.
- Sticky team headers already exist; add horizontal edge-fade overlays on the scrolling `section` and keep `overflow-auto`.
- No data, pick logic, celebration or ticker changes.
