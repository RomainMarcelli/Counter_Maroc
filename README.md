# Marrakech Crew

PWA mobile-first et offline-first pour saisir les boissons d’un séjour en un ou deux taps. IndexedDB répond immédiatement ; Supabase synchronise ensuite les autres téléphones sans bloquer l’utilisateur.

Chaque personne a un compte email + mot de passe. Tous les membres d’un séjour partagent les mêmes droits : n’importe qui peut ajouter un verre à n’importe qui, l’auteur de l’action restant conservé.

## Installation

Prérequis : Node.js 20+ et npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir `http://localhost:3000`. Au premier lancement, l’application demande de créer un compte ou de se connecter, puis de créer un séjour ou d’en rejoindre un avec son code. À la création d’un séjour, la sélection de bières, vins, spiritueux et cocktails est ajoutée automatiquement ; elle reste entièrement modifiable. Le bouton **Réinitialiser les données locales** des réglages efface uniquement IndexedDB, jamais le compte.

## Variables d’environnement

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_ENABLE_DEMO_SEED=false
```

- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` activent Supabase Auth (email + mot de passe), la synchronisation et Realtime. Sans eux, l’application reste utilisable en mode local sur un seul téléphone, sans compte.
- `NEXT_PUBLIC_ENABLE_DEMO_SEED` active explicitement le seed de test. Il reste à `false` pour une base vide.
- Ne placez jamais une clé `secret` ou `service_role` dans une variable `NEXT_PUBLIC_*`.

## Supabase

Avec le CLI Supabase :

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

En local :

```bash
supabase start
supabase db reset
```

Les migrations créent les tables, index, politiques RLS, les fonctions sécurisées de création et de jonction d’un séjour, la publication Realtime et le bucket public `profile-photos` protégé en écriture par les membres du séjour. Voir [docs/DATABASE.md](docs/DATABASE.md) et [docs/AUTH.md](docs/AUTH.md).

Dans le Dashboard Supabase :

1. **Authentication → Sign In / Providers → Email** : laisser le provider **activé**. C’est le seul nécessaire, aucun OAuth n’est utilisé.
2. **Authentication → Sign In / Providers → Email → Confirm email** : décocher pour un usage privé entre amis, l’inscription ouvre alors la session immédiatement. Si l’option reste active, l’application affiche « Compte créé. Vérifie ton email. » et attend la confirmation.
3. **Authentication → Sign In / Providers** : laisser **Allow anonymous sign-ins** désactivé, l’application ne s’en sert plus.
4. Depuis le panneau **Connect** du projet : copier l’URL du projet et la clé publique `anon`/`publishable` dans `.env`.
5. Appliquer les migrations avec `supabase db push`, ou coller chaque fichier de `supabase/migrations` dans le **SQL Editor**, dans l’ordre de leurs noms.
6. Pour la production, renseigner **Authentication → URL Configuration** avec l’URL publique de l’application et ses redirect URLs autorisées.

Ne désactivez jamais RLS. Les droits reposent entièrement sur `trip_members`.

## Photos de profil

Dans **Réglages > Participants**, le bouton appareil photo accepte une image JPG, PNG ou WebP de 5 Mo maximum. L’application la recadre en carré, la compresse en WebP 512 × 512, l’envoie dans Supabase Storage puis synchronise son URL avec le crew. L’envoi d’une photo nécessite une connexion ; le reste de l’application reste offline-first.

Pour effacer uniquement les données et conserver tout le schéma, exécuter volontairement [`supabase/RESET_DATA.sql`](supabase/RESET_DATA.sql) dans le SQL Editor Supabase.

## Développement, build et tests

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run start
```

`npm run test:all` enchaîne lint, types, tests unitaires et E2E.

Deux suites supplémentaires s’exécutent contre un vrai projet Supabase migré, avec de vraies sessions authentifiées. Elles ne tournent pas par défaut : elles exigent le réseau et la clé de service.

```bash
SUPABASE_RLS_TEST=1 npm run test:rls                   # policies : membre, intrus, séjour voisin
SUPABASE_E2E=1 npx playwright test --project=Comptes   # deux comptes, deux navigateurs
```

Chacune crée ses comptes et son séjour de test, puis les supprime à la fin.

## Tester la PWA et le hors-ligne

1. Lancer un build de production avec `npm run build && npm run start`.
2. Ouvrir l’application une fois en ligne et attendre l’activation du service worker.
3. Dans DevTools > Application, vérifier Manifest et Service Workers.
4. Passer Network sur Offline, recharger, ajouter un verre et vérifier le Journal.
5. Revenir en ligne : l’indicateur passe des actions en attente à **Synchronisé** si Supabase est configuré.

Sur iPhone : Safari > Partager > **Sur l’écran d’accueil**. Sur Android : menu du navigateur > **Installer l’application**. Le service worker met en cache la coquille et les assets ; les données métier restent dans IndexedDB.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Comptes, séjours et identités](docs/AUTH.md)
- [Synchronisation offline](docs/OFFLINE_SYNC.md)
- [Base de données et sécurité](docs/DATABASE.md)
