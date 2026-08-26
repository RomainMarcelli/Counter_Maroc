# Architecture

## Principes

- L’interface ne lit jamais Supabase directement pour afficher une mutation locale.
- Dexie/IndexedDB est la source de vérité réactive du téléphone.
- Une mutation métier et son opération de queue sont écrites dans la même transaction.
- Les UUID sont créés côté client. Un rejeu produit donc un `upsert`, jamais un doublon.
- Toutes les dates métier sont des ISO 8601 UTC ; les vues utilisent `Africa/Casablanca` via `Intl`.

## Couches

- `src/domain` : types, favoris et calculs de statistiques purs.
- `src/data` : Dexie, repository transactionnel, seed, mapping Supabase et moteur de sync.
- `src/components` : écrans client réactifs alimentés par `useLiveQuery`.
- `src/app` : routes App Router et métadonnées PWA.
- `supabase/migrations` : PostgreSQL, RLS, Auth anonyme et Realtime.

Le provider de séjour souscrit aux tables locales. Un tap met donc à jour le DOM dès la validation IndexedDB, normalement en quelques millisecondes, indépendamment de la latence réseau.

## Modèle de données

L’eau est séparée des consommations alcoolisées par conception. Les deux tables d’entrées gardent `consumed_at`, `action_by`, `device_id` et `round_id`. `round_id` permet de refaire une tournée et d’annuler son lot complet.

Les participants et boissons sont supprimés logiquement afin que l’ancien journal reste interprétable. Les statistiques ne comptent que les entrées non supprimées.
