import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Clock,
  Download,
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PlayerList } from "@/components/draft/PlayerList";
import { VoicePick } from "@/components/draft/VoicePick";
import { makePick, undoLastPick } from "@/lib/draft.functions";
import { findPlayerHighlight, type HighlightResult } from "@/lib/highlights.functions";
import {
  POSITION_CLASS,
  formatClock,
  picksToCsv,
  slotForOverall,
} from "@/lib/draft-utils";
import { useDraftRoom, type Player } from "@/lib/useDraftRoom";

export const Route = createFileRoute("/draft/$code")({
  head: () => ({
    meta: [
      { title: "Draft Board — Snapcount" },
      {
        name: "description",
        content:
          "Live fantasy football draft board: call picks out loud, track every roster and watch highlights land in real time.",
      },
      { property: "og:title", content: "Draft Board — Snapcount" },
      {
        property: "og:description",
        content: "Follow every pick on the live Snapcount draft board.",
      },
    ],
  }),
  component: DraftBoard,
});

function DraftBoard() {
  const { code } = Route.useParams();
  const { draft, teams, picks, players, isLoading, notFound, refresh } =
    useDraftRoom(code);
  const pick = useServerFn(makePick);
  const undo = useServerFn(undoLastPick);
  const highlight = useServerFn(findPlayerHighlight);

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [spotlight, setSpotlight] = useState<
    { player: Player; teamName: string; highlight: HighlightResult | null } | null
  >(null);

  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );
  const draftedIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);
  const available = useMemo(
    () => players.filter((p) => !draftedIds.has(p.id)),
    [players, draftedIds],
  );

  const complete = draft?.status === "complete";
  const current = draft && !complete
    ? slotForOverall(draft.current_overall, draft.team_count, draft.order_type)
    : null;
  const onTheClock = current
    ? teams.find((t) => t.slot === current.slot) ?? null
    : null;
  const nextUp =
    draft && current && draft.current_overall < draft.team_count * draft.rounds
      ? teams.find(
          (t) =>
            t.slot ===
            slotForOverall(draft.current_overall + 1, draft.team_count, draft.order_type)
              .slot,
        ) ?? null
      : null;

  useEffect(() => {
    if (!draft) return;
    setRemaining(draft.clock_seconds);
  }, [draft?.current_overall, draft?.clock_seconds, draft]);

  useEffect(() => {
    if (paused || complete || !draft) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [paused, complete, draft, draft?.current_overall]);

  const submitPick = useCallback(
    async (player: Player) => {
      if (!draft || busy || complete) return;
      setBusy(true);
      const teamName = onTheClock?.name ?? "";
      try {
        await pick({ data: { draftId: draft.id, playerId: player.id } });
        refresh();
        setWatchlist((w) => w.filter((id) => id !== player.id));
        setSpotlight({ player, teamName, highlight: null });
        toast.success(`${teamName} selects ${player.name}`);
        void highlight({ data: { playerId: player.id } })
          .then((result) =>
            setSpotlight((prev) =>
              prev && prev.player.id === player.id ? { ...prev, highlight: result } : prev,
            ),
          )
          .catch(() => undefined);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That pick didn't go through");
      } finally {
        setBusy(false);
      }
    },
    [draft, busy, complete, onTheClock, pick, refresh, highlight],
  );

  const exportCsv = () => {
    if (!draft) return;
    const rows = picks.map((p) => {
      const player = playersById.get(p.player_id);
      const team = teams.find((t) => t.id === p.team_id);
      return {
        overall: p.overall,
        round: p.round,
        pickInRound: p.pick_in_round,
        team: team?.name ?? "",
        player: player?.name ?? "",
        position: player?.position ?? "",
        nflTeam: player?.nfl_team ?? "",
        bye: player?.bye_week ?? null,
      };
    });
    const blob = new Blob([picksToCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.league_name.replace(/\s+/g, "-").toLowerCase()}-draft.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading the board…
      </main>
    );
  }

  if (notFound || !draft) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="text-4xl">No draft with code {code}</h1>
          <p className="mt-3 text-muted-foreground">
            Double-check the code, or set up a new draft.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Back to setup</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-surface px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground" aria-label="Back to setup">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-2xl leading-none">{draft.league_name}</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Room {draft.room_code} · {draft.order_type} · {draft.rounds} rounds
          </p>
        </div>

        <div className="ml-auto flex items-center gap-4">
          {complete ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-primary/15 px-4 py-2 font-display text-2xl text-primary">
              <Trophy className="h-5 w-5" /> Draft complete
            </span>
          ) : (
            <>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  On the clock · {current?.round}.{String(current?.pickInRound).padStart(2, "0")}
                </p>
                <p
                  className="font-display text-3xl leading-none"
                  style={{ color: onTheClock?.color }}
                >
                  {onTheClock?.name ?? "—"}
                </p>
              </div>
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-display text-4xl leading-none tabular-nums ${
                  remaining <= 10 ? "bg-destructive/20 text-destructive" : "bg-surface-2 text-clock"
                }`}
              >
                <Clock className="h-6 w-6" />
                {formatClock(remaining)}
              </div>
              <Button variant="secondary" size="icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume clock" : "Pause clock"}>
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="icon"
            aria-label="Undo last pick"
            disabled={picks.length === 0}
            onClick={async () => {
              await undo({ data: { draftId: draft.id } });
              refresh();
              setSpotlight(null);
              toast.success("Last pick undone");
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={exportCsv} aria-label="Export results">
            <Download className="h-4 w-4" />
          </Button>
          <Button asChild variant="secondary">
            <Link to="/recap/$code" params={{ code }}>Recap</Link>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="min-h-0 flex-1 overflow-auto scrollbar-thin p-4">
          {nextUp && !complete && (
            <p className="mb-3 text-sm text-muted-foreground">
              Next up: <span className="font-semibold text-foreground">{nextUp.name}</span>
            </p>
          )}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${teams.length}, minmax(140px, 1fr))` }}
          >
            {teams.map((team) => (
              <div key={team.id} className="min-w-0">
                <div
                  className="sticky top-0 z-10 rounded-t-md border-b-4 bg-surface px-2 py-2"
                  style={{ borderColor: team.color }}
                >
                  <p className="truncate font-display text-lg leading-tight">{team.name}</p>
                  <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                    {team.manager || `Slot ${team.slot}`}
                  </p>
                </div>
                <ul className="mt-1 space-y-1">
                  {Array.from({ length: draft.rounds }, (_, r) => {
                    const round = r + 1;
                    const entry = picks.find(
                      (p) => p.team_id === team.id && p.round === round,
                    );
                    const player = entry ? playersById.get(entry.player_id) : undefined;
                    const isCurrent =
                      !complete &&
                      current?.round === round &&
                      onTheClock?.id === team.id;
                    return (
                      <li
                        key={round}
                        className={`rounded-md px-2 py-1.5 text-sm ${
                          player
                            ? "bg-surface"
                            : isCurrent
                              ? "animate-pulse bg-primary/15 ring-1 ring-primary"
                              : "bg-surface-2/50"
                        }`}
                      >
                        {player ? (
                          <>
                            <span className="flex items-center gap-1.5">
                              <span className={`pos-chip ${POSITION_CLASS[player.position] ?? ""}`}>
                                {player.position}
                              </span>
                              <span className="truncate font-semibold">{player.name}</span>
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {player.nfl_team} · {round}.
                              {String(entry!.pick_in_round).padStart(2, "0")}
                            </span>
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
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-border bg-surface lg:w-[400px] lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-1">
            <PlayerList
              players={available}
              watchlist={watchlist}
              onToggleWatch={(id) =>
                setWatchlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
              }
              onDraft={submitPick}
              disabled={busy || complete}
            />
          </div>
          {!complete && (
            <VoicePick players={available} onConfirm={submitPick} disabled={busy} />
          )}
        </aside>
      </div>

      <AnimatePresence>
        {spotlight && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="pointer-events-auto fixed bottom-4 left-4 z-50 w-[min(480px,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-4 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSpotlight(null)}
              aria-label="Dismiss highlight"
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-xs uppercase tracking-widest text-primary">
              {spotlight.teamName} selects
            </p>
            <p className="font-display text-3xl leading-tight">{spotlight.player.name}</p>
            <p className="text-sm text-muted-foreground">
              {spotlight.player.position} · {spotlight.player.nfl_team}
              {spotlight.player.stat_line ? ` · ${spotlight.player.stat_line}` : ""}
            </p>
            {spotlight.highlight ? (
              <div className="mt-3">
                {spotlight.highlight.summary && (
                  <p className="text-sm">{spotlight.highlight.summary}</p>
                )}
                {spotlight.highlight.url && (
                  <a
                    href={spotlight.highlight.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {spotlight.highlight.title ?? "Watch highlights"}
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Finding highlights…</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
