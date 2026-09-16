ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'builtin',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

UPDATE public.players SET source = 'builtin' WHERE source IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS players_source_external_id_key
  ON public.players (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS players_active_rank_idx ON public.players (active, rank);

CREATE TABLE IF NOT EXISTS public.player_sync (
  id text PRIMARY KEY,
  last_synced_at timestamp with time zone,
  player_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.player_sync TO anon;
GRANT SELECT ON public.player_sync TO authenticated;
GRANT ALL ON public.player_sync TO service_role;

ALTER TABLE public.player_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player sync public read"
  ON public.player_sync FOR SELECT
  USING (true);

INSERT INTO public.player_sync (id) VALUES ('sleeper')
  ON CONFLICT (id) DO NOTHING;