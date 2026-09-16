CREATE TABLE public.voice_pick_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.drafts(id) ON DELETE CASCADE,
  transcript text NOT NULL,
  cleaned text,
  matched_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  confidence numeric,
  heard_team text,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX voice_pick_logs_draft_idx ON public.voice_pick_logs (draft_id, created_at DESC);

GRANT SELECT, INSERT ON public.voice_pick_logs TO anon;
GRANT SELECT, INSERT ON public.voice_pick_logs TO authenticated;
GRANT ALL ON public.voice_pick_logs TO service_role;

ALTER TABLE public.voice_pick_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read voice pick logs"
  ON public.voice_pick_logs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can add voice pick logs"
  ON public.voice_pick_logs FOR INSERT
  WITH CHECK (true);