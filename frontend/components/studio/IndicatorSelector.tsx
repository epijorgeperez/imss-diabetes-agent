'use client'

import { cn } from '@/lib/utils'
import type { Indicator } from '@/types/studio'
import { INDICATOR_LABELS, INDICATOR_DESCRIPTIONS } from '@/types/studio'
import { 
  TrendingUp, 
  Users, 
  Heart, 
  Building2, 
  LayoutDashboard,
  Check
} from 'lucide-react'

interface IndicatorSelectorProps {
  selected: Indicator[]
  onChange: (indicators: Indicator[]) => void
}

const INDICATOR_ICONS: Record<Indicator, React.ComponentType<{ className?: string }>> = {
  incidencia: TrendingUp,
  prevalencia: Users,
  mortalidad: Heart,
  hospitalizacion: Building2,
  perfil_integral: LayoutDashboard,
}

const ALL_INDICATORS: Indicator[] = [
  'incidencia',
  'prevalencia',
  'mortalidad',
  'hospitalizacion',
  'perfil_integral',
]

export function IndicatorSelector({ selected, onChange }: IndicatorSelectorProps) {
  const toggleIndicator = (indicator: Indicator) => {
    if (indicator === 'perfil_integral') {
      // If selecting perfil_integral, clear others and select only it
      if (selected.includes('perfil_integral')) {
        onChange([])
      } else {
        onChange(['perfil_integral'])
      }
      return
    }

    // If selecting individual indicator, remove perfil_integral
    const withoutIntegral = selected.filter(i => i !== 'perfil_integral')
    
    if (withoutIntegral.includes(indicator)) {
      onChange(withoutIntegral.filter(i => i !== indicator))
    } else {
      onChange([...withoutIntegral, indicator])
    }
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Indicadores a analizar
      </label>
      <div className="flex flex-wrap gap-2">
        {ALL_INDICATORS.map((indicator) => {
          const Icon = INDICATOR_ICONS[indicator]
          const isSelected = selected.includes(indicator)
          const isIntegral = indicator === 'perfil_integral'
          
          return (
            <button
              key={indicator}
              type="button"
              onClick={() => toggleIndicator(indicator)}
              className={cn(
                'group relative flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all duration-200',
                'hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background hover:bg-muted border-border hover:border-primary/50',
                isIntegral && 'border-dashed'
              )}
              title={INDICATOR_DESCRIPTIONS[indicator]}
            >
              <Icon className={cn(
                'h-4 w-4 transition-transform group-hover:scale-110',
                isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
              )} />
              <span>{INDICATOR_LABELS[indicator]}</span>
              {isSelected && (
                <Check className="h-3 w-3 ml-1" />
              )}
            </button>
          )
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Selecciona uno o más indicadores, o elige &ldquo;Perfil Integral&rdquo; para un análisis completo
        </p>
      )}
    </div>
  )
}

