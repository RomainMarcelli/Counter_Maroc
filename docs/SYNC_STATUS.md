# Statut réseau et synchronisation

L'indicateur sépare quatre sources d'état qui étaient auparavant confondues : la
configuration du build, la session Supabase, le réseau du téléphone et la file
IndexedDB.

| Libellé | Condition exacte |
| --- | --- |
| **Synchronisé** | Variables Supabase présentes dans le build, session restaurée, téléphone en ligne, aucune erreur et file vide. |
| **Hors ligne · X actions locales** | `navigator.onLine === false`. Les écritures restent dans IndexedDB. |
| **Synchronisation en attente** | Au moins une opération locale attend son envoi. |
| **Synchronisation en cours** | Une opération est effectivement en cours d'envoi. |
| **Erreur de synchronisation** | Une lecture, une écriture ou le membership Supabase a échoué. |
| **Session expirée** | Le build attend un compte mais aucune session exploitable n'est disponible. |
| **Mode local** | Le build ne contient pas les deux variables Supabase, ou `NEXT_PUBLIC_ENABLE_DEMO_SEED=true`. |

Une panne ponctuelle, un chargement d'authentification ou un délai de synchronisation
ne produit donc plus **Mode local**.

## Cause du faux « Mode local »

Le précédent composant testait uniquement `!isSupabaseConfigured() || !accountRequired`.
Comme les variables `NEXT_PUBLIC_*` sont incorporées par Next.js pendant le build, un
déploiement Vercel construit sans elles reste en mode local même si elles sont ajoutées
plus tard au projet. Une PWA déjà installée pouvait en plus conserver ce bundle jusqu'à
sa prochaine mise à jour.

La machine d'état est maintenant indépendante et testée. Au retour au premier plan ou
du réseau, l'app :

1. relit `navigator.onLine` ;
2. recrée les canaux Realtime, que Safari iOS peut suspendre en arrière-plan ;
3. relit le séjour distant ;
4. rejoue immédiatement la file IndexedDB ;
5. demande une mise à jour du service worker et recharge une fois si un nouveau bundle
   prend le contrôle.

## Vérifications Vercel

Dans **Project Settings → Environment Variables** :

- renseigner `NEXT_PUBLIC_SUPABASE_URL` ;
- renseigner `NEXT_PUBLIC_SUPABASE_ANON_KEY` avec la clé publique `anon` ou
  `publishable`, jamais `service_role` ;
- fixer `NEXT_PUBLIC_ENABLE_DEMO_SEED=false` ;
- cocher l'environnement réellement utilisé : **Production**, **Preview** et/ou
  **Development** ;
- relancer un déploiement complet après toute modification. Modifier une variable ne
  réécrit pas un build déjà produit.

Si seul un ancien raccourci iPhone affiche encore **Mode local**, ouvrir d'abord le site
dans Safari en ligne, attendre quelques secondes, fermer complètement la PWA puis la
rouvrir. Le service worker `marrakech-crew-v4` remplace alors l'ancien cache. En dernier
recours, supprimer puis réinstaller le raccourci.

## Vérifications Supabase

- **Authentication → Providers → Email** activé ;
- utilisateurs anonymes laissés désactivés : l'app utilise email + mot de passe ;
- migrations appliquées, dont les policies RLS, les RPC de séjour et la publication
  Realtime ;
- URL publique Vercel ajoutée dans **Authentication → URL Configuration** ;
- RLS conservée sur toutes les tables métier.

Un clic sur l'indicateur relance manuellement la file. Son infobulle/nom accessible
donne le compte, l'état réseau, la file et la dernière erreur connue sans exposer de clé.

