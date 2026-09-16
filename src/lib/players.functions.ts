import { createServerFn } from "@tanstack/react-start";

const SYNC_ID = "sleeper";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PlayerPoolStatus = {
  source: "sleeper" | "builtin";
  playerCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};

async function readStatus(): Promise<PlayerPoolStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sync } = await supabaseAdmin
    .from("player_sync")
    .select("last_synced_at, player_count, last_error")
    .eq("id", SYNC_ID)
    .maybeSingle();

  const { count } = await supabaseAdmin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  return {
    source: sync?.last_synced_at ? "sleeper" : "builtin",
    playerCount: count ?? 0,
    lastSyncedAt: sync?.last_synced_at ?? null,
    lastError: sync?.last_error ?? null,
  };
}

/** Pull the live Sleeper pool into the database. Cached for 24 hours unless forced. */
export const syncPlayers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const force = Boolean((input as { force?: boolean } | undefined)?.force);
    return { force };
  })
  .handler(async ({ data }): Promise<PlayerPoolStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchSleeperPool } = await import("./sleeper.server");

    const { data: sync } = await supabaseAdmin
      .from("player_sync")
      .select("last_synced_at")
      .eq("id", SYNC_ID)
      .maybeSingle();

    const age = sync?.last_synced_at
      ? Date.now() - new Date(sync.last_synced_at).getTime()
      : Infinity;
    if (!data.force && age < MAX_AGE_MS) return readStatus();

    try {
      const pool = await fetchSleeperPool();
      if (pool.length < 100) throw new Error("Sleeper returned an unexpectedly small pool");

      const now = new Date().toISOString();
      const rows = pool.map((player, index) => ({
        source: "sleeper",
        external_id: player.externalId,
        name: player.name,
        position: player.position,
        nfl_team: player.nflTeam,
        stat_line: player.statLine,
        bye_week: null,
        rank: index + 1,
        adp: index + 1,
        active: true,
        updated_at: now,
      }));

      for (let i = 0; i < rows.length; i += 250) {
        const { error } = await supabaseAdmin
          .from("players")
          .upsert(rows.slice(i, i + 250), { onConflict: "source,external_id" });
        if (error) throw new Error(error.message);
      }

      // Anything Sleeper no longer lists drops out of the pool but keeps its row,
      // so picks made in earlier drafts still resolve.
      await supabaseAdmin
        .from("players")
        .update({ active: false })
        .eq("source", "sleeper")
        .lt("updated_at", now);

      // Live data wins: retire the built-in fallback rows.
      await supabaseAdmin
        .from("players")
        .update({ active: false })
        .eq("source", "builtin")
        .eq("active", true);

      await supabaseAdmin
        .from("player_sync")
        .upsert({
          id: SYNC_ID,
          last_synced_at: now,
          player_count: rows.length,
          last_error: null,
          updated_at: now,
        });

      return readStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Player sync failed";
      await supabaseAdmin
        .from("player_sync")
        .upsert({ id: SYNC_ID, last_error: message, updated_at: new Date().toISOString() });

      // Nothing synced yet: make sure the built-in list is available to draft on.
      const { count } = await supabaseAdmin
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("active", true);
      if (!count) {
        await supabaseAdmin
          .from("players")
          .update({ active: true })
          .eq("source", "builtin");
      }
      return readStatus();
    }
  });

/** Current pool status, kicking off a refresh when the cache is stale. */
export const getPlayerPoolStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlayerPoolStatus> => {
    return readStatus();
  },
);
