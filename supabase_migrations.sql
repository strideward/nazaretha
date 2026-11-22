-- ============================================================
--  SUBASE MIGRATIONS FOR AMANAZARETHA CHURCH APP
--  Run in Supabase SQL Editor in order
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  1. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    first TEXT,
    surname TEXT,
    initials TEXT,
    avatar_color TEXT DEFAULT '#0c0c0c',
    avatar_image TEXT,
    cover_image TEXT,
    bio TEXT DEFAULT 'Walking the Shembe path with amaNazaretha.',
    type TEXT DEFAULT 'Member',
    temple TEXT DEFAULT 'eBuhleni',
    preacher TEXT,
    gender TEXT,
    praise TEXT,
    dob DATE,
    age INTEGER,
    location TEXT DEFAULT 'Durban',
    joined TIMESTAMPTZ DEFAULT NOW(),
    followers INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_temple ON public.profiles(temple);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
--  2. POSTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name TEXT,
    author_initials TEXT,
    author_avatar TEXT,
    text TEXT NOT NULL,
    temple TEXT DEFAULT 'eBuhleni',
    image TEXT,
    video TEXT,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_temple ON public.posts(temple);

-- RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts are viewable by everyone" ON public.posts
    FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can insert posts" ON public.posts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own posts" ON public.posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON public.posts
    FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_posts_updated_at ON public.posts;
CREATE TRIGGER trigger_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
--  3. COMMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comments (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_initials TEXT,
    text TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);

-- RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone" ON public.comments
    FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can insert comments" ON public.comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_comments_updated_at ON public.comments;
CREATE TRIGGER trigger_comments_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
--  4. REELS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reels (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username TEXT,
    initials TEXT,
    avatar_color TEXT DEFAULT '#0c0c0c',
    verified BOOLEAN DEFAULT FALSE,
    location TEXT,
    description TEXT,
    tags TEXT,
    music TEXT,
    video TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reels_user_id ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON public.reels(created_at DESC);

-- RLS
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reels are viewable by everyone" ON public.reels
    FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can insert reels" ON public.reels
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own reels" ON public.reels
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reels" ON public.reels
    FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_reels_updated_at ON public.reels;
CREATE TRIGGER trigger_reels_updated_at
    BEFORE UPDATE ON public.reels
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
--  5. REEL COMMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reel_comments (
    id BIGSERIAL PRIMARY KEY,
    reel_id BIGINT REFERENCES public.reels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_initials TEXT,
    text TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_id ON public.reel_comments(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_comments_created_at ON public.reel_comments(created_at DESC);

-- RLS
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reel comments are viewable by everyone" ON public.reel_comments
    FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can insert reel comments" ON public.reel_comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
--  6. EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    day TEXT,
    month TEXT,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'Service',
    date_label TEXT,
    time TEXT,
    venue TEXT,
    temple TEXT,
    host TEXT,
    attending INTEGER DEFAULT 0,
    description TEXT,
    cover TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_temple ON public.events(temple);

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone" ON public.events
    FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can insert events" ON public.events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own events" ON public.events
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events" ON public.events
    FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_events_updated_at ON public.events;
CREATE TRIGGER trigger_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
--  7. EVENT ATTENDEES (for reminders/going)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_attendees (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reminded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON public.event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON public.event_attendees(user_id);

-- RLS
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendees viewable by everyone" ON public.event_attendees
    FOR SELECT USING (TRUE);

CREATE POLICY "Users can manage their own attendance" ON public.event_attendees
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================
--  8. CHATS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    type TEXT DEFAULT 'private', -- 'private', 'public'
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_created_by ON public.chats(created_by);

-- RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chats viewable by participants" ON public.chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants
            WHERE chat_id = chats.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can create chats" ON public.chats
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS trigger_chats_updated_at ON public.chats;
CREATE TRIGGER trigger_chats_updated_at
    BEFORE UPDATE ON public.chats
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
--  9. CHAT PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_participants (
    id BIGSERIAL PRIMARY KEY,
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    UNIQUE(chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON public.chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON public.chat_participants(user_id);

-- RLS
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants viewable by chat members" ON public.chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants cp2
            WHERE cp2.chat_id = chat_participants.chat_id AND cp2.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join chats" ON public.chat_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
--  10. MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT,
    media_type TEXT, -- 'image', 'video', 'voice'
    media_url TEXT,
    voice_duration TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by chat participants" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants
            WHERE chat_id = messages.chat_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Participants can send messages" ON public.messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_participants
            WHERE chat_id = messages.chat_id AND user_id = auth.uid()
        )
    );

DROP TRIGGER IF EXISTS trigger_messages_updated_at ON public.messages;
CREATE TRIGGER trigger_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
--  11. MESSAGE REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- ============================================================
--  12. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'like', 'comment', 'follow', 'repost', 'mention', 'message', 'event_reminder'
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT,
    actor_initials TEXT,
    actor_avatar TEXT,
    entity_type TEXT, -- 'post', 'reel', 'event', 'chat', 'profile'
    entity_id TEXT,
    title TEXT NOT NULL,
    text TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, read) WHERE read = FALSE;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
--  13. FOLLOWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.follows (
    id BIGSERIAL PRIMARY KEY,
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone" ON public.follows
    FOR SELECT USING (TRUE);

CREATE POLICY "Users can follow others" ON public.follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON public.follows
    FOR DELETE USING (auth.uid() = follower_id);

-- ============================================================
--  14. SAVED POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON public.saved_posts(user_id);

-- ============================================================
--  15. POST LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.post_likes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);

-- ============================================================
--  16. POST REPOSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.post_reposts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reposts_user_id ON public.post_reposts(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reposts_post_id ON public.post_reposts(post_id);

-- ============================================================
--  17. STORAGE BUCKETS (run in Storage section or via API)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES
--     ('media', 'media', TRUE),
--     ('avatars', 'avatars', TRUE),
--     ('covers', 'covers', TRUE),
--     ('reels', 'reels', TRUE)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies (run after buckets exist):
-- CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (bucket_id IN ('media','avatars','covers','reels'));
-- CREATE POLICY "Authenticated upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('media','avatars','covers','reels') AND auth.role() = 'authenticated');
-- CREATE POLICY "Owner update/delete" ON storage.objects FOR UPDATE USING (auth.uid() = owner);
-- CREATE POLICY "Owner delete" ON storage.objects FOR DELETE USING (auth.uid() = owner);

-- ============================================================
--  16. FUNCTIONS FOR NOTIFICATIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    post_owner UUID;
BEGIN
    SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
    IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, type, actor_id, actor_name, entity_type, entity_id, title, text)
        SELECT post_owner, 'like', NEW.user_id, p.name, 'post', NEW.post_id::TEXT, 'New like', p.name || ' liked your post'
        FROM public.profiles p WHERE p.user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    post_owner UUID;
BEGIN
    SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
    IF post_owner IS NOT NULL AND post_owner != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, type, actor_id, actor_name, entity_type, entity_id, title, text)
        SELECT post_owner, 'comment', NEW.user_id, p.name, 'post', NEW.post_id::TEXT, 'New comment', p.name || ' commented on your post'
        FROM public.profiles p WHERE p.user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.follower_id != NEW.following_id THEN
        INSERT INTO public.notifications (user_id, type, actor_id, actor_name, entity_type, entity_id, title, text)
        SELECT NEW.following_id, 'follow', NEW.follower_id, p.name, 'profile', p.user_id::TEXT, 'New follower', p.name || ' started following you'
        FROM public.profiles p WHERE p.user_id = NEW.follower_id;
    END IF;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    participant UUID;
BEGIN
    FOR participant IN
        SELECT user_id FROM public.chat_participants WHERE chat_id = NEW.chat_id AND user_id != NEW.user_id
    LOOP
        INSERT INTO public.notifications (user_id, type, actor_id, actor_name, entity_type, entity_id, title, text)
        SELECT participant, 'message', NEW.user_id, p.name, 'chat', NEW.chat_id::TEXT, 'New message', p.name || ': ' || COALESCE(NEW.content, 'Sent media')
        FROM public.profiles p WHERE p.user_id = NEW.user_id;
    END LOOP;
    RETURN NEW;
END; $$;

-- Attach triggers
DROP TRIGGER IF EXISTS trigger_post_like_notify ON public.posts;
-- Note: We'd need a separate likes table for this trigger. For now, handled in app.

DROP TRIGGER IF EXISTS trigger_comment_notify ON public.comments;
CREATE TRIGGER trigger_comment_notify
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS trigger_follow_notify ON public.follows;
CREATE TRIGGER trigger_follow_notify
    AFTER INSERT ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

DROP TRIGGER IF EXISTS trigger_message_notify ON public.messages;
CREATE TRIGGER trigger_message_notify
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- ============================================================
--  17. PROFILE AUTO-CREATE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, name, first, surname, initials, temple, preacher, gender, praise, avatar_color)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'amaNazaretha Member'),
        NEW.raw_user_meta_data->>'first',
        NEW.raw_user_meta_data->>'surname',
        UPPER(COALESCE(SUBSTRING(NEW.raw_user_meta_data->>'first' FROM 1 FOR 1), 'A') || COALESCE(SUBSTRING(NEW.raw_user_meta_data->>'surname' FROM 1 FOR 1), '')),
        NEW.raw_user_meta_data->>'temple',
        NEW.raw_user_meta_data->>'preacher',
        NEW.raw_user_meta_data->>'gender',
        NEW.raw_user_meta_data->>'praise',
        '#0c0c0c'
    ) ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
--  18. UPDATE PROFILE COUNTS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.profiles SET followers = followers + 1 WHERE user_id = NEW.following_id;
        UPDATE public.profiles SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.profiles SET followers = GREATEST(0, followers - 1) WHERE user_id = OLD.following_id;
        UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE user_id = OLD.follower_id;
    END IF;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_follow_counts ON public.follows;
CREATE TRIGGER trigger_follow_counts
    AFTER INSERT OR DELETE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- ============================================================
--  19. REALTIME PUBLICATION
-- ============================================================
-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reposts;

-- ============================================================
--  20. HELPER VIEWS
-- ============================================================
CREATE OR REPLACE VIEW public.posts_with_author AS
SELECT p.*, pr.name as author_name, pr.initials as author_initials, pr.avatar_image as author_avatar
FROM public.posts p
LEFT JOIN public.profiles pr ON p.user_id = pr.user_id;

CREATE OR REPLACE VIEW public.reels_with_author AS
SELECT r.*, pr.name as author_name, pr.initials as author_initials, pr.avatar_image as author_avatar
FROM public.reels r
LEFT JOIN public.profiles pr ON r.user_id = pr.user_id;

-- ============================================================
--  END OF MIGRATIONS
-- ============================================================