'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Template, AudienceRole } from '@/types/package'
import {
  Search,
  Package,
  Activity,
  Building,
  GitCompare,
  Hospital,
  TrendingDown,
  BedDouble,
  AlertTriangle,
  Briefcase,
  Calendar,
  FileText,
  Users,
  BarChart2,
  TrendingUp,
  Clock,
  Triangle,
  Heart,
  LayoutDashboard,
  Target,
  CalendarCheck,
  AlertCircle
} from 'lucide-react'

// Template catalog - embedded directly for now, can be fetched from API in production
const catalogData = {
  "version": "1.0.0",
  "templates": [
    {
      "id": "comite-incidencia-ooad",
      "name": "Reporte de Incidencia para Comité OOAD",
      "description": "Análisis de casos nuevos de diabetes para presentar en comité de OOAD. Incluye tendencias mensuales, comparativo con nacional y recomendaciones.",
      "category": "incidencia",
      "audience": ["ooad"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["incidencia"],
      "constraints": { "granularity": "mensual", "minPeriodMonths": 12, "allowedLevels": ["OOAD"] },
      "icon": "activity"
    },
    {
      "id": "comite-incidencia-central",
      "name": "Reporte de Incidencia para Comité Central",
      "description": "Panorama nacional de incidencia de diabetes con desglose por OOAD. Para presentación ante directivos centrales.",
      "category": "incidencia",
      "audience": ["central"],
      "requiredParams": ["periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft", "pdf"],
      "defaultIndicators": ["incidencia"],
      "constraints": { "granularity": "anual", "allowedLevels": ["Nacional", "OOAD"] },
      "icon": "building"
    },
    {
      "id": "comparativo-inter-ooad",
      "name": "Análisis Comparativo Inter-OOAD",
      "description": "Comparación de indicadores entre múltiples OOADs. Identifica mejores y peores desempeños.",
      "category": "comparativo",
      "audience": ["central", "ooad"],
      "requiredParams": ["indicadores", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["incidencia", "prevalencia"],
      "constraints": { "allowedLevels": ["OOAD"] },
      "icon": "git-compare"
    },
    {
      "id": "perfil-epidemiologico-um",
      "name": "Perfil Epidemiológico de Unidad Médica",
      "description": "Análisis integral de diabetes en una unidad médica específica.",
      "category": "integral",
      "audience": ["um", "ooad"],
      "requiredParams": ["unidad", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft", "pdf"],
      "defaultIndicators": ["incidencia", "prevalencia", "mortalidad", "hospitalizacion"],
      "constraints": { "allowedLevels": ["Unidad Medica"] },
      "icon": "hospital"
    },
    {
      "id": "tendencia-mortalidad-regional",
      "name": "Tendencia de Mortalidad Regional",
      "description": "Análisis de mortalidad por diabetes en una región/OOAD.",
      "category": "mortalidad",
      "audience": ["ooad", "central"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["mortalidad"],
      "constraints": { "minPeriodMonths": 24, "allowedLevels": ["Nacional", "OOAD"] },
      "icon": "trending-down"
    },
    {
      "id": "dashboard-hospitalizaciones",
      "name": "Dashboard de Hospitalizaciones",
      "description": "Egresos hospitalarios por diabetes: volumen, días de estancia promedio, tendencias.",
      "category": "hospitalizacion",
      "audience": ["ooad", "um"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["hospitalizacion"],
      "constraints": { "granularity": "mensual" },
      "icon": "bed"
    },
    {
      "id": "alerta-temprana-brotes",
      "name": "Alerta Temprana - Detección de Brotes",
      "description": "Identifica incrementos atípicos en incidencia que podrían indicar brotes.",
      "category": "incidencia",
      "audience": ["central", "ooad"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["incidencia"],
      "constraints": { "granularity": "mensual", "minPeriodMonths": 6 },
      "icon": "alert-triangle"
    },
    {
      "id": "informe-ejecutivo-nacional",
      "name": "Informe Ejecutivo Nacional",
      "description": "Resumen ejecutivo para alta dirección. Vista panorámica de todos los indicadores.",
      "category": "integral",
      "audience": ["central"],
      "requiredParams": ["periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft", "pdf"],
      "defaultIndicators": ["incidencia", "prevalencia", "mortalidad", "hospitalizacion"],
      "constraints": { "granularity": "anual", "allowedLevels": ["Nacional"] },
      "icon": "briefcase"
    },
    {
      "id": "comparativa-anual-indicadores",
      "name": "Comparativa Anual de Indicadores",
      "description": "Análisis año vs año de todos los indicadores.",
      "category": "comparativo",
      "audience": ["central", "ooad"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["incidencia", "prevalencia", "mortalidad", "hospitalizacion"],
      "constraints": { "granularity": "anual", "minPeriodMonths": 24 },
      "icon": "calendar"
    },
    {
      "id": "reporte-integral-diabetes",
      "name": "Reporte Integral de Diabetes",
      "description": "Análisis completo de todos los indicadores para un ámbito específico.",
      "category": "integral",
      "audience": ["central", "ooad", "um"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft", "pdf"],
      "defaultIndicators": ["incidencia", "prevalencia", "mortalidad", "hospitalizacion"],
      "constraints": {},
      "icon": "file-text"
    },
    {
      "id": "prevalencia-cronico-degenerativo",
      "name": "Prevalencia y Carga de Enfermedad",
      "description": "Análisis de prevalencia de diabetes: pacientes activos, distribución por edad/sexo.",
      "category": "prevalencia",
      "audience": ["central", "ooad"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["prevalencia"],
      "constraints": { "granularity": "anual" },
      "icon": "users"
    },
    {
      "id": "ranking-ooad-incidencia",
      "name": "Ranking de OOADs por Incidencia",
      "description": "Ordenamiento de todas las OOADs por tasa de incidencia.",
      "category": "comparativo",
      "audience": ["central"],
      "requiredParams": ["periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["incidencia"],
      "constraints": { "allowedLevels": ["OOAD"] },
      "icon": "bar-chart-2"
    },
    {
      "id": "evolucion-temporal-ooad",
      "name": "Evolución Temporal de OOAD",
      "description": "Serie de tiempo de indicadores clave para una OOAD específica.",
      "category": "comparativo",
      "audience": ["ooad"],
      "requiredParams": ["ooad", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["incidencia", "mortalidad"],
      "constraints": { "granularity": "mensual", "minPeriodMonths": 12, "allowedLevels": ["OOAD"] },
      "icon": "trending-up"
    },
    {
      "id": "analisis-estancia-hospitalaria",
      "name": "Análisis de Estancia Hospitalaria",
      "description": "Detalle de días de estancia por diabetes: promedio, distribución, outliers.",
      "category": "hospitalizacion",
      "audience": ["ooad", "um"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["hospitalizacion"],
      "constraints": {},
      "icon": "clock"
    },
    {
      "id": "tablero-control-directivo",
      "name": "Tablero de Control Directivo",
      "description": "KPIs principales de diabetes en formato ejecutivo. Semáforos y metas vs realidad.",
      "category": "integral",
      "audience": ["central", "ooad"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "chart", "emailDraft"],
      "defaultIndicators": ["incidencia", "prevalencia", "mortalidad"],
      "constraints": { "granularity": "mensual" },
      "icon": "layout-dashboard"
    },
    {
      "id": "benchmark-nacional",
      "name": "Benchmark con Media Nacional",
      "description": "Comparación de indicadores de una OOAD/UM contra la media nacional.",
      "category": "comparativo",
      "audience": ["ooad", "um"],
      "requiredParams": ["ambito", "periodo"],
      "expectedOutputs": ["executiveSummary", "kpis", "table", "chart", "emailDraft"],
      "defaultIndicators": ["incidencia", "prevalencia", "mortalidad"],
      "constraints": {},
      "icon": "target"
    }
  ]
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'activity': Activity,
  'building': Building,
  'git-compare': GitCompare,
  'hospital': Hospital,
  'trending-down': TrendingDown,
  'bed': BedDouble,
  'alert-triangle': AlertTriangle,
  'briefcase': Briefcase,
  'calendar': Calendar,
  'file-text': FileText,
  'users': Users,
  'bar-chart-2': BarChart2,
  'trending-up': TrendingUp,
  'clock': Clock,
  'triangle': Triangle,
  'heart': Heart,
  'layout-dashboard': LayoutDashboard,
  'target': Target,
  'calendar-check': CalendarCheck,
  'alert-circle': AlertCircle,
}

const AUDIENCE_LABELS: Record<AudienceRole, string> = {
  central: 'Central',
  ooad: 'OOAD',
  um: 'Unidad Médica'
}

// IMSS Institutional Colors
// VERDE_IMSS = #00594C | ROJO_GOB = #9B2242 | DORADO_IMSS = #AD841F
// TINTO = #651D32 | NEGRO = #222223 | GRIS_TEXTO = #B1B3B3
const AUDIENCE_COLORS: Record<AudienceRole, string> = {
  central: 'bg-[#9B2242]/10 text-[#9B2242] dark:bg-[#9B2242]/20 dark:text-[#e5a0b0]',
  ooad: 'bg-[#00594C]/10 text-[#00594C] dark:bg-[#00594C]/20 dark:text-[#7dc9bc]',
  um: 'bg-[#AD841F]/10 text-[#AD841F] dark:bg-[#AD841F]/20 dark:text-[#d4b872]'
}

const CATEGORY_COLORS: Record<string, string> = {
  incidencia: 'border-l-[#9B2242]',      // Rojo Gobierno
  prevalencia: 'border-l-[#651D32]',     // Tinto
  mortalidad: 'border-l-[#222223]',      // Negro
  hospitalizacion: 'border-l-[#00594C]', // Verde IMSS
  integral: 'border-l-[#AD841F]',        // Dorado IMSS
  comparativo: 'border-l-[#B1B3B3]'      // Gris
}

const CATEGORY_ICON_COLORS: Record<string, { bg: string; text: string; hoverBg: string; hoverText: string }> = {
  incidencia: { 
    bg: 'bg-[#9B2242]/10', 
    text: 'text-[#9B2242]',
    hoverBg: 'group-hover:bg-[#9B2242]/20',
    hoverText: 'group-hover:text-[#9B2242]'
  },
  prevalencia: { 
    bg: 'bg-[#651D32]/10', 
    text: 'text-[#651D32]',
    hoverBg: 'group-hover:bg-[#651D32]/20',
    hoverText: 'group-hover:text-[#651D32]'
  },
  mortalidad: { 
    bg: 'bg-[#222223]/10', 
    text: 'text-[#222223] dark:text-[#B1B3B3]',
    hoverBg: 'group-hover:bg-[#222223]/20',
    hoverText: 'group-hover:text-[#222223] dark:group-hover:text-white'
  },
  hospitalizacion: { 
    bg: 'bg-[#00594C]/10', 
    text: 'text-[#00594C]',
    hoverBg: 'group-hover:bg-[#00594C]/20',
    hoverText: 'group-hover:text-[#00594C]'
  },
  integral: { 
    bg: 'bg-[#AD841F]/10', 
    text: 'text-[#AD841F]',
    hoverBg: 'group-hover:bg-[#AD841F]/20',
    hoverText: 'group-hover:text-[#AD841F]'
  },
  comparativo: { 
    bg: 'bg-[#B1B3B3]/20', 
    text: 'text-[#666666] dark:text-[#B1B3B3]',
    hoverBg: 'group-hover:bg-[#B1B3B3]/30',
    hoverText: 'group-hover:text-[#444444] dark:group-hover:text-white'
  }
}

interface TemplateLibraryProps {
  onSelectTemplate: (template: Template) => void
}

export function TemplateLibrary({ onSelectTemplate }: TemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAudience, setSelectedAudience] = useState<AudienceRole | 'all'>('all')

  const templates = catalogData.templates as Template[]

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      // Filter by search query
      const matchesSearch = searchQuery === '' ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase())

      // Filter by audience
      const matchesAudience = selectedAudience === 'all' ||
        template.audience.includes(selectedAudience)

      return matchesSearch && matchesAudience
    })
  }, [templates, searchQuery, selectedAudience])

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, Template[]> = {}
    filteredTemplates.forEach(template => {
      if (!groups[template.category]) {
        groups[template.category] = []
      }
      groups[template.category].push(template)
    })
    return groups
  }, [filteredTemplates])

  const categoryLabels: Record<string, string> = {
    incidencia: 'Incidencia',
    prevalencia: 'Prevalencia',
    mortalidad: 'Mortalidad',
    hospitalizacion: 'Hospitalización',
    integral: 'Análisis Integral',
    comparativo: 'Comparativos'
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#00594C]/20 to-[#00594C]/5 mb-4 shadow-lg">
          <Package className="h-8 w-8 text-[#00594C]" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Paquetes Directivos
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Selecciona una plantilla para generar un paquete completo con resumen ejecutivo, 
          KPIs, gráficas y correo listo para enviar
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar plantillas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Audience filter */}
        <div className="flex gap-2">
          <Button
            variant={selectedAudience === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedAudience('all')}
          >
            Todos
          </Button>
          {(['central', 'ooad', 'um'] as AudienceRole[]).map(audience => (
            <Button
              key={audience}
              variant={selectedAudience === audience ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedAudience(audience)}
            >
              {AUDIENCE_LABELS[audience]}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="space-y-8">
        {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className={cn(
                'w-1 h-6 rounded-full',
                CATEGORY_COLORS[category]?.replace('border-l-', 'bg-') || 'bg-gray-500'
              )} />
              {categoryLabels[category] || category}
              <span className="text-sm font-normal text-muted-foreground">
                ({categoryTemplates.length})
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => onSelectTemplate(template)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No se encontraron plantillas con los filtros seleccionados</p>
        </div>
      )}
    </div>
  )
}

interface TemplateCardProps {
  template: Template
  onSelect: () => void
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const IconComponent = template.icon ? ICON_MAP[template.icon] : FileText
  const iconColors = CATEGORY_ICON_COLORS[template.category] || CATEGORY_ICON_COLORS.comparativo

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-l-4',
        CATEGORY_COLORS[template.category] || 'border-l-gray-500'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors',
            iconColors.bg,
            iconColors.hoverBg
          )}>
            {IconComponent && (
              <IconComponent className={cn(
                'h-5 w-5 transition-colors',
                iconColors.text,
                iconColors.hoverText
              )} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground text-sm leading-tight mb-1 group-hover:text-[#00594C] transition-colors">
              {template.name}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {template.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {template.audience.map(audience => (
                <span
                  key={audience}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    AUDIENCE_COLORS[audience]
                  )}
                >
                  {AUDIENCE_LABELS[audience]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default TemplateLibrary
