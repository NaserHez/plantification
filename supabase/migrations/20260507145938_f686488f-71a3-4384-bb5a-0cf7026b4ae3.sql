CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT,
  auth TEXT,
  reminder_time TIME WITHOUT TIME ZONE NOT NULL DEFAULT '08:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  tone TEXT NOT NULL DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can create own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_enabled_time
ON public.push_subscriptions (enabled, reminder_time);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
ON public.push_subscriptions (user_id);

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();