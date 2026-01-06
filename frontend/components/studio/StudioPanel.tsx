'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { IndicatorSelector } from './IndicatorSelector'
import { GeographicSelector } from './GeographicSelector'
import { PeriodSelector } from './PeriodSelector'
import { GranularitySelector } from './GranularitySelector'
import { OutputTypeSelector } from './OutputTypeSelector'
import { buildAnalysisPrompt } from '@/lib/promptBuilder'
import type { AnalysisConfig } from '@/types/studio'
import { DEFAULT_ANALYSIS_CONFIG } from '@/types/studio'
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Send, 
  MessageSquare,
  LayoutDashboard
} from 'lucide-react'

interface StudioPanelProps {
  onSubmit: (prompt: string) => void
  disabled?: boolean
}

export function StudioPanel({ onSubmit, disabled }: StudioPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_ANALYSIS_CONFIG)

  const updateConfig = <K extends keyof AnalysisConfig>(
    key: K,
    value: AnalysisConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    const prompt = buildAnalysisPrompt(config)
    onSubmit(prompt)
  }

  const isValid = config.indicators.length > 0 && config.geographic.levels.length > 0

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
          <LayoutDashboard className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Panel de Análisis
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Configura los parámetros de tu análisis epidemiológico de diabetes o escribe tu pregunta directamente
        </p>
      </div>

      {/* Collapsible Panel */}
      <div className={cn(
        'rounded-2xl border bg-card shadow-sm overflow-hidden transition-all duration-300',
        isExpanded ? 'shadow-lg' : ''
      )}>
        {/* Panel Header */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'w-full flex items-center justify-between p-4 transition-colors',
            'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <span className="font-semibold text-foreground block">Análisis Guiado</span>
              <span className="text-xs text-muted-foreground">Configura los parámetros de tu consulta</span>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {/* Panel Content */}
        <div className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}>
          <div className="p-4 pt-0 space-y-6 border-t">
            {/* Step 1: Indicators */}
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                <span className="text-sm font-medium text-muted-foreground">Selecciona indicadores</span>
              </div>
              <IndicatorSelector
                selected={config.indicators}
                onChange={(indicators) => updateConfig('indicators', indicators)}
              />
            </div>

            {/* Step 2: Geographic */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                <span className="text-sm font-medium text-muted-foreground">Define el ámbito geográfico</span>
              </div>
              <GeographicSelector
                value={config.geographic}
                onChange={(geographic) => updateConfig('geographic', geographic)}
              />
            </div>

            {/* Step 3: Period */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                <span className="text-sm font-medium text-muted-foreground">Especifica el periodo</span>
              </div>
              <PeriodSelector
                startYear={config.periodStart}
                endYear={config.periodEnd}
                onStartChange={(year) => updateConfig('periodStart', year)}
                onEndChange={(year) => updateConfig('periodEnd', year)}
              />
            </div>

            {/* Step 4: Granularity */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                <span className="text-sm font-medium text-muted-foreground">Elige la granularidad</span>
              </div>
              <GranularitySelector
                value={config.granularity}
                onChange={(granularity) => updateConfig('granularity', granularity)}
              />
            </div>

            {/* Step 5: Additional Requests */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">+</span>
                <span className="text-sm font-medium text-muted-foreground">Solicitudes adicionales (opcional)</span>
              </div>
              <Textarea
                value={config.additionalRequests || ''}
                onChange={(e) => updateConfig('additionalRequests', e.target.value)}
                placeholder="Ej: desglose por sexo y edad, análisis de días de estancia hospitalaria, comparativa entre unidades..."
                className="min-h-[80px] resize-none text-sm"
                rows={3}
              />
            </div>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-muted-foreground uppercase tracking-wider">
                  Tipo de resultado
                </span>
              </div>
            </div>

            {/* Output Type */}
            <OutputTypeSelector
              value={config.outputType}
              onChange={(outputType) => updateConfig('outputType', outputType)}
            />

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                onClick={handleSubmit}
                disabled={disabled || !isValid}
                className="w-full h-12 text-base font-semibold gap-2"
                size="lg"
              >
                <Send className="h-4 w-4" />
                Generar Análisis
              </Button>
              {!isValid && config.indicators.length === 0 && (
                <p className="text-xs text-destructive mt-2 text-center">
                  Selecciona al menos un indicador para continuar
                </p>
              )}
              {!isValid && config.indicators.length > 0 && config.geographic.levels.length === 0 && (
                <p className="text-xs text-destructive mt-2 text-center">
                  Selecciona al menos un ámbito geográfico
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alternative: Free text */}
      <div className="mt-6 text-center">
        <div className="flex items-center gap-3 justify-center text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>O escribe tu pregunta directamente en el campo de texto</span>
        </div>
      </div>
    </div>
  )
}

