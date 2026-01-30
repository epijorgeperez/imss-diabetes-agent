'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { EmailDraft as EmailDraftType } from '@/types/package'
import { Mail, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

// IMSS Institutional Colors
const IMSS_COLORS = {
  VERDE_IMSS: '#00594C',
  ROJO_GOB: '#9B2242',
  DORADO_IMSS: '#AD841F',
  TINTO: '#651D32',
  NEGRO: '#222223',
  GRIS_TEXTO: '#B1B3B3',
}

interface EmailDraftProps {
  email: EmailDraftType
  className?: string
}

export function EmailDraft({ email, className }: EmailDraftProps) {
  const [copiedSubject, setCopiedSubject] = useState(false)
  const [copiedBody, setCopiedBody] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const handleCopySubject = async () => {
    await navigator.clipboard.writeText(email.subject)
    setCopiedSubject(true)
    setTimeout(() => setCopiedSubject(false), 2000)
  }

  const handleCopyBody = async () => {
    await navigator.clipboard.writeText(email.body)
    setCopiedBody(true)
    setTimeout(() => setCopiedBody(false), 2000)
  }

  const handleCopyAll = async () => {
    const fullEmail = `Asunto: ${email.subject}\n\n${email.body}`
    await navigator.clipboard.writeText(fullEmail)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div 
            className="flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${IMSS_COLORS.TINTO}15` }}
          >
            <Mail className="h-4 w-4" style={{ color: IMSS_COLORS.TINTO }} />
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-sm">Borrador de Correo</h4>
            <p className="text-xs" style={{ color: IMSS_COLORS.GRIS_TEXTO }}>Listo para copiar y enviar</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleCopyAll()
            }}
            className="gap-1.5 text-xs h-8"
          >
            {copiedAll ? (
              <>
                <Check className="h-3 w-3" style={{ color: IMSS_COLORS.VERDE_IMSS }} />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copiar todo
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
        <div className="border-t p-4 space-y-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Asunto
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySubject}
                className="h-6 px-2 text-xs"
              >
                {copiedSubject ? (
                  <Check className="h-3 w-3" style={{ color: IMSS_COLORS.VERDE_IMSS }} />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
              {email.subject}
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Cuerpo del correo
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyBody}
                className="h-6 px-2 text-xs"
              >
                {copiedBody ? (
                  <Check className="h-3 w-3" style={{ color: IMSS_COLORS.VERDE_IMSS }} />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
              {email.body}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmailDraft
