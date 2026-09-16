import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { Search, Star, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { POSITIONS, POSITION_CLASS, matchPlayers } from "@/lib/draft-utils";
import type { Player } from "@/lib/useDraftRoom";

const PAGE = 40;

type Props = {
  players: Player[];
  watchlist: string[];
  onToggleWatch: (playerId: string) => void;
  onDraft: (player: Player) => void;
  disabled?: boolean;
};

export function PlayerList({
  players,
  watchlist,
  onToggleWatch,
  onDraft,
  disabled,
}: Props) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string | null>(null);
  const [onlyWatched, setOnlyWatched] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    let list = players;
    if (position) list = list.filter((p) => p.position === position);
    if (onlyWatched) list = list.filter((p) => watchlist.includes(p.id));
    if (query.trim()) {
      return matchPlayers(query, list, 60)
        .filter((c) => c.score > 0.35)
        .map((c) => c.player);
    }
    return list;
  }, [players, position, onlyWatched, watchlist, query]);

  useEffect(() => {
    setVisible(PAGE);
  }, [query, position, onlyWatched]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisible((v) => v + PAGE);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players"
            className="h-11 pl-9 pr-9 text-base"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!position && !onlyWatched} onClick={() => { setPosition(null); setOnlyWatched(false); }}>
            All
          </FilterChip>
          {POSITIONS.map((p) => (
            <FilterChip
              key={p}
              active={position === p}
              onClick={() => setPosition(position === p ? null : p)}
            >
              {p}
            </FilterChip>
          ))}
          <FilterChip active={onlyWatched} onClick={() => setOnlyWatched((v) => !v)}>
            <Star className="mr-1 h-3 w-3" /> {watchlist.length}
          </FilterChip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin overscroll-contain">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No available players match that.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.slice(0, visible).map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                watched={watchlist.includes(player.id)}
                onToggleWatch={() => onToggleWatch(player.id)}
                onDraft={() => onDraft(player)}
                disabled={disabled}
              />
            ))}
          </ul>
        )}
        <div ref={sentinel} className="h-8" />
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface-2 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PlayerRow({
  player,
  watched,
  onToggleWatch,
  onDraft,
  disabled,
}: {
  player: Player;
  watched: boolean;
  onToggleWatch: () => void;
  onDraft: () => void;
  disabled?: boolean;
}) {
  const x = useMotionValue(0);
  const draftOpacity = useTransform(x, [20, 110], [0, 1]);
  const watchOpacity = useTransform(x, [-110, -20], [1, 0]);

  return (
    <li className="relative overflow-hidden">
      <motion.div
        style={{ opacity: draftOpacity }}
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center bg-primary/15 px-4 text-sm font-bold uppercase text-primary"
      >
        Draft
      </motion.div>
      <motion.div
        style={{ opacity: watchOpacity }}
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-clock/15 px-4 text-sm font-bold uppercase text-clock"
      >
        Watch
      </motion.div>
      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        onDragEnd={(_, info) => {
          if (info.offset.x > 110 && !disabled) onDraft();
          else if (info.offset.x < -110) onToggleWatch();
        }}
        className="relative flex touch-pan-y items-center gap-3 bg-surface px-4 py-2.5"
      >
        <span className="w-8 shrink-0 text-center font-display text-lg text-muted-foreground">
          {player.rank}
        </span>
        <span className={`pos-chip shrink-0 ${POSITION_CLASS[player.position] ?? ""}`}>
          {player.position}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{player.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {player.nfl_team}
            {player.bye_week ? ` · Bye ${player.bye_week}` : ""}
            {player.stat_line ? ` · ${player.stat_line}` : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 shrink-0 ${watched ? "text-clock" : "text-muted-foreground"}`}
          onClick={onToggleWatch}
          aria-label={watched ? `Unwatch ${player.name}` : `Watch ${player.name}`}
        >
          <Star className={`h-4 w-4 ${watched ? "fill-current" : ""}`} />
        </Button>
        <Button
          size="sm"
          className="shrink-0"
          onClick={onDraft}
          disabled={disabled}
        >
          Draft
        </Button>
      </motion.div>
    </li>
  );
}
