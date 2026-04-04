-- Adresse saisie libre ; géocodage (API Adresse) remplit latitude / longitude et peut déduire la zone scolaire.
alter table public.restaurants
  add column if not exists address_text text;

alter table public.restaurants
  add column if not exists school_zone_is_manual boolean not null default false;

comment on column public.restaurants.address_text is 'Adresse postale pour géocodage (météo, zone vacances).';
comment on column public.restaurants.school_zone_is_manual is 'Si false, la zone A/B/C peut être recalculée au géocodage.';
