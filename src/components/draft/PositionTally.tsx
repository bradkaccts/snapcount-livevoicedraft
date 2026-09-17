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
      className="pos-tally min-w-0 flex-1 items-center"
      role="status"
      aria-label={`Players drafted by position: ${POSITIONS.map(
        (pos) => `${counts[pos] ?? 0} ${pos}`,
      ).join(", ")}`}
    >
      <span
        className="tally-label mr-1 hidden shrink-0 font-display uppercase tracking-widest text-muted-foreground md:inline"
        style={{ fontSize: "clamp(0.55rem, 2.4cqi, 0.75rem)" }}
      >
        Drafted
      </span>
      {POSITIONS.map((pos) => {
        const count = counts[pos] ?? 0;
        return (
          <span
            key={pos}
            title={`${count} ${pos} drafted`}
            className={`pos-chip shrink-0 tabular-nums transition-opacity ${
              count > 0 ? POSITION_CLASS[pos] : "bg-surface-2 text-muted-foreground opacity-60"
            }`}
          >
            {pos}
            <span className="ml-1 font-display">{count}</span>
          </span>
        );
      })}
      <span
        className="tally-total ml-1 shrink-0 font-display uppercase tracking-widest text-muted-foreground tabular-nums"
        style={{ fontSize: "clamp(0.6rem, 2.6cqi, 0.85rem)" }}
      >
        {total} total
      </span>
    </div>
  );
}
