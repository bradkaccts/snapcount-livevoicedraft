import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

  const playersQuery = useQuery({
    queryKey: ["players"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, position, nfl_team, bye_week, rank, stat_line")
        .order("rank")
        .limit(1000);
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

  return {
    draft: draftQuery.data ?? null,
    teams: teamsQuery.data ?? [],
    picks: picksQuery.data ?? [],
    players: playersQuery.data ?? [],
    isLoading: draftQuery.isLoading || playersQuery.isLoading,
    notFound: draftQuery.isFetched && !draftQuery.data,
    refresh,
  };
}
