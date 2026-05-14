-- Permissions pages personnalisées par collaborateur.
-- Si renseigné, ce tableau prend le dessus sur app_role pour déterminer les pages accessibles.
alter table staff_members
  add column if not exists app_nav_keys text[] default null;
