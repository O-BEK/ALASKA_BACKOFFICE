import "server-only"

import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"
import {
  ACTION_ITEMS,
  DAILY_ENTRIES_2026,
  FIXED_CHARGES,
  IMPORT_HISTORY,
  MONTHLY_CA_2025,
  MONTHLY_CA_2026,
  MONTHLY_OBJECTIVES_2026,
  OBJECTIVES,
} from "@/lib/mock-data"
import type {
  ActionItem,
  DailyEntry,
  FixedCharge,
  ImportRecord,
  MonthlyObjective,
  Objective,
  UserRole,
} from "@/lib/types"

type DailySaleSource = "manual" | "csv_import"

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  password_hash: string
}

export interface DailySaleRecord {
  id: string
  date: string
  ca_caisse: number
  ca_b2b: number
  ca_soir: number
  pct_soir: number
  tickets_count: number
  mouvement_caisse: number
  notes: string
  source: DailySaleSource
  import_id: string | null
  created_by: string | null
  updated_at: string
}

export interface ExpenseRecord {
  id: string
  date: string
  category: "MP" | "RH" | "CHARGES" | "AUTRE"
  label: string
  amount: number
  notes: string
  created_by: string | null
  updated_at: string
}

export interface PilotDb {
  users: AppUser[]
  daily_sales: DailySaleRecord[]
  expenses: ExpenseRecord[]
  fixed_charges: FixedCharge[]
  objectives: Objective[]
  monthly_objectives: MonthlyObjective[]
  action_items: ActionItem[]
  import_history: ImportRecord[]
}

const DATA_DIR = path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "pilot-db.json")

function nowIso() {
  return new Date().toISOString()
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex")
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function toMonthParts(month: string) {
  const [year, rawMonth] = month.split("-").map(Number)
  return { year, monthIndex: rawMonth - 1 }
}

function distributeMonthlySales(month: string, caCaisse: number, caB2b: number): DailySaleRecord[] {
  const { year, monthIndex } = toMonthParts(month)
  const totalDays = daysInMonth(year, monthIndex)
  const updatedAt = nowIso()

  const caisseBase = Math.floor((caCaisse / totalDays) * 100) / 100
  const b2bBase = Math.floor((caB2b / totalDays) * 100) / 100
  const caisseLast = Math.round((caCaisse - caisseBase * (totalDays - 1)) * 100) / 100
  const b2bLast = Math.round((caB2b - b2bBase * (totalDays - 1)) * 100) / 100

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(year, monthIndex, index + 1)
    const isLast = index === totalDays - 1
    return {
      id: makeId("sale"),
      date: date.toISOString().slice(0, 10),
      ca_caisse: isLast ? caisseLast : caisseBase,
      ca_b2b: isLast ? b2bLast : b2bBase,
      ca_soir: 0,
      pct_soir: 0,
      tickets_count: 0,
      notes: "Seed historique Alaska",
      source: "manual",
      import_id: null,
      created_by: null,
      updated_at: updatedAt,
    }
  })
}

function seedUsers(): AppUser[] {
  return [
    {
      id: "user_admin",
      email: process.env.ALASKA_ADMIN_EMAIL || "othman@alaska.ma",
      name: "Othman",
      role: "admin",
      password_hash: hashPassword(process.env.ALASKA_ADMIN_PASSWORD || "alaska2026"),
    },
    {
      id: "user_manager",
      email: process.env.ALASKA_MANAGER_EMAIL || "manager@alaska.ma",
      name: "Manager",
      role: "manager",
      password_hash: hashPassword(process.env.ALASKA_MANAGER_PASSWORD || "manager2026"),
    },
  ]
}

function seedDatabase(): PilotDb {
  const seededSales = [
    ...Object.entries(MONTHLY_CA_2025).flatMap(([month, value]) =>
      distributeMonthlySales(month, value.ca_caisse, value.ca_b2b)
    ),
    ...Object.entries(MONTHLY_CA_2026)
      .filter(([month]) => month !== "2026-04")
      .flatMap(([month, value]) => distributeMonthlySales(month, value.ca_caisse, value.ca_b2b)),
  ]

  const detailedSales = Object.values(DAILY_ENTRIES_2026).map((entry) => ({
    id: makeId("sale"),
    date: entry.date,
    ca_caisse: entry.ca_caisse,
    ca_b2b: entry.ca_b2b,
    ca_soir: entry.ca_soir,
    pct_soir: entry.pct_soir,
    tickets_count: entry.tickets_count,
    notes: entry.notes,
    source: entry.source,
    import_id: null,
    created_by: null,
    updated_at: nowIso(),
  }))

  const detailedByDate = new Set(detailedSales.map((item) => item.date))
  const dailySales = [...seededSales.filter((item) => !detailedByDate.has(item.date)), ...detailedSales]

  const expenses = Object.values(DAILY_ENTRIES_2026).flatMap((entry) =>
    entry.expenses.map((expense) => ({
      id: expense.id,
      date: entry.date,
      category: expense.category,
      label: expense.label,
      amount: expense.amount,
      notes: expense.notes || "",
      created_by: null,
      updated_at: nowIso(),
    }))
  )

  return {
    users: seedUsers(),
    daily_sales: dailySales,
    expenses,
    fixed_charges: FIXED_CHARGES.map((charge) => ({ ...charge })),
    objectives: OBJECTIVES.map((item) => ({ ...item })),
    monthly_objectives: MONTHLY_OBJECTIVES_2026.map((item) => ({ ...item })),
    action_items: ACTION_ITEMS.map((item) => ({ ...item })),
    import_history: IMPORT_HISTORY.map((item) => ({ ...item })),
  }
}

let writeQueue = Promise.resolve()

async function ensureDatabaseFile() {
  try {
    await fs.access(DB_PATH)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(DB_PATH, JSON.stringify(seedDatabase(), null, 2), "utf8")
  }
}

export async function readDb(): Promise<PilotDb> {
  await ensureDatabaseFile()
  const raw = await fs.readFile(DB_PATH, "utf8")
  return JSON.parse(raw) as PilotDb
}

export async function writeDb(nextDb: PilotDb) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  writeQueue = writeQueue.then(() =>
    fs.writeFile(DB_PATH, JSON.stringify(nextDb, null, 2), "utf8")
  )
  await writeQueue
}

export async function updateDb(updater: (_current: PilotDb) => PilotDb | Promise<PilotDb>) {
  const current = await readDb()
  const next = await updater(current)
  await writeDb(next)
  return next
}

export function verifyPassword(user: AppUser, password: string) {
  return user.password_hash === hashPassword(password)
}

export function toDailyEntry(sale: DailySaleRecord | null, expenses: ExpenseRecord[], date: string): DailyEntry {
  return {
    date,
    ca_caisse: sale?.ca_caisse ?? 0,
    ca_b2b: sale?.ca_b2b ?? 0,
    ca_soir: sale?.ca_soir ?? 0,
    pct_soir: sale?.pct_soir ?? 0,
    tickets_count: sale?.tickets_count ?? 0,
    notes: sale?.notes ?? "",
    source: sale?.source ?? "manual",
    expenses: expenses.map((expense) => ({
      id: expense.id,
      category: expense.category,
      label: expense.label,
      amount: expense.amount,
      notes: expense.notes || undefined,
    })),
  }
}

export function normalizeAmount(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100
}

export function upsertDailySale(
  db: PilotDb,
  payload: Omit<DailySaleRecord, "id" | "updated_at"> & { id?: string }
) {
  const existingIndex = db.daily_sales.findIndex((item) => item.date === payload.date)
  const nextRecord: DailySaleRecord = {
    id: existingIndex >= 0 ? db.daily_sales[existingIndex].id : payload.id || makeId("sale"),
    updated_at: nowIso(),
    ...payload,
  }

  if (existingIndex >= 0) {
    db.daily_sales[existingIndex] = nextRecord
  } else {
    db.daily_sales.push(nextRecord)
  }
}

export function replaceExpensesForDate(db: PilotDb, date: string, expenses: ExpenseRecord[]) {
  db.expenses = db.expenses.filter((item) => item.date !== date).concat(expenses)
}

export function createExpenseRecord(
  date: string,
  expense: DailyEntry["expenses"][number],
  createdBy: string | null
): ExpenseRecord {
  return {
    id: expense.id || makeId("expense"),
    date,
    category: expense.category,
    label: expense.label,
    amount: normalizeAmount(expense.amount),
    notes: expense.notes || "",
    created_by: createdBy,
    updated_at: nowIso(),
  }
}

export function applyImportedSales(
  db: PilotDb,
  rows: Array<{
    date: string
    ca_caisse: number
    ca_soir: number
    pct_soir: number
    tickets_count: number
  }>,
  options: { importId: string; userId: string }
) {
  rows.forEach((row) => {
    const existing = db.daily_sales.find((item) => item.date === row.date)
    upsertDailySale(db, {
      date: row.date,
      ca_caisse: row.ca_caisse,
      ca_b2b: existing?.ca_b2b || 0,
      ca_soir: row.ca_soir,
      pct_soir: row.pct_soir,
      tickets_count: row.tickets_count,
      notes: existing?.notes || "",
      source: "csv_import",
      import_id: options.importId,
      created_by: existing?.created_by || options.userId,
    })
  })
}
