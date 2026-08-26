# Synchronisation offline-first

```text
UI tactile
   ↓ transaction atomique
IndexedDB (entité) + syncQueue (opération)
   ↓ événement local / retour réseau
moteur de synchronisation
   ↓ upsert idempotent
Supabase + PostgreSQL
   ↓ postgres_changes
Realtime
   ↓ fusion last-write-wins
IndexedDB des autres téléphones
```

## Cycle d’une opération

Une opération porte un identifiant stable `<entityType>:<entityId>` et un statut `pending`, `syncing` ou `failed`. Plusieurs éditions locales de la même entité écrasent l’opération en attente : seule sa version la plus récente doit traverser le réseau.

Le moteur traite d’abord le séjour, puis participants et boissons, puis consommations. Après un échec, il conserve l’erreur et utilise un backoff exponentiel plafonné à 60 secondes. Les interactions restent disponibles pendant ce délai.

Un timer est reprogrammé sur la prochaine échéance de retry : aucune nouvelle interaction utilisateur n’est nécessaire pour reprendre la synchronisation.

## Conflits et idempotence

- UUID côté client + clé primaire PostgreSQL + `upsert on conflict (id)` empêchent les doublons.
- `updated_at` tranche les conflits en last-write-wins.
- Un trigger PostgreSQL ignore tout `upsert` dont `updated_at` est plus ancien que la ligne déjà présente.
- Une version Realtime plus ancienne que la version locale ou la queue locale n’écrase rien.
- Une suppression renseigne `deleted_at` et reste synchronisable comme toute autre mise à jour.
- `created_at` et `consumed_at` ne sont jamais remplacés par une simple chaîne locale.

## Limites assumées

Rejoindre un séjour inconnu exige une première connexion afin de résoudre le code de partage et obtenir les données. Une fois hydraté, le séjour est entièrement utilisable hors ligne. Si le stockage du navigateur est manuellement effacé avant synchronisation, les données locales non répliquées ne peuvent pas être récupérées.
