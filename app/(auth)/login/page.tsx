"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowRight, Loader2, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.user) {
        if (error?.code === "email_not_confirmed") {
          setError("Compte créé, mais email non confirmé. Vérifie la boîte mail associée ou désactive la confirmation email dans Supabase.")
        } else {
          setError(error?.message || "Email ou mot de passe incorrect.")
        }
        setLoading(false)
        return
      }

      const redirectParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null
      const role = (data.user.user_metadata?.role || "manager") as "admin" | "manager"
      const redirectTo = redirectParam || (role === "admin" ? "/" : "/saisie")
      router.push(redirectTo)
      router.refresh()
    } catch {
      setError("Impossible de se connecter. Vérifiez votre connexion.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-alaska-cream relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,103,65,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(201,169,110,0.18),transparent_28%),linear-gradient(180deg,rgba(31,56,100,0.06),rgba(31,56,100,0))]" />
      <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-alaska-sage/10 blur-3xl" />
      <div className="absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-alaska-gold/15 blur-3xl" />

      <div className="relative min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-[1.05fr_0.95fr] items-stretch">
          <section className="hidden lg:flex flex-col justify-between rounded-[28px] bg-alaska-dark text-white p-10 border border-white/10 shadow-[0_24px_80px_rgba(31,56,100,0.18)]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-alaska-gold">
                Pilotage interne
              </div>
              <h1 className="font-playfair text-5xl leading-tight mt-6">Alaska Pilot</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-alaska-muted">
                Pilotage quotidien du restaurant Alaska Neo Bistrot, avec un suivi unifié du CA, des sorties, du seuil et des imports caisse.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-xl bg-white/10 p-2">
                    <ShieldCheck size={18} className="text-alaska-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Accès sécurisé par rôle</p>
                    <p className="mt-1 text-xs leading-5 text-alaska-muted">
                      L&apos;admin accède au pilotage complet. Le manager est redirigé vers les écrans opérationnels seulement.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 border border-white/10">
                  <Image src="/logo.png" alt="Alaska Neo Bistrot" width={34} height={34} className="object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Alaska Neo Bistrot</p>
                  <p className="text-xs text-alaska-muted">Rabat • Interface de pilotage financier</p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center">
            <Card className="w-full border border-alaska-sage-lt bg-white/95 backdrop-blur rounded-[28px] shadow-[0_24px_80px_rgba(31,56,100,0.12)] overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-alaska-sage via-alaska-gold to-alaska-sage" />
              <CardHeader className="space-y-4 px-6 pt-7 pb-4 md:px-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-alaska-sage-lt bg-alaska-sage-lt/70">
                    <Image src="/logo.png" alt="Alaska Neo Bistrot" width={28} height={28} className="object-contain" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-alaska-sage">Connexion</p>
                    <CardTitle className="font-playfair text-3xl text-alaska-dark">Bienvenue</CardTitle>
                  </div>
                </div>
                <CardDescription className="text-sm leading-6 text-alaska-muted">
                  Connecte-toi pour accéder au pilotage Alaska avec les droits correspondant à ton rôle.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-6 pb-6 md:px-8">
                <form onSubmit={handleLogin} className="space-y-5">
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-alaska-dark" htmlFor="email">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="nom@alaska.ma"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 border-alaska-sage-lt focus-visible:ring-alaska-sage"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-alaska-dark" htmlFor="password">
                        Mot de passe
                      </label>
                      <span className="text-xs text-alaska-muted">Accès équipe uniquement</span>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 border-alaska-sage-lt focus-visible:ring-alaska-sage"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-alaska-dark hover:bg-[#162A4A] text-white rounded-xl font-medium"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Connexion...
                      </>
                    ) : (
                      <>
                        Se connecter
                        <ArrowRight size={16} className="ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t border-alaska-sage-lt/80 bg-alaska-sage-lt/25 px-6 py-4 md:px-8">
                <p className="text-xs text-alaska-muted">Alaska Neo Bistrot • Pilotage interne</p>
                <p className="text-xs text-alaska-muted">© 2026 KAYZARAN SARL</p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
