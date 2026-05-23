import type { Metadata } from "next"
import { Playfair_Display, DM_Sans } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" })
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-alaska-cream font-sans antialiased", playfair.variable, dmSans.variable)}>
        {children}
      </body>
    </html>
  )
}
