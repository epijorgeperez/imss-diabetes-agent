'use client'

import { cn } from '@/lib/utils'
import type { OutputType } from '@/types/studio'
import { OUTPUT_TYPE_LABELS, OUTPUT_TYPE_DESCRIPTIONS } from '@/types/studio'
import { FileText, BarChart3, Table, FileSpreadsheet, Check } from 'lucide-react'

interface OutputTypeSelectorProps {
  value: OutputType
  onChange: (outputType: OutputType) => void
}

const OUTPUT_ICONS: Record<OutputType, React.ComponentType<{ className?: string }>> = {
  reporte_integral: FileText,
  grafico: BarChart3,
  tablas: Table,
  excel: FileSpreadsheet,
}

const ALL_OUTPUT_TYPES: OutputType[] = [
  'reporte_integral',
  'grafico',
  'tablas',
  'excel',
]

export function OutputTypeSelector({ value, onChange }: OutputTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Tipo de resultado
      </label>
      
      <div className="grid grid-cols-2 gap-3">
        {ALL_OUTPUT_TYPES.map((outputType) => {
          const Icon = OUTPUT_ICONS[outputType]
          const isSelected = value === outputType
          
          return (
            <button
              key={outputType}
              type="button"
              onClick={() => onChange(outputType)}
              className={cn(
                'group relative flex flex-col items-start gap-2 p-4 rounded-xl border transition-all duration-200',
                'hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-background hover:bg-muted/50 border-border hover:border-primary/50'
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20">
                    <Check className="h-3 w-3" />
                  </div>
                </div>
              )}
              
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                isSelected
                  ? 'bg-primary-foreground/20'
                  : 'bg-primary/10 group-hover:bg-primary/20'
              )}>
                <Icon className={cn(
                  'h-5 w-5 transition-transform group-hover:scale-110',
                  isSelected ? 'text-primary-foreground' : 'text-primary'
                )} />
              </div>
              
              <div className="space-y-1 text-left">
                <span className="text-sm font-semibold block">
                  {OUTPUT_TYPE_LABELS[outputType]}
                </span>
                <span className={cn(
                  'text-xs block leading-relaxed',
                  isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}>
                  {OUTPUT_TYPE_DESCRIPTIONS[outputType]}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

