-- Localisation pour météo (Open-Meteo) et zone pour vacances scolaires (France).
alter table public.restaurants
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists school_zone text;

alter table public.restaurants drop constraint if exists chk_restaurants_school_zone;
alter table public.restaurants
  add constraint chk_restaurants_school_zone
  check (school_zone is null or school_zone in ('A', 'B', 'C'));

comment on column public.restaurants.latitude is 'Latitude WGS84 pour météo (ex. 48.8566).';
comment on column public.restaurants.longitude is 'Longitude WGS84 pour météo (ex. 2.3522).';
comment on column public.restaurants.school_zone is 'Zone vacances scolaires France : A, B ou C (calendrier académique).';
