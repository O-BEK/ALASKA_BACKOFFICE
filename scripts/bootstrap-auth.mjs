import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function findUserByEmail(email) {
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error

    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (match) return match

    if (!data.nextPage) return null
    page = data.nextPage
  }
}

async function ensureUser({ email, password, role, name }) {
  const existingUser = await findUserByEmail(email)

  const userResponse = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
        email_confirm: true,
        password,
        user_metadata: { name },
      })
    : await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      })

  if (userResponse.error || !userResponse.data.user) {
    throw userResponse.error || new Error(`Impossible de préparer le compte ${email}`)
  }

  const user = userResponse.data.user
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, role, name }, { onConflict: "id" })

  if (profileError) {
    throw profileError
  }

  console.log(`ready: ${email} (${role})`)
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
