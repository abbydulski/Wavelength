-- Wavelength v2 Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor → New query)
--
-- Prerequisites: Enable PostGIS extension in Supabase Dashboard → Database → Extensions
--   Or run: CREATE EXTENSION IF NOT EXISTS postgis;

CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. Users table (extends auth.users)
-- ============================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  bio TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  is_private BOOLEAN DEFAULT false,
  has_onboarded BOOLEAN DEFAULT false,
  posts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 2. Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. Places (backed by Google Places API)
-- ============================================================
CREATE TABLE public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  location GEOGRAPHY(Point, 4326) NOT NULL,
  category TEXT DEFAULT '',
  photo_reference TEXT DEFAULT '',
  avg_rating NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- Anyone can view places
CREATE POLICY "Places are viewable by everyone"
  ON public.places FOR SELECT
  USING (true);

-- Any authenticated user can insert a place (when rating a new venue)
CREATE POLICY "Authenticated users can create places"
  ON public.places FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow updates so upsert works when place already exists
CREATE POLICY "Authenticated users can update places"
  ON public.places FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Spatial index for local queries (~100 mile radius)
CREATE INDEX idx_places_location ON public.places USING GIST (location);
CREATE INDEX idx_places_google_id ON public.places (google_place_id);

-- ============================================================
-- 4. Posts (ratings/recommendations)
-- ============================================================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
  caption TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  category TEXT NOT NULL DEFAULT 'other',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Public posts are visible to everyone UNLESS the author is private.
-- Private authors' posts are only readable by the author and their followers.
-- (Anonymous rating-only visibility for private authors is served via the
-- get_place_ratings SECURITY DEFINER RPC, which never exposes identity/caption/photos.)
CREATE POLICY "Public posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (
    is_public = true
    AND NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = posts.user_id AND u.is_private = true
    )
  );

-- Users can see their own posts
CREATE POLICY "Users can view own posts"
  ON public.posts FOR SELECT
  USING (auth.uid() = user_id);

-- Followers can view a private author's posts
CREATE POLICY "Followers can view followed posts"
  ON public.posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.following_id = posts.user_id
    )
  );

-- Users can create their own posts (rate-limit checked by function)
CREATE POLICY "Users can create own posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- Index for place page queries
CREATE INDEX idx_posts_place_id ON public.posts (place_id, created_at DESC);
CREATE INDEX idx_posts_user_id ON public.posts (user_id, created_at DESC);

-- ============================================================
-- 5. Post photos (at least 1 required, enforced in app)
-- ============================================================
CREATE TABLE public.post_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.post_photos ENABLE ROW LEVEL SECURITY;

-- Photos are viewable only when the parent post is viewable to the requester
-- (public non-private author, own post, or a followed author).
CREATE POLICY "Post photos follow post visibility"
  ON public.post_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.users u ON u.id = p.user_id
      WHERE p.id = post_photos.post_id
        AND (
          auth.uid() = p.user_id
          OR (p.is_public = true AND u.is_private IS NOT TRUE)
          OR EXISTS (
            SELECT 1 FROM public.follows f
            WHERE f.follower_id = auth.uid() AND f.following_id = p.user_id
          )
        )
    )
  );

CREATE POLICY "Users can add photos to own posts"
  ON public.post_photos FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_id)
  );

CREATE POLICY "Users can delete photos from own posts"
  ON public.post_photos FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_id)
  );

CREATE INDEX idx_post_photos_post_id ON public.post_photos (post_id, display_order);

-- ============================================================
-- 6. Comments
-- ============================================================
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT USING (true);

CREATE POLICY "Users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7. Follows
-- ============================================================
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone"
  ON public.follows FOR SELECT USING (true);

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Note: follower visibility for posts is defined alongside the posts policies
-- above ("Followers can view followed posts").

-- ============================================================
-- 8. Follow requests
-- ============================================================
CREATE TABLE public.follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own follow requests"
  ON public.follow_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create follow requests"
  ON public.follow_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can delete follow requests they sent or received"
  ON public.follow_requests FOR DELETE
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- ============================================================
-- 9. Feedback
-- ============================================================
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 10. Rate limiting: max 10 posts per user per day
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_post_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  post_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO post_count
  FROM public.posts
  WHERE user_id = NEW.user_id
    AND created_at >= NOW() - INTERVAL '24 hours';

  IF post_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 10 posts per 24 hours';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_post_rate_limit
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.check_post_rate_limit();

-- ============================================================
-- 10b. Auto-update user posts_count on insert/delete
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_user_posts_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users SET posts_count = posts_count + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users SET posts_count = GREATEST(posts_count - 1, 0) WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_user_posts_count
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_posts_count();

-- ============================================================
-- 11. Auto-update place avg_rating on new/updated/deleted posts
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_place_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_place_id UUID;
BEGIN
  -- Determine which place to update
  IF TG_OP = 'DELETE' THEN
    target_place_id := OLD.place_id;
  ELSE
    target_place_id := NEW.place_id;
  END IF;

  UPDATE public.places
  SET
    avg_rating = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM public.posts WHERE place_id = target_place_id), 0),
    rating_count = (SELECT COUNT(*) FROM public.posts WHERE place_id = target_place_id)
  WHERE id = target_place_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_post_change_update_place_rating
  AFTER INSERT OR UPDATE OF rating OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_place_rating();

-- ============================================================
-- 12. RPC: Get ratings for a place page (network first, then recent 50)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_place_ratings(
  p_place_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  post_id UUID,
  user_id UUID,
  display_name TEXT,
  photo_url TEXT,
  caption TEXT,
  rating INTEGER,
  category TEXT,
  created_at TIMESTAMPTZ,
  is_network BOOLEAN,
  is_private_locked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  -- Network ratings (from people the user follows) — full detail, all of them
  (
    SELECT
      p.id AS post_id,
      p.user_id,
      u.display_name,
      u.photo_url,
      p.caption,
      p.rating,
      p.category,
      p.created_at,
      TRUE AS is_network,
      FALSE AS is_private_locked
    FROM public.posts p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.place_id = p_place_id
      AND p.is_public = true
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = p_user_id AND f.following_id = p.user_id
      )
    ORDER BY p.created_at DESC
  )
  UNION ALL
  -- Public (non-private) non-network ratings — full detail, most recent N
  (
    SELECT
      p.id AS post_id,
      p.user_id,
      u.display_name,
      u.photo_url,
      p.caption,
      p.rating,
      p.category,
      p.created_at,
      FALSE AS is_network,
      FALSE AS is_private_locked
    FROM public.posts p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.place_id = p_place_id
      AND p.is_public = true
      AND u.is_private IS NOT TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = p_user_id AND f.following_id = p.user_id
      )
      AND p.user_id != p_user_id
    ORDER BY p.created_at DESC
    LIMIT p_limit
  )
  UNION ALL
  -- Private non-network ratings — rating ONLY, no identity/caption/photos.
  -- These count toward the place but stay anonymous until you follow them.
  (
    SELECT
      p.id AS post_id,
      NULL::UUID AS user_id,
      NULL::TEXT AS display_name,
      NULL::TEXT AS photo_url,
      NULL::TEXT AS caption,
      p.rating,
      p.category,
      p.created_at,
      FALSE AS is_network,
      TRUE AS is_private_locked
    FROM public.posts p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.place_id = p_place_id
      AND p.is_public = true
      AND u.is_private = true
      AND NOT EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = p_user_id AND f.following_id = p.user_id
      )
      AND p.user_id != p_user_id
    ORDER BY p.created_at DESC
    LIMIT p_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 13. RPC: Discover nearby places (within ~100 miles)
-- ============================================================
CREATE OR REPLACE FUNCTION public.discover_nearby_places(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_miles INTEGER DEFAULT 100,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  place_id UUID,
  google_place_id TEXT,
  name TEXT,
  address TEXT,
  category TEXT,
  avg_rating NUMERIC,
  rating_count INTEGER,
  distance_miles DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.id AS place_id,
    pl.google_place_id,
    pl.name,
    pl.address,
    pl.category,
    pl.avg_rating,
    pl.rating_count,
    (ST_Distance(pl.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1609.34) AS distance_miles,
    ST_Y(pl.location::geometry) AS lat,
    ST_X(pl.location::geometry) AS lng
  FROM public.places pl
  WHERE ST_DWithin(
    pl.location,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_radius_miles * 1609.34  -- convert miles to meters
  )
  AND pl.rating_count > 0
  ORDER BY pl.rating_count DESC, pl.avg_rating DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 14. Table grants for authenticated & anon roles
-- ============================================================
GRANT SELECT ON public.users TO anon, authenticated;
GRANT INSERT ON public.users TO authenticated;
GRANT UPDATE ON public.users TO authenticated;

GRANT SELECT ON public.places TO anon, authenticated;
GRANT INSERT, UPDATE ON public.places TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;

GRANT SELECT, INSERT, DELETE ON public.post_photos TO authenticated;
GRANT SELECT ON public.post_photos TO anon;

GRANT SELECT, INSERT ON public.comments TO authenticated;
GRANT SELECT ON public.comments TO anon;

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;

GRANT SELECT, INSERT, DELETE ON public.follow_requests TO authenticated;

GRANT INSERT ON public.feedback TO authenticated;

-- Post reactions (agree / disagree with a rating)
CREATE TABLE public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('agree', 'disagree')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reactions" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can react" ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change their reaction" ON public.post_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove their reaction" ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT ON public.post_reactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated;

-- ============================================================
-- 14b. RPC: Delete the calling user's own account
-- ============================================================
-- Deletes the authenticated user's auth.users row. Every user-owned table
-- (users, posts, post_photos, comments, follows, follow_requests,
-- post_reactions) cascades from auth.users / public.users, so this removes
-- all of the user's data in one call. Runs as SECURITY DEFINER because the
-- anon/authenticated role cannot delete from auth.users directly.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  -- Require a real authenticated API request (a JWT sub claim). This blocks
  -- invocation from a superuser/dashboard context where auth.uid() could
  -- otherwise resolve to an impersonated user.
  IF current_setting('request.jwt.claim.sub', true) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ============================================================
-- 14c. RPC: Ensure the calling user's profile row exists
-- ============================================================
-- Self-heals a missing public.users row for the authenticated user (e.g. if
-- the handle_new_user trigger did not run at signup). Runs as SECURITY DEFINER
-- because public.users intentionally has no INSERT policy. Raises if the
-- auth.users row no longer exists (a stale JWT for a deleted account) so the
-- client can force a re-authentication instead of hitting a FK violation.
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void AS $$
DECLARE
  uid UUID := auth.uid();
  au auth.users%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.sub', true) IS NULL OR uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO au FROM auth.users WHERE id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account no longer exists';
  END IF;

  INSERT INTO public.users (id, email, display_name)
  VALUES (
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.ensure_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

-- ============================================================
-- 15. Storage buckets (create manually in Supabase Dashboard)
-- ============================================================
-- Create these PUBLIC buckets in Dashboard → Storage:
--   • avatars    — for user profile photos
--   • post-photos — for rating/recommendation photos
