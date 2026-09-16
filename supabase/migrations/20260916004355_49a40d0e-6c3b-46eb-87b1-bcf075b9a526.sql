CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL,
  nfl_team text NOT NULL,
  bye_week int,
  rank int NOT NULL,
  adp numeric,
  stat_line text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_rank_idx ON public.players(rank);
CREATE INDEX players_position_idx ON public.players(position);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players are public" ON public.players FOR SELECT USING (true);

CREATE TABLE public.drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL UNIQUE,
  league_name text NOT NULL,
  team_count int NOT NULL,
  rounds int NOT NULL,
  clock_seconds int NOT NULL DEFAULT 90,
  order_type text NOT NULL DEFAULT 'snake',
  status text NOT NULL DEFAULT 'setup',
  current_overall int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drafts TO anon, authenticated;
GRANT ALL ON public.drafts TO service_role;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drafts open" ON public.drafts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.draft_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  name text NOT NULL,
  manager text,
  color text NOT NULL DEFAULT '#22d3ee',
  slot int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, slot)
);
CREATE INDEX draft_teams_draft_idx ON public.draft_teams(draft_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_teams TO anon, authenticated;
GRANT ALL ON public.draft_teams TO service_role;
ALTER TABLE public.draft_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draft teams open" ON public.draft_teams FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.draft_teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id),
  round int NOT NULL,
  pick_in_round int NOT NULL,
  overall int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, overall),
  UNIQUE (draft_id, player_id)
);
CREATE INDEX picks_draft_idx ON public.picks(draft_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.picks TO anon, authenticated;
GRANT ALL ON public.picks TO service_role;
ALTER TABLE public.picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "picks open" ON public.picks FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.highlights (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  title text,
  url text,
  source text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.highlights TO anon, authenticated;
GRANT ALL ON public.highlights TO service_role;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "highlights public read" ON public.highlights FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.picks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drafts;