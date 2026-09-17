import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Dice5,
  Mic,
  Sparkles,
  Trophy,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDraft } from "@/lib/draft.functions";
import { syncPlayers } from "@/lib/players.functions";
import { shuffle } from "@/lib/draft-utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snapcount — Live Fantasy Football Draft Board" },
      {
        name: "description",
        content:
          "Set up a fantasy football draft room, call picks out loud, watch highlights land on the board and export the results.",
      },
      { property: "og:title", content: "Snapcount — Live Fantasy Football Draft Board" },
      {
        property: "og:description",
        content:
          "Run your in-person fantasy football draft on one big screen with voice picks and instant highlights.",
      },
    ],
  }),
  component: SetupPage,
});

const TEAM_COLORS = [
  "#84cc16",
  "#22d3ee",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#facc15",
  "#38bdf8",
  "#f472b6",
  "#4ade80",
  "#fb923c",
  "#818cf8",
  "#2dd4bf",
  "#e879f9",
  "#fbbf24",
  "#60a5fa",
  "#f87171",
];

type TeamDraftEntry = { name: string; manager: string; color: string };

function defaultTeams(count: number): TeamDraftEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Team ${i + 1}`,
    manager: "",
    color: TEAM_COLORS[i % TEAM_COLORS.length]!,
  }));
}

function relativeTime(iso: string | null): string {
  if (!iso) return "just now";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function SetupPage() {
  const navigate = useNavigate();
  const create = useServerFn(createDraft);
  const [leagueName, setLeagueName] = useState("Sunday Money League");
  const [rounds, setRounds] = useState(15);
  const [clock, setClock] = useState(90);
  const [orderType, setOrderType] = useState<"snake" | "linear">("snake");
  const [teams, setTeams] = useState<TeamDraftEntry[]>(() => defaultTeams(10));
  const [shuffling, setShuffling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const queryClient = useQueryClient();
  const sync = useServerFn(syncPlayers);
  const [refreshing, setRefreshing] = useState(false);
  const poolQuery = useQuery({
    queryKey: ["player-pool"],
    staleTime: 5 * 60 * 1000,
    queryFn: () => sync({ data: { force: false } }),
  });
  const pool = poolQuery.data ?? null;

  const refreshPool = async () => {
    setRefreshing(true);
    try {
      const status = await sync({ data: { force: true } });
      queryClient.setQueryData(["player-pool"], status);
      queryClient.setQueryData(["player-pool-sync"], status);
      void queryClient.invalidateQueries({ queryKey: ["players"] });
      void queryClient.invalidateQueries({ queryKey: ["picked-players"] });
      toast.success(
        status.source === "sleeper"
          ? `Player list updated — ${status.playerCount} players`
          : "Couldn't reach the live player feed, using the built-in list",
      );
    } catch {
      toast.error("Couldn't refresh the player list");
    } finally {
      setRefreshing(false);
    }
  };

  const updateTeam = (index: number, patch: Partial<TeamDraftEntry>) => {
    setTeams((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const randomize = () => {
    setShuffling(true);
    let ticks = 0;
    const interval = setInterval(() => {
      setTeams((prev) => shuffle(prev));
      ticks += 1;
      if (ticks >= 8) {
        clearInterval(interval);
        setShuffling(false);
        toast.success("Draft order set");
      }
    }, 90);
  };

  const start = async () => {
    if (teams.some((t) => !t.name.trim())) {
      toast.error("Every team needs a name");
      return;
    }
    setSubmitting(true);
    try {
      const result = await create({
        data: {
          leagueName: leagueName.trim() || "Fantasy Draft",
          rounds,
          clockSeconds: clock,
          orderType,
          teams: teams.map((t) => ({
            name: t.name.trim(),
            manager: t.manager.trim() || null,
            color: t.color,
          })),
        },
      });
      navigate({ to: "/draft/$code", params: { code: result.roomCode } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the draft");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-5 py-10 md:py-16">
        <header className="mb-12">
          <div className="flex items-center gap-2 text-primary">
            <Trophy className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">
              Snapcount
            </span>
          </div>
          <h1 className="mt-4 text-5xl leading-none md:text-7xl">
            Your draft night,
            <br />
            on the big screen.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Set the room up once, then just call the picks out loud. Snapcount hears
            the name, puts it on the board, and pulls up the player's highlights while
            the next manager gets on the clock.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
              <Mic className="h-4 w-4 text-primary" /> Speak your pick
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Instant highlights
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
              <Dice5 className="h-4 w-4 text-primary" /> Randomized order
            </span>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-2xl">League setup</h2>
            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="league">League name</Label>
                <Input
                  id="league"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  maxLength={60}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="teamCount">Teams</Label>
                  <Select
                    value={String(teams.length)}
                    onValueChange={(v) => setTeams(defaultTeams(Number(v)))}
                  >
                    <SelectTrigger id="teamCount">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 13 }, (_, i) => i + 4).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} teams
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rounds">Rounds</Label>
                  <Select
                    value={String(rounds)}
                    onValueChange={(v) => setRounds(Number(v))}
                  >
                    <SelectTrigger id="rounds">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }, (_, i) => i + 5).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} rounds
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clock">Pick clock</Label>
                  <Select value={String(clock)} onValueChange={(v) => setClock(Number(v))}>
                    <SelectTrigger id="clock">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[30, 45, 60, 90, 120, 180, 300].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n < 60 ? `${n} seconds` : `${n / 60} minutes`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Order</Label>
                  <Select
                    value={orderType}
                    onValueChange={(v) => setOrderType(v as "snake" | "linear")}
                  >
                    <SelectTrigger id="order">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="snake">Snake</SelectItem>
                      <SelectItem value="linear">Linear</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
                <p className="text-muted-foreground">
                  {poolQuery.isLoading || refreshing ? (
                    "Loading the latest player list…"
                  ) : pool?.source === "sleeper" ? (
                    <>
                      Player list:{" "}
                      <span className="text-foreground">
                        {pool.playerCount.toLocaleString()} players
                      </span>
                      , updated {relativeTime(pool.lastSyncedAt)}
                    </>
                  ) : (
                    "Using the built-in player list — couldn't reach the live player feed."
                  )}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground"
                  onClick={refreshPool}
                  disabled={refreshing || poolQuery.isLoading}
                >
                  <RefreshCw
                    className={refreshing ? "mr-1.5 h-3.5 w-3.5 animate-spin" : "mr-1.5 h-3.5 w-3.5"}
                  />
                  Refresh
                </Button>
              </div>

              <Button
                size="lg"
                className="w-full text-base"
                onClick={start}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Trophy className="mr-2 h-5 w-5" />
                )}
                Start the draft
              </Button>

              <div className="border-t border-border pt-5">
                <Label htmlFor="join">Rejoin a draft with its code</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="join"
                    value={joinCode}
                    placeholder="ABC123"
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="uppercase tracking-widest"
                    maxLength={6}
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      joinCode.length === 6 &&
                      navigate({ to: "/draft/$code", params: { code: joinCode } })
                    }
                  >
                    Open
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl">Draft order</h2>
              <Button variant="secondary" onClick={randomize} disabled={shuffling}>
                <Dice5 className={shuffling ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                Randomize
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick 1.01 goes to the team at the top.
            </p>

            <ul className="mt-5 space-y-2">
              {teams.map((team, index) => (
                <motion.li
                  key={`${team.color}-${index}`}
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  className="flex items-center gap-3 rounded-lg bg-surface-2 p-2.5"
                >
                  <span className="w-7 text-center font-display text-xl text-muted-foreground">
                    {index + 1}
                  </span>
                  <span
                    className="h-8 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <Input
                    value={team.name}
                    onChange={(e) => updateTeam(index, { name: e.target.value })}
                    className="h-9 border-0 bg-transparent px-1 font-semibold focus-visible:bg-background"
                    maxLength={40}
                  />
                  <Input
                    value={team.manager}
                    placeholder="Manager"
                    onChange={(e) => updateTeam(index, { manager: e.target.value })}
                    className="h-9 w-32 border-0 bg-transparent px-1 text-muted-foreground focus-visible:bg-background"
                    maxLength={40}
                  />
                  {teams.length > 4 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground"
                      onClick={() => setTeams((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove ${team.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </motion.li>
              ))}
            </ul>

            {teams.length < 16 && (
              <Button
                variant="ghost"
                className="mt-3 w-full text-muted-foreground"
                onClick={() =>
                  setTeams((prev) => [
                    ...prev,
                    {
                      name: `Team ${prev.length + 1}`,
                      manager: "",
                      color: TEAM_COLORS[prev.length % TEAM_COLORS.length]!,
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add a team
              </Button>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
