-- Regroupement multi-réseaux + options de publication sérialisées.

alter table public.social_posts
  add column if not exists publish_batch_id uuid,
  add column if not exists publish_options jsonb;

create index if not exists social_posts_batch_idx
  on public.social_posts (publish_batch_id)
  where publish_batch_id is not null;
