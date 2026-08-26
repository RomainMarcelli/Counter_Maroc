# Estimation d’alcoolémie

> **Cette fonctionnalité fournit une estimation théorique et ne constitue ni un dispositif médical ni un éthylotest.**
>
> Estimation indicative uniquement. Elle ne remplace pas un éthylotest ou une mesure réelle.
> Ne pas utiliser cette estimation pour décider de conduire.

L’application n’affiche jamais « vous pouvez conduire », « vous êtes sobre », ni de compte à rebours
prétendant garantir une heure à laquelle la conduite serait sûre. Les libellés employés sont
systématiquement *alcoolémie estimée*, *alcoolémie théorique* ou *estimation*, préfixés par `≈`.

## 1. Ce qui est calculé

Pour chaque participant ayant **activé** l’estimation et renseigné un poids :

- l’alcoolémie théorique courante ;
- son évolution dans le temps (courbe) ;
- le pic estimé et son heure ;
- le pic de chaque journée et le pic du séjour.

Rien n’est stocké : le taux est une **valeur dérivée**, recalculée à partir des consommations,
de leur heure exacte et du profil. Aucune colonne `current_bac` n’existe, ni en local ni côté serveur.

## 2. Alcool pur d’une boisson

Masse volumique de l’éthanol retenue : **0,789 g/ml**.

```
alcoolPurGrammes = volumeMl × (abvPercent / 100) × 0,789
```

Exemple — un whisky de 4 cl à 40 % :

```
40 × 0,40 × 0,789 ≈ 12,62 g
```

Deux whiskys identiques : ≈ 25,25 g.

### Cocktails

Un cocktail n’est **jamais** calculé sur le volume total du verre. Seuls ses alcools comptent, et
ils s’additionnent :

```ts
[
  { name: "Vodka",    volumeMl: 30, abvPercent: 40 },  // 9,47 g
  { name: "Curaçao",  volumeMl: 20, abvPercent: 20 },  // 3,16 g
]
// ≈ 12,62 g d’alcool pur
```

Implémentation : `calculatePureAlcoholGrams()` et `calculateDrinkAlcoholGrams()` dans
[`src/domain/bac/alcohol.ts`](../src/domain/bac/alcohol.ts). Les deux sont pures et testées.

### Compositions par défaut

Les boissons livrées avec l’application partent avec des doses **plausibles mais non vérifiées**,
marquées `compositionConfirmed: false`. L’écran Réglages affiche alors « Composition à confirmer ».
Le crew ajuste les doses réellement servies au bar depuis la fiche de la boisson.

## 3. Modèle d’estimation

Approche de type **Widmark**, présentée comme une approximation :

```
BAC(t) = max(0, Σ alcoolAbsorbé(t) / (poidsKg × r) − β × tempsÉcouléHeures)
```

| Paramètre | Valeur | Origine |
|---|---|---|
| `r` (coefficient de répartition) | 0,60 par défaut, 0,55 / 0,60 / 0,68 proposés, valeur libre en réglage avancé | Plage usuelle de la littérature Widmark |
| `β` (élimination) | 0,15 g/L/h en central, 0,11 – 0,19 pour la plage | Ordre de grandeur communément retenu |
| Absorption | montée linéaire sur 30 minutes | Simplification assumée (voir §4) |

Le calcul est **linéaire par morceaux** : entre deux points de rupture (début d’absorption d’un
verre, fin d’absorption, minuit local), la pente est constante. Les points de rupture suffisent donc
à décrire la courbe exactement, ce qui la rend à la fois exacte pour le modèle et peu coûteuse —
`O(nombre de verres)`, sans échantillonnage.

Le résultat est **borné à zéro** et le reste : après un retour à zéro, un verre bu plus tard repart
d’une base saine, sans « dette » d’élimination accumulée.

### Plage d’incertitude

Une valeur unique donnerait une fausse impression de précision. Chaque estimation est donc
encadrée en faisant varier conjointement `β` et `r` :

- **basse** : `β = 0,19`, `r × 1,08`
- **centrale** : `β = 0,15`, `r` choisi
- **haute** : `β = 0,11`, `r × 0,92`

L’écran principal n’affiche que la valeur centrale, pour rester lisible ; le détail affiche la plage.

## 4. Absorption

Un verre ne passe pas intégralement dans le sang à la milliseconde du tap. Le modèle étale sa
montée **linéairement sur 30 minutes** ([`absorption.ts`](../src/domain/bac/absorption.ts)).

Ce n’est pas un modèle médical : c’est une abstraction isolée, remplaçable (courbe en cloche, effet
du repas, différence à jeun) sans toucher au reste du moteur.

## 5. Le temps

Chaque consommation porte son heure exacte. Le moteur en dépend intégralement :

```
20:00 whisky
21:00 whisky
22:30 bière
```

Le taux à 23:00 dépend de l’alcool pur de chaque verre, du moment de chaque verre, du temps écoulé,
du poids, du coefficient de répartition et du modèle d’élimination. Il n’est **jamais** approché par
`nombre de verres × valeur fixe`.

- Stockage : timestamps UTC (`consumedAt`).
- Journées, heures affichées et pics quotidiens : fuseau du séjour (`Africa/Casablanca`).

Déplacer une consommation de 23 h à 20 h change donc le taux estimé à minuit ; supprimer un verre le
fait baisser immédiatement.

## 6. Snapshot par consommation

Modifier la recette du Mojito au jour 8 ne doit pas réécrire les Mojitos des sept premiers jours.
Chaque `drink_entry` porte donc un instantané pris au moment du verre :

| Champ | Rôle |
|---|---|
| `alcohol_grams` | alcool pur estimé de ce verre-là |
| `drink_name_snapshot` | nom au moment du verre |
| `price_cents_snapshot` | prix au moment du verre |

Le moteur utilise le snapshot en priorité et retombe sur la définition actuelle de la boisson pour
les consommations enregistrées avant l’arrivée de la fonctionnalité.

Le recalcul est **explicite** : changer la boisson d’une entrée reprend un snapshot, et le bouton
« Recalculer » de l’éditeur du Journal réaligne une entrée sur la recette actuelle.

## 7. Hors ligne

Le calcul est **entièrement local**. Il n’appelle aucune API et ne dépend d’aucun réseau.

En mode avion, `Romain → Whisky` :

1. écrit l’entrée dans IndexedDB ;
2. recalcule l’alcoolémie estimée immédiatement ;
3. met à jour l’interface ;
4. empile l’opération dans la file de synchronisation.

`ANNULER` agit de la même façon, sans attendre le serveur. À la reconnexion, la file est rejouée ;
les autres appareils reçoivent les consommations et **recalculent localement** leurs propres
statistiques.

## 8. Confidentialité

- Le poids et le coefficient sont **facultatifs** et modifiables ou effaçables à tout moment
  (« Effacer mes données d’estimation »).
- Ils vivent dans la table `participants`, déjà protégée par RLS : seuls les membres du séjour
  concerné peuvent les lire. Aucune nouvelle table, aucune policy affaiblie.
- Aucune donnée corporelle n’est stockée : le coefficient de répartition est enregistré **comme un
  nombre**, jamais comme un sexe biologique ou une morphologie.
- `bac_private` permet de n’afficher son taux que sur le téléphone réglé sur son identité. C’est une
  **règle d’affichage** : les membres du séjour restent techniquement capables de lire la ligne
  `participants` en base. Pour une confidentialité stricte, laisser l’estimation désactivée.
- Le classement du séjour reste fondé sur le compteur de verres et n’expose aucun poids.
- La carte de partage globale ne contient **jamais** d’alcoolémie individuelle. La carte personnelle
  ne l’inclut que si le participant coche explicitement la case avant de partager.

## 9. Limites du modèle

Ce que le modèle **ne sait pas** :

- l’état de l’estomac (à jeun ou après un repas) ;
- le rythme d’absorption réel, variable d’une personne et d’un soir à l’autre ;
- la vitesse d’élimination réelle, qui varie fortement (habitude, foie, fatigue, médicaments) ;
- la composition corporelle exacte ;
- ce qui a été réellement servi dans le verre.

Une erreur de dose au bar (6 cl servis au lieu de 4) se répercute directement sur l’estimation.
La plage affichée traduit une partie de cette incertitude, pas sa totalité.

**En cas de doute, seul un éthylotest a valeur de mesure.**

## 10. Où est le code

```
src/domain/bac/
  types.ts        modèles (composition, profil, événement, estimation)
  constants.ts    hypothèses documentées (0,789 · r · β · absorption)
  alcohol.ts      alcool pur d’un volume, d’une boisson, d’une recette
  absorption.ts   fraction absorbée dans le temps
  widmark.ts      courbe, estimation à un instant, pic
  timeline.ts     fenêtre de courbe, pics quotidiens, stats participant
  profile.ts      passerelle entités ↔ moteur, règle de visibilité
  format.ts       affichage (≈ 0,82 g/L)
```

Aucune formule métier ne vit dans un composant React. Les composants d’affichage se trouvent dans
`src/components/bac/`.
