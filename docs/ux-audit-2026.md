# Audit UX 2026 - Alaska Pilot

Date: 2026-05-11  
Branche: `feat/ux-refonte-coherence`

## Synthèse

L'application couvre déjà les grands besoins du restaurant: saisie quotidienne, suivi semaine, charges fixes, objectifs, imports et reporting. Le point faible n'est pas le manque de données, mais leur dispersion: le gérant doit passer entre Dashboard, Saisie > Mois et Reporting pour répondre à une question simple: est-ce que le mois gagne de l'argent, et pourquoi ?

La refonte doit donc rester légère: clarifier les labels, rendre les KPIs cohérents, remonter les indicateurs restaurant au bon endroit, et préserver l'usage mobile quotidien du manager.

## A. Navigation et noms de menus

### Constats

- `Dashboard` est un terme technique. Pour un gérant, `Accueil` ou `Vue du mois` est plus naturel.
- `Reporting` contient la vraie lecture de pilotage mensuel. Le label `Pilotage` est plus clair que `Reporting`.
- `Import CSV` est devenu faux: la page gère maintenant POS, journal caisse et relevés bancaires PDF.
- `Charges` contient aussi les modèles de saisie. Le nom `Réglages` est plus exact, mais il peut masquer l'importance des charges fixes.
- L'ordre actuel place `Reporting` en dernier alors que c'est une page décisionnelle admin.
- Manager: `Caisse` puis `Semaine` est logique et doit rester très simple.

### Proposition

Ordre admin recommandé:

1. `Accueil`
2. `Caisse`
3. `Semaine`
4. `Pilotage`
5. `Objectifs`
6. `Imports`
7. `Réglages`

Changement implémentable sans migration ni rupture: renommer les labels de menu et les titres de page les plus visibles. Le routage reste identique.

## B. Cohérence des KPIs

### Constats

- Le socle `ca_total = ca_caisse + ca_b2b` est respecté dans `analytics.ts`, `Dashboard`, `Semaine` et `Reporting`.
- `buildCaisseBalance` reste bien cash-only, conformément aux règles métier.
- Le Dashboard affiche `Marge nette`, basée sur dépenses saisies, alors que `Saisie > Mois` et `Reporting` affichent `Prime cost` et `Résultat net estimé`. Cela crée deux lectures financières différentes.
- `Saisie > Mois` ressemble davantage à un mini reporting mensuel qu'à une saisie opérationnelle.
- Le reporting expose déjà `financialConsolidation` côté API et contrat Zod, mais la page ne l'affiche pas encore. C'est un manque critique depuis l'arrivée des relevés bancaires.
- Les KPIs restaurant utiles existent partiellement: ticket moyen, couverture, mix cash, prime cost, résultat net. Il manque une séparation lisible entre coût matière et coût RH.

### Proposition

- Ajouter un bloc décisionnel `Banque + Cash - résultat réel` dans `/reporting`.
- Remonter sur le Dashboard une carte compacte `Pilotage restaurant` avec prime cost et résultat estimé, en cohérence avec `/reporting`.
- Ajouter dans `buildCashMonthSummary` des sous-KPIs: coût matière %, coût RH %, charges fixes actives, puis les exposer via `contracts.ts`.
- Garder `Saisie > Mois` pour l'instant, mais le considérer comme une vue opérationnelle admin. A moyen terme, le déplacer vers `/reporting` ou le transformer en raccourci vers Pilotage.

## C. UX et ergonomie mobile

### Constats

- Les pages sont majoritairement mobile-first, avec des grilles qui tombent en une colonne.
- Plusieurs tableaux restent nécessaires mais doivent garder `overflow-x-auto`.
- Les boutons icon-only manquent parfois de `aria-label` dans la navigation mois et mobile.
- Les statuts utilisent bien vert/orange/rouge, mais les classes alternent entre `green`, `orange`, `amber`, `alaska-sage`. Pour un restaurateur, la logique est claire, mais visuellement elle mérite un vocabulaire unique.
- Le menu mobile est simple, mais `Import CSV` trop long et daté.

### Proposition

- Harmoniser les statuts KPI: vert/sage = bon, amber = attention, rouge = problème.
- Ajouter des `aria-label` aux boutons de navigation mois et menu.
- Remplacer les libellés techniques par des verbes ou noms métier: `Pilotage`, `Imports`, `Réglages`.

## D. Fonctionnalités

### Gagnent à être simplifiées

- L'onglet `Mois` dans `/saisie` duplique une partie du reporting. Il ne faut pas le supprimer brutalement, car il porte les fournisseurs virement mensuels.
- La page `/charges` mélange charges fixes et modèles de saisie. C'est cohérent pour un admin, mais le label doit signaler que c'est un espace de réglage.

### Manques à fort ROI

- Alerte semaine si le CA hebdomadaire ne couvre pas le seuil.
- Résultat réel banque + cash dans le reporting.
- Indicateur de transactions bancaires à revoir.
- Séparation lisible: dépenses cash, dépenses banque, apports propriétaire, dépôts cash neutres.

## E. Structure des pages

### Décisions

- Ne pas déplacer de route dans cette branche: cela réduirait le risque en production.
- Renommer seulement les entrées de navigation.
- Faire de `/reporting` la page décisionnelle principale avec le résultat réel.
- Garder `/saisie` comme page du manager et des corrections opérationnelles.
- Garder `/charges` comme page admin, renommée `Réglages` dans le menu.

## Changements prévus dans cette branche

### P0 - Cohérence

- Exposer coût matière %, coût RH % et charges fixes actives depuis `buildCashMonthSummary`.
- Afficher une carte Dashboard `Pilotage restaurant`.
- Afficher dans Reporting le bloc `Banque + Cash - résultat réel`.
- Ajouter l'alerte transactions bancaires à revoir.

### P1 - Navigation

- Renommer les labels du menu: `Accueil`, `Pilotage`, `Imports`, `Réglages`.
- Réordonner les pages admin pour mettre la décision avant les réglages.
- Mettre à jour les titres visibles correspondants.

### P2 - Fonctionnalités légères

- Ajouter une alerte semaine si le seuil n'est pas atteint.
- Clarifier dans l'UI que les dépôts cash vers banque sont neutres.

## Non implémenté volontairement dans cette branche

- Déplacement complet de `Saisie > Mois` vers `/reporting`: trop risqué sans validation produit, car l'onglet contient encore la saisie des fournisseurs virement.
- Refonte visuelle complète des pages: le besoin prioritaire est la cohérence décisionnelle.
- Nouvelle migration SQL: inutile pour ces changements.
