ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unit_system TEXT NOT NULL DEFAULT 'metric'
    CHECK (unit_system IN ('metric','imperial'));