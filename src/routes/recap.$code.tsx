import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { POSITION_CLASS, picksToCsv } from "@/lib/draft-utils";
import { useDraftRoom } from "@/lib/useDraftRoom";

export const Route = createFileRoute("/recap/$code")({
  head: () => ({
    meta: [
      { title: "Draft Recap — Snapcount" },
      {
        name: "description",
        content: "Every roster from the draft, ready to print, copy or export as a spreadsheet.",
      },
      { property: "og:title", content: "Draft Recap — Snapcount" },
      {
        property: "og:description",
        content: "See the finished rosters from this fantasy football draft.",
      },
    ],
  }),
  component: Recap,
});

function Recap() {
  const { code } = Route.useParams();
  const { draft, teams, picks, players, isLoading, notFound } = useDraftRoom(code);
  const playersById = new Map(players.map((p) => [p.id, p]));

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading the recap…
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

  const exportCsv = () => {
    const blob = new Blob([picksToCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.league_name.replace(/\s+/g, "-").toLowerCase()}-recap.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/draft/$code" params={{ code }} className="text-muted-foreground hover:text-foreground" aria-label="Back to the board">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-4xl leading-none">{draft.league_name}</h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Recap · Room {draft.room_code} · {picks.length} picks
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <section key={team.id} className="rounded-xl border border-border bg-surface p-4">
              <h2
                className="border-b-4 pb-2 text-2xl leading-none"
                style={{ borderColor: team.color }}
              >
                {team.name}
              </h2>
              {team.manager && (
                <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {team.manager}
                </p>
              )}
              <ol className="mt-3 space-y-1.5">
                {picks
                  .filter((p) => p.team_id === team.id)
                  .map((p) => {
                    const player = playersById.get(p.player_id);
                    return (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 text-right text-muted-foreground">{p.round}</span>
                        <span className={`pos-chip ${POSITION_CLASS[player?.position ?? ""] ?? ""}`}>
                          {player?.position}
                        </span>
                        <span className="truncate font-semibold">{player?.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {player?.nfl_team}
                        </span>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
