'use client'

import { cn } from '@/lib/utils'

interface SegmentedControlProps<T extends string> {
    items: readonly T[]
    labels: Record<T, string>
    value: T
    onChange: (value: T) => void
    className?: string
}

export default function SegmentedControl<T extends string>({
    items,
    labels,
    value,
    onChange,
    className,
}: SegmentedControlProps<T>) {
    return (
        <div className={cn('mb-6 flex rounded-xl bg-muted p-1', className)}>
            {items.map((item) => (
                <button
                    key={item}
                    type="button"
                    onClick={() => onChange(item)}
                    className={cn(
                        'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        value === item
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                    aria-pressed={value === item}
                >
                    {labels[item]}
                </button>
            ))}
        </div>
    )
}
