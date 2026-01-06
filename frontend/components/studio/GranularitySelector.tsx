'use client'

import { cn } from '@/lib/utils'
import type { Granularity } from '@/types/studio'
import { CalendarDays, CalendarRange } from 'lucide-react'

interface GranularitySelectorProps {
  value: Granularity
  onChange: (granularity: Granularity) => void
}

const GRANULARITY_OPTIONS: { value: Granularity; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { 
    value: 'anual', 
    label: 'Anual', 
    description: 'Datos agregados por año',
    icon: CalendarRange,
  },
  { 
    value: 'mensual', 
    label: 'Mensual', 
    description: 'Datos desglosados por mes',
    icon: CalendarDays,
  },
]

export function GranularitySelector({ value, onChange }: GranularitySelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Granularidad temporal
      </label>
      
      <div className="flex gap-3">
        {GRANULARITY_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = value === option.value
          
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200',
                'hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background hover:bg-muted border-border hover:border-primary/50'
              )}
            >
              <Icon className={cn(
                'h-5 w-5',
                isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
              )} />
              <span className="text-sm font-medium">{option.label}</span>
              <span className={cn(
                'text-xs text-center',
                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}>
                {option.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

