'use client'

import { cn } from '@/lib/utils'
import type { KPIItem } from '@/types/package'
import { TrendingUp, TrendingDown, Minus, Activity, Users, Heart, Building2, BarChart2, type LucideProps } from 'lucide-react'

// IMSS Institutional Colors
const IMSS_COLORS = {
  VERDE_IMSS: '#00594C',
  ROJO_GOB: '#9B2242',
  DORADO_IMSS: '#AD841F',
  TINTO: '#651D32',
  NEGRO: '#222223',
  GRIS_TEXTO: '#B1B3B3',
}

interface KPIDisplayProps {
  kpis: KPIItem[]
  className?: string
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus
}

// Using IMSS institutional colors for trends
const TREND_STYLES = {
  up: { color: IMSS_COLORS.VERDE_IMSS },
  down: { color: IMSS_COLORS.ROJO_GOB },
  stable: { color: IMSS_COLORS.GRIS_TEXTO }
}

// Map icon names to components (using LucideProps for proper typing)
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  'activity': Activity,
  'users': Users,
  'heart': Heart,
  'building': Building2,
  'chart': BarChart2,
}

export function KPIDisplay({ kpis, className }: KPIDisplayProps) {
  return (
    <div className={cn('grid gap-3', className)}>
      <div className={cn(
        'grid gap-3',
        kpis.length === 1 && 'grid-cols-1',
        kpis.length === 2 && 'grid-cols-2',
        kpis.length === 3 && 'grid-cols-3',
        kpis.length === 4 && 'grid-cols-2 sm:grid-cols-4',
        kpis.length >= 5 && 'grid-cols-2 sm:grid-cols-3'
      )}>
        {kpis.map((kpi, index) => (
          <KPICard key={index} kpi={kpi} />
        ))}
      </div>
    </div>
  )
}

interface KPICardProps {
  kpi: KPIItem
}

function KPICard({ kpi }: KPICardProps) {
  const TrendIcon = kpi.trend ? TREND_ICONS[kpi.trend] : null
  const IconComponent = kpi.icon ? ICON_MAP[kpi.icon] : null

  return (
    <div 
      className="relative overflow-hidden rounded-lg border p-4"
      style={{ 
        borderColor: `${IMSS_COLORS.VERDE_IMSS}30`,
        background: `linear-gradient(to bottom right, white, ${IMSS_COLORS.VERDE_IMSS}05)`
      }}
    >
      {/* Background decoration */}
      <div 
        className="absolute -right-4 -top-4 h-16 w-16 rounded-full"
        style={{ backgroundColor: `${IMSS_COLORS.DORADO_IMSS}10` }}
      />
      
      <div className="relative">
        {/* Header with icon and label */}
        <div className="flex items-center gap-2 mb-2">
          {IconComponent && (
            <IconComponent className="h-4 w-4" style={{ color: IMSS_COLORS.DORADO_IMSS }} />
          )}
          <span 
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: IMSS_COLORS.GRIS_TEXTO }}
          >
            {kpi.label}
          </span>
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-1.5">
          <span 
            className="text-2xl font-bold"
            style={{ color: IMSS_COLORS.NEGRO }}
          >
            {typeof kpi.value === 'number' ? kpi.value.toLocaleString('es-MX') : kpi.value}
          </span>
          {kpi.unit && (
            <span 
              className="text-sm"
              style={{ color: IMSS_COLORS.GRIS_TEXTO }}
            >
              {kpi.unit}
            </span>
          )}
        </div>

        {/* Trend */}
        {kpi.trend && (
          <div 
            className="flex items-center gap-1 mt-1.5 text-xs font-medium"
            style={TREND_STYLES[kpi.trend]}
          >
            {TrendIcon && <TrendIcon className="h-3 w-3" />}
            {kpi.trendValue && <span>{kpi.trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default KPIDisplay
