-- ============================================================================
-- amaNazaretha Church App — schema for Supabase project gzxbppwlfxtbybzxlocw
-- Idempotent: safe to re-run. Creates all tables the church app reads/writes
-- and opens them up to the publishable (anon) key the app ships with.
-- ============================================================================

-- Enable UUID extension for auth.users references
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- PROFILES (column names mirror what the app's renderMyProfile() reads)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  name            text        not null default '',
  first           text        not null default '',
  surname         text        not null default '',
  email           text,
  temple          text        not null default 'eBuhleni',
  age             integer     not null default 25,
  gender          text        not null default '',
  praise          text        not null default '',
  bio             text        not null default 'Walking the Shembe path with amaNazaretha.',
  type            text        not null default 'Member',
  initials        text        not null default '',
  "avatarColor"   text        not null default '#0c0c0c',
  "avatarImage"   text,
  "coverImage"    text,
  avatar          text,
  cover           text,
  location        text        not null default 'Durban',
  joined          text        not null default 'Just now',
  followers       integer     not null default 0,
  "followingCount" integer    not null default 0,
  verified        boolean     not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- POSTS (home feed)
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete set null,
  author_name     text,
  author_initials text,
  author_avatar   text,
  title           text        not null default '',
  text            text,
  tags            text        not null default '',
  temple          text        not null default 'eBuhleni',
  image           text,
  video           text,
  likes           integer     not null default 0,
  comments        integer     not null default 0,
  reposts         integer     not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ---------------------------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id              bigint generated always as identity primary key,
  day             text        not null default '01',
  month           text        not null default 'JAN',
  title           text        not null default '',
  type            text        not null default 'Service',
  date_label      text        not null default '',
  time            text        not null default '',
  venue           text        not null default '',
  temple          text        not null default '',
  host            text        not null default '',
  attending       integer     not null default 0,
  description     text        not null default '',
  cover           text        not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists events_created_at_idx on public.events (created_at desc);

-- ---------------------------------------------------------------------------
-- REELS
-- ---------------------------------------------------------------------------
create table if not exists public.reels (
  id              bigint generated always as identity primary key,
  username        text        not null default '',
  initials        text        not null default 'AN',
  avatar_color    text        not null default '#0c0c0c',
  verified        boolean     not null default false,
  location        text        not null default '',
  description     text        not null default '',
  tags            text        not null default '',
  music           text        not null default '',
  likes           integer     not null default 0,
  comments        integer     not null default 0,
  reposts         integer     not null default 0,
  video           text        not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists reels_created_at_idx on public.reels (created_at desc);

-- ---------------------------------------------------------------------------
-- FOLLOWS
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  id              bigint generated always as identity primary key,
  follower_id     uuid references auth.users(id) on delete cascade,
  following_id    uuid references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(follower_id, following_id)
);

create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

-- ---------------------------------------------------------------------------
-- SAVED POSTS
-- ---------------------------------------------------------------------------
create table if not exists public.saved_posts (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  post_id         bigint references public.posts(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(user_id, post_id)
);

create index if not exists saved_posts_user_id_idx on public.saved_posts (user_id);

-- ---------------------------------------------------------------------------
-- POST LIKES
-- ---------------------------------------------------------------------------
create table if not exists public.post_likes (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  post_id         bigint references public.posts(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(user_id, post_id)
);

create index if not exists post_likes_user_id_idx on public.post_likes (user_id);
create index if not exists post_likes_post_id_idx on public.post_likes (post_id);

-- ---------------------------------------------------------------------------
-- POST REPOSTS
-- ---------------------------------------------------------------------------
create table if not exists public.post_reposts (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  post_id         bigint references public.posts(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(user_id, post_id)
);

create index if not exists post_reposts_user_id_idx on public.post_reposts (user_id);
create index if not exists post_reposts_post_id_idx on public.post_reposts (post_id);

-- ---------------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id              bigint generated always as identity primary key,
  post_id         bigint references public.posts(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  user_name       text,
  user_initials   text,
  text            text not null,
  likes           integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists comments_post_id_idx on public.comments (post_id);
create index if not exists comments_user_id_idx on public.comments (user_id);

-- ---------------------------------------------------------------------------
-- EVENT ATTENDEES
-- ---------------------------------------------------------------------------
create table if not exists public.event_attendees (
  id              bigint generated always as identity primary key,
  event_id        bigint references public.events(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(event_id, user_id)
);

create index if not exists event_attendees_event_id_idx on public.event_attendees (event_id);
create index if not exists event_attendees_user_id_idx on public.event_attendees (user_id);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  type            text not null,
  title           text not null,
  text            text,
  data            jsonb,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.posts          enable row level security;
alter table public.events         enable row level security;
alter table public.reels          enable row level security;
alter table public.profiles       enable row level security;
alter table public.follows        enable row level security;
alter table public.saved_posts    enable row level security;
alter table public.post_likes     enable row level security;
alter table public.post_reposts   enable row level security;
alter table public.comments       enable row level security;
alter table public.event_attendees enable row level security;
alter table public.notifications  enable row level security;

do $$
declare
  t text;
  r text;
begin
  foreach t in array array['posts', 'events', 'reels', 'profiles', 'follows', 'saved_posts', 'comments', 'event_attendees', 'notifications', 'post_likes', 'post_reposts']
  loop
    foreach r in array array['anon', 'authenticated']
    loop
      execute format('drop policy if exists "%s_%s_all" on public.%I', t, r, t);
      execute format(
        'create policy "%s_%s_all" on public.%I for all to %I using (true) with check (true)',
        t, r, t, r
      );
    end loop;
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.posts          to anon, authenticated;
grant select, insert, update, delete on public.events         to anon, authenticated;
grant select, insert, update, delete on public.reels          to anon, authenticated;
grant select, insert, update, delete on public.profiles       to anon, authenticated;
grant select, insert, update, delete on public.follows        to anon, authenticated;
grant select, insert, update, delete on public.saved_posts    to anon, authenticated;
grant select, insert, update, delete on public.comments       to anon, authenticated;
grant select, insert, update, delete on public.event_attendees to anon, authenticated;
grant select, insert, update, delete on public.notifications  to anon, authenticated;
grant select, insert, update, delete on public.post_likes     to anon, authenticated;
grant select, insert, update, delete on public.post_reposts   to anon, authenticated;

-- ============================================================
--  REALTIME PUBLICATION
-- ============================================================
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
