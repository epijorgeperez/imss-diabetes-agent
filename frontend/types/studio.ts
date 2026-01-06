export type Indicator = 
  | 'incidencia' 
  | 'prevalencia' 
  | 'mortalidad' 
  | 'hospitalizacion' 
  | 'perfil_integral'

export type GeographicLevel = 'Nacional' | 'OOAD' | 'Unidad Medica'

export interface GeographicSelection {
  levels: GeographicLevel[]
  ooadFilter?: string      // texto libre para OOADs (vacío = todas)
  unidadFilter?: string    // texto libre para Unidades (vacío = todas)
}

export type Granularity = 'anual' | 'mensual'

export type OutputType = 
  | 'reporte_integral' 
  | 'grafico' 
  | 'tablas' 
  | 'excel'

export interface AnalysisConfig {
  indicators: Indicator[]
  geographic: GeographicSelection
  periodStart: number
  periodEnd: number
  granularity: Granularity
  additionalRequests?: string
  outputType: OutputType
}

export const INDICATOR_LABELS: Record<Indicator, string> = {
  incidencia: 'Incidencia',
  prevalencia: 'Prevalencia',
  mortalidad: 'Mortalidad',
  hospitalizacion: 'Hospitalización',
  perfil_integral: 'Perfil Integral',
}

export const INDICATOR_DESCRIPTIONS: Record<Indicator, string> = {
  incidencia: 'Casos nuevos de diabetes',
  prevalencia: 'Pacientes existentes con diabetes',
  mortalidad: 'Defunciones por diabetes',
  hospitalizacion: 'Egresos hospitalarios y días de estancia',
  perfil_integral: 'Análisis completo de todos los indicadores',
}

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  reporte_integral: 'Reporte Integral',
  grafico: 'Solo Gráfico',
  tablas: 'Tablas Comparativas',
  excel: 'Archivo Excel',
}

export const OUTPUT_TYPE_DESCRIPTIONS: Record<OutputType, string> = {
  reporte_integral: 'PDF con tablas, gráficos, tendencias y análisis',
  grafico: 'Visualización gráfica de los datos',
  tablas: 'Datos tabulados para comparación',
  excel: 'Archivo descargable con los datos',
}

export const GEOGRAPHIC_LEVEL_LABELS: Record<GeographicLevel, string> = {
  'Nacional': 'Nacional',
  'OOAD': 'Delegación (OOAD)',
  'Unidad Medica': 'Unidad Médica',
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  indicators: [],
  geographic: {
    levels: ['Nacional'],
  },
  periodStart: 2023,
  periodEnd: 2024,
  granularity: 'anual',
  outputType: 'reporte_integral',
}

