/** Turning a spoken sentence into a confident player match. */

import { NFL_TEAMS } from "./nfl-teams";
import { normalizeSpoken } from "./draft-utils";

export type MatchablePlayer = {
  id: string;
  name: string;
  position: string;
  nfl_team: string;
};

/** Common nicknames and shorthand heard on draft night. */
export const PLAYER_ALIASES: Record<string, string> = {
  cmc: "christian mccaffrey",
  "c mac": "christian mccaffrey",
  bijan: "bijan robinson",
  jsn: "jaxon smith njigba",
  "saint brown": "amon ra st brown",
  "amon ra": "amon ra st brown",
  hollywood: "marquise brown",
  "cee dee": "ceedee lamb",
  "ceedee": "ceedee lamb",
  jamarr: "jamarr chase",
  "ja marr": "jamarr chase",
  "bill sanders": "bijan robinson",
  achane: "de von achane",
  "mahomes": "patrick mahomes",
  "lamar": "lamar jackson",
  "jj": "justin jefferson",
  "jettas": "justin jefferson",
  "nabors": "malik nabers",
  "etn": "javonte williams",
  "pollard": "tony pollard",
  "kittle": "george kittle",
  "bowers": "brock bowers",
  "mccon": "christian mccaffrey",
};

const FILLER =
  /\b(with|the|pick|picks|selects|select|selection|selecting|takes|take|taking|drafts|draft|drafting|is|are|on|clock|round|number|our|we|i|ll|will|going|to|go|gonna|please|uh+|um+|okay|ok|and|from|of|out|team|guy|player|next|up|now|here|there)\b/g;

const ORDINALS =
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g;

/** Lower-cased, punctuation-free words. */
export function words(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export type ClubHit = { abbr: string; matched: string[] };

/** Find an NFL club mentioned anywhere in the spoken call. */
export function extractClub(raw: string): ClubHit | null {
  const text = ` ${words(raw).join(" ")} `;
  let best: ClubHit | null = null;
  for (const [abbr, team] of Object.entries(NFL_TEAMS)) {
    const parts = team.name.toLowerCase().split(" ");
    const nickname = parts[parts.length - 1] ?? "";
    const city = parts.slice(0, -1).join(" ");
    const matched: string[] = [];
    if (nickname && text.includes(` ${nickname} `)) matched.push(nickname);
    if (city && text.includes(` ${city} `)) matched.push(city);
    if (matched.length === 0) continue;
    if (!best || matched.length > best.matched.length) best = { abbr, matched };
  }
  return best;
}

/** Strip draft chatter and any club words so only the player's name is left. */
export function extractNamePhrase(raw: string, club: ClubHit | null): string {
  let text = ` ${words(raw).join(" ")} `;
  if (club) {
    for (const part of club.matched) text = text.replace(` ${part} `, " ");
    // also drop a leftover half of the club name
    for (const part of NFL_TEAMS[club.abbr]!.name.toLowerCase().split(" ")) {
      text = text.replace(` ${part} `, " ");
    }
  }
  text = text.replace(FILLER, " ").replace(ORDINALS, " ").replace(/\b\d+\b/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  const alias = PLAYER_ALIASES[text];
  if (alias) return alias;
  for (const [key, full] of Object.entries(PLAYER_ALIASES)) {
    if (text === key || text.endsWith(` ${key}`) || text.startsWith(`${key} `)) return full;
  }
  return text;
}

/** Rough phonetic key so "Nabors" and "Nabers" collide. */
export function phonetic(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/sch/g, "sk")
    .replace(/[wh]/g, "")
    .replace(/[aeiouy]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[b.length]!;
}

function similarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function cleanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type VoiceCandidate<T extends MatchablePlayer> = {
  player: T;
  confidence: number;
};

/** Score one player against the spoken name phrase, 0..1. */
export function scorePlayer(phrase: string, player: MatchablePlayer): number {
  const q = phrase.trim();
  if (!q) return 0;
  const full = cleanName(player.name);
  const parts = full.split(" ");
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  const qParts = q.split(" ");

  let score = similarity(q, full);
  score = Math.max(score, similarity(q, `${first} ${last}`));
  if (qParts.length === 1) {
    score = Math.max(score, similarity(q, last) * 0.9);
  }
  if (full === q) score = 1;
  if (full.includes(q) && q.length > 4) score = Math.max(score, 0.9);

  // phonetic rescue for mis-spelled surnames
  const phoneticScore = similarity(phonetic(q), phonetic(full));
  const phoneticLast = similarity(phonetic(qParts[qParts.length - 1] ?? ""), phonetic(last));
  score = Math.max(score, phoneticScore * 0.85, phoneticLast * 0.8);

  // every spoken token present in the name
  const covered = qParts.filter((p) => p.length > 1 && parts.some((n) => n.startsWith(p)));
  if (qParts.length > 1 && covered.length === qParts.length) {
    score = Math.max(score, 0.88);
  }
  return Math.min(1, score);
}

export type VoiceResolution<T extends MatchablePlayer> = {
  status: "auto" | "confirm" | "none";
  cleaned: string;
  heardTeam: string | null;
  candidates: VoiceCandidate<T>[];
};

const CONFIRM_FLOOR = 0.45;
const AUTO_FLOOR = 0.8;

/**
 * Resolve a spoken call into a pick.
 * Auto-draft only when the name is confident AND the player's club was said too.
 */
export function resolveSpokenPick<T extends MatchablePlayer>(
  transcript: string,
  pool: T[],
): VoiceResolution<T> {
  const club = extractClub(transcript);
  const phrase = extractNamePhrase(transcript, club);
  if (!phrase) {
    return {
      status: "none",
      cleaned: normalizeSpoken(transcript),
      heardTeam: club?.abbr ?? null,
      candidates: [],
    };
  }

  const scored = pool
    .map((player) => {
      let confidence = scorePlayer(phrase, player);
      if (club) {
        confidence =
          club.abbr === player.nfl_team.toUpperCase()
            ? Math.min(1, confidence + 0.05)
            : confidence * 0.55;
      }
      return { player, confidence };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const candidates = scored.filter((c) => c.confidence >= CONFIRM_FLOOR).slice(0, 4);
  const top = candidates[0];
  const runnerUp = candidates[1];

  if (!top) {
    return { status: "none", cleaned: phrase, heardTeam: club?.abbr ?? null, candidates: [] };
  }

  const clubConfirmed =
    club !== null &&
    club.abbr === top.player.nfl_team.toUpperCase() &&
    club.matched.length >= 2;
  const clear = !runnerUp || top.confidence - runnerUp.confidence >= 0.12;

  const status =
    clubConfirmed && clear && top.confidence >= AUTO_FLOOR ? "auto" : "confirm";

  return { status, cleaned: phrase, heardTeam: club?.abbr ?? null, candidates };
}
