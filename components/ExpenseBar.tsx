interface ExpenseBarItem {
  label: string
  amount: number
}

interface ExpenseBarProps {
  items: ExpenseBarItem[]
  maxItems?: number
}

export function ExpenseBar({ items, maxItems = 10 }: ExpenseBarProps) {
  const visible = items.slice(0, maxItems)
  const maxAmount = Math.max(...visible.map(i => i.amount), 1)

  if (visible.length === 0) {
    return <p className="text-sm text-alaska-muted text-center py-4">Aucune dépense pour cette période</p>
  }

  return (
    <div className="space-y-3">
      {visible.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-sm text-alaska-dark w-32 truncate flex-shrink-0">{item.label}</span>
          <div className="flex-1 bg-alaska-sage-lt rounded-full h-2">
            <div
              className="h-2 rounded-full bg-alaska-sage transition-all duration-500"
              style={{ width: `${(item.amount / maxAmount) * 100}%` }}
            />
          </div>
          <span className="text-sm font-playfair font-semibold text-alaska-dark w-24 text-right flex-shrink-0">
            {item.amount.toLocaleString("fr-MA")} MAD
          </span>
        </div>
      ))}
    </div>
  )
}
