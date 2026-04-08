import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  process.exit(1)
}

const supabase = createClient(url, anonKey)

async function ensureUser({ email, password, role, name }) {
  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, name },
    },
  })

  if (signUp.error && !signUp.error.message.toLowerCase().includes("already")) {
    throw signUp.error
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (signIn.error?.code === "email_not_confirmed" || signIn.error?.message?.toLowerCase().includes("not confirmed")) {
    console.log(`pending-confirmation: ${email} (${role})`)
    return
  }
  if (signIn.error) {
    throw signIn.error
  }

  console.log(`ready: ${email} (${role})`)
  await supabase.auth.signOut()
}

await ensureUser({
  email: process.env.ALASKA_ADMIN_EMAIL || "othman@alaska.ma",
  password: process.env.ALASKA_ADMIN_PASSWORD || "alaska2026",
  role: "admin",
  name: "Othman",
})

await ensureUser({
  email: process.env.ALASKA_MANAGER_EMAIL || "manager@alaska.ma",
  password: process.env.ALASKA_MANAGER_PASSWORD || "manager2026",
  role: "manager",
  name: "Manager",
})

console.log("Supabase auth bootstrap complete.")
