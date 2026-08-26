# Base de données Supabase

## Tables

- `profiles` : prénom affiché d’un compte, alimenté à l’inscription par un trigger sur `auth.users`.
- `trips` : séjour, code court unique, dates et timezone.
- `trip_members` : appartenance d’un utilisateur Auth à un séjour.
- `participants` et `drinks` : référentiels extensibles avec soft delete. `participants.user_id` rattache un compte à une personne du séjour ; il reste `null` tant que cette personne n’a pas rejoint.
- `drink_entries` : verres alcoolisés.
- `water_entries` : hydratation exclue des classements alcool.
- `sync_operations` : disponible pour audit/déduplication serveur avancée.

Le bucket Storage public `profile-photos` contient les avatars optimisés. Son arborescence est `trip_id/participant_id/fichier.webp`. Les policies d’écriture vérifient que l’utilisateur authentifié est membre du séjour ; l’URL publique permet ensuite l’affichage direct et la mise en cache sur les téléphones.

La seconde migration complète les séjours existants avec une sélection de boissons système sans dupliquer les noms déjà présents. Lors d’une nouvelle création, cette même sélection est d’abord écrite dans IndexedDB pour rester instantanée, puis synchronisée dans `drinks`.

Les identifiants sont des UUID fournis par les clients. `timestamptz` conserve l’instant absolu ; `Africa/Casablanca` n’est appliqué qu’au regroupement et à l’affichage.

## Sécurité

Toutes les tables ont RLS activé. `is_trip_member` est une fonction `security definer` à `search_path` verrouillé qui évite la récursion des policies. Les policies SELECT/INSERT/UPDATE/DELETE limitent chaque accès aux membres du séjour.

La règle est le **membership**, pas la propriété individuelle : tout membre crée, modifie et supprime les participants, boissons et consommations de son séjour, y compris pour quelqu’un d’autre. Trois exceptions restreignent davantage :

- `action_by = auth.uid()` est exigé à l’insertion d’une consommation, pour la traçabilité.
- `participant_in_trip` et `drink_in_trip` interdisent de mélanger deux séjours dans une même ligne.
- La suppression d’un séjour et la gestion des membres sont réservées au rôle `owner`.

`participants.user_id` n’est jamais écrit par la synchronisation. Le trigger `participants_guard_identity` refuse toute tentative de rattacher un participant à un autre compte que l’appelant, et `claim_participant` est le seul chemin nominal.

`join_trip_by_code` reste la seule voie permettant de découvrir un séjour dont on n’est pas encore membre. Elle résout le code exact puis inscrit `auth.uid()` dans `trip_members`.

Le rôle `anon` ne peut rien écrire : aucune policy ne le vise. Sans session, une insertion échoue avec `42501` — c’est exactement ce qui se produisait quand l’application s’appuyait sur une authentification anonyme désactivée côté projet. Voir [AUTH.md](AUTH.md).
