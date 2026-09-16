import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POSITIONS, POSITION_CLASS, picksToCsv } from "@/lib/draft-utils";
import { useDraftRoom } from "@/lib/useDraftRoom";

export const Route = createFileRoute("/history/$code")({
  head: () => ({
    meta: [
      { title: "Draft History — Snapcount" },
      {
        name: "description",
        content:
          "Review every pick from the draft team by team, with player stats, bye weeks and round-by-round order.",
      },
      { property: "og:title", content: "Draft History — Snapcount" },
      {
        property: "og:description",
        content: "Every team's picks with player stats, ready to review after the draft.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: History,
});

function History() {
  const { code } = Route.useParams();
  const { draft, teams, picks, players, isLoading, notFound } = useDraftRoom(code);
  const [view, setView] = useState<"teams" | "timeline">("teams");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string>("ALL");

  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const rows = useMemo(
    () =>
      [...picks]
        .sort((a, b) => a.overall - b.overall)
        .map((p) => {
          const player = playersById.get(p.player_id);
          const team = teamsById.get(p.team_id);
          return {
            id: p.id,
            overall: p.overall,
            round: p.round,
            pickInRound: p.pick_in_round,
            teamId: p.team_id,
            teamName: team?.name ?? "",
            teamColor: team?.color ?? "#64748b",
            player: player?.name ?? "Unknown player",
            position: player?.position ?? "",
            nflTeam: player?.nfl_team ?? "",
            bye: player?.bye_week ?? null,
            rank: player?.rank ?? null,
            statLine: player?.stat_line ?? null,
          };
        }),
    [picks, playersById, teamsById],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (position !== "ALL" && r.position !== position) return false;
      if (!q) return true;
      return (
        r.player.toLowerCase().includes(q) ||
        r.teamName.toLowerCase().includes(q) ||
        r.nflTeam.toLowerCase().includes(q)
      );
    });
  }, [rows, query, position]);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading the draft history…
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

  const exportCsv = () => {
    const blob = new Blob(
      [
        picksToCsv(
          filtered.map((r) => ({
            overall: r.overall,
            round: r.round,
            pickInRound: r.pickInRound,
            team: r.teamName,
            player: r.player,
            position: r.position,
            nflTeam: r.nflTeam,
            bye: r.bye,
          })),
        ),
      ],
      { type: "text/csv" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.league_name.replace(/\s+/g, "-").toLowerCase()}-history.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPicks = draft.team_count * draft.rounds;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/draft/$code"
            params={{ code }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to the board"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-4xl leading-none">{draft.league_name}</h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Draft history · Room {draft.room_code} · {picks.length} of {totalPicks} picks
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-surface p-1">
              {(["teams", "timeline"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-md px-3 py-1.5 text-xs uppercase tracking-widest transition-colors ${
                    view === v
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v === "teams" ? "By team" : "Timeline"}
                </button>
              ))}
            </div>
            <Button variant="secondary" asChild>
              <Link to="/recap/$code" params={{ code }}>
                Recap
              </Link>
            </Button>
            <Button onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player or team"
              aria-label="Search the draft history"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["ALL", ...POSITIONS].map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPosition(pos)}
                aria-pressed={position === pos}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition-colors ${
                  position === pos
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {filtered.length} shown
          </span>
        </div>

        {picks.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">
            No picks yet — the history fills in as the draft runs.
          </p>
        ) : view === "teams" ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {teams.map((team) => {
              const teamRows = filtered.filter((r) => r.teamId === team.id);
              const counts = POSITIONS.map((pos) => ({
                pos,
                n: rows.filter((r) => r.teamId === team.id && r.position === pos).length,
              })).filter((c) => c.n > 0);
              return (
                <section
                  key={team.id}
                  className="overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <header
                    className="flex flex-wrap items-center gap-3 border-b-4 px-4 py-3"
                    style={{ borderColor: team.color }}
                  >
                    <div>
                      <h2 className="text-2xl leading-none">{team.name}</h2>
                      <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                        {team.manager ? `${team.manager} · ` : ""}Slot {team.slot} ·{" "}
                        {rows.filter((r) => r.teamId === team.id).length} picks
                      </p>
                    </div>
                    <div className="ml-auto flex flex-wrap gap-1">
                      {counts.map((c) => (
                        <span
                          key={c.pos}
                          className={`pos-chip ${POSITION_CLASS[c.pos] ?? ""}`}
                        >
                          {c.pos} {c.n}
                        </span>
                      ))}
                    </div>
                  </header>
                  {teamRows.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">
                      No picks match the current filters.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {teamRows.map((r) => (
                        <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                          <span className="w-12 shrink-0 text-xs uppercase tracking-widest text-muted-foreground">
                            {r.round}.{String(r.pickInRound).padStart(2, "0")}
                          </span>
                          <span className={`pos-chip shrink-0 ${POSITION_CLASS[r.position] ?? ""}`}>
                            {r.position}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{r.player}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.nflTeam}
                              {r.bye ? ` · Bye ${r.bye}` : ""}
                              {r.rank ? ` · Rank ${r.rank}` : ""}
                            </p>
                            {r.statLine && (
                              <p className="mt-1 text-xs text-muted-foreground">{r.statLine}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            #{r.overall}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <caption className="sr-only">Every pick in draft order</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Pick</th>
                  <th scope="col" className="px-4 py-3">Team</th>
                  <th scope="col" className="px-4 py-3">Player</th>
                  <th scope="col" className="px-4 py-3">Pos</th>
                  <th scope="col" className="px-4 py-3">NFL</th>
                  <th scope="col" className="px-4 py-3">Bye</th>
                  <th scope="col" className="px-4 py-3">Stats</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {r.round}.{String(r.pickInRound).padStart(2, "0")}
                      <span className="ml-2 text-xs">#{r.overall}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                        style={{ background: r.teamColor }}
                      />
                      {r.teamName}
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.player}</td>
                    <td className="px-4 py-3">
                      <span className={`pos-chip ${POSITION_CLASS[r.position] ?? ""}`}>
                        {r.position}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.nflTeam}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.bye ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.statLine ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
