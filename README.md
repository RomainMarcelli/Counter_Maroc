# Marrakech Crew

PWA mobile-first et offline-first pour saisir les boissons d’un séjour en un ou deux taps. IndexedDB répond immédiatement ; Supabase synchronise ensuite les autres téléphones sans bloquer l’utilisateur.

## Installation

Prérequis : Node.js 20+ et npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir `http://localhost:3000`. La base locale démarre vide : créez ou rejoignez un séjour depuis l’écran d’accueil, puis ajoutez vos participants et boissons. Le bouton **Reset DEV** des réglages efface uniquement la base IndexedDB du navigateur.

## Variables d’environnement

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_ENABLE_DEMO_SEED=false
```

- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` activent Auth anonyme, la synchronisation et Realtime. Sans eux, l’app reste fonctionnelle en mode local.
- `NEXT_PUBLIC_ENABLE_DEMO_SEED` active explicitement le seed de test. Il reste à `false` pour une base vide.
- Auth > Providers > Anonymous Sign-Ins doit être activé dans Supabase.

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

La migration crée les tables, index, politiques RLS, la fonction sécurisée de jonction par code et la publication Realtime. Voir [docs/DATABASE.md](docs/DATABASE.md).

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

## Tester la PWA et le hors-ligne

1. Lancer un build de production avec `npm run build && npm run start`.
2. Ouvrir l’application une fois en ligne et attendre l’activation du service worker.
3. Dans DevTools > Application, vérifier Manifest et Service Workers.
4. Passer Network sur Offline, recharger, ajouter un verre et vérifier le Journal.
5. Revenir en ligne : l’indicateur passe des actions en attente à **Synchronisé** si Supabase est configuré.

Sur iPhone : Safari > Partager > **Sur l’écran d’accueil**. Sur Android : menu du navigateur > **Installer l’application**. Le service worker met en cache la coquille et les assets ; les données métier restent dans IndexedDB.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Synchronisation offline](docs/OFFLINE_SYNC.md)
- [Base de données et sécurité](docs/DATABASE.md)
