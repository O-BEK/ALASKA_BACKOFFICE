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
