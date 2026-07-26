-- Publications réseaux sociales depuis l'ERP (historique + statuts).

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook')),
  content_type text not null check (content_type in ('feed', 'story', 'reel')),
  caption text,
  media_url text,
  status text not null default 'draft' check (status in ('draft', 'publishing', 'published', 'failed')),
  meta_media_id text,
  meta_permalink text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists social_posts_restaurant_created_idx
  on public.social_posts (restaurant_id, created_at desc);

alter table public.social_posts enable row level security;
