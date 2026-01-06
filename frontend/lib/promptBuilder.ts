import type { AnalysisConfig, Indicator, OutputType, GeographicLevel, GeographicSelection } from '@/types/studio'
import { INDICATOR_LABELS, OUTPUT_TYPE_LABELS, GEOGRAPHIC_LEVEL_LABELS } from '@/types/studio'

const OUTPUT_INSTRUCTIONS: Record<OutputType, string> = {
  reporte_integral: 'Genera un reporte PDF completo con tablas de datos, gráficos de tendencias, análisis estadístico y conclusiones.',
  grafico: 'Genera únicamente una visualización gráfica clara y profesional de los datos.',
  tablas: 'Presenta los datos en formato de tablas comparativas bien estructuradas.',
  excel: 'Exporta los datos a un archivo Excel descargable con los datos completos.',
}

function formatIndicators(indicators: Indicator[]): string {
  if (indicators.length === 0) return ''
  
  if (indicators.includes('perfil_integral')) {
    return 'un perfil integral (incidencia, prevalencia, mortalidad y hospitalización)'
  }
  
  const labels = indicators.map(i => INDICATOR_LABELS[i].toLowerCase())
  
  if (labels.length === 1) {
    return labels[0]
  }
  
  if (labels.length === 2) {
    return `${labels[0]} y ${labels[1]}`
  }
  
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`
}

function formatPeriod(start: number, end: number): string {
  if (start === end) {
    return `del año ${start}`
  }
  return `del periodo ${start} a ${end}`
}

function formatGranularity(granularity: 'anual' | 'mensual'): string {
  return granularity === 'mensual' 
    ? 'con desglose mensual' 
    : 'con datos anuales'
}

function formatGeographic(geographic: GeographicSelection): string {
  const parts: string[] = []
  
  // Nacional
  if (geographic.levels.includes('Nacional')) {
    parts.push('nivel Nacional')
  }
  
  // OOAD
  if (geographic.levels.includes('OOAD')) {
    if (geographic.ooadFilter?.trim()) {
      parts.push(`nivel OOAD para: ${geographic.ooadFilter.trim()}`)
    } else {
      parts.push('nivel OOAD (todas las delegaciones)')
    }
  }
  
  // Unidad Médica
  if (geographic.levels.includes('Unidad Medica')) {
    if (geographic.unidadFilter?.trim()) {
      parts.push(`nivel Unidad Médica para: ${geographic.unidadFilter.trim()}`)
    } else {
      parts.push('nivel Unidad Médica (todas las unidades)')
    }
  }
  
  if (parts.length === 0) {
    return 'a nivel Nacional'
  }
  
  if (parts.length === 1) {
    return `a ${parts[0]}`
  }
  
  if (parts.length === 2) {
    return `a ${parts[0]} y ${parts[1]}`
  }
  
  return `a ${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

export function buildAnalysisPrompt(config: AnalysisConfig): string {
  const {
    indicators,
    geographic,
    periodStart,
    periodEnd,
    granularity,
    additionalRequests,
    outputType,
  } = config

  // Build main request
  const indicatorText = formatIndicators(indicators)
  const periodText = formatPeriod(periodStart, periodEnd)
  const granularityText = formatGranularity(granularity)
  const geographicText = formatGeographic(geographic)
  const outputInstruction = OUTPUT_INSTRUCTIONS[outputType]

  // Construct the prompt
  let prompt = `Realiza un análisis de ${indicatorText} de diabetes ${geographicText}, ${periodText}, ${granularityText}.\n\n`
  
  prompt += `**Tipo de resultado solicitado:** ${OUTPUT_TYPE_LABELS[outputType]}\n`
  prompt += `${outputInstruction}\n`

  // Add additional requests if any
  if (additionalRequests?.trim()) {
    prompt += `\n**Solicitudes adicionales:**\n${additionalRequests.trim()}\n`
  }

  return prompt.trim()
}

// Utility to generate a summary of the config (for display purposes)
export function getConfigSummary(config: AnalysisConfig): string {
  const parts: string[] = []
  
  if (config.indicators.length > 0) {
    parts.push(formatIndicators(config.indicators))
  }
  
  const levelLabels = config.geographic.levels.map(l => GEOGRAPHIC_LEVEL_LABELS[l])
  parts.push(levelLabels.join(' + '))
  
  parts.push(formatPeriod(config.periodStart, config.periodEnd))
  
  return parts.join(' • ')
}
