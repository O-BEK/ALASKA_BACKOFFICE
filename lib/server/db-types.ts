import "server-only"

import type {
  ActionItem,
  FixedCharge,
  ImportRecord,
  MonthlyObjective,
  Objective,
} from "@/lib/types"

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
  source: "manual" | "csv_import"
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
  users: never[]
  daily_sales: DailySaleRecord[]
  expenses: ExpenseRecord[]
  fixed_charges: FixedCharge[]
  objectives: Objective[]
  monthly_objectives: MonthlyObjective[]
  action_items: ActionItem[]
  import_history: ImportRecord[]
}
