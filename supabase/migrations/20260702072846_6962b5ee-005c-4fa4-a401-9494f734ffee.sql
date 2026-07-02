
-- === Batch A: care schedules, shared gardens, gamification, plant/profile extensions ===

-- Ensure updated_at trigger exists (already present in project as public.update_updated_at_column)

-- 1) SHARED GARDENS
CREATE TABLE public.shared_gardens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT substring(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_gardens TO authenticated;
GRANT ALL ON public.shared_gardens TO service_role;
ALTER TABLE public.shared_gardens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shared_garden_members (
  garden_id UUID NOT NULL REFERENCES public.shared_gardens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (garden_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.shared_garden_members TO authenticated;
GRANT ALL ON public.shared_garden_members TO service_role;
ALTER TABLE public.shared_garden_members ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_garden_member(_garden UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_garden_members
    WHERE garden_id = _garden AND user_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.shared_gardens
    WHERE id = _garden AND owner_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.garden_owner(_garden UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id FROM public.shared_gardens WHERE id = _garden;
$$;

-- Policies for shared_gardens
CREATE POLICY "Members can view their gardens" ON public.shared_gardens
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_garden_member(id, auth.uid()));
CREATE POLICY "Users can create gardens" ON public.shared_gardens
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update garden" ON public.shared_gardens
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner can delete garden" ON public.shared_gardens
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Allow joining by invite code (anonymous read of code lookup is unsafe — allow authenticated to lookup by code via RPC below)
CREATE OR REPLACE FUNCTION public.join_shared_garden(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id INTO g_id FROM public.shared_gardens WHERE invite_code = _code;
  IF g_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.shared_garden_members(garden_id, user_id)
    VALUES (g_id, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN g_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.join_shared_garden(TEXT) TO authenticated;

-- Policies for shared_garden_members
CREATE POLICY "Members can view membership rows" ON public.shared_garden_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_garden_member(garden_id, auth.uid()));
CREATE POLICY "Users can leave a garden" ON public.shared_garden_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.garden_owner(garden_id) = auth.uid());
-- Inserts go through join_shared_garden() RPC; block direct inserts by not creating an INSERT policy.

CREATE TRIGGER trg_shared_gardens_updated
  BEFORE UPDATE ON public.shared_gardens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) EXTEND plants: shared garden linkage + light readings
ALTER TABLE public.plants
  ADD COLUMN IF NOT EXISTS shared_garden_id UUID REFERENCES public.shared_gardens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_light_reading TEXT,
  ADD COLUMN IF NOT EXISTS last_light_lux INTEGER,
  ADD COLUMN IF NOT EXISTS last_light_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS light_requirement TEXT;

-- Extend plants RLS: shared-garden members can view + edit shared plants
DROP POLICY IF EXISTS "Users can view own plants" ON public.plants;
CREATE POLICY "Users can view own or shared plants" ON public.plants
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (shared_garden_id IS NOT NULL AND public.is_garden_member(shared_garden_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update own plants" ON public.plants;
CREATE POLICY "Users can update own or shared plants" ON public.plants
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (shared_garden_id IS NOT NULL AND public.is_garden_member(shared_garden_id, auth.uid()))
  );
-- Delete stays owner-only (already exists)
-- Insert stays owner-only (already exists)

-- 3) CARE SCHEDULES
CREATE TABLE public.care_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('water','fertilize','mist','repot')),
  interval_days INTEGER NOT NULL CHECK (interval_days > 0),
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_done_at TIMESTAMPTZ,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plant_id, task_type)
);
CREATE INDEX care_schedules_plant_idx ON public.care_schedules(plant_id);
CREATE INDEX care_schedules_due_idx ON public.care_schedules(next_due_at) WHERE is_paused = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_schedules TO authenticated;
GRANT ALL ON public.care_schedules TO service_role;
ALTER TABLE public.care_schedules ENABLE ROW LEVEL SECURITY;

-- Policies mirror plants access (owner or shared-garden member)
CREATE POLICY "View own or shared care schedules" ON public.care_schedules
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.plants p
      WHERE p.id = care_schedules.plant_id
        AND p.shared_garden_id IS NOT NULL
        AND public.is_garden_member(p.shared_garden_id, auth.uid())
    )
  );
CREATE POLICY "Insert own care schedules" ON public.care_schedules
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own or shared care schedules" ON public.care_schedules
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.plants p
      WHERE p.id = care_schedules.plant_id
        AND p.shared_garden_id IS NOT NULL
        AND public.is_garden_member(p.shared_garden_id, auth.uid())
    )
  );
CREATE POLICY "Delete own care schedules" ON public.care_schedules
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_care_schedules_updated
  BEFORE UPDATE ON public.care_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) GAMIFICATION - badges + streaks
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_care_date DATE;

CREATE TABLE public.badges (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are public" ON public.badges FOR SELECT USING (true);

INSERT INTO public.badges(code, name, description, icon) VALUES
  ('first_plant','First sprout','Add your first plant','sprout'),
  ('ten_plants','Green thumb','Grow your garden to 10 plants','leaf'),
  ('seven_day_streak','Steady gardener','Log care 7 days in a row','flame'),
  ('identified_ten','Botanist','Identify 10 different plants','search'),
  ('saved_a_wilter','Plant medic','Revive a wilting plant','heart')
ON CONFLICT DO NOTHING;

CREATE TABLE public.user_badges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL REFERENCES public.badges(code) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_code)
);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own badges" ON public.user_badges
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Inserts happen via trigger (SECURITY DEFINER); no client insert policy.

-- Grant helper for triggers
CREATE OR REPLACE FUNCTION public.grant_badge(_user UUID, _code TEXT)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.user_badges(user_id, badge_code)
  VALUES (_user, _code) ON CONFLICT DO NOTHING;
$$;

-- Streak update on care action (called from client via RPC after care completion)
CREATE OR REPLACE FUNCTION public.record_care_action(_plant UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  today DATE := (now() AT TIME ZONE 'UTC')::date;
  prev DATE;
  cur INT;
  best INT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT last_care_date, current_streak, longest_streak
    INTO prev, cur, best
    FROM public.profiles WHERE id = uid;

  IF prev = today THEN
    -- already counted today
    NULL;
  ELSIF prev = today - 1 THEN
    cur := COALESCE(cur,0) + 1;
  ELSE
    cur := 1;
  END IF;
  best := GREATEST(COALESCE(best,0), cur);

  UPDATE public.profiles
     SET last_care_date = today,
         current_streak = cur,
         longest_streak = best
   WHERE id = uid;

  IF cur >= 7 THEN
    PERFORM public.grant_badge(uid, 'seven_day_streak');
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.record_care_action(UUID) TO authenticated;

-- Auto-badges on plant milestones
CREATE OR REPLACE FUNCTION public.check_plant_badges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM public.plants WHERE user_id = NEW.user_id;
  IF cnt >= 1 THEN PERFORM public.grant_badge(NEW.user_id, 'first_plant'); END IF;
  IF cnt >= 10 THEN PERFORM public.grant_badge(NEW.user_id, 'ten_plants'); END IF;
  IF cnt >= 10 THEN
    IF (SELECT COUNT(DISTINCT scientific_name) FROM public.plants WHERE user_id = NEW.user_id AND scientific_name IS NOT NULL) >= 10 THEN
      PERFORM public.grant_badge(NEW.user_id, 'identified_ten');
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_plants_badges
  AFTER INSERT ON public.plants
  FOR EACH ROW EXECUTE FUNCTION public.check_plant_badges();
