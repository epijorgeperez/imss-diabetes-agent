// Package and Template types for the directive package system

export type AudienceRole = 'central' | 'ooad' | 'um'

// ============================================
// Template Types
// ============================================

export interface TemplateConstraints {
  granularity?: 'anual' | 'mensual'
  minPeriodMonths?: number
  maxPeriodMonths?: number
  allowedIndicators?: string[]
  allowedLevels?: ('Nacional' | 'OOAD' | 'Unidad Medica')[]
}

export interface Template {
  id: string
  name: string
  description: string
  category: 'incidencia' | 'prevalencia' | 'mortalidad' | 'hospitalizacion' | 'integral' | 'comparativo'
  audience: AudienceRole[]
  requiredParams: ('indicadores' | 'ambito' | 'periodo' | 'ooad' | 'unidad')[]
  expectedOutputs: ('executiveSummary' | 'kpis' | 'table' | 'chart' | 'emailDraft' | 'pdf')[]
  defaultIndicators?: string[]
  constraints?: TemplateConstraints
  icon?: string
}

// ============================================
// Package Types
// ============================================

export interface PackageParams {
  templateId: string
  indicators: string[]
  geographic: {
    levels: ('Nacional' | 'OOAD' | 'Unidad Medica')[]
    ooadFilter?: string
    unidadFilter?: string
  }
  periodStart: number
  periodEnd: number
  granularity: 'anual' | 'mensual'
}

export interface KPIItem {
  label: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  icon?: string
}

export interface ChartItem {
  title: string
  src: string  // href for ImageViewer
  alt?: string
}

export interface TableItem {
  title: string
  headers: string[]
  rows: (string | number)[][]
  footer?: string
}

export interface DownloadItem {
  label: string
  href: string
  format: 'pdf' | 'csv' | 'xlsx' | 'png'
}

export interface EmailDraft {
  subject: string
  body: string
}

export interface ActionItem {
  priority: 'alta' | 'media' | 'baja'
  action: string
  rationale: string
  deadline: string
  owner: string
}

export interface PackagePayload {
  type: 'package'
  title: string
  templateId: string
  templateName: string
  params: PackageParams
  executiveSummary: string[]        // 5 bullets max
  kpis: KPIItem[]                   // 3-5 key metrics
  recommendedActions: ActionItem[]  // 2-4 recommended actions
  emailDraft: EmailDraft
  charts: ChartItem[]               // hrefs for ImageViewer
  tables: TableItem[]               // data to render inline
  downloads: DownloadItem[]         // hrefs for FileDownload
  methodologyNotes: string[]
  generatedAt: string
}

// ============================================
// API Request/Response Types
// ============================================

export interface GeneratePackageRequest {
  templateId: string
  params: Omit<PackageParams, 'templateId'>
  chatId: string
}

export interface GeneratePackageResponse {
  success: boolean
  package?: PackagePayload
  error?: string
}

// ============================================
// Template Catalog
// ============================================

export interface TemplateCatalog {
  version: string
  templates: Template[]
}
