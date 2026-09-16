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
  Sparkles,
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
    {
      player: Player;
      teamName: string;
      highlight: HighlightResult | null;
      overall: number;
      round: number;
      pickInRound: number;
    } | null
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

  // The clock holds at its last value while the celebration is on screen,
  // then resets to the full clock and starts counting the moment it closes.
  useEffect(() => {
    if (!draft || spotlight) return;
    setRemaining(draft.clock_seconds);
  }, [draft?.current_overall, draft?.clock_seconds, draft, spotlight]);

  useEffect(() => {
    if (paused || complete || spotlight || !draft) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [paused, complete, draft, draft?.current_overall, spotlight]);

  // Let the celebration play out (~4s), hold for 3s, then return to the board.
  const spotlightKey = spotlight ? `${spotlight.overall}-${spotlight.player.id}` : null;
  useEffect(() => {
    if (!spotlightKey) return;
    const timer = setTimeout(() => setSpotlight(null), 7000);
    return () => clearTimeout(timer);
  }, [spotlightKey]);

  const submitPick = useCallback(
    async (player: Player) => {
      if (!draft || busy || complete) return;
      setBusy(true);
      const teamName = onTheClock?.name ?? "";
      try {
        await pick({ data: { draftId: draft.id, playerId: player.id } });
        refresh();
        setWatchlist((w) => w.filter((id) => id !== player.id));
        const selection = slotForOverall(
          draft.current_overall,
          draft.team_count,
          draft.order_type,
        );
        setSpotlight({
          player,
          teamName,
          highlight: null,
          overall: draft.current_overall,
          round: selection.round,
          pickInRound: selection.pickInRound,
        });
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
                              {String(entry?.pick_in_round ?? 0).padStart(2, "0")}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/95 px-5 py-8 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label={`${spotlight.player.name} selected by ${spotlight.teamName}`}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0.2] }}
              transition={{ duration: 1.4, times: [0, 0.25, 1] }}
              className="pointer-events-none absolute inset-0 bg-celebration"
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
              <motion.div
                initial={{ rotate: -30, x: "-85%" }}
                animate={{ rotate: 35, x: "85%" }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-28 w-[160vw] bg-celebration blur-3xl"
              />
            </div>

            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {Array.from({ length: 34 }, (_, index) => (
                <motion.span
                  key={index}
                  initial={{
                    left: `${8 + ((index * 29) % 84)}%`,
                    top: "-8%",
                    rotate: 0,
                    opacity: 0,
                  }}
                  animate={{
                    top: "108%",
                    rotate: index % 2 === 0 ? 540 : -540,
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 2.8 + (index % 5) * 0.25,
                    delay: 0.45 + (index % 7) * 0.08,
                    ease: "easeIn",
                  }}
                  className={`absolute h-3 w-1.5 ${
                    index % 3 === 0
                      ? "bg-primary"
                      : index % 3 === 1
                        ? "bg-celebration"
                        : "bg-foreground"
                  }`}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSpotlight(null)}
              aria-label="Dismiss highlight"
              className="absolute right-5 top-5 z-30 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>

            <motion.section
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 150, damping: 16, delay: 0.18 }}
              className="relative flex w-full max-w-5xl flex-col items-center justify-center text-center"
            >
              <div className="absolute left-0 top-0 h-14 w-14 border-l-4 border-t-4 border-celebration sm:h-20 sm:w-20" />
              <div className="absolute bottom-0 right-0 h-14 w-14 border-b-4 border-r-4 border-celebration sm:h-20 sm:w-20" />

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.4, delay: 0.55 }}
                className="mb-4 flex items-center gap-2 bg-celebration px-5 py-2 text-xs font-black uppercase italic tracking-[0.2em] text-celebration-foreground sm:text-sm"
              >
                <Sparkles className="h-4 w-4" /> The pick is in
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.72 }}
                className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground sm:text-sm"
              >
                Round {spotlight.round} · Pick {spotlight.round}.
                {String(spotlight.pickInRound).padStart(2, "0")} · #{spotlight.overall} overall
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, scale: 1.35, filter: "blur(12px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.65, delay: 0.82, ease: [0.2, 0.8, 0.2, 1] }}
                className="max-w-full px-4 font-display text-6xl uppercase leading-[0.82] text-foreground drop-shadow-[0_0_30px_var(--celebration)] sm:text-8xl lg:text-[9rem]"
              >
                {spotlight.player.name}
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.45, delay: 1.15 }}
                className="mt-5 flex w-full max-w-xl items-center justify-center gap-4"
              >
                <span className="h-0.5 flex-1 bg-celebration" />
                <span className={`pos-chip ${POSITION_CLASS[spotlight.player.position] ?? ""}`}>
                  {spotlight.player.position}
                </span>
                <span className="text-lg font-bold uppercase text-celebration sm:text-2xl">
                  {spotlight.player.nfl_team}
                </span>
                <span className="h-0.5 flex-1 bg-celebration" />
              </motion.div>

              {spotlight.player.stat_line && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.35 }}
                  className="mt-4 text-sm text-muted-foreground sm:text-base"
                >
                  {spotlight.player.stat_line}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
                className="mt-8 border-t border-border px-10 pt-6"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                  Selected by
                </p>
                <p className="mt-1 font-display text-3xl uppercase text-foreground sm:text-4xl">
                  {spotlight.teamName}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.75 }}
                className="mt-5 min-h-12 max-w-xl px-4"
              >
                {spotlight.highlight ? (
                  <>
                    {spotlight.highlight.summary && (
                      <p className="text-sm text-muted-foreground">{spotlight.highlight.summary}</p>
                    )}
                    {spotlight.highlight.url && (
                      <Button asChild variant="secondary" className="mt-3">
                        <a href={spotlight.highlight.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          {spotlight.highlight.title ?? "Watch highlights"}
                        </a>
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="animate-pulse text-sm font-semibold uppercase tracking-widest text-celebration-soft">
                    Finding the highlight reel…
                  </p>
                )}
              </motion.div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
