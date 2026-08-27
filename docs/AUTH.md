# Comptes, séjours et identités

## Pourquoi ce changement

L’application ouvrait une session avec `supabase.auth.signInAnonymously()`. Le provider
anonyme a ensuite été désactivé sur le projet, ce qui a produit une panne silencieuse :

```text
POST /rest/v1/drinks        → 42501  new row violates row-level security policy
POST /rest/v1/drink_entries → 42501  new row violates row-level security policy
```

Reproduit contre le projet réel :

| Vérification | Résultat |
| --- | --- |
| `POST /auth/v1/signup` (anonyme) | `422 anonymous_provider_disabled` |
| `GET /auth/v1/settings` | `"anonymous_users": false` |
| `INSERT` sans session | `42501` sur `drinks` et `drink_entries` |
| `select count(*) from trips` | `0` |
| `select count(*) from trip_members` | `0` |

L’enchaînement est le suivant. Sans session, PostgREST exécute la requête en rôle `anon` ;
toutes les policies sont écrites `to authenticated`, donc aucune ne s’applique et l’insertion
est refusée. Comme le séjour n’a jamais pu être poussé, `trip_members` est resté vide, si bien
que `is_trip_member(trip_id)` renvoyait `false` même pour les rares téléphones qui avaient
encore une session anonyme en cache. Enfin, le moteur de synchronisation replanifiait toutes
les opérations toutes les 60 secondes : d’où la rafale d’erreurs dans la console.

Les utilisateurs anonymes existaient bien dans `auth.users` (cinq d’entre eux) ; la liste
**Authentication → Users** du dashboard ne les montrait simplement pas, faute d’email.

## Le modèle retenu

```text
auth.users          un compte email + mot de passe
   ↓ 1..1
profiles            le prénom affiché
   ↓ 0..n
trip_members        (trip_id, user_id, role)     ← la seule source de vérité des droits
   ↓
participants        une personne du séjour, user_id nullable
```

Un **compte** et un **participant** sont deux choses distinctes. Quelqu’un peut ajouter
« Lucas » au séjour bien avant que Lucas installe l’application ; le participant existe alors
sans `user_id`. Lucas crée ensuite son compte, rejoint avec le code, et choisit son identité :
`claim_participant()` renseigne `participants.user_id`.

Un compte ne tient qu’une identité par séjour (index unique partiel), et personne ne peut
prendre une identité déjà rattachée à un autre compte.

## Règle d’autorisation

> Si `auth.uid()` appartient au séjour, il gère toutes les données fonctionnelles du séjour.

Romain peut donc ajouter un Mojito à Lucas, corriger l’heure d’un verre de Théo, ou supprimer
une tournée saisie par quelqu’un d’autre. Aucune policy n’exige `participant.user_id = auth.uid()`
pour les consommations — ce serait contraire au produit.

La seule contrainte d’identité porte sur la traçabilité : `action_by = auth.uid()` est exigé
à l’**insertion**. `participant_id` reste libre parmi les participants du séjour, et
`participant_id ≠ action_by` est le cas normal. Le Journal affiche « ajouté par Romain » en
résolvant `action_by` via `participants.user_id`.

Une modification ne réécrit pas `action_by` : l’auteur d’origine reste l’auteur même quand
quelqu’un d’autre corrige la ligne.

## Fonctions SQL

| Fonction | Rôle |
| --- | --- |
| `is_trip_member(uuid)` | Base de toutes les policies. `security definer`, `search_path` verrouillé, donc pas de récursion sur `trip_members`. |
| `is_trip_owner(uuid)` | Suppression d’un séjour, gestion des membres. |
| `create_trip_with_owner(...)` | Séjour + membership `owner` + participant du créateur, en une transaction. |
| `join_trip_by_code(text)` | Résout le code, inscrit `auth.uid()` dans `trip_members`. Idempotent. |
| `claim_participant(uuid)` | Rattache le compte à un participant libre du séjour. |
| `my_trips()` | Séjours du compte, pour rouvrir directement le bon au lancement. |
| `participant_in_trip` / `drink_in_trip` | Cohérence d’un verre : participant et boisson appartiennent au séjour visé. |

`create_trip_with_owner` remplace le trigger `trips_add_owner` comme chemin nominal. Le trigger
créait bien le membership, mais seulement si l’INSERT du séjour réussissait ; en cas d’échec, la
synchronisation continuait sur les boissons et les verres et se heurtait à un `trip_members`
vide. Le RPC rend l’ensemble atomique, et il est idempotent : les identifiants viennent du
téléphone, donc rejouer l’appel ne crée rien en double.

## Le piège de l’upsert et des policies d’insertion

Un `upsert` PostgREST est un `INSERT ... ON CONFLICT (id) DO UPDATE`. PostgreSQL évalue le
`WITH CHECK` de la policy d’**insertion** sur la ligne proposée **avant** de détecter le
conflit. Une policy écrite pour encadrer la création s’applique donc aussi à chaque mise à
jour venue de la file de synchronisation — alors que la policy `UPDATE`, elle, autorise
l’opération.

Deux conséquences, toutes deux observées contre le projet réel :

| Policy | Ce qui cassait |
| --- | --- |
| `trips_insert with check (created_by = auth.uid())` | Tout `upsert` de séjour omettant `created_by` proposait `NULL` → `42501` en boucle sur `/trips`. Et un membre non-créateur, qui renvoie le `created_by` d’origine, était refusé lui aussi. |
| `drink_entries_insert with check (… action_by = auth.uid())` | Lucas ne pouvait ni corriger ni supprimer une consommation saisie par Romain : sa ligne proposait `action_by = Romain`. |

La correction tient en deux gestes :

- Le téléphone renvoie toujours `created_by` et `action_by` tels quels — l’auteur d’origine
  reste l’auteur, et la ligne proposée est complète.
- Les policies d’insertion tolèrent le chemin d’insertion **quand la ligne existe déjà**
  (`trip_exists`, `drink_entry_exists`, `water_entry_exists`, tous `security definer` pour
  éviter la récursion d’une policy interrogeant sa propre table).

Aucune permission nouvelle : ces mises à jour étaient déjà autorisées par les policies
`UPDATE`. Pour une ligne réellement neuve, la contrainte d’origine s’applique intégralement —
on ne peut toujours pas créer un séjour au nom de quelqu’un d’autre, ni signer une
consommation d’un autre compte.

## Ordre imposé à la synchronisation

Le moteur ne pousse **rien** avant d’avoir confirmé le membership serveur du séjour concerné :

1. session présente ? sinon on n’émet aucune requête ;
2. `trip_members` contient-il `(trip_id, auth.uid())` ? une seule vérification par séjour et par session ;
3. sinon, appel de `create_trip_with_owner` ;
4. seulement ensuite : participants, boissons, consommations.

Si l’étape 2 ou 3 échoue, les opérations du séjour sont replanifiées **sans consommer de
tentative** : l’échec porte sur le séjour, pas sur chacun des soixante verres.

## Reprise après erreur

| Type d’erreur | Comportement |
| --- | --- |
| Autorisation (`42501`, `28000`, 401/403, RLS) | Reprise automatique espacée à 5 minutes. Un refus ne se résout pas en réessayant. |
| Réseau / serveur | Backoff exponentiel plafonné à 60 s, comme avant. |
| Retour en ligne, appui sur l’indicateur, changement de session | Reprise immédiate, backoff ignoré. |

C’est ce qui supprime la boucle de requêtes interdites.

## Session et hors-ligne

La session est lue avec `getSession()`, qui interroge le stockage du navigateur — jamais
`getUser()`, qui exigerait le réseau. Une PWA installée relancée en mode avion reste donc
connectée et pleinement utilisable : consultation, ajout de verre, tournée, eau, Journal,
statistiques, alcoolémie estimée. Les écritures s’empilent dans IndexedDB et repartent au
retour du réseau.

Seuls trois moments exigent une connexion : créer un compte, se connecter la première fois sur
un téléphone neuf, et rejoindre un séjour inconnu.

## Séparation des comptes sur un même navigateur

- **Se déconnecter** n’efface pas IndexedDB : le séjour reste en place pour le même compte.
- Si un **autre** compte se connecte sur le même navigateur, les données locales du précédent
  sont effacées avant l’ouverture de sa session (`claimLocalData`).
- **Réglages → Réinitialiser les données locales** efface tout, y compris la file d’attente.

## Migration des données locales

La version 4 d’IndexedDB vide les tables du séjour et la file de synchronisation. Ce n’est pas
une perte : ces enregistrements portaient un `actionBy` issu d’un compte anonyme qui ne
référence plus rien, et chaque opération en attente aurait été refusée indéfiniment par la RLS.
Côté serveur il n’y avait rien à récupérer — `trips` et `trip_members` étaient vides. Seul
`deviceId` est conservé, car il identifie le téléphone et non un compte.
