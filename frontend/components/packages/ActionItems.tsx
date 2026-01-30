'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ActionItem } from '@/types/package'
import {
  Target,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  User
} from 'lucide-react'

// IMSS Institutional Colors
const IMSS_COLORS = {
  VERDE_IMSS: '#00594C',
  ROJO_GOB: '#9B2242',
  DORADO_IMSS: '#AD841F',
  TINTO: '#651D32',
  NEGRO: '#222223',
  GRIS_TEXTO: '#B1B3B3',
}

interface ActionItemsProps {
  actions: ActionItem[]
  className?: string
}

// Using IMSS institutional colors for priorities
const PRIORITY_STYLES = {
  alta: {
    badgeBg: `${IMSS_COLORS.ROJO_GOB}20`,
    badgeColor: IMSS_COLORS.ROJO_GOB,
    borderColor: IMSS_COLORS.ROJO_GOB,
    bg: `${IMSS_COLORS.ROJO_GOB}08`
  },
  media: {
    badgeBg: `${IMSS_COLORS.DORADO_IMSS}20`,
    badgeColor: IMSS_COLORS.DORADO_IMSS,
    borderColor: IMSS_COLORS.DORADO_IMSS,
    bg: `${IMSS_COLORS.DORADO_IMSS}08`
  },
  baja: {
    badgeBg: `${IMSS_COLORS.VERDE_IMSS}20`,
    badgeColor: IMSS_COLORS.VERDE_IMSS,
    borderColor: IMSS_COLORS.VERDE_IMSS,
    bg: `${IMSS_COLORS.VERDE_IMSS}08`
  }
}

const PRIORITY_LABELS = {
  alta: 'ALTA',
  media: 'MEDIA',
  baja: 'BAJA'
}

export function ActionItems({ actions, className }: ActionItemsProps) {
  const [copiedActions, setCopiedActions] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const handleCopyActions = async () => {
    const actionsText = actions
      .map((action, i) => {
        return `[${PRIORITY_LABELS[action.priority]}] ${action.action}\n  → Responsable: ${action.owner} | Fecha límite: ${action.deadline}\n  → Justificación: ${action.rationale}`
      })
      .join('\n\n')
    
    await navigator.clipboard.writeText(actionsText)
    setCopiedActions(true)
    setTimeout(() => setCopiedActions(false), 2000)
  }

  if (!actions || actions.length === 0) {
    return null
  }

  // Sort by priority: alta first, then media, then baja
  const sortedActions = [...actions].sort((a, b) => {
    const priorityOrder = { alta: 0, media: 1, baja: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-[#9B2242]/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-[#9B2242]" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-sm">
              Acciones Recomendadas
            </h4>
            <p className="text-xs text-muted-foreground">
              {actions.length} acción{actions.length !== 1 ? 'es' : ''} basada{actions.length !== 1 ? 's' : ''} en los hallazgos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleCopyActions()
            }}
            className="gap-1.5 text-xs h-8"
          >
            {copiedActions ? (
              <>
                <Check className="h-3 w-3" style={{ color: IMSS_COLORS.VERDE_IMSS }} />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copiar acciones
              </>
            )}
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t p-4 space-y-3">
          {sortedActions.map((action, index) => (
            <ActionCard key={index} action={action} />
          ))}
        </div>
      )}
    </div>
  )
}

interface ActionCardProps {
  action: ActionItem
}

function ActionCard({ action }: ActionCardProps) {
  const styles = PRIORITY_STYLES[action.priority]
  
  return (
    <div
      className="rounded-lg border-l-4 p-4 transition-colors hover:shadow-sm"
      style={{
        borderLeftColor: styles.borderColor,
        backgroundColor: styles.bg
      }}
    >
      {/* Priority Badge and Action */}
      <div className="flex items-start gap-3 mb-2">
        <span
          className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-bold uppercase"
          style={{
            backgroundColor: styles.badgeBg,
            color: styles.badgeColor
          }}
        >
          {PRIORITY_LABELS[action.priority]}
        </span>
        <p className="text-sm font-medium text-foreground leading-tight">
          {action.action}
        </p>
      </div>

      {/* Meta Info */}
      <div className="flex flex-wrap gap-4 text-xs mb-2 ml-[52px]" style={{ color: IMSS_COLORS.GRIS_TEXTO }}>
        <span className="inline-flex items-center gap-1">
          <User className="h-3 w-3" />
          {action.owner}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {action.deadline}
        </span>
      </div>

      {/* Rationale */}
      <div 
        className="ml-[52px] flex items-start gap-2 text-xs"
        style={{ color: IMSS_COLORS.GRIS_TEXTO }}
      >
        <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: IMSS_COLORS.DORADO_IMSS }} />
        <span className="italic">{action.rationale}</span>
      </div>
    </div>
  )
}

export default ActionItems
