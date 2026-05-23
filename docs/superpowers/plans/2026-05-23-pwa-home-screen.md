# PWA Home Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre Alaska Pilot installable sur l'écran d'accueil mobile (Android & iOS) via un manifest PWA natif Next.js.

**Architecture:** Manifest via `app/manifest.ts` (App Router natif, aucune dépendance runtime), icônes PNG générées une fois depuis `public/logo.png` avec sharp, meta tags enrichies dans `app/layout.tsx`. Pas de service worker — l'app nécessite le réseau.

**Tech Stack:** Next.js 14 App Router (`MetadataRoute.Manifest`), sharp (devDependency, script ponctuel), Tailwind couleurs existantes.

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `app/manifest.ts` | Créer |
| `app/layout.tsx` | Modifier (metadata) |
| `public/icons/icon-192.png` | Générer (script ponctuel) |
| `public/icons/icon-512.png` | Générer (script ponctuel) |
| `scripts/generate-pwa-icons.mjs` | Créer (script ponctuel, peut être supprimé après) |

---

## Task 1 : Générer les icônes PWA

**Files:**
- Create: `scripts/generate-pwa-icons.mjs`
- Create: `public/icons/icon-192.png` (généré)
- Create: `public/icons/icon-512.png` (généré)

- [ ] **Step 1 : Installer sharp comme devDependency**

```bash
npm install --save-dev sharp
```

Expected output : `added 1 package` (ou similaire).

- [ ] **Step 2 : Créer le script de génération**

Créer `scripts/generate-pwa-icons.mjs` :

```js
import sharp from "sharp"
import { mkdirSync } from "fs"

mkdirSync("public/icons", { recursive: true })

const sizes = [192, 512]
for (const size of sizes) {
  await sharp("public/logo.png")
    .resize(size, size, { fit: "contain", background: { r: 250, g: 248, b: 243, alpha: 1 } })
    .png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`✓ icon-${size}.png generated`)
}
```

Note : `background` reprend `#FAF8F3` (alaska-cream) pour remplir les zones vides si le logo n'est pas carré.

- [ ] **Step 3 : Exécuter le script**

```bash
node scripts/generate-pwa-icons.mjs
```

Expected output :
```
✓ icon-192.png generated
✓ icon-512.png generated
```

Vérifier que `public/icons/icon-192.png` et `public/icons/icon-512.png` existent.

- [ ] **Step 4 : Commit icons + script**

```bash
git add public/icons/ scripts/generate-pwa-icons.mjs package.json package-lock.json
git commit -m "chore: generate PWA icons from logo.png"
```

---

## Task 2 : Créer app/manifest.ts

**Files:**
- Create: `app/manifest.ts`

- [ ] **Step 1 : Créer le fichier manifest**

Créer `app/manifest.ts` :

```ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alaska Pilot",
    short_name: "Alaska",
    description: "Pilotage Alaska Neo Bistrot",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F3",
    theme_color: "#1A1A1A",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
```

- [ ] **Step 2 : Vérifier le type compile**

```bash
npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add app/manifest.ts
git commit -m "feat: add PWA manifest (Next.js App Router native)"
```

---

## Task 3 : Enrichir les metadata dans app/layout.tsx

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1 : Mettre à jour l'objet metadata**

Dans `app/layout.tsx`, remplacer l'objet `metadata` existant par :

```ts
export const metadata: Metadata = {
  title: "Alaska Pilot",
  description: "Pilotage Alaska Neo Bistrot",
  manifest: "/manifest.webmanifest",
  themeColor: "#1A1A1A",
  appleWebApp: {
    capable: true,
    title: "Alaska Pilot",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/icons/icon-192.png",
  },
}
```

- [ ] **Step 2 : Vérifier le type compile**

```bash
npx tsc --noEmit
```

Expected : aucune erreur.

- [ ] **Step 3 : Vérifier le lint**

```bash
npm run lint
```

Expected : `No ESLint warnings or errors`

- [ ] **Step 4 : Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add PWA meta tags (manifest link, apple-web-app, theme-color)"
```

---

## Task 4 : Build final et vérification

**Files:** aucun fichier supplémentaire.

- [ ] **Step 1 : Build de production**

```bash
npm run build
```

Expected : build successful, la route `/manifest.webmanifest` apparaît dans la liste des routes statiques.

- [ ] **Step 2 : Vérification en dev local**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/manifest.webmanifest` dans le navigateur et vérifier que le JSON est valide avec les bons champs (`name`, `icons`, `display: "standalone"`).

- [ ] **Step 3 : Vérification mobile Android**

1. Déployer sur Vercel (ou accéder à l'URL de preview)
2. Ouvrir l'app dans Chrome sur Android
3. Après quelques secondes, Chrome affiche une bannière "Ajouter à l'écran d'accueil" — ou accéder via Menu ⋮ → "Ajouter à l'écran d'accueil"
4. Vérifier que l'icône apparaît et que l'app s'ouvre en plein écran (sans barre de navigateur)

- [ ] **Step 4 : Vérification mobile iOS**

1. Ouvrir l'URL dans Safari sur iPhone/iPad
2. Appuyer sur le bouton Partager (carré avec flèche)
3. Choisir "Sur l'écran d'accueil"
4. Vérifier que l'icône et le nom "Alaska" apparaissent
5. Ouvrir depuis l'écran d'accueil — l'app doit s'ouvrir en mode standalone

- [ ] **Step 5 : Commit final si tout est bon**

```bash
git add -A
git status  # vérifier qu'il n'y a rien d'inattendu
git commit -m "feat: PWA home screen support — manifest, icons, meta tags" 2>/dev/null || echo "nothing to commit"
```

---

## Résumé des commits attendus

1. `chore: generate PWA icons from logo.png`
2. `feat: add PWA manifest (Next.js App Router native)`
3. `feat: add PWA meta tags (manifest link, apple-web-app, theme-color)`
