# PWA — Raccourci écran d'accueil

**Date :** 2026-05-23  
**Scope :** Rendre Alaska Pilot installable sur mobile (iOS & Android) via un raccourci écran d'accueil.  
**Non-scope :** Service worker, cache offline, push notifications.

---

## Objectif

Permettre à l'utilisateur d'ajouter l'app sur l'écran d'accueil de son téléphone. L'app s'ouvre en mode standalone (plein écran, sans barre de navigateur), avec l'icône Alaska et le nom "Alaska Pilot".

---

## Architecture

### 1. `app/manifest.ts`

Fichier natif Next.js App Router (génère `/manifest.webmanifest` automatiquement).

```ts
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alaska Pilot",
    short_name: "Alaska",
    description: "Pilotage Alaska Neo Bistrot",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF8F3",   // alaska-cream
    theme_color: "#1A1A1A",        // couleur de la toolbar mobile
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
```

### 2. `app/layout.tsx` — metadata enrichies

Ajouter dans l'objet `metadata` :

```ts
manifest: "/manifest.webmanifest",
themeColor: "#1A1A1A",
appleWebApp: {
  capable: true,
  title: "Alaska Pilot",
  statusBarStyle: "black-translucent",
},
```

### 3. Icônes

Générer deux PNG depuis `public/logo.png` :
- `public/icons/icon-192.png` — 192×192 px
- `public/icons/icon-512.png` — 512×512 px

Outil : script Node.js avec `sharp` (déjà probablement disponible via next) ou outil en ligne.

---

## Comportement attendu

| Plateforme | Comportement |
|------------|-------------|
| Android Chrome | Bannière "Ajouter à l'écran d'accueil" automatique après 2 visites |
| iOS Safari | Menu Partager → "Sur l'écran d'accueil" (manuel) |
| Desktop Chrome | Icône d'installation dans la barre d'adresse |

L'app ouvre en mode standalone : pas de barre de navigation du navigateur, pas d'URL visible — ressemble à une app native.

---

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `app/manifest.ts` | Créer |
| `app/layout.tsx` | Modifier metadata |
| `public/icons/icon-192.png` | Créer |
| `public/icons/icon-512.png` | Créer |

---

## Hors scope

- Service worker (pas d'offline)
- Splash screen personnalisé (iOS le génère automatiquement depuis `background_color` + icône)
- Push notifications
