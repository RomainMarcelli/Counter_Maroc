# Base de données Supabase

## Tables

- `trips` : séjour, code court unique, dates et timezone.
- `trip_members` : appartenance d’un utilisateur Auth à un séjour.
- `participants` et `drinks` : référentiels extensibles avec soft delete.
- `drink_entries` : verres alcoolisés.
- `water_entries` : hydratation exclue des classements alcool.
- `sync_operations` : disponible pour audit/déduplication serveur avancée.

Les identifiants sont des UUID fournis par les clients. `timestamptz` conserve l’instant absolu ; `Africa/Casablanca` n’est appliqué qu’au regroupement et à l’affichage.

## Sécurité

Toutes les tables ont RLS activé. `is_trip_member` est une fonction `security definer` à `search_path` verrouillé qui évite la récursion des policies. Les policies SELECT/INSERT/UPDATE/DELETE limitent chaque accès aux membres du séjour.

`join_trip_by_code` est la seule voie permettant à un utilisateur anonyme authentifié de découvrir un séjour dont il n’est pas encore membre. Elle ne renvoie que l’UUID correspondant au code exact puis inscrit `auth.uid()` dans `trip_members`.

Le rôle `anon` n’obtient aucun droit direct sur les tables : l’application établit d’abord une session Supabase Auth anonyme, donc les requêtes utilisent le rôle `authenticated` et les policies RLS.
