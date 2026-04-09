# Suivi du solde caisse cumulé — Design Spec

## Contexte métier

Chaque soir, le manager sort le Z (rapport POS), compte la caisse et saisit le CA caisse + les dépenses cash dans l'app. Toutes les dépenses saisies sont des paiements en cash. Le solde journalier (CA - dépenses) s'accumule dans le tiroir-caisse physique.

Le lundi matin (ou tout autre jour selon les besoins), le manager dépose le surplus à la banque. Il garde toujours :
- **1 500 MAD** : fonds de caisse permanent (toujours dans le tiroir, non comptabilisé dans l'app)
- **1 000 MAD** : réserve semaine pour les achats cash ponctuels

Le versement au propriétaire était jusqu'ici saisi comme dépense "Othman". Il est renommé **"Virement banque"** pour plus de professionnalisme. Les anciennes entrées "Othman" restent valides et réduisent le solde correctement.

---

## Objectif

Afficher en permanence dans la page Saisie :
1. Le **solde cumulé** en caisse (hors fonds permanent 1 500 MAD)
2. Le **montant à déposer** recommandé

Et permettre de saisir un **Virement banque** directement depuis le formulaire journalier.

---

## Calcul

```
Solde cumulé = Σ(ca_caisse) - Σ(expenses.amount)  [toutes les données historiques]
À déposer    = max(0, Solde cumulé - 1 000)
```

> Le fonds permanent de 1 500 MAD est physique et hors app. Les 1 000 MAD de réserve semaine sont déduits du solde calculé pour obtenir le montant à déposer.

---

## Architecture

### Nouveau endpoint

**`GET /api/caisse/balance`**
- Lecture seule, admin + manager
- Appelle `readSnapshot()` → calcule balance depuis `db.daily_sales` et `db.expenses`
- Réponse : `{ balance: number, toDeposit: number }`

### Nouveau hook client

**`lib/hooks/useCaisseBalance.ts`**
- `fetch("/api/caisse/balance")`
- Expose : `{ balance, toDeposit, loading }`

### Calcul côté serveur

Dans `lib/server/analytics.ts` :

```ts
export function buildCaisseBalance(db: PilotDb): { balance: number; toDeposit: number } {
  const totalCA = db.daily_sales.reduce((s, r) => s + r.ca_caisse, 0)
  const totalExp = db.expenses.reduce((s, e) => s + e.amount, 0)
  const balance = totalCA - totalExp
  return { balance, toDeposit: Math.max(0, balance - 1000) }
}
```

---

## UI — Modifications dans `/saisie`

### 1. Carte "Solde caisse" (haut de l'onglet Saisie)

Positionnée entre les onglets de navigation et le sélecteur de date.

Contenu :
- Ligne "En caisse" → `balance` formaté en MAD
- Ligne "À déposer" → `toDeposit` formaté en MAD, en vert si > 0, gris sinon
- Sous-texte : "Réserve : 1 000 MAD · Fonds permanent : 1 500 MAD (hors app)"

### 2. Section "Virement banque" (bas du formulaire)

Section dédiée sous les groupes de dépenses existants, avant le récapitulatif final.

- Label : "🏦 Virement banque"
- Style : bordure dorée (alaska-gold) pour la distinguer des dépenses courantes
- Composant `ExpenseRow` réutilisé avec label = `"Virement banque"` et catégorie `"CHARGES"`
- Saisie identique aux autres lignes — réduit automatiquement le solde du jour et le cumul

---

## Compatibilité historique

- Les dépenses avec label `"Othman"` dans la base restent intactes
- Elles réduisent le solde cumulé au même titre que "Virement banque"
- Aucune migration de données nécessaire
- L'app n'expose plus "Othman" comme option de saisie — nouvelles entrées via "Virement banque" uniquement

---

## Ce qui n'est PAS dans ce scope

- Historique des virements (liste des dépôts passés)
- Confirmation/validation du virement (pas de workflow d'approbation)
- Alertes automatiques quand le seuil est dépassé
- Multi-devise ou comptes bancaires multiples
