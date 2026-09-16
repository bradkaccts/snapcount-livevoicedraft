import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rivalNicknames, teamWords } from "@/lib/nfl-teams";

const Input = z.object({ playerId: z.string().uuid() });

export type PlayerMedia = {
  actionUrl: string | null;
  headshotUrl: string | null;
};

/** Bump when the scoring rules change so cached picks get re-evaluated. */
const SELECTOR_VERSION = 2;

/** Minimum score for a photo to be shown at all. */
const MIN_SCORE = 2;

const CURRENT_SEASON = new Date().getFullYear();

type Candidate = {
  title: string;
  url: string;
  width: number;
  height: number;
  text: string;
  year: number | null;
};

const BAD_TITLE =
  /logo|helmet|wordmark|uniform design|map|stadium|signature|icon|\.svg|jersey|statue|mural/i;

const COLLEGE_WORDS =
  /college|university|\bncaa\b|crimson tide|bulldogs|buckeyes|longhorns|sooners|wolverines|high school|all-american|all american|combine|senior bowl|pro day|draft day|bowl game|tigers|gators|aggies|spartans|cornhuskers|seminoles|volunteers/i;

function extractYear(...parts: (string | null | undefined)[]): number | null {
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/\b(19[89]\d|20[0-4]\d)\b/g);
    if (match) {
      const years = match.map(Number).filter((y) => y <= CURRENT_SEASON + 1);
      if (years.length) return Math.max(...years);
    }
  }
  return null;
}

async function commonsSearch(query: string, limit: number): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
    iiextmetadatafilter: "DateTimeOriginal|DateTime|ImageDescription|Categories",
  });
  try {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "SnapcountDraft/1.0 (fantasy draft app)" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { query?: { pages?: Record<string, any> } };
    return Object.values(json.query?.pages ?? {})
      .map((page): Candidate | null => {
        const info = page?.imageinfo?.[0];
        const url: string | undefined = info?.thumburl ?? info?.url;
        if (!url || typeof url !== "string") return null;
        const meta = info?.extmetadata ?? {};
        const strip = (value: unknown) =>
          typeof value === "string" ? value.replace(/<[^>]*>/g, " ") : "";
        const description = strip(meta?.ImageDescription?.value);
        const categories = strip(meta?.Categories?.value);
        const taken = strip(meta?.DateTimeOriginal?.value) || strip(meta?.DateTime?.value);
        const title: string = page?.title ?? "";
        return {
          title,
          url,
          width: Number(info?.thumbwidth ?? info?.width ?? 0),
          height: Number(info?.thumbheight ?? info?.height ?? 0),
          text: `${title} ${description} ${categories}`.toLowerCase(),
          year: extractYear(taken, title, categories, description),
        };
      })
      .filter((c): c is Candidate => Boolean(c))
      .filter((c) => !BAD_TITLE.test(c.title) && /\.(jpg|jpeg|png|webp)/i.test(c.url));
  } catch {
    return [];
  }
}

function scoreCandidate(
  candidate: Candidate,
  player: { name: string; nfl_team: string },
): number {
  const words = teamWords(player.nfl_team);
  const rivals = rivalNicknames(player.nfl_team);
  const text = candidate.text;
  const surnameParts = player.name.split(" ");
  const surname = (surnameParts[surnameParts.length - 1] ?? player.name).toLowerCase();

  let score = 0;

  // The photo must at least be of this player.
  if (text.includes(player.name.toLowerCase())) score += 3;
  else if (text.includes(surname)) score += 1;
  else score -= 4;

  // Current team wording is the strongest signal of the right uniform.
  if (words) {
    if (text.includes(words.full.toLowerCase())) score += 6;
    else if (text.includes(words.nickname.toLowerCase())) score += 5;
    else if (words.city && text.includes(words.city.toLowerCase())) score += 2;
  }

  // Former-team photos are wrong uniforms.
  if (rivals.some((nickname) => text.includes(nickname))) score -= 5;

  // College / pre-draft imagery.
  if (COLLEGE_WORDS.test(text)) score -= 6;

  // Recency.
  if (candidate.year) {
    const age = CURRENT_SEASON - candidate.year;
    if (age <= 2) score += 4;
    else if (age <= 4) score += 2;
    else if (age <= 7) score += 0;
    else score -= 3;
  }

  // Size and shape as tiebreakers only.
  if (candidate.width >= 1200) score += 1;
  if (candidate.width > candidate.height) score += 0.5;

  return score;
}

async function wikipediaThumb(name: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${name} American football`,
    gsrlimit: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "600",
  });
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "SnapcountDraft/1.0 (fantasy draft app)" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { query?: { pages?: Record<string, any> } };
    const page = Object.values(json.query?.pages ?? {})[0];
    const url: string | undefined = page?.thumbnail?.source;
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Finds an action photo and a headshot for a drafted player, preferring recent
 * images that show the player in his current NFL team's uniform.
 */
export const findPlayerMedia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<PlayerMedia> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cached } = await supabaseAdmin
      .from("player_media")
      .select("action_url, headshot_url, selector_version")
      .eq("player_id", data.playerId)
      .maybeSingle();
    if (cached && (cached as any).selector_version >= SELECTOR_VERSION) {
      return { actionUrl: cached.action_url, headshotUrl: cached.headshot_url };
    }

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("name, position, nfl_team")
      .eq("id", data.playerId)
      .maybeSingle();
    if (!player) return { actionUrl: null, headshotUrl: null };

    const words = teamWords(player.nfl_team);
    const queries = [
      words ? `${player.name} ${words.full}` : null,
      words ? `${player.name} ${words.nickname}` : null,
      `${player.name} NFL`,
      `${player.name} football`,
    ].filter((q): q is string => Boolean(q));

    const batches = await Promise.all(queries.map((q) => commonsSearch(q, 10)));
    const byUrl = new Map<string, Candidate>();
    for (const batch of batches) {
      for (const candidate of batch) byUrl.set(candidate.url, candidate);
    }

    const scored = [...byUrl.values()]
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(candidate, {
          name: player.name,
          nfl_team: player.nfl_team,
        }),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const accepted = best && best.score >= MIN_SCORE ? best : null;

    const portrait = scored.find(
      (entry) =>
        entry.score >= MIN_SCORE &&
        entry.candidate.height >= entry.candidate.width &&
        entry.candidate.url !== accepted?.candidate.url,
    );

    const result: PlayerMedia = {
      actionUrl: accepted?.candidate.url ?? null,
      headshotUrl: portrait?.candidate.url ?? (await wikipediaThumb(player.name)),
    };

    await supabaseAdmin.from("player_media").upsert({
      player_id: data.playerId,
      action_url: result.actionUrl,
      headshot_url: result.headshotUrl,
      source: "wikimedia",
      score: accepted?.score ?? null,
      selector_version: SELECTOR_VERSION,
      updated_at: new Date().toISOString(),
    });

    return result;
  });
