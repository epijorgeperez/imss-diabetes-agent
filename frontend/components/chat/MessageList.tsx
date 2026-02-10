'use client'

import { useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownRenderer } from './MarkdownRenderer'
import { PackageCard } from '@/components/packages'
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
    <div className="w-full relative" ref={scrollRef}>
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
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2 min-w-0">
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
                    <span>🔧 Ejecutando: {currentTool}</span>
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

  // If message has packageData, render PackageCard instead of regular message
  if (message.packageData) {
    return (
      <div className="flex gap-4 relative z-0">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-2 mb-4">
              {message.toolCalls.map((tool, idx) => (
                <ToolCallItem key={idx} tool={tool} />
              ))}
            </div>
          )}
          {message.toolResults && message.toolResults.length > 0 && (
            <div className="space-y-2 mb-4">
              {message.toolResults.map((result, idx) => (
                <ToolResultItem key={idx} result={result} />
              ))}
            </div>
          )}
          <PackageCard packageData={message.packageData} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-4 relative z-0', isUser && 'flex-row-reverse')}>
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
            'rounded-lg border p-4 relative group z-0',
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

/**
 * Detect the language of a tool argument value for syntax highlighting.
 * Returns 'sql', 'python', 'json', or null for plain text.
 */
function detectArgLanguage(key: string, value: string): 'sql' | 'python' | 'json' | null {
  const lowerKey = key.toLowerCase()
  
  // SQL detection
  const sqlKeys = ['sql_query', 'query', 'sql']
  if (sqlKeys.includes(lowerKey)) return 'sql'
  const trimmedUpper = value.trim().toUpperCase()
  if (/^(SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/.test(trimmedUpper)) return 'sql'
  
  // Python/code detection
  const codeKeys = ['code', 'python_code', 'script', 'python', 'python_script']
  if (codeKeys.includes(lowerKey)) return 'python'
  // Heuristic: if it has import statements or def/class keywords, it's Python
  const trimmed = value.trim()
  if (/^(import |from |def |class |print\(|#\s)/.test(trimmed)) return 'python'
  
  // JSON detection (for string values that look like JSON)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // not JSON
    }
  }
  
  return null
}

function ToolCallItem({ tool, isExecuting = false }: { tool: ToolCall; isExecuting?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const hasArgs = tool.arguments && Object.keys(tool.arguments).length > 0

  const handleCopyValue = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Parse arguments into renderable entries
  const entries = hasArgs
    ? Object.entries(tool.arguments as Record<string, unknown>)
    : []

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
          <span className="font-medium text-muted-foreground">🔧 Ejecutando: {tool.name}</span>
        </div>
      </button>
      {isExpanded && hasArgs && (
        <div className="border-t border-border bg-background/50 px-3 py-3 space-y-3">
          {entries.map(([key, value]) => {
            const strValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
            const lang = typeof value === 'string' 
              ? detectArgLanguage(key, value) 
              : (typeof value === 'object' ? 'json' : null)

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {key}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleCopyValue(key, strValue)}
                  >
                    {copiedKey === key ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {lang ? (
                  <div className="rounded-md overflow-x-auto overflow-y-auto max-h-[500px] border border-border/50">
                    <SyntaxHighlighter
                      language={lang}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: '0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.375rem',
                      }}
                      wrapLongLines={true}
                      showLineNumbers={lang !== 'json'}
                    >
                      {strValue}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <div className="rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
                    {strValue}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ToolResultItem({ result }: { result: { name: string; output: unknown } }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Safely convert output to string
  const outputString = (() => {
    if (typeof result.output === 'string') return result.output
    if (typeof result.output === 'object' && result.output !== null) {
      return JSON.stringify(result.output, null, 2)
    }
    if (result.output !== undefined && result.output !== null) {
      return String(result.output)
    }
    return ''
  })()
  
  const hasOutput = outputString.trim().length > 0

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

  const language = hasOutput ? detectLanguage(outputString) : 'text'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(outputString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="font-medium">✅ {result.name}</span>
          <span className="text-xs">completado</span>
        </div>
      </button>
      {isExpanded && hasOutput && (
        <div className="border-t border-border bg-background/50">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="text-xs font-medium text-muted-foreground">Resultado:</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1 text-green-600" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar
                </>
              )}
            </Button>
          </div>
          <div className="px-3 pb-3">
            {language === 'sql' || language === 'json' ? (
              <div className="rounded overflow-x-auto overflow-y-auto max-h-[600px] border border-border/50">
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '0.75rem',
                    fontSize: '0.75rem',
                    borderRadius: '0.375rem',
                    minWidth: 'max-content',
                  }}
                  wrapLongLines={false}
                  showLineNumbers={true}
                >
                  {outputString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <div className="rounded bg-muted/50 p-3 text-xs font-mono overflow-x-auto overflow-y-auto max-h-[600px] border border-border/50">
                <pre className="whitespace-pre">{outputString}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

