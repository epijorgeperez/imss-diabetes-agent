'use client'

import { useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Loader2, Bot, User } from 'lucide-react'
import type { Message, ToolCall } from '@/types/chat'
import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
  currentTool?: string | null
  streamingContent?: string
}

export function MessageList({
  messages,
  isStreaming = false,
  currentTool = null,
  streamingContent = '',
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent, isStreaming])

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="space-y-6 p-4">
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
            <div className="flex-1 space-y-2">
              {currentTool && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Consultando: {currentTool}</span>
                  </div>
                </div>
              )}
              {streamingContent && (
                <div className="rounded-lg border bg-card p-4">
                  <MarkdownRenderer content={streamingContent} />
                </div>
              )}
              {!streamingContent && !currentTool && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Pensando...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-4', isUser && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8">
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
      <div className={cn('flex-1 space-y-2', isUser && 'text-right')}>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((tool, idx) => (
              <ToolCallItem key={idx} tool={tool} />
            ))}
          </div>
        )}
        <div
          className={cn(
            'rounded-lg border p-4',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-card-foreground'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="space-y-2">
            {message.toolResults.map((result, idx) => (
              <ToolResultItem key={idx} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallItem({ tool }: { tool: ToolCall }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-3">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="font-medium">Ejecutando: {tool.name}</span>
      </div>
    </div>
  )
}

function ToolResultItem({ result }: { result: { name: string; output: string } }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">{result.name}</span> completado
      </div>
    </div>
  )
}

