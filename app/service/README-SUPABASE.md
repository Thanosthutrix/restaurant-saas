# Tables Supabase pour le MVP Service

Pour que `/service/new` et `/service/[id]` fonctionnent, crée ces tables dans le **Table Editor** Supabase.

## 1. Table `dishes`

| Colonne         | Type   | Contraintes                          |
|-----------------|--------|--------------------------------------|
| id              | uuid   | Primary key, Default: gen_random_uuid() |
| restaurant_id   | uuid   |                                      |
| name            | text   |                                      |

- Ajoute au moins un plat pour le restaurant `11111111-1111-1111-1111-111111111111` (ex. name = "Salade", "Plat du jour").

## 2. Table `services`

| Colonne               | Type   | Contraintes                          |
|-----------------------|--------|--------------------------------------|
| id                    | uuid   | Primary key, Default: gen_random_uuid() |
| restaurant_id         | uuid   |                                      |
| service_date          | date   |                                      |
| service_type          | text   | (valeurs: `lunch` ou `dinner`)       |
| image_url             | text   | (optionnel)                          |
| analysis_status       | text   | (optionnel) `done` / `error`         |
| analysis_result_json  | text   | (optionnel) JSON `{"items":[...]}`   |
| analysis_error        | text   | (optionnel) message d'erreur         |
| analysis_version      | text   | (optionnel) version du pipeline     |

- Pour ajouter les colonnes d’analyse sur une table existante, exécute le script `supabase/schema-analysis-and-aliases.sql` dans le SQL Editor Supabase.

## 3. Table `service_sales`

| Colonne       | Type   | Contraintes                          |
|---------------|--------|--------------------------------------|
| id            | uuid   | Primary key, Default: gen_random_uuid() |
| service_id    | uuid   | Foreign key → services(id)          |
| dish_id       | uuid   | Foreign key → dishes(id)             |
| qty           | int4   |                                      |
| restaurant_id | uuid   |                                      |

- Dans Supabase, crée les **Foreign Keys** pour `service_id` et `dish_id` afin que la page détail puisse afficher le nom du plat (join).

## 4. Table `dish_aliases` (optionnel, pour le matching)

| Colonne       | Type   | Contraintes                          |
|---------------|--------|--------------------------------------|
| id            | uuid   | Primary key, Default: gen_random_uuid() |
| restaurant_id | uuid   |                                      |
| dish_id       | uuid   | Foreign key → dishes(id)             |
| alias         | text   | ex. "Reine", "Marg"                  |
| created_at    | timestamptz | Default: now()                    |

- Création via le script `supabase/schema-analysis-and-aliases.sql`. La logique d’utilisation des alias dans le matching n’est pas encore branchée.

## 5. Row Level Security (RLS)

- Désactive RLS sur `dishes`, `services`, `service_sales` et `dish_aliases` pour ce MVP, ou ajoute des policies qui autorisent SELECT/INSERT pour le rôle `anon`.
