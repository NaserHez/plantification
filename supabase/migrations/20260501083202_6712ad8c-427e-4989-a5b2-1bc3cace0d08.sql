-- community_posts
CREATE TABLE public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  plant_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view community posts"
ON public.community_posts FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Users can create own posts"
ON public.community_posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
ON public.community_posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
ON public.community_posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- post_likes
CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
ON public.post_likes FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Users can like posts"
ON public.post_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own likes"
ON public.post_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- post_comments
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
ON public.post_comments FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Users can comment"
ON public.post_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
ON public.post_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.post_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_post_comments_updated_at
BEFORE UPDATE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id, created_at);