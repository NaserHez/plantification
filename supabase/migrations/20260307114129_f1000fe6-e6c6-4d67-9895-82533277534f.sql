
CREATE TABLE public.diagnosis_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  overall_confidence NUMERIC,
  diseases JSONB DEFAULT '[]'::jsonb,
  care_recommendations JSONB,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.diagnosis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own diagnosis history"
ON public.diagnosis_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagnosis history"
ON public.diagnosis_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own diagnosis history"
ON public.diagnosis_history
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
