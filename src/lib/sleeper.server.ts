/**
 * Sleeper public API reader (free, no key, no account).
 * The NFL player dump is ~15MB, so it is parsed as a stream and filtered
 * down to the fantasy-relevant pool instead of being held in memory whole.
 */
import { NFL_TEAMS } from "./nfl-teams";

const PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const TRENDING_URL =
  "https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=200";

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
const SKILL_POOL_SIZE = 700;

export type SleeperPlayer = {
  externalId: string;
  name: string;
  position: string;
  nflTeam: string;
  statLine: string;
  searchRank: number;
};

type RawPlayer = {
  player_id?: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  team?: string | null;
  active?: boolean | null;
  status?: string | null;
  age?: number | null;
  years_exp?: number | null;
  college?: string | null;
  number?: number | null;
  injury_status?: string | null;
  search_rank?: number | null;
};

/** Yields each top-level `"key": { ... }` value of a large JSON object. */
async function* streamObjectValues(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  let done = false;

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) buffer += decoder.decode(chunk.value, { stream: true });

    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth += 1;
        if (depth === 2) start = i;
        continue;
      }
      if (ch === "}") {
        depth -= 1;
        if (depth === 1 && start >= 0) {
          const slice = buffer.slice(start, i + 1);
          start = -1;
          try {
            yield JSON.parse(slice) as RawPlayer;
          } catch {
            /* skip malformed entry */
          }
        }
      }
    }

    // keep only the part of the buffer belonging to an unfinished entry
    if (start >= 0) {
      buffer = buffer.slice(start);
      start = 0;
    } else {
      buffer = "";
    }
  }
}

function statLine(raw: RawPlayer, position: string, team: string): string {
  if (position === "DST") {
    return `${NFL_TEAMS[team]?.name ?? team} team defense`;
  }
  const parts = [position, team];
  if (raw.number) parts.push(`#${raw.number}`);
  if (raw.age) parts.push(`Age ${raw.age}`);
  if (typeof raw.years_exp === "number") {
    parts.push(raw.years_exp === 0 ? "Rookie" : `${raw.years_exp} yr`);
  }
  if (raw.college) parts.push(raw.college);
  if (raw.injury_status) parts.push(raw.injury_status);
  return parts.join(" · ");
}

function toPlayer(raw: RawPlayer): SleeperPlayer | null {
  const externalId = raw.player_id;
  const rawPosition = raw.position?.toUpperCase();
  const team = raw.team?.toUpperCase();
  if (!externalId || !rawPosition || !team) return null;
  if (!FANTASY_POSITIONS.has(rawPosition)) return null;
  if (raw.active === false) return null;
  if (!NFL_TEAMS[team]) return null;

  const position = rawPosition === "DEF" ? "DST" : rawPosition;
  const name =
    position === "DST"
      ? (NFL_TEAMS[team]?.name ?? `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim())
      : (raw.full_name ?? `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim());
  if (!name) return null;

  return {
    externalId,
    name,
    position,
    nflTeam: team,
    statLine: statLine(raw, position, team),
    searchRank: typeof raw.search_rank === "number" ? raw.search_rank : 99_999,
  };
}

async function fetchTrending(): Promise<Map<string, number>> {
  try {
    const response = await fetch(TRENDING_URL, { headers: { accept: "application/json" } });
    if (!response.ok) return new Map();
    const rows = (await response.json()) as Array<{ player_id?: string; count?: number }>;
    return new Map(
      rows
        .filter((r) => r.player_id)
        .map((r, index) => [r.player_id!, Math.max(0, rows.length - index)]),
    );
  } catch {
    return new Map();
  }
}

/** Fetch the current Sleeper pool, ranked and ready to upsert. */
export async function fetchSleeperPool(): Promise<SleeperPlayer[]> {
  const [response, trending] = await Promise.all([
    fetch(PLAYERS_URL, { headers: { accept: "application/json" } }),
    fetchTrending(),
  ]);
  if (!response.ok || !response.body) {
    throw new Error(`Sleeper player feed returned ${response.status}`);
  }

  const skill: SleeperPlayer[] = [];
  const defenses: SleeperPlayer[] = [];

  for await (const raw of streamObjectValues(response.body)) {
    const player = toPlayer(raw);
    if (!player) continue;
    if (player.position === "DST") defenses.push(player);
    else if (player.searchRank < 99_999) skill.push(player);
  }

  const trendBoost = (p: SleeperPlayer) => (trending.get(p.externalId) ?? 0) * 0.15;
  skill.sort((a, b) => a.searchRank - trendBoost(a) - (b.searchRank - trendBoost(b)));
  defenses.sort((a, b) => a.name.localeCompare(b.name));

  return [...skill.slice(0, SKILL_POOL_SIZE), ...defenses];
}
