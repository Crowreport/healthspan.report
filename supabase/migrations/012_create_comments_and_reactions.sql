-- Comments + reactions (likes/dislikes) for rss_items (articles + research/topic).
-- Videos intentionally excluded for now, but will work automatically if you later link them.

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rss_item_id UUID NOT NULL REFERENCES public.rss_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_rss_item_id_idx ON public.comments(rss_item_id);
CREATE INDEX IF NOT EXISTS comments_user_id_idx ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS comments_created_at_idx ON public.comments(created_at DESC);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments.
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments
  FOR SELECT
  USING (true);

-- Only authenticated users can create comments for themselves.
CREATE POLICY "Users can create their own comments"
  ON public.comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can edit their own comments; admins can edit any comment.
CREATE POLICY "Users can update their own comments"
  ON public.comments
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can delete their own comments; admins can delete any comment.
CREATE POLICY "Users can delete their own comments"
  ON public.comments
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reactions: one per user per comment (like=1, dislike=-1).
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction SMALLINT NOT NULL CHECK (reaction IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_reactions_user_id_idx ON public.comment_reactions(user_id);
CREATE INDEX IF NOT EXISTS comment_reactions_comment_id_idx ON public.comment_reactions(comment_id);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions (for counts).
CREATE POLICY "Comment reactions are viewable by everyone"
  ON public.comment_reactions
  FOR SELECT
  USING (true);

-- Only authenticated users can create/update/delete their own reaction.
CREATE POLICY "Users can create their own comment reactions"
  ON public.comment_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment reactions"
  ON public.comment_reactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comment reactions"
  ON public.comment_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_comment_reactions_updated_at ON public.comment_reactions;
CREATE TRIGGER update_comment_reactions_updated_at
  BEFORE UPDATE ON public.comment_reactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

