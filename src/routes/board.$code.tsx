import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Clock, MonitorSmartphone, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BoardGrid } from "@/components/draft/BoardGrid";
import { PickCelebration } from "@/components/draft/PickCelebration";
import { OnTheClockOverlay } from "@/components/draft/OnTheClockOverlay";
import { PicksTicker } from "@/components/draft/PicksTicker";
import { formatClock, slotForOverall } from "@/lib/draft-utils";
import { useDraftRoom } from "@/lib/useDraftRoom";
import { useDraftPresentation } from "@/lib/useDraftPresentation";
import { useBigBoardBeacon } from "@/lib/useBigBoardPresence";

export const Route = createFileRoute("/board/$code")({
  head: () => ({
    meta: [
      { title: "Big Board — Snapcount" },
      {
        name: "description",
        content:
          "The full-screen Snapcount big board: every team, every pick, plus live celebrations and on-the-clock announcements.",
      },
      { property: "og:title", content: "Big Board — Snapcount" },
      {
        property: "og:description",
        content: "Put every team's picks on the big screen while the draft runs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BigBoard,
});

function BigBoard() {
  const { code } = Route.useParams();
  const { draft, teams, picks, players, isLoading, notFound } = useDraftRoom(code);
  useBigBoardBeacon(code);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const complete = draft?.status === "complete";
  const current =
    draft && !complete
      ? slotForOverall(draft.current_overall, draft.team_count, draft.order_type)
      : null;
  const onTheClock = current ? teams.find((t) => t.slot === current.slot) ?? null : null;

  const { spotlight, setSpotlight, clockAnnounce, presenting } = useDraftPresentation({
    draft,
    teams,
    picks,
    playersById,
    complete: Boolean(complete),
    current,
    onTheClock,
  });

  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!draft || presenting) return;
    setRemaining(draft.clock_seconds);
  }, [draft?.current_overall, draft?.clock_seconds, draft, presenting]);
  useEffect(() => {
    if (complete || presenting || !draft) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [complete, draft, draft?.current_overall, presenting]);

  // Keep the drafting team in view on very wide boards.
  const scrollRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onTheClock) return;
    const index = teams.findIndex((t) => t.id === onTheClock.id);
    if (index < 0 || el.scrollWidth <= el.clientWidth) return;
    const colWidth = el.scrollWidth / Math.max(teams.length, 1);
    el.scrollTo({
      left: Math.max(0, colWidth * (index + 0.5) - el.clientWidth / 2),
      behavior: "smooth",
    });
  }, [onTheClock?.id, teams]);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading the big board…
      </main>
    );
  }

  if (notFound || !draft) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="text-4xl">No draft with code {code}</h1>
          <Button asChild className="mt-6">
            <Link to="/">Back to setup</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-surface px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl leading-none">{draft.league_name}</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Big board · Room {draft.room_code} · {draft.rounds} rounds
          </p>
        </div>

        <div className="ml-auto flex items-center gap-5">
          {complete ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-primary/15 px-5 py-2 font-display text-3xl text-primary">
              <Trophy className="h-6 w-6" /> Draft complete
            </span>
          ) : (
            <>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  On the clock · {current?.round}.
                  {String(current?.pickInRound).padStart(2, "0")}
                </p>
                <p
                  className="font-display text-4xl leading-none"
                  style={{ color: onTheClock?.color }}
                >
                  {onTheClock?.name ?? "—"}
                </p>
              </div>
              <div
                className={`flex items-center gap-2 rounded-lg px-5 py-2 font-display text-5xl leading-none tabular-nums ${
                  remaining <= 10 ? "bg-destructive/20 text-destructive" : "bg-surface-2 text-clock"
                }`}
              >
                <Clock className="h-7 w-7" />
                {formatClock(remaining)}
              </div>
            </>
          )}
          <Button asChild variant="secondary">
            <Link to="/draft/$code" params={{ code }}>
              <MonitorSmartphone className="h-4 w-4" /> Drafting console
            </Link>
          </Button>
        </div>
      </header>

      <section
        ref={scrollRef}
        className="board-scroll min-h-0 flex-1 overflow-auto scrollbar-thin p-4"
      >
        <BoardGrid
          teams={teams}
          picks={picks}
          playersById={playersById}
          rounds={draft.rounds}
          currentRound={current?.round ?? null}
          onTheClockId={onTheClock?.id ?? null}
          complete={Boolean(complete)}
        />
      </section>

      <PicksTicker picks={picks} teams={teams} playersById={playersById} />

      <AnimatePresence>
        {spotlight && (
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
        {clockAnnounce && (
          <OnTheClockOverlay key={`on-the-clock-${clockAnnounce.overall}`} announce={clockAnnounce} />
        )}
      </AnimatePresence>
    </main>
  );
}
