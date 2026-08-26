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

Le moteur exige une session : sans compte connecté, aucune requête n’est émise et la file reste intacte. Il confirme ensuite le membership serveur du séjour — au besoin en le créant via `create_trip_with_owner` — **avant** de pousser la moindre boisson ou consommation. Vient alors l’ordre habituel : séjour, participants et boissons, puis consommations.

Après un échec réseau, l’erreur est conservée et le backoff exponentiel plafonne à 60 secondes. Après un refus d’autorisation (`42501`, 401/403, RLS), la reprise automatique est au contraire espacée à 5 minutes : une requête interdite ne devient pas permise en la répétant. Un retour en ligne, un appui sur l’indicateur ou un changement de session relancent immédiatement. Les interactions restent disponibles pendant ces délais.

Un timer est reprogrammé sur la prochaine échéance de retry : aucune nouvelle interaction utilisateur n’est nécessaire pour reprendre la synchronisation.

## Conflits et idempotence

- UUID côté client + clé primaire PostgreSQL + `upsert on conflict (id)` empêchent les doublons.
- `updated_at` tranche les conflits en last-write-wins.
- Un trigger PostgreSQL ignore tout `upsert` dont `updated_at` est plus ancien que la ligne déjà présente.
- Une version Realtime plus ancienne que la version locale ou la queue locale n’écrase rien.
- Une suppression renseigne `deleted_at` et reste synchronisable comme toute autre mise à jour.
- `created_at` et `consumed_at` ne sont jamais remplacés par une simple chaîne locale.

## Trois états distincts

L’indicateur de l’en-tête ne mélange plus les causes :

- **Compte** — connecté en tant que X, ou aucun compte connecté.
- **Réseau** — en ligne ou hors ligne.
- **File** — synchronisé, N actions en attente, ou erreur de synchronisation.

Hors ligne avec des écritures locales, il affiche par exemple « Hors ligne · 2 actions locales ».

## Limites assumées

Rejoindre un séjour inconnu exige une première connexion afin de résoudre le code de partage et obtenir les données. Créer un compte, et se connecter pour la première fois sur un téléphone neuf, demandent également le réseau ; ensuite la session est relue depuis le stockage du navigateur et l’application reste utilisable en mode avion. Une fois hydraté, le séjour est entièrement utilisable hors ligne. Si le stockage du navigateur est manuellement effacé avant synchronisation, les données locales non répliquées ne peuvent pas être récupérées.
