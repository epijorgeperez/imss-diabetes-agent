'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IndicatorSelector } from '@/components/studio/IndicatorSelector'
import { GeographicSelector } from '@/components/studio/GeographicSelector'
import { PeriodSelector } from '@/components/studio/PeriodSelector'
import { GranularitySelector } from '@/components/studio/GranularitySelector'
import type { Template, PackageParams } from '@/types/package'
import type { Indicator, GeographicLevel, GeographicSelection, Granularity } from '@/types/studio'
import { 
  Package, 
  ArrowLeft, 
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

interface TemplateConfigPanelProps {
  template: Template
  onBack: () => void
  onGeneratePackage: (params: PackageParams) => void
  onExploreChat?: (prompt: string) => void
  isGenerating?: boolean
}

export function TemplateConfigPanel({
  template,
  onBack,
  onGeneratePackage,
  onExploreChat,
  isGenerating = false
}: TemplateConfigPanelProps) {
  // Initialize state based on template defaults and constraints
  const [indicators, setIndicators] = useState<Indicator[]>(() => {
    if (template.defaultIndicators?.length) {
      return template.defaultIndicators as Indicator[]
    }
    return []
  })

  const [geographic, setGeographic] = useState<GeographicSelection>(() => {
    const allowedLevels = template.constraints?.allowedLevels
    if (allowedLevels?.length) {
      return { levels: [allowedLevels[0]] }
    }
    return { levels: ['Nacional'] }
  })

  // Set default period start to current year minus 2
  const [periodStart, setPeriodStart] = useState(() => {
    const currentYear = new Date().getFullYear()
    return currentYear - 2
  })

  // Set default period end to current year minus 1
  const [periodEnd, setPeriodEnd] = useState(() => {
    const currentYear = new Date().getFullYear()
    return currentYear - 1
  })

  const [granularity, setGranularity] = useState<Granularity>(() => {
    return template.constraints?.granularity || 'anual'
  })

  const [additionalNotes, setAdditionalNotes] = useState('')

  // Determine which params are required based on template
  const requiredParams = template.requiredParams || []
  
  const showIndicators = requiredParams.includes('indicadores') || !template.defaultIndicators?.length
  const showGeographic = requiredParams.includes('ambito') || requiredParams.includes('ooad') || requiredParams.includes('unidad')
  const showPeriod = requiredParams.includes('periodo')
  const showGranularity = !template.constraints?.granularity // Only show if not locked by constraint

  // Filter geographic levels based on constraints
  const allowedLevels = useMemo(() => {
    return template.constraints?.allowedLevels || ['Nacional', 'OOAD', 'Unidad Medica']
  }, [template.constraints])

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []

    if (indicators.length === 0) {
      errors.push('Selecciona al menos un indicador')
    }

    if (geographic.levels.length === 0) {
      errors.push('Selecciona un ámbito geográfico')
    }

    // Check if selected levels are allowed
    const invalidLevels = geographic.levels.filter(l => !allowedLevels.includes(l))
    if (invalidLevels.length > 0) {
      errors.push(`Esta plantilla no permite: ${invalidLevels.join(', ')}`)
    }

    // Check period requirements
    if (template.constraints?.minPeriodMonths) {
      const months = (periodEnd - periodStart + 1) * 12
      if (months < template.constraints.minPeriodMonths) {
        warnings.push(`Se recomienda un periodo de al menos ${template.constraints.minPeriodMonths} meses`)
      }
    }

    return { errors, warnings, isValid: errors.length === 0 }
  }, [indicators, geographic, periodStart, periodEnd, allowedLevels, template.constraints])

  const handleGeneratePackage = () => {
    if (!validation.isValid) return

    const params: PackageParams = {
      templateId: template.id,
      indicators,
      geographic: {
        levels: geographic.levels as ('Nacional' | 'OOAD' | 'Unidad Medica')[],
        ooadFilter: geographic.ooadFilter,
        unidadFilter: geographic.unidadFilter
      },
      periodStart,
      periodEnd,
      granularity
    }

    onGeneratePackage(params)
  }

  const handleExploreChat = () => {
    if (!onExploreChat) return

    // Build a prompt from the current config
    const indicatorText = indicators.join(', ') || 'perfil integral'
    const levelText = geographic.levels.join(' y ')
    const periodText = periodStart === periodEnd 
      ? `año ${periodStart}` 
      : `periodo ${periodStart}-${periodEnd}`

    const prompt = `Realiza un análisis de ${indicatorText} a nivel ${levelText} para el ${periodText}, con granularidad ${granularity}.${additionalNotes ? `\n\nNotas adicionales: ${additionalNotes}` : ''}`

    onExploreChat(prompt)
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a plantillas
      </Button>

      {/* Template Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">
              {template.name}
            </h2>
            <p className="text-muted-foreground">
              {template.description}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Configuración del Paquete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Indicators */}
          {showIndicators && (
            <div>
              <IndicatorSelector
                selected={indicators}
                onChange={setIndicators}
              />
              {template.defaultIndicators?.length && (
                <p className="text-xs text-muted-foreground mt-2">
                  Indicadores predeterminados: {template.defaultIndicators.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Geographic */}
          {showGeographic && (
            <div>
              <GeographicSelector
                value={geographic}
                onChange={setGeographic}
              />
              {allowedLevels.length < 3 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Esta plantilla está limitada a: {allowedLevels.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Period */}
          {showPeriod && (
            <PeriodSelector
              startYear={periodStart}
              endYear={periodEnd}
              onStartChange={setPeriodStart}
              onEndChange={setPeriodEnd}
            />
          )}

          {/* Granularity */}
          {showGranularity && (
            <GranularitySelector
              value={granularity}
              onChange={setGranularity}
            />
          )}
          {template.constraints?.granularity && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Granularidad fijada a: <strong>{template.constraints.granularity}</strong></span>
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Notas adicionales (opcional)
            </label>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Solicitudes específicas, contexto adicional, formato deseado..."
              className="min-h-[80px] resize-none"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Validation Messages */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="mb-6 space-y-2">
          {validation.errors.map((error, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ))}
          {validation.warnings.map((warning, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expected Outputs Preview */}
      <Card className="mb-6 bg-muted/50">
        <CardContent className="py-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            El paquete incluirá:
          </p>
          <div className="flex flex-wrap gap-2">
            {template.expectedOutputs.map(output => (
              <span
                key={output}
                className="text-xs px-2 py-1 rounded-full bg-background border"
              >
                {OUTPUT_LABELS[output] || output}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleGeneratePackage}
          disabled={!validation.isValid || isGenerating}
          className="flex-1 h-12 text-base font-semibold gap-2"
          size="lg"
        >
          {isGenerating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generando...
            </>
          ) : (
            <>
              <Package className="h-5 w-5" />
              Generar Paquete
            </>
          )}
        </Button>

        {onExploreChat && (
          <Button
            variant="outline"
            onClick={handleExploreChat}
            disabled={isGenerating}
            className="sm:w-auto gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Explorar en Chat
          </Button>
        )}
      </div>
    </div>
  )
}

const OUTPUT_LABELS: Record<string, string> = {
  executiveSummary: 'Resumen Ejecutivo',
  kpis: 'KPIs',
  table: 'Tabla Comparativa',
  chart: 'Gráfica',
  emailDraft: 'Borrador de Correo',
  pdf: 'PDF Descargable'
}

export default TemplateConfigPanel
