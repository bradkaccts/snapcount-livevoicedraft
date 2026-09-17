import { useMemo } from "react";

import { POSITIONS, POSITION_CLASS } from "@/lib/draft-utils";
import type { Pick, Player } from "@/lib/useDraftRoom";

type Props = {
  picks: Pick[];
  playersById: Map<string, Player>;
};

/**
 * Running tally of how many players have been drafted at each position.
 * Reads live from the picks list, so it updates the moment a pick lands.
 */
export function PositionTally({ picks, playersById }: Props) {
  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const p of picks) {
      const pos = playersById.get(p.player_id)?.position;
      if (pos) tally[pos] = (tally[pos] ?? 0) + 1;
    }
    return tally;
  }, [picks, playersById]);

  const total = picks.length;

  return (
    <div
      className="flex items-center gap-1.5"
      role="status"
      aria-label={`Players drafted by position: ${POSITIONS.map(
        (pos) => `${counts[pos] ?? 0} ${pos}`,
      ).join(", ")}`}
    >
      <span className="mr-1 hidden font-display text-[10px] uppercase tracking-widest text-muted-foreground lg:inline">
        Drafted
      </span>
      {POSITIONS.map((pos) => {
        const count = counts[pos] ?? 0;
        return (
          <span
            key={pos}
            title={`${count} ${pos} drafted`}
            className={`pos-chip tabular-nums transition-opacity ${
              count > 0 ? POSITION_CLASS[pos] : "bg-surface-2 text-muted-foreground opacity-60"
            }`}
          >
            {pos}
            <span className="ml-1 font-display">{count}</span>
          </span>
        );
      })}
      <span className="ml-1 font-display text-xs uppercase tracking-widest text-muted-foreground tabular-nums">
        {total} total
      </span>
    </div>
  );
}
