import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ playerId: z.string().uuid() });

export type HighlightResult = {
  title: string | null;
  url: string | null;
  source: string | null;
  summary: string | null;
};

/**
 * Finds a highlight video for a drafted player.
 * Cached per player so the same lookup never runs twice.
 */
export const findPlayerHighlight = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<HighlightResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cached } = await supabaseAdmin
      .from("highlights")
      .select("title, url, source, summary")
      .eq("player_id", data.playerId)
      .maybeSingle();
    if (cached?.url) return cached as HighlightResult;

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("name, position, nfl_team, stat_line")
      .eq("id", data.playerId)
      .maybeSingle();
    if (!player) return { title: null, url: null, source: null, summary: null };

    const isTeamDefense = player.position === "DST";
    const query = isTeamDefense
      ? `${player.name} defense highlights`
      : `${player.name} ${player.nfl_team} highlights youtube`;

    const { searchWeb, youtubeIdFromUrl } = await import("./web-search.server");
    const results = await searchWeb(query, 10);
    const videoResults = results.filter((r) => youtubeIdFromUrl(r.url));

    let chosen = videoResults[0] ?? null;
    let summary: string | null = player.stat_line ?? null;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey && videoResults.length > 0) {
      try {
        const { generateText, Output } = await import("ai");
        const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
        const gateway = createLovableAiGatewayProvider(apiKey);
        const list = videoResults
          .map((r, i) => `${i}. ${r.title} — ${r.url}`)
          .join("\n");
        const { output } = await generateText({
          model: gateway("google/gemini-3.8-flash"),
          output: Output.object({
            schema: z.object({ index: z.number(), blurb: z.string() }),
          }),
          prompt:
            `A fantasy football team just drafted ${player.name}, ${player.position} for the ${player.nfl_team}.\n` +
            `Pick the single best career/season highlight video from this list and return its index.\n` +
            `Prefer official or well-known channels, full highlight reels over single plays, and recent seasons.\n` +
            `Also write a blurb of at most 18 words hyping the pick.\n\n${list}`,
        });
        const idx = Math.trunc(output.index);
        if (idx >= 0 && idx < videoResults.length) chosen = videoResults[idx]!;
        if (output.blurb) summary = output.blurb.slice(0, 160);
      } catch (error) {
        console.error("highlight agent failed", error);
      }
    }

    const result: HighlightResult = chosen
      ? { title: chosen.title, url: chosen.url, source: "YouTube", summary }
      : {
          title: null,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          source: "search",
          summary,
        };

    if (chosen) {
      await supabaseAdmin.from("highlights").upsert({
        player_id: data.playerId,
        title: result.title,
        url: result.url,
        source: result.source,
        summary: result.summary,
      });
    }

    return result;
  });
