-- ─── Reports table ───
CREATE TABLE public.post_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  post_id UUID,
  comment_id UUID,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.post_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
  ON public.post_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE INDEX idx_post_reports_post ON public.post_reports(post_id);
CREATE INDEX idx_post_reports_comment ON public.post_reports(comment_id);

-- ─── Community notifications table ───
CREATE TABLE public.community_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like','comment')),
  post_id UUID NOT NULL,
  comment_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can view own notifications"
  ON public.community_notifications FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Recipients can update own notifications"
  ON public.community_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Recipients can delete own notifications"
  ON public.community_notifications FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "System can insert notifications"
  ON public.community_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_community_notif_recipient ON public.community_notifications(recipient_id, created_at DESC);

-- ─── Trigger: like → notification ───
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner UUID;
BEGIN
  SELECT user_id INTO owner FROM public.community_posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.community_notifications (recipient_id, actor_id, type, post_id)
    VALUES (owner, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_post_like
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

-- ─── Trigger: unlike → remove notification ───
CREATE OR REPLACE FUNCTION public.unnotify_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.community_notifications
   WHERE type='like' AND post_id = OLD.post_id AND actor_id = OLD.user_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_unnotify_post_like
AFTER DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.unnotify_post_like();

-- ─── Trigger: comment → notification ───
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner UUID;
BEGIN
  SELECT user_id INTO owner FROM public.community_posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.community_notifications (recipient_id, actor_id, type, post_id, comment_id)
    VALUES (owner, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_post_comment
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();