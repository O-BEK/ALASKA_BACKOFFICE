import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMAD(amount: number): string {
  return new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + " MAD"
}

export function formatPct(value: number): string {
  return (value >= 0 ? "+" : "") + value.toFixed(1) + "%"
}
