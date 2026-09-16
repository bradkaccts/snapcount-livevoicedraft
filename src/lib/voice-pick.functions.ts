import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { resolveSpokenPick } from "./voice-match";

const ResolveInput = z.object({
  draftId: z.string().uuid(),
  transcript: z.string().min(1).max(500),
});

export type ResolvedVoicePick = {
  status: "auto" | "confirm" | "none";
  cleaned: string;
  heardTeam: string | null;
  alreadyDrafted: string | null;
  candidates: {
    id: string;
    name: string;
    position: string;
    nfl_team: string;
    rank: number;
    confidence: number;
  }[];
};

/** Turn what the commissioner said into a pick decision, server-side. */
export const resolveVoicePick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResolveInput.parse(input))
  .handler(async ({ data }): Promise<ResolvedVoicePick> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: players }, { data: picks }] = await Promise.all([
      supabaseAdmin
        .from("players")
        .select("id, name, position, nfl_team, rank")
        .eq("active", true)
        .limit(2000),
      supabaseAdmin.from("picks").select("player_id").eq("draft_id", data.draftId),
    ]);

    const drafted = new Set((picks ?? []).map((p) => p.player_id));
    const all = players ?? [];
    const pool = all.filter((p) => !drafted.has(p.id));

    const result = resolveSpokenPick(data.transcript, pool);

    // Did they call a player who is already off the board?
    let alreadyDrafted: string | null = null;
    if (result.candidates.length === 0 && drafted.size > 0) {
      const takenPool = all.filter((p) => drafted.has(p.id));
      const taken = resolveSpokenPick(data.transcript, takenPool);
      if (taken.candidates[0] && taken.candidates[0].confidence >= 0.75) {
        alreadyDrafted = taken.candidates[0].player.name;
      }
    }

    const candidates = result.candidates.map((c) => ({
      id: c.player.id,
      name: c.player.name,
      position: c.player.position,
      nfl_team: c.player.nfl_team,
      rank: c.player.rank,
      confidence: Number(c.confidence.toFixed(3)),
    }));

    await supabaseAdmin.from("voice_pick_logs").insert({
      draft_id: data.draftId,
      transcript: data.transcript.slice(0, 500),
      cleaned: result.cleaned,
      matched_player_id: candidates[0]?.id ?? null,
      confidence: candidates[0]?.confidence ?? null,
      heard_team: result.heardTeam,
      outcome: alreadyDrafted ? "already_drafted" : result.status,
    });

    return {
      status: result.status,
      cleaned: result.cleaned,
      heardTeam: result.heardTeam,
      alreadyDrafted,
      candidates,
    };
  });
