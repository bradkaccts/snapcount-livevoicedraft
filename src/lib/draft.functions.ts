import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { makeRoomCode, slotForOverall } from "./draft-utils";

const CreateDraftInput = z.object({
  leagueName: z.string().min(1).max(60),
  rounds: z.number().int().min(1).max(30),
  clockSeconds: z.number().int().min(15).max(600),
  orderType: z.enum(["snake", "linear"]),
  teams: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        manager: z.string().max(40).nullable(),
        color: z.string().max(20),
      }),
    )
    .min(2)
    .max(16),
});

export const createDraft = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateDraftInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let roomCode = makeRoomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await supabaseAdmin
        .from("drafts")
        .select("id")
        .eq("room_code", roomCode)
        .maybeSingle();
      if (!existing) break;
      roomCode = makeRoomCode();
    }

    const { data: draft, error } = await supabaseAdmin
      .from("drafts")
      .insert({
        room_code: roomCode,
        league_name: data.leagueName,
        team_count: data.teams.length,
        rounds: data.rounds,
        clock_seconds: data.clockSeconds,
        order_type: data.orderType,
        status: "live",
        current_overall: 1,
      })
      .select("id, room_code")
      .single();
    if (error || !draft) throw new Error(error?.message ?? "Could not create the draft");

    const { error: teamError } = await supabaseAdmin.from("draft_teams").insert(
      data.teams.map((team, index) => ({
        draft_id: draft.id,
        name: team.name,
        manager: team.manager,
        color: team.color,
        slot: index + 1,
      })),
    );
    if (teamError) throw new Error(teamError.message);

    return { roomCode: draft.room_code };
  });

const MakePickInput = z.object({
  draftId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export const makePick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MakePickInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: draft } = await supabaseAdmin
      .from("drafts")
      .select("id, team_count, rounds, order_type, current_overall, status")
      .eq("id", data.draftId)
      .maybeSingle();
    if (!draft) throw new Error("Draft not found");
    if (draft.status === "complete") throw new Error("This draft is already finished");

    const totalPicks = draft.team_count * draft.rounds;
    if (draft.current_overall > totalPicks) throw new Error("Every pick has been made");

    const { data: taken } = await supabaseAdmin
      .from("picks")
      .select("id")
      .eq("draft_id", draft.id)
      .eq("player_id", data.playerId)
      .maybeSingle();
    if (taken) throw new Error("That player is already off the board");

    const { round, pickInRound, slot } = slotForOverall(
      draft.current_overall,
      draft.team_count,
      draft.order_type,
    );

    const { data: team } = await supabaseAdmin
      .from("draft_teams")
      .select("id")
      .eq("draft_id", draft.id)
      .eq("slot", slot)
      .maybeSingle();
    if (!team) throw new Error("Could not work out whose pick this is");

    const { error: pickError } = await supabaseAdmin.from("picks").insert({
      draft_id: draft.id,
      team_id: team.id,
      player_id: data.playerId,
      round,
      pick_in_round: pickInRound,
      overall: draft.current_overall,
    });
    if (pickError) throw new Error(pickError.message);

    const nextOverall = draft.current_overall + 1;
    await supabaseAdmin
      .from("drafts")
      .update({
        current_overall: nextOverall,
        status: nextOverall > totalPicks ? "complete" : "live",
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id);

    return { overall: draft.current_overall, round, pickInRound, teamId: team.id };
  });

const UndoInput = z.object({ draftId: z.string().uuid() });

export const undoLastPick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UndoInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: last } = await supabaseAdmin
      .from("picks")
      .select("id, overall")
      .eq("draft_id", data.draftId)
      .order("overall", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) return { undone: false };

    await supabaseAdmin.from("picks").delete().eq("id", last.id);
    await supabaseAdmin
      .from("drafts")
      .update({
        current_overall: last.overall,
        status: "live",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.draftId);

    return { undone: true };
  });
