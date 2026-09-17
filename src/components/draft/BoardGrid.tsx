import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { POSITION_CLASS } from "@/lib/draft-utils";
import type { DraftTeam, Pick, Player } from "@/lib/useDraftRoom";

type Props = {
  teams: DraftTeam[];
  picks: Pick[];
  playersById: Map<string, Player>;
  rounds: number;
  currentRound: number | null;
  onTheClockId: string | null;
  complete: boolean;
  /** "full" shows every team; "window" shows a sliding set centred on the drafter. */
  variant?: "full" | "window";
  windowSize?: number;
  compact?: boolean;
};

export function BoardGrid({
  teams,
  picks,
  playersById,
  rounds,
  currentRound,
  onTheClockId,
  complete,
  variant = "full",
  windowSize = 5,
  compact = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [boardWidth, setBoardWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setBoardWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    });
    ro.observe(el);
    setBoardWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const focusIndex = useMemo(() => {
    const i = teams.findIndex((t) => t.id === onTheClockId);
    return i >= 0 ? i : 0;
  }, [teams, onTheClockId]);

  // Manual peeking offsets the window away from the drafting team; it snaps
  // back whenever the pick advances.
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [focusIndex]);

  if (variant === "window") {
    const size = Math.min(windowSize, teams.length);
    const half = Math.floor(size / 2);
    const maxStart = Math.max(0, teams.length - size);
    const rawStart = focusIndex - half + offset;
    const start = Math.min(Math.max(rawStart, 0), maxStart);
    const visible = teams.slice(start, start + size);

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Show earlier teams"
            disabled={start === 0}
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">
            Teams {start + 1}–{start + visible.length} of {teams.length}
            {offset !== 0 && " · peeking"}
          </p>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Show later teams"
            disabled={start >= maxStart}
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="grid min-h-0 flex-1 gap-2 overflow-y-auto scrollbar-thin"
          style={{
            gridTemplateColumns: visible
              .map((t) => (t.id === onTheClockId && !complete ? "1.7fr" : "1fr"))
              .join(" "),
          }}
        >
          {visible.map((team) => {
            const focused = team.id === onTheClockId && !complete;
            return (
              <TeamColumn
                key={team.id}
                team={team}
                picks={picks}
                playersById={playersById}
                rounds={rounds}
                currentRound={currentRound}
                isOnClock={team.id === onTheClockId}
                complete={complete}
                focused={focused}
                fullNames
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Full board ----
  const teamCount = teams.length || 1;
  const colFloor = compact ? 76 : 92;
  const gapPx = compact ? 4 : 6;
  const usable = boardWidth > 0 ? boardWidth - gapPx * (teamCount - 1) : 0;
  const fluidCol = usable > 0 ? Math.floor(usable / teamCount) : 0;
  const legacyMin =
    (teamCount <= 10 ? 140 : teamCount <= 12 ? 104 : teamCount <= 14 ? 96 : 88) -
    (compact ? 16 : 0);
  const colMin = Math.max(colFloor, Math.min(legacyMin, fluidCol || legacyMin));
  const narrow = fluidCol > 0 && fluidCol < 96;

  return (
    <div ref={scrollRef} className="min-w-0">
      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: `repeat(${teamCount}, minmax(${colMin}px, 1fr))`,
          minWidth: `${teamCount * colMin + gapPx * (teamCount - 1)}px`,
          gap: compact ? "0.25rem" : "0.375rem",
        }}
      >
        {teams.map((team) => (
          <TeamColumn
            key={team.id}
            team={team}
            picks={picks}
            playersById={playersById}
            rounds={rounds}
            currentRound={currentRound}
            isOnClock={team.id === onTheClockId}
            complete={complete}
            compact={compact}
            narrow={narrow}
          />
        ))}
      </div>
    </div>
  );
}

function TeamColumn({
  team,
  picks,
  playersById,
  rounds,
  currentRound,
  isOnClock,
  complete,
  compact = false,
  narrow = false,
  focused = false,
  fullNames = false,
}: {
  team: DraftTeam;
  picks: Pick[];
  playersById: Map<string, Player>;
  rounds: number;
  currentRound: number | null;
  isOnClock: boolean;
  complete: boolean;
  compact?: boolean;
  narrow?: boolean;
  focused?: boolean;
  fullNames?: boolean;
}) {
  return (
    <div
      className={`min-w-0 ${
        focused ? "rounded-lg bg-surface-2/40 p-1.5 ring-2 ring-offset-0" : ""
      }`}
      style={focused ? { boxShadow: `0 0 0 2px ${team.color}` } : undefined}
    >
      <div
        className={`sticky top-0 z-10 rounded-t-md border-b-4 bg-surface ${
          narrow ? "px-1" : "px-2"
        } ${compact || narrow ? "py-1" : "py-2"}`}
        style={{ borderColor: team.color }}
      >
        <p
          className={`font-display leading-tight ${fullNames ? "break-words" : "truncate"} ${
            focused ? "text-2xl" : compact || narrow ? "text-base" : "text-lg"
          }`}
          style={focused ? { color: team.color } : undefined}
        >
          {team.name}
        </p>
        {(focused || (!compact && !narrow)) && (
          <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {team.manager || `Slot ${team.slot}`}
          </p>
        )}
      </div>
      <ul className="mt-1 space-y-1">
        {Array.from({ length: rounds }, (_, r) => {
          const round = r + 1;
          const entry = picks.find((p) => p.team_id === team.id && p.round === round);
          const player = entry ? playersById.get(entry.player_id) : undefined;
          const isCurrent = !complete && currentRound === round && isOnClock;
          return (
            <li
              key={round}
              className={`rounded-md ${narrow ? "px-1" : "px-2"} ${
                compact ? "py-1 text-xs" : "py-1.5 text-sm"
              } ${focused ? "py-2 text-base" : ""} ${
                player
                  ? "bg-surface"
                  : isCurrent
                    ? "animate-pulse bg-primary/15 ring-1 ring-primary"
                    : "bg-surface-2/50"
              }`}
            >
              {player ? (
                <>
                  <span className="flex min-w-0 items-start gap-1.5">
                    <span className={`pos-chip shrink-0 ${POSITION_CLASS[player.position] ?? ""}`}>
                      {player.position}
                    </span>
                    <span
                      className={`font-semibold ${fullNames ? "break-words" : "truncate"}`}
                    >
                      {player.name}
                    </span>
                  </span>
                  {(fullNames || (!compact && !narrow)) && (
                    <span className="text-[11px] text-muted-foreground">
                      {player.nfl_team} · {round}.
                      {String(entry?.pick_in_round ?? 0).padStart(2, "0")}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Rd {round}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
