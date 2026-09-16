import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PlayerList } from "@/components/draft/PlayerList";
import { VoicePick } from "@/components/draft/VoicePick";
import { makePick, undoLastPick } from "@/lib/draft.functions";
import { findPlayerHighlight, type HighlightResult } from "@/lib/highlights.functions";
import { findPlayerMedia, type PlayerMedia } from "@/lib/player-media.functions";
import { lighten, readableOn, teamPalette } from "@/lib/nfl-teams";
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
  const playerMedia = useServerFn(findPlayerMedia);

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [spotlight, setSpotlight] = useState<
    {
      player: Player;
      teamName: string;
      highlight: HighlightResult | null;
      media: PlayerMedia | null;
      overall: number;
      round: number;
      pickInRound: number;
    } | null
  >(null);
  const [clockAnnounce, setClockAnnounce] = useState<
    {
      teamId: string;
      teamName: string;
      manager: string | null;
      color: string;
      round: number;
      pickInRound: number;
      overall: number;
    } | null
  >(null);

  const spotlightPalette = teamPalette(spotlight?.player.nfl_team);

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

  // The clock holds at its last value while the celebration or the
  // "Now on the Clock" announcement is on screen, then resets to the full
  // clock and starts counting the moment the announcement closes.
  useEffect(() => {
    if (!draft || spotlight || clockAnnounce) return;
    setRemaining(draft.clock_seconds);
  }, [draft?.current_overall, draft?.clock_seconds, draft, spotlight, clockAnnounce]);

  useEffect(() => {
    if (paused || complete || spotlight || clockAnnounce || !draft) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [paused, complete, draft, draft?.current_overall, spotlight, clockAnnounce]);

  // Let the celebration play out (~4s), hold for 3s, then return to the board.
  const spotlightKey = spotlight ? `${spotlight.overall}-${spotlight.player.id}` : null;
  useEffect(() => {
    if (!spotlightKey) return;
    const timer = setTimeout(() => setSpotlight(null), 7000);
    return () => clearTimeout(timer);
  }, [spotlightKey]);

  // The moment the celebration closes, hand the mic to the next drafter:
  // an automatic "Now on the Clock" announcement, then the countdown begins.
  const celebrationWasOpen = useRef(false);
  const skipNextAnnounce = useRef(false);
  useEffect(() => {
    const wasOpen = celebrationWasOpen.current;
    celebrationWasOpen.current = Boolean(spotlight);
    if (!wasOpen || spotlight || complete || !draft) return;
    if (skipNextAnnounce.current) {
      skipNextAnnounce.current = false;
      return;
    }
    if (!onTheClock || !current) return;
    setClockAnnounce({
      teamId: onTheClock.id,
      teamName: onTheClock.name,
      manager: onTheClock.manager,
      color: onTheClock.color,
      round: current.round,
      pickInRound: current.pickInRound,
      overall: draft.current_overall,
    });
  }, [spotlight, draft, complete, onTheClock, current]);

  // The announcement runs its entrance (~1.2s), holds, then clears itself.
  const announceKey = clockAnnounce ? `${clockAnnounce.overall}-${clockAnnounce.teamId}` : null;
  useEffect(() => {
    if (!announceKey) return;
    const timer = setTimeout(() => setClockAnnounce(null), 4500);
    return () => clearTimeout(timer);
  }, [announceKey]);

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
          media: null,
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
        void playerMedia({ data: { playerId: player.id } })
          .then((media) =>
            setSpotlight((prev) =>
              prev && prev.player.id === player.id ? { ...prev, media } : prev,
            ),
          )
          .catch(() => undefined);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That pick didn't go through");
      } finally {
        setBusy(false);
      }
    },
    [draft, busy, complete, onTheClock, pick, refresh, highlight, playerMedia],
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
              skipNextAnnounce.current = true;
              setSpotlight(null);
              setClockAnnounce(null);
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
            <VoicePick
              draftId={draft.id}
              players={available}
              onConfirm={submitPick}
              disabled={busy}
            />
          )}
        </aside>
      </div>

      {picks.length > 0 && (
        <footer className="shrink-0 border-t border-border bg-surface" aria-label="Previous picks">
          <div className="flex items-stretch">
            <span className="flex shrink-0 items-center gap-1.5 border-r border-border bg-surface-2 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-clock">
              <Timer className="h-3.5 w-3.5" /> Latest picks
            </span>
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <div className="ticker-track flex w-max items-center gap-8 py-1.5 pr-8">
                {[0, 1].map((copy) => (
                  <div key={copy} className="flex items-center gap-8" aria-hidden={copy === 1}>
                    {[...picks].sort((a, b) => b.overall - a.overall).map((p) => {
                      const player = playersById.get(p.player_id);
                      const team = teams.find((t) => t.id === p.team_id);
                      if (!player) return null;
                      return (
                        <span key={`${copy}-${p.id}`} className="flex items-center gap-2 whitespace-nowrap text-sm">
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
      )}

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
            style={
              {
                "--celebration": spotlightPalette.primary,
                "--celebration-foreground": readableOn(spotlightPalette.primary),
                "--celebration-soft": lighten(spotlightPalette.primary, 0.35),
              } as Record<string, string>
            }
          >
            {spotlight.media?.actionUrl && (
              <motion.img
                key={spotlight.media.actionUrl}
                src={spotlight.media.actionUrl}
                alt={`${spotlight.player.name} in action`}
                initial={{ opacity: 0, scale: 1.18 }}
                animate={{ opacity: 0.4, scale: 1 }}
                transition={{ duration: 6, ease: "easeOut" }}
                onError={() =>
                  setSpotlight((prev) =>
                    prev ? { ...prev, media: { ...prev.media!, actionUrl: null } } : prev,
                  )
                }
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            )}

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(120% 90% at 50% 45%, rgba(6,8,12,0.35) 5%, ${spotlightPalette.secondary}55 55%, rgba(6,8,12,0.94) 100%)`,
              }}
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0.2] }}
              transition={{ duration: 1.4, times: [0, 0.25, 1] }}
              className="pointer-events-none absolute inset-0 bg-celebration mix-blend-overlay"
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

              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.62 }}
                className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 shadow-[0_0_40px_var(--celebration)] sm:h-32 sm:w-32"
                style={{
                  borderColor: spotlightPalette.primary,
                  backgroundColor: spotlightPalette.secondary,
                }}
              >
                {spotlight.media?.headshotUrl ? (
                  <img
                    src={spotlight.media.headshotUrl}
                    alt={spotlight.player.name}
                    className="h-full w-full object-cover"
                    onError={() =>
                      setSpotlight((prev) =>
                        prev
                          ? { ...prev, media: { ...prev.media!, headshotUrl: null } }
                          : prev,
                      )
                    }
                  />
                ) : (
                  <span
                    className="font-display text-3xl uppercase sm:text-4xl"
                    style={{ color: readableOn(spotlightPalette.secondary) }}
                  >
                    {spotlight.player.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 3)}
                  </span>
                )}
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

        {clockAnnounce && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/90 px-5 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label={`Now on the clock: ${clockAnnounce.teamName}`}
          >
            <motion.div
              initial={{ x: "-70vw", opacity: 0 }}
              animate={{ x: "70vw", opacity: [0, 0.45, 0.45, 0] }}
              transition={{ duration: 1.6, times: [0, 0.2, 0.8, 1], ease: "easeInOut" }}
              className="pointer-events-none absolute inset-y-0 w-[55vw] blur-3xl"
              style={{
                background: `linear-gradient(90deg, transparent, ${clockAnnounce.color}, transparent)`,
              }}
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {[0, 1, 2].map((ring) => (
                <motion.span
                  key={ring}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: [0.4, 1.6], opacity: [0.5, 0] }}
                  transition={{
                    duration: 1.6,
                    delay: 0.3 + ring * 0.45,
                    repeat: Infinity,
                    repeatDelay: 0.4,
                    ease: "easeOut",
                  }}
                  className="absolute h-72 w-72 rounded-full border-2 sm:h-96 sm:w-96"
                  style={{ borderColor: clockAnnounce.color }}
                />
              ))}
            </div>

            <motion.section
              initial={{ opacity: 0, y: 50, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 150, damping: 16, delay: 0.15 }}
              className="relative flex flex-col items-center text-center"
            >
              <div className="absolute left-0 top-0 h-12 w-12 border-l-4 border-t-4 sm:h-16 sm:w-16" style={{ borderColor: clockAnnounce.color }} />
              <div className="absolute bottom-0 right-0 h-12 w-12 border-b-4 border-r-4 sm:h-16 sm:w-16" style={{ borderColor: clockAnnounce.color }} />

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.35, delay: 0.4 }}
                className="mb-5 flex items-center gap-2 px-5 py-2 text-xs font-black uppercase italic tracking-[0.2em] sm:text-sm"
                style={{ backgroundColor: clockAnnounce.color, color: "var(--color-background)" }}
              >
                <Timer className="h-4 w-4" /> Now on the clock
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground sm:text-sm"
              >
                Round {clockAnnounce.round} · Pick {clockAnnounce.round}.
                {String(clockAnnounce.pickInRound).padStart(2, "0")} · #{clockAnnounce.overall} overall
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, scale: 1.4, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.6, delay: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
                className="max-w-full px-4 font-display text-6xl uppercase leading-[0.85] sm:text-8xl lg:text-[8rem]"
                style={{
                  color: clockAnnounce.color,
                  textShadow: `0 0 40px ${clockAnnounce.color}`,
                }}
              >
                {clockAnnounce.teamName}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground sm:text-base"
              >
                {clockAnnounce.manager || "You're on the board"}
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: [0, 1, 1, 0.4, 1], y: 8 }}
                transition={{ delay: 1.2, duration: 1.4 }}
                className="mt-6 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-foreground"
              >
                <Clock className="h-4 w-4 animate-pulse" /> The clock is ticking
              </motion.p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
