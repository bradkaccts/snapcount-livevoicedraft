DROP INDEX IF EXISTS public.players_source_external_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS players_source_external_id_key
  ON public.players (source, external_id);