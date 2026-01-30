'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImageViewer } from '@/components/artifacts/ImageViewer'
import { FileDownload } from '@/components/artifacts/FileDownload'
import { KPIDisplay } from './KPIDisplay'
import { EmailDraft } from './EmailDraft'
import { ActionItems } from './ActionItems'
import type { PackagePayload, TableItem } from '@/types/package'
import {
  Package,
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart2,
  Mail,
  Download,
  Clock,
  MapPin,
  Calendar,
  Activity,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react'

// IMSS Institutional Colors
const IMSS_COLORS = {
  VERDE_IMSS: '#00594C',
  ROJO_GOB: '#9B2242',
  DORADO_IMSS: '#AD841F',
  TINTO: '#651D32',
  NEGRO: '#222223',
  GRIS_TEXTO: '#B1B3B3',
  BLANCO: '#FFFFFF',
}

interface PackageCardProps {
  packageData: PackagePayload
  className?: string
}

export function PackageCard({ packageData, className }: PackageCardProps) {
  const [isMethodologyExpanded, setIsMethodologyExpanded] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

  const handleCopySummary = async () => {
    const summary = packageData.executiveSummary.map((s, i) => `${i + 1}. ${s}`).join('\n')
    await navigator.clipboard.writeText(summary)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <Card 
      className={cn(
        'overflow-hidden border-2 shadow-lg',
        'bg-gradient-to-br from-background via-background to-[#00594C]/5',
        className
      )}
      style={{ borderColor: `${IMSS_COLORS.VERDE_IMSS}40` }}
    >
      {/* Header - Verde IMSS */}
      <CardHeader 
        className="pb-4 border-b"
        style={{ 
          background: `linear-gradient(to right, ${IMSS_COLORS.VERDE_IMSS}15, transparent)`,
          borderBottomColor: `${IMSS_COLORS.VERDE_IMSS}30`
        }}
      >
        <div className="flex items-start gap-4">
          <div 
            className="flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center shadow-inner"
            style={{ backgroundColor: `${IMSS_COLORS.VERDE_IMSS}20` }}
          >
            <Package className="h-6 w-6" style={{ color: IMSS_COLORS.VERDE_IMSS }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span 
                className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: IMSS_COLORS.VERDE_IMSS }}
              >
                PAQUETE DIRECTIVO
              </span>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {packageData.title}
            </h3>
            
            {/* Chips - Colores institucionales */}
            <div className="flex flex-wrap gap-2">
              {packageData.params.geographic.levels.map(level => (
                <span
                  key={level}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: `${IMSS_COLORS.VERDE_IMSS}15`,
                    color: IMSS_COLORS.VERDE_IMSS
                  }}
                >
                  <MapPin className="h-3 w-3" />
                  {level}
                </span>
              ))}
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: `${IMSS_COLORS.DORADO_IMSS}15`,
                  color: IMSS_COLORS.DORADO_IMSS
                }}
              >
                <Calendar className="h-3 w-3" />
                {packageData.params.periodStart === packageData.params.periodEnd
                  ? packageData.params.periodStart
                  : `${packageData.params.periodStart}-${packageData.params.periodEnd}`}
              </span>
              {packageData.params.indicators.map(ind => (
                <span
                  key={ind}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: `${IMSS_COLORS.ROJO_GOB}15`,
                    color: IMSS_COLORS.ROJO_GOB
                  }}
                >
                  <Activity className="h-3 w-3" />
                  {ind}
                </span>
              ))}
            </div>
          </div>
          
          <div className="text-right text-xs hidden sm:block" style={{ color: IMSS_COLORS.GRIS_TEXTO }}>
            <div className="flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3" />
              {formatDate(packageData.generatedAt)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Executive Summary */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: IMSS_COLORS.ROJO_GOB }} />
              Resumen Ejecutivo
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopySummary}
              className="h-7 text-xs gap-1"
            >
              {copiedSummary ? (
                <>
                  <Check className="h-3 w-3" style={{ color: IMSS_COLORS.VERDE_IMSS }} />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copiar
                </>
              )}
            </Button>
          </div>
          <div className="space-y-2">
            {packageData.executiveSummary.map((point, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <span 
                  className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: IMSS_COLORS.ROJO_GOB }}
                >
                  {index + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recommended Actions */}
        {packageData.recommendedActions && packageData.recommendedActions.length > 0 && (
          <section>
            <ActionItems actions={packageData.recommendedActions} />
          </section>
        )}

        {/* KPIs */}
        {packageData.kpis.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <BarChart2 className="h-4 w-4" style={{ color: IMSS_COLORS.DORADO_IMSS }} />
              Indicadores Clave
            </h4>
            <KPIDisplay kpis={packageData.kpis} />
          </section>
        )}

        {/* Email Draft */}
        {packageData.emailDraft && (
          <section>
            <EmailDraft email={packageData.emailDraft} />
          </section>
        )}

        {/* Tables */}
        {packageData.tables.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4" style={{ color: IMSS_COLORS.TINTO }} />
              Tablas Comparativas
            </h4>
            <div className="space-y-4">
              {packageData.tables.map((table, index) => (
                <PackageTable key={index} table={table} />
              ))}
            </div>
          </section>
        )}

        {/* Charts */}
        {packageData.charts.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <BarChart2 className="h-4 w-4" style={{ color: IMSS_COLORS.VERDE_IMSS }} />
              Evidencia Visual
            </h4>
            <div className="space-y-4">
              {packageData.charts.map((chart, index) => (
                <ImageViewer
                  key={index}
                  src={chart.src}
                  alt={chart.alt}
                  title={chart.title}
                />
              ))}
            </div>
          </section>
        )}

        {/* Downloads */}
        {packageData.downloads.length > 0 && (
          <section>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Download className="h-4 w-4" style={{ color: IMSS_COLORS.DORADO_IMSS }} />
              Archivos Descargables
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {packageData.downloads.map((download, index) => (
                <FileDownload
                  key={index}
                  href={download.href}
                  filename={download.label}
                >
                  {download.label}
                </FileDownload>
              ))}
            </div>
          </section>
        )}

        {/* Methodology */}
        {packageData.methodologyNotes.length > 0 && (
          <section 
            className="pt-4"
            style={{ borderTop: `1px solid ${IMSS_COLORS.GRIS_TEXTO}30` }}
          >
            <button
              onClick={() => setIsMethodologyExpanded(!isMethodologyExpanded)}
              className="w-full flex items-center justify-between text-sm hover:opacity-80 transition-opacity"
              style={{ color: IMSS_COLORS.GRIS_TEXTO }}
            >
              <span className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: IMSS_COLORS.VERDE_IMSS }} />
                Notas Metodológicas
              </span>
              {isMethodologyExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {isMethodologyExpanded && (
              <div 
                className="mt-3 space-y-1 text-xs animate-in fade-in slide-in-from-top-2"
                style={{ color: IMSS_COLORS.GRIS_TEXTO }}
              >
                {packageData.methodologyNotes.map((note, index) => (
                  <p key={index} className="flex items-start gap-2">
                    <span style={{ color: IMSS_COLORS.VERDE_IMSS }}>•</span>
                    {note}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  )
}

interface PackageTableProps {
  table: TableItem
}

function PackageTable({ table }: PackageTableProps) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: `${IMSS_COLORS.VERDE_IMSS}30` }}>
      {table.title && (
        <div 
          className="px-4 py-2 border-b"
          style={{ 
            backgroundColor: `${IMSS_COLORS.DORADO_IMSS}10`,
            borderBottomColor: `${IMSS_COLORS.DORADO_IMSS}30`
          }}
        >
          <h5 className="text-sm font-medium" style={{ color: IMSS_COLORS.DORADO_IMSS }}>{table.title}</h5>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: IMSS_COLORS.VERDE_IMSS }}>
            <tr>
              {table.headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-2 text-left font-semibold text-white"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {table.rows.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                className="transition-colors"
                style={{ 
                  backgroundColor: rowIndex % 2 === 0 ? 'transparent' : `${IMSS_COLORS.VERDE_IMSS}05`
                }}
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2 text-foreground">
                    {typeof cell === 'number' ? cell.toLocaleString('es-MX') : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.footer && (
        <div 
          className="px-4 py-2 border-t text-xs"
          style={{ 
            backgroundColor: `${IMSS_COLORS.GRIS_TEXTO}10`,
            borderTopColor: `${IMSS_COLORS.GRIS_TEXTO}30`,
            color: IMSS_COLORS.GRIS_TEXTO
          }}
        >
          {table.footer}
        </div>
      )}
    </div>
  )
}

export default PackageCard
