'use client'

import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import type { GeographicLevel, GeographicSelection } from '@/types/studio'
import { GEOGRAPHIC_LEVEL_LABELS } from '@/types/studio'
import { Globe, MapPin, Building, Check } from 'lucide-react'

interface GeographicSelectorProps {
  value: GeographicSelection
  onChange: (selection: GeographicSelection) => void
}

const LEVEL_ICONS: Record<GeographicLevel, React.ComponentType<{ className?: string }>> = {
  'Nacional': Globe,
  'OOAD': MapPin,
  'Unidad Medica': Building,
}

const ALL_LEVELS: GeographicLevel[] = ['Nacional', 'OOAD', 'Unidad Medica']

export function GeographicSelector({ value, onChange }: GeographicSelectorProps) {
  const toggleLevel = (level: GeographicLevel) => {
    const currentLevels = value.levels
    const isSelected = currentLevels.includes(level)
    
    let newLevels: GeographicLevel[]
    if (isSelected) {
      // Don't allow deselecting if it's the only one
      if (currentLevels.length === 1) return
      newLevels = currentLevels.filter(l => l !== level)
    } else {
      newLevels = [...currentLevels, level]
    }
    
    onChange({
      ...value,
      levels: newLevels,
    })
  }

  const updateOoadFilter = (filter: string) => {
    onChange({ ...value, ooadFilter: filter })
  }

  const updateUnidadFilter = (filter: string) => {
    onChange({ ...value, unidadFilter: filter })
  }

  const showOoadFilter = value.levels.includes('OOAD')
  const showUnidadFilter = value.levels.includes('Unidad Medica')

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-foreground">
        Ámbito geográfico
      </label>
      
      {/* Multi-select level buttons */}
      <div className="flex flex-wrap gap-2">
        {ALL_LEVELS.map((level) => {
          const Icon = LEVEL_ICONS[level]
          const isSelected = value.levels.includes(level)
          
          return (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={cn(
                'group relative flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all duration-200',
                'hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background hover:bg-muted border-border hover:border-primary/50'
              )}
            >
              <Icon className={cn(
                'h-4 w-4 transition-transform group-hover:scale-110',
                isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
              )} />
              <span>{GEOGRAPHIC_LEVEL_LABELS[level]}</span>
              {isSelected && (
                <Check className="h-3 w-3 ml-1" />
              )}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Selecciona uno o más niveles. El análisis incluirá datos de todos los niveles seleccionados.
      </p>

      {/* Conditional filter inputs */}
      {showOoadFilter && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            Delegaciones (OOAD)
          </label>
          <Textarea
            value={value.ooadFilter || ''}
            onChange={(e) => updateOoadFilter(e.target.value)}
            placeholder="Ej: Jalisco, Nuevo León, CDMX Norte... (vacío = todas)"
            className="min-h-[60px] resize-none text-sm"
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Deja vacío para incluir todas las delegaciones
          </p>
        </div>
      )}

      {showUnidadFilter && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Building className="h-3 w-3" />
            Unidades Médicas
          </label>
          <Textarea
            value={value.unidadFilter || ''}
            onChange={(e) => updateUnidadFilter(e.target.value)}
            placeholder="Ej: UMF 34, HGZ 26, UMF 168 Tepatitlán... (vacío = todas)"
            className="min-h-[60px] resize-none text-sm"
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Deja vacío para incluir todas las unidades
          </p>
        </div>
      )}
    </div>
  )
}
