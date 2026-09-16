CREATE TABLE public.player_media (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  action_url text,
  headshot_url text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_media TO anon, authenticated;
GRANT ALL ON public.player_media TO service_role;
ALTER TABLE public.player_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player media public read" ON public.player_media FOR SELECT USING (true);