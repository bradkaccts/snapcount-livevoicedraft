import { Timer } from "lucide-react";

import { POSITION_CLASS } from "@/lib/draft-utils";
import type { DraftTeam, Pick, Player } from "@/lib/useDraftRoom";

type Props = {
  picks: Pick[];
  teams: DraftTeam[];
  playersById: Map<string, Player>;
};

export function PicksTicker({ picks, teams, playersById }: Props) {
  if (picks.length === 0) return null;
  const ordered = [...picks].sort((a, b) => b.overall - a.overall);

  return (
    <footer className="shrink-0 border-t border-border bg-surface" aria-label="Previous picks">
      <div className="flex items-stretch">
        <span className="flex shrink-0 items-center gap-1.5 border-r border-border bg-surface-2 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-clock">
          <Timer className="h-3.5 w-3.5" /> Latest picks
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex w-max items-center gap-8 py-1.5 pr-8">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex items-center gap-8" aria-hidden={copy === 1}>
                {ordered.map((p) => {
                  const player = playersById.get(p.player_id);
                  const team = teams.find((t) => t.id === p.team_id);
                  if (!player) return null;
                  return (
                    <span
                      key={`${copy}-${p.id}`}
                      className="flex items-center gap-2 whitespace-nowrap text-sm"
                    >
                      <span className="font-display text-muted-foreground tabular-nums">
                        {p.round}.{String(p.pick_in_round).padStart(2, "0")}
                      </span>
                      <span className={`pos-chip ${POSITION_CLASS[player.position] ?? ""}`}>
                        {player.position}
                      </span>
                      <span className="font-semibold">{player.name}</span>
                      <span className="text-muted-foreground">{player.nfl_team}</span>
                      <span
                        className="font-display uppercase tracking-wide"
                        style={{ color: team?.color }}
                      >
                        → {team?.name ?? ""}
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
