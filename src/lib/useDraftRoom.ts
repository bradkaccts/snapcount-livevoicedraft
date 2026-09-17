import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { syncPlayers } from "@/lib/players.functions";

const POOL_STALE_MS = 5 * 60 * 1000;

export type Player = {
  id: string;
  name: string;
  position: string;
  nfl_team: string;
  bye_week: number | null;
  rank: number;
  stat_line: string | null;
};

export type DraftTeam = {
  id: string;
  name: string;
  manager: string | null;
  color: string;
  slot: number;
};

export type Draft = {
  id: string;
  room_code: string;
  league_name: string;
  team_count: number;
  rounds: number;
  clock_seconds: number;
  order_type: string;
  status: string;
  current_overall: number;
};

export type Pick = {
  id: string;
  team_id: string;
  player_id: string;
  round: number;
  pick_in_round: number;
  overall: number;
};

export function useDraftRoom(code: string) {
  const queryClient = useQueryClient();

  const draftQuery = useQuery({
    queryKey: ["draft", code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drafts")
        .select(
          "id, room_code, league_name, team_count, rounds, clock_seconds, order_type, status, current_overall",
        )
        .eq("room_code", code)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Draft | null) ?? null;
    },
  });

  const draftId = draftQuery.data?.id;

  const teamsQuery = useQuery({
    queryKey: ["draft-teams", draftId],
    enabled: Boolean(draftId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draft_teams")
        .select("id, name, manager, color, slot")
        .eq("draft_id", draftId!)
        .order("slot");
      if (error) throw new Error(error.message);
      return (data ?? []) as DraftTeam[];
    },
  });

  const picksQuery = useQuery({
    queryKey: ["picks", draftId],
    enabled: Boolean(draftId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("picks")
        .select("id, team_id, player_id, round, pick_in_round, overall")
        .eq("draft_id", draftId!)
        .order("overall");
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick[];
    },
  });

  // Keep the live Sleeper feed flowing into open draft rooms: this is cached
  // server-side for 24h, so it only does real work when the feed is stale.
  const runSync = useServerFn(syncPlayers);
  const poolSyncQuery = useQuery({
    queryKey: ["player-pool-sync"],
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: () => runSync({ data: { force: false } }),
  });
  const lastSyncedAt = poolSyncQuery.data?.lastSyncedAt ?? null;

  const playersQuery = useQuery({
    queryKey: ["players"],
    staleTime: POOL_STALE_MS,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, position, nfl_team, bye_week, rank, stat_line")
        .eq("active", true)
        .order("rank")
        .limit(1500);
      if (error) throw new Error(error.message);
      return (data ?? []) as Player[];
    },
  });

  const pickedIds = (picksQuery.data ?? []).map((p) => p.player_id).sort();

  // Players drafted in this room that are no longer in the active pool
  // (e.g. dropped from the live feed) still need to render on the board.
  const pickedPlayersQuery = useQuery({
    queryKey: ["picked-players", pickedIds],
    enabled: pickedIds.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, position, nfl_team, bye_week, rank, stat_line")
        .in("id", pickedIds);
      if (error) throw new Error(error.message);
      return (data ?? []) as Player[];
    },
  });

  useEffect(() => {
    if (!draftId) return;
    const channel = supabase
      .channel(`draft-${draftId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "picks", filter: `draft_id=eq.${draftId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["picks", draftId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drafts", filter: `id=eq.${draftId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["draft", code] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [draftId, code, queryClient]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["picks", draftId] });
    void queryClient.invalidateQueries({ queryKey: ["draft", code] });
  };

  const mergedPlayers = (() => {
    const pool = playersQuery.data ?? [];
    const extras = (pickedPlayersQuery.data ?? []).filter(
      (p) => !pool.some((x) => x.id === p.id),
    );
    return extras.length ? [...pool, ...extras] : pool;
  })();

  return {
    draft: draftQuery.data ?? null,
    teams: teamsQuery.data ?? [],
    picks: picksQuery.data ?? [],
    players: mergedPlayers,
    isLoading: draftQuery.isLoading || playersQuery.isLoading,
    notFound: draftQuery.isFetched && !draftQuery.data,
    refresh,
  };
}
