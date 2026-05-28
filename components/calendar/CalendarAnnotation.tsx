import { cn, formatMAD } from "@/lib/utils"
import type { CalendarAnnotation } from "@/lib/calendar-context"

export function CalendarAnnotationBadge({ annotation }: { annotation: CalendarAnnotation }) {
  return (
    <div className={cn(
      "flex flex-col gap-0.5 text-xs rounded-lg px-2.5 py-1.5 mt-1.5",
      annotation.type === 'warning' && "bg-amber-50 border border-amber-200 text-amber-800",
      annotation.type === 'info' && "bg-blue-50 border border-blue-200 text-blue-800",
      annotation.type === 'boost' && "bg-emerald-50 border border-emerald-200 text-emerald-800",
      annotation.type === 'correction' && "bg-gray-50 border border-gray-200 text-gray-700",
    )}>
      <div className="flex items-center gap-1.5 font-medium">
        <span aria-hidden="true">{annotation.icon}</span>
        <span>{annotation.label}</span>
      </div>
      <span className="opacity-80">{annotation.detail}</span>
      {annotation.ca_adjusted !== undefined && (
        <span className="font-semibold">
          CA corrigé : {formatMAD(annotation.ca_adjusted)}
        </span>
      )}
      {annotation.vs_n1_note && (
        <span className="italic opacity-70">{annotation.vs_n1_note}</span>
      )}
    </div>
  )
}
