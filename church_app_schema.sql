-- ============================================================================
-- amaNazaretha Church App — schema for Supabase project gzxbppwlfxtbybzxlocw
-- Idempotent: safe to re-run. Creates the 4 tables the church app reads/writes
-- and opens them up to the publishable (anon) key the app ships with.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- POSTS (home feed)
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id          bigint generated always as identity primary key,
  icon        text        not null default 'sun',
  title       text        not null default '',
  text        text,
  tags        text        not null default '',
  temple      text        not null default 'eBuhleni',
  image       text,
  video       text,
  likes       integer     not null default 0,
  comments    integer     not null default 0,
  reposts     integer     not null default 0,
  author      text,
  created_at  timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ---------------------------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  day         text        not null default '01',
  month       text        not null default 'JAN',
  title       text        not null default '',
  type        text        not null default 'Service',
  date_label  text        not null default '',
  time        text        not null default '',
  venue       text        not null default '',
  temple      text        not null default '',
  host        text        not null default '',
  attending   integer     not null default 0,
  description text        not null default '',
  cover       text        not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists events_created_at_idx on public.events (created_at desc);

-- ---------------------------------------------------------------------------
-- REELS
-- ---------------------------------------------------------------------------
create table if not exists public.reels (
  id           bigint generated always as identity primary key,
  username     text        not null default '',
  initials     text        not null default 'AN',
  avatar_color text        not null default '#0c0c0c',
  verified     boolean     not null default false,
  location     text        not null default '',
  description  text        not null default '',
  tags         text        not null default '',
  music        text        not null default '',
  likes        integer     not null default 0,
  comments     integer     not null default 0,
  reposts      integer     not null default 0,
  video        text        not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists reels_created_at_idx on public.reels (created_at desc);

-- ---------------------------------------------------------------------------
-- PROFILES (column names mirror what the app's renderMyProfile() reads)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              bigint generated always as identity primary key,
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

create index if not exists profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- Row level security: the app has no auth, so allow the publishable key
-- (anon role) full read/write on these four tables only.
-- ---------------------------------------------------------------------------
alter table public.posts    enable row level security;
alter table public.events   enable row level security;
alter table public.reels    enable row level security;
alter table public.profiles enable row level security;

do $$
declare
  t text;
  r text;
begin
  foreach t in array array['posts', 'events', 'reels', 'profiles']
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
grant select, insert, update, delete on public.posts    to anon, authenticated;
grant select, insert, update, delete on public.events   to anon, authenticated;
grant select, insert, update, delete on public.reels    to anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated;
