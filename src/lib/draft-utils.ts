export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export const POSITION_CLASS: Record<string, string> = {
  QB: "bg-pos-qb/20 text-pos-qb",
  RB: "bg-pos-rb/20 text-pos-rb",
  WR: "bg-pos-wr/20 text-pos-wr",
  TE: "bg-pos-te/20 text-pos-te",
  K: "bg-pos-k/20 text-pos-k",
  DST: "bg-pos-dst/20 text-pos-dst",
};

export type SlotPosition = { round: number; pickInRound: number; slot: number };

/** Map an overall pick number to round / pick-in-round / team slot (1-indexed). */
export function slotForOverall(
  overall: number,
  teamCount: number,
  orderType: string,
): SlotPosition {
  const round = Math.floor((overall - 1) / teamCount) + 1;
  const pickInRound = ((overall - 1) % teamCount) + 1;
  const snakeBack = orderType === "snake" && round % 2 === 0;
  const slot = snakeBack ? teamCount + 1 - pickInRound : pickInRound;
  return { round, pickInRound, slot };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i]!;
    const b = copy[j]!;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

const NOISE =
  /\b(i'?ll take|we'?ll take|take|pick|select|selecting|with the pick|the|our|is|please|uh+|um+|guy|player)\b/gi;

export function normalizeSpoken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(NOISE, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap edit-distance similarity, 0..1. */
function similarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = new Array<number>(cols);
  let cur = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    cur[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  const dist = prev[cols - 1]!;
  return 1 - dist / Math.max(a.length, b.length);
}

export type MatchablePlayer = {
  id: string;
  name: string;
  position: string;
  nfl_team: string;
};

export type MatchCandidate<T extends MatchablePlayer> = { player: T; score: number };

/** Rank available players against a spoken or typed phrase. */
export function matchPlayers<T extends MatchablePlayer>(
  phrase: string,
  players: T[],
  limit = 5,
): MatchCandidate<T>[] {
  const q = normalizeSpoken(phrase);
  if (!q) return [];
  const qParts = q.split(" ");
  const scored: MatchCandidate<T>[] = players.map((player) => {
    const full = normalizeName(player.name);
    const parts = full.split(" ");
    const last = parts[parts.length - 1] ?? "";
    const first = parts[0] ?? "";

    let score = similarity(q, full);
    score = Math.max(score, similarity(q, last) * 0.92);
    score = Math.max(score, similarity(q, `${first} ${last}`));
    if (full.includes(q) || q.includes(full)) score = Math.max(score, 0.95);
    if (qParts.length === 1 && last === q) score = Math.max(score, 0.93);
    // token overlap bonus
    const overlap = parts.filter((p) => p.length > 2 && qParts.includes(p)).length;
    if (overlap) score = Math.max(score, 0.7 + 0.12 * overlap);
    // position / team hints spoken alongside the name
    if (qParts.includes(player.position.toLowerCase())) score += 0.03;
    if (qParts.includes(player.nfl_team.toLowerCase())) score += 0.03;
    return { player, score: Math.min(score, 1) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function picksToCsv(rows: {
  overall: number;
  round: number;
  pickInRound: number;
  team: string;
  player: string;
  position: string;
  nflTeam: string;
  bye: number | null;
}[]): string {
  const header = "Overall,Round,Pick,Team,Player,Position,NFL Team,Bye";
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) =>
    [
      r.overall,
      r.round,
      r.pickInRound,
      r.team,
      r.player,
      r.position,
      r.nflTeam,
      r.bye,
    ]
      .map(esc)
      .join(","),
  );
  return [header, ...body].join("\n");
}
