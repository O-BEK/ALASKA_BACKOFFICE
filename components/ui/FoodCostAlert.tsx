"use client"

import { cn } from "@/lib/utils"
import { getFoodCostStatus } from "@/lib/calculations"
import type { FoodCostStatus } from "@/lib/calculations"

interface FoodCostAlertProps {
  pct: number
  className?: string
}

export function FoodCostAlert({ pct, className }: FoodCostAlertProps) {
  if (pct === 0) {
    return <span className={cn("text-sm font-semibold text-alaska-muted", className)}>—</span>
  }

  const status: FoodCostStatus = getFoodCostStatus(pct)

  return (
    <div className={cn("flex flex-col", className)}>
      <span className={cn(
        "text-sm font-semibold",
        status === "ok" ? "text-green-600" :
        status === "alert" ? "text-red-600" :
        "text-alaska-muted"
      )}>
        {pct.toFixed(1)} %
      </span>
      {status === "suspect" && (
        <span className="text-[10px] text-alaska-muted leading-tight">⚠️ Achats incomplets</span>
      )}
      {status === "alert" && (
        <span className="text-[10px] text-red-500 leading-tight">🚨 Food cost critique</span>
      )}
    </div>
  )
}
