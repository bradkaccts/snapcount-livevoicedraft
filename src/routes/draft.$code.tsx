import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Clock,
  Download,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BoardGrid } from "@/components/draft/BoardGrid";
import { PickCelebration } from "@/components/draft/PickCelebration";
import { OnTheClockOverlay } from "@/components/draft/OnTheClockOverlay";
import { PicksTicker } from "@/components/draft/PicksTicker";
import { PlayerList } from "@/components/draft/PlayerList";
import { VoicePick } from "@/components/draft/VoicePick";
import { makePick, undoLastPick } from "@/lib/draft.functions";
import { formatClock, picksToCsv, slotForOverall } from "@/lib/draft-utils";
import { useDraftRoom, type Player } from "@/lib/useDraftRoom";
import { useDraftPresentation } from "@/lib/useDraftPresentation";
import { useBigBoardOpen } from "@/lib/useBigBoardPresence";

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
  const { draft, teams, picks, players, isLoading, notFound, refresh } = useDraftRoom(code);
  const pick = useServerFn(makePick);
  const undo = useServerFn(undoLastPick);
  const bigBoardOpen = useBigBoardOpen(code);

  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const draftedIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);
  const available = useMemo(
    () => players.filter((p) => !draftedIds.has(p.id)),
    [players, draftedIds],
  );

  const complete = draft?.status === "complete";
  const current =
    draft && !complete
      ? slotForOverall(draft.current_overall, draft.team_count, draft.order_type)
      : null;
  const onTheClock = current ? teams.find((t) => t.slot === current.slot) ?? null : null;
  const nextUp =
    draft && current && draft.current_overall < draft.team_count * draft.rounds
      ? teams.find(
          (t) =>
            t.slot ===
            slotForOverall(draft.current_overall + 1, draft.team_count, draft.order_type).slot,
        ) ?? null
      : null;

  const { spotlight, setSpotlight, clockAnnounce, clearForUndo, presenting } =
    useDraftPresentation({
      draft,
      teams,
      picks,
      playersById,
      complete: Boolean(complete),
      current,
      onTheClock,
    });

  // The clock holds while the broadcast overlays run — even when they are
  // playing on the big board window instead of here.
  useEffect(() => {
    if (!draft || presenting) return;
    setRemaining(draft.clock_seconds);
  }, [draft?.current_overall, draft?.clock_seconds, draft, presenting]);

  useEffect(() => {
    if (paused || complete || presenting || !draft) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [paused, complete, draft, draft?.current_overall, presenting]);

  const submitPick = useCallback(
    async (player: Player) => {
      if (!draft || busy || complete) return;
      setBusy(true);
      const teamName = onTheClock?.name ?? "";
      try {
        await pick({ data: { draftId: draft.id, playerId: player.id } });
        refresh();
        toast.success(`${teamName} selects ${player.name}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That pick didn't go through");
      } finally {
        setBusy(false);
      }
    },
    [draft, busy, complete, onTheClock, pick, refresh],
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

        <PositionTally picks={picks} playersById={playersById} />

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
                  remaining <= 0
                    ? "clock-expired bg-destructive/25 text-destructive"
                    : remaining <= 10
                      ? "bg-destructive/20 text-destructive"
                      : "bg-surface-2 text-clock"
                }`}
                aria-live="polite"
              >
                <Clock className="h-6 w-6" />
                {remaining <= 0 ? (
                  <span className="text-2xl uppercase tracking-wide">Time expired</span>
                ) : (
                  formatClock(remaining)
                )}
              </div>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Resume clock" : "Pause clock"}
              >
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
              clearForUndo();
              toast.success("Last pick undone");
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={exportCsv} aria-label="Export results">
            <Download className="h-4 w-4" />
          </Button>
          <Button asChild variant={bigBoardOpen ? "default" : "secondary"}>
            <a href={`/board/${code}`} target="_blank" rel="noreferrer">
              <MonitorPlay className="h-4 w-4" />
              {bigBoardOpen ? "Big board live" : "Open big board"}
            </a>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/history/$code" params={{ code }}>History</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/recap/$code" params={{ code }}>Recap</Link>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <section className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            {nextUp && !complete ? (
              <p className="min-w-0 truncate text-sm text-muted-foreground">
                Next up: <span className="font-semibold text-foreground">{nextUp.name}</span>
              </p>
            ) : (
              <span />
            )}
            {bigBoardOpen && (
              <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                Celebrations playing on the big board
              </span>
            )}
          </div>

          <BoardGrid
            teams={teams}
            picks={picks}
            playersById={playersById}
            rounds={draft.rounds}
            currentRound={current?.round ?? null}
            onTheClockId={onTheClock?.id ?? null}
            complete={Boolean(complete)}
            variant="window"
            windowSize={5}
          />
        </section>

        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-border bg-surface xl:w-[400px] xl:border-l xl:border-t-0">
          <div className="min-h-0 flex-1">
            <PlayerList players={available} onDraft={submitPick} disabled={busy || complete} />
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

      <PicksTicker picks={picks} teams={teams} playersById={playersById} />

      <AnimatePresence>
        {spotlight && !bigBoardOpen && (
          <PickCelebration
            key="pick-celebration"
            spotlight={spotlight}
            onClose={() => setSpotlight(null)}
            onMediaError={(field) =>
              setSpotlight((prev) =>
                prev ? { ...prev, media: { ...prev.media!, [field]: null } } : prev,
              )
            }
          />
        )}
        {clockAnnounce && !bigBoardOpen && (
          <OnTheClockOverlay key={`on-the-clock-${clockAnnounce.overall}`} announce={clockAnnounce} />
        )}
      </AnimatePresence>
    </main>
  );
}
