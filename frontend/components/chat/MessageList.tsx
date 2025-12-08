'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Loader2, Bot, User, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import type { Message, ToolCall } from '@/types/chat'
import { cn } from '@/lib/utils'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
  currentTool?: string | null
  streamingContent?: string
  streamingToolCalls?: ToolCall[]
  streamingToolResults?: { name: string; output: string }[]
}

export function MessageList({
  messages,
  isStreaming = false,
  currentTool = null,
  streamingContent = '',
  streamingToolCalls = [],
  streamingToolResults = [],
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent, isStreaming])

  return (
    <div className="w-full" ref={scrollRef}>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">
              Agente Analítico de Diabetes IMSS
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Haz una pregunta sobre datos de diabetes en el IMSS. Puedo ayudarte
              con análisis, consultas a la base de datos y visualizaciones.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {isStreaming && (
          <div className="flex gap-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2 min-w-0 overflow-hidden">
              {streamingToolCalls && streamingToolCalls.length > 0 && (
                <div className="space-y-2">
                  {streamingToolCalls.map((tool, idx) => {
                    // Check if this tool is currently executing (no result yet)
                    const isCurrentlyExecuting = currentTool === tool.name && 
                      !streamingToolResults?.some(r => r.name === tool.name)
                    return (
                      <ToolCallItem key={idx} tool={tool} isExecuting={isCurrentlyExecuting} />
                    )
                  })}
                </div>
              )}
              {currentTool && !streamingToolCalls?.some(t => t.name === currentTool) && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>C Ejecutando: {currentTool}</span>
                  </div>
                </div>
              )}
              {streamingToolResults && streamingToolResults.length > 0 && (
                <div className="space-y-2">
                  {streamingToolResults.map((result, idx) => (
                    <ToolResultItem key={idx} result={result} />
                  ))}
                </div>
              )}
              {streamingContent && (
                <div className="rounded-lg border bg-card p-4">
                  <MarkdownRenderer content={streamingContent} />
                </div>
              )}
              {!streamingContent && !currentTool && streamingToolCalls?.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Pensando...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn('flex gap-4', isUser && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback
          className={cn(
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className={cn('flex-1 space-y-2 min-w-0', isUser && 'text-right')}>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((tool, idx) => (
              <ToolCallItem key={idx} tool={tool} />
            ))}
          </div>
        )}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="space-y-2">
            {message.toolResults.map((result, idx) => (
              <ToolResultItem key={idx} result={result} />
            ))}
          </div>
        )}
        <div
          className={cn(
            'rounded-lg border p-4 relative group',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-card-foreground'
          )}
        >
          {!isUser && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </div>
  )
}

function ToolCallItem({ tool, isExecuting = false }: { tool: ToolCall; isExecuting?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasArgs = tool.arguments && Object.keys(tool.arguments).length > 0

  return (
    <div className="rounded-lg border bg-muted/50 overflow-hidden">
      <button
        onClick={() => hasArgs && setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-3 text-left transition-colors",
          hasArgs ? "hover:bg-muted/70 cursor-pointer" : "cursor-default"
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
          ) : isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="font-medium text-muted-foreground">C Ejecutando: {tool.name}</span>
        </div>
      </button>
      {isExpanded && hasArgs && (
        <div className="border-t border-border p-3 bg-background/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">Argumentos:</div>
          <div className="rounded overflow-auto max-h-96">
            <SyntaxHighlighter
              language="json"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: '0.75rem',
                fontSize: '0.75rem',
                borderRadius: '0.375rem',
              }}
              wrapLongLines={true}
            >
              {JSON.stringify(tool.arguments, null, 2)}
            </SyntaxHighlighter>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolResultItem({ result }: { result: { name: string; output: string } }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasOutput = result.output && result.output.trim().length > 0

  // Detect if output is SQL, JSON, or plain text
  const detectLanguage = (text: string): string => {
    const trimmed = text.trim()
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
      return 'sql'
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed)
        return 'json'
      } catch {
        return 'text'
      }
    }
    return 'text'
  }

  const language = hasOutput ? detectLanguage(result.output) : 'text'

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
          )}
          <span className="font-medium">{result.name}</span>
          <span>completado</span>
        </div>
      </button>
      {isExpanded && hasOutput && (
        <div className="border-t border-border p-3 bg-background/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">Resultado:</div>
          {language === 'sql' || language === 'json' ? (
            <div className="rounded overflow-auto max-h-96">
              <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.375rem',
                }}
                wrapLongLines={true}
              >
                {result.output}
              </SyntaxHighlighter>
            </div>
          ) : (
            <div className="rounded bg-muted/50 p-3 text-xs font-mono whitespace-pre-wrap break-words overflow-auto max-h-96">
              {result.output}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

