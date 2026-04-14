import { createClient } from "@supabase/supabase-js"

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ALASKA_ADMIN_EMAIL",
  "ALASKA_ADMIN_PASSWORD",
  "ALASKA_MANAGER_EMAIL",
  "ALASKA_MANAGER_PASSWORD",
]

const missingEnv = requiredEnv.filter((key) => !process.env[key]?.trim())
if (missingEnv.length > 0) {
  console.error("Missing required environment variables:")
  missingEnv.forEach((key) => console.error(` - ${key}`))
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.ALASKA_ADMIN_EMAIL
const adminPassword = process.env.ALASKA_ADMIN_PASSWORD
const managerEmail = process.env.ALASKA_MANAGER_EMAIL
const managerPassword = process.env.ALASKA_MANAGER_PASSWORD

const rejectedPasswords = new Set(["alaska2026", "manager2026"])
const invalidPasswordEntries = [
  ["ALASKA_ADMIN_PASSWORD", adminPassword],
  ["ALASKA_MANAGER_PASSWORD", managerPassword],
].filter(([, password]) => rejectedPasswords.has(password) || password.length < 12)

if (invalidPasswordEntries.length > 0) {
  console.error("Invalid bootstrap password:")
  invalidPasswordEntries.forEach(([key, password]) => {
    const reason = rejectedPasswords.has(password)
      ? "default password is forbidden"
      : "password must be at least 12 characters"
    console.error(` - ${key}: ${reason}`)
  })
  process.exit(1)
}

if (adminEmail.toLowerCase() === managerEmail.toLowerCase()) {
  console.error("ALASKA_ADMIN_EMAIL and ALASKA_MANAGER_EMAIL must be different.")
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
  email: adminEmail,
  password: adminPassword,
  role: "admin",
  name: "Othman",
})

await ensureUser({
  email: managerEmail,
  password: managerPassword,
  role: "manager",
  name: "Manager",
})

console.log("Supabase auth bootstrap complete.")
