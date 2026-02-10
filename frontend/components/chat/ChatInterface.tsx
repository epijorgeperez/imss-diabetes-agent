'use client'

import { useState, useEffect, useCallback } from 'react'
import { useChatId } from '@/hooks/useChatId'
import { useChatHistory } from '@/hooks/useChatHistory'
import { useAgencyStream } from '@/hooks/useAgencyStream'
import { Sidebar } from './Sidebar'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { ModeToggle, type AppMode } from './ModeToggle'
import { StudioPanel } from '@/components/studio'
import { TemplateLibrary, TemplateConfigPanel } from '@/components/templates'
import { useToast } from '@/components/ui/use-toast'
import { generateId } from '@/lib/utils'
import type { Message } from '@/types/chat'
import type { Template, PackageParams } from '@/types/package'
import { usePackageGenerator } from '@/hooks/usePackageGenerator'

type ViewMode = 'templates' | 'config' | 'exploration' | 'chat'

interface ChatInterfaceProps {
  userEmail: string
}

export function ChatInterface({ userEmail }: ChatInterfaceProps) {
  const { chatId, isReady } = useChatId()
  const {
    currentSession,
    saveSession,
    addMessage,
    loadSession,
    updateSessionTitle,
  } = useChatHistory(chatId)
  const {
    stream,
    isStreaming,
    currentTool,
    fullMessage,
    toolCalls,
    toolResults,
    error,
    isComplete,
    reset: resetStream,
  } = useAgencyStream()
  const { generatePackage, isGenerating } = usePackageGenerator()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [appMode, setAppMode] = useState<AppMode>('packages')
  const [viewMode, setViewMode] = useState<ViewMode>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Load messages from current session
  useEffect(() => {
    if (currentSession) {
      setMessages(currentSession.messages)
      // If there are existing messages, go to chat view
      if (currentSession.messages.length > 0) {
        setViewMode('chat')
      }
    } else {
      setMessages([])
      // Reset to appropriate view based on app mode
      setViewMode(appMode === 'packages' ? 'templates' : 'exploration')
    }
  }, [currentSession, appMode])

  // Handle app mode change
  const handleModeChange = useCallback((newMode: AppMode) => {
    setAppMode(newMode)
    setSelectedTemplate(null)
    // Only change view if not in chat mode with messages
    if (messages.length === 0 && !isStreaming) {
      setViewMode(newMode === 'packages' ? 'templates' : 'exploration')
    }
  }, [messages.length, isStreaming])

  // Handle stream completion - update assistant message when complete
  useEffect(() => {
    if (isComplete && fullMessage) {
      console.log('[ChatInterface] Stream complete, updating message:', {
        fullMessageLength: fullMessage.length,
        messagesCount: messages.length,
        toolCalls: toolCalls.length,
        toolResults: toolResults.length,
      })
      
      setMessages((prevMessages) => {
        if (prevMessages.length > 0) {
          const lastMessage = prevMessages[prevMessages.length - 1]
          if (lastMessage.role === 'assistant') {
            const updated = [...prevMessages]
            updated[updated.length - 1] = {
              ...lastMessage,
              content: fullMessage,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              toolResults: toolResults.length > 0 ? toolResults : undefined,
            }
            return updated
          } else {
            // No assistant message yet, create one
            const assistantMessage: Message = {
              id: generateId(),
              role: 'assistant',
              content: fullMessage,
              timestamp: Date.now(),
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              toolResults: toolResults.length > 0 ? toolResults : undefined,
            }
            return [...prevMessages, assistantMessage]
          }
        } else {
          // No messages at all, create assistant message
          const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: fullMessage,
            timestamp: Date.now(),
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            toolResults: toolResults.length > 0 ? toolResults : undefined,
          }
          return [assistantMessage]
        }
      })
      
      // Save to session after state update
      setTimeout(() => {
        setMessages((currentMessages) => {
          saveSession(currentMessages)
          return currentMessages
        })
      }, 0)
    }
  }, [isComplete, fullMessage, toolCalls, toolResults, saveSession])

  // Handle streaming updates - update message as chunks arrive
  useEffect(() => {
    if (isStreaming && fullMessage) {
      setMessages((prevMessages) => {
        if (prevMessages.length > 0) {
          const lastMessage = prevMessages[prevMessages.length - 1]
          if (lastMessage.role === 'assistant') {
            // Update existing assistant message
            const updated = [...prevMessages]
            updated[updated.length - 1] = {
              ...lastMessage,
              content: fullMessage,
            }
            return updated
          } else {
            // Create new assistant message if user message exists but no assistant yet
            const assistantMessage: Message = {
              id: generateId(),
              role: 'assistant',
              content: fullMessage,
              timestamp: Date.now(),
            }
            return [...prevMessages, assistantMessage]
          }
        } else {
          // No messages yet, create assistant message
          const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: fullMessage,
            timestamp: Date.now(),
          }
          return [assistantMessage]
        }
      })
    }
  }, [isStreaming, fullMessage])

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }, [error, toast])

  // Handle new agent activation
  useEffect(() => {
    if (currentTool === 'Agent Activated') {
      toast({
        title: 'Agente Activado',
        description: 'El agente está procesando tu solicitud',
      })
    }
  }, [currentTool, toast])

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!chatId || !isReady) return

      // Switch to chat view
      setViewMode('chat')

      // Add user message
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMessage])
      addMessage(userMessage)

      // Reset stream state before starting
      resetStream()

      try {
        // Start streaming
        console.log('[ChatInterface] Starting stream for message:', content.substring(0, 50))
        await stream(content, chatId, userEmail)
        console.log('[ChatInterface] Stream completed')
      } catch (err) {
        console.error('[ChatInterface] Stream error:', err)
        // Update with error message
        setMessages((prev) => {
          const errorMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            timestamp: Date.now(),
          }
          return [...prev, errorMessage]
        })
      }
    },
    [chatId, isReady, addMessage, stream, resetStream, userEmail]
  )

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template)
    setViewMode('config')
  }, [])

  const handleBackToTemplates = useCallback(() => {
    setSelectedTemplate(null)
    setViewMode('templates')
  }, [])

  const handleGeneratePackage = useCallback(
    async (params: PackageParams) => {
      if (!chatId || !isReady || !selectedTemplate) return

      // Switch to chat view
      setViewMode('chat')

      // Add user message indicating package generation
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: `Generar paquete: ${selectedTemplate.name}\n\nParámetros:\n- Indicadores: ${params.indicators.join(', ')}\n- Ámbito: ${params.geographic.levels.join(', ')}\n- Periodo: ${params.periodStart}-${params.periodEnd}\n- Granularidad: ${params.granularity}`,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMessage])
      addMessage(userMessage)

      try {
        toast({
          title: 'Generando paquete...',
          description: 'Esto puede tomar unos segundos',
        })

        const packagePayload = await generatePackage(params, chatId, userEmail)

        if (packagePayload) {
          // Create assistant message with package data
          const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: `Paquete generado exitosamente: ${packagePayload.title}`,
            timestamp: Date.now(),
            packageData: packagePayload,
          }

          setMessages((prev) => [...prev, assistantMessage])
          addMessage(assistantMessage)
          
          // Update session title with package name
          if (chatId) {
            updateSessionTitle(chatId, packagePayload.title)
          }

          toast({
            title: 'Paquete generado',
            description: 'El paquete directivo está listo',
          })
        }
      } catch (err) {
        console.error('[ChatInterface] Package generation error:', err)
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Error al generar paquete: ${err instanceof Error ? err.message : 'Error desconocido'}`,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    },
    [chatId, isReady, selectedTemplate, addMessage, generatePackage, toast, updateSessionTitle, userEmail]
  )

  const handleSelectChat = useCallback(
    (targetChatId: string) => {
      const session = loadSession(targetChatId)
      if (session) {
        setMessages(session.messages)
        // Update chatId in localStorage
        localStorage.setItem('imss_diabetes_chat_id', targetChatId)
        window.location.reload()
      }
    },
    [loadSession]
  )

  // Handle returning to initial view
  const handleReturnToInitialView = useCallback(() => {
    setViewMode(appMode === 'packages' ? 'templates' : 'exploration')
  }, [appMode])

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }


  // Determine what content to show in main area
  const renderMainContent = () => {
    // Show view based on mode
    switch (viewMode) {
      case 'chat':
        return (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            currentTool={currentTool}
            streamingContent={isStreaming ? fullMessage : undefined}
            streamingToolCalls={isStreaming ? toolCalls : undefined}
            streamingToolResults={isStreaming ? toolResults : undefined}
          />
        )
      case 'templates':
        return (
          <TemplateLibrary
            onSelectTemplate={handleSelectTemplate}
          />
        )
      case 'config':
        if (selectedTemplate) {
          return (
            <TemplateConfigPanel
              template={selectedTemplate}
              onBack={handleBackToTemplates}
              onGeneratePackage={handleGeneratePackage}
              onExploreChat={(prompt) => handleSendMessage(prompt)}
              isGenerating={isGenerating}
            />
          )
        }
        return null
      case 'exploration':
        return (
          <StudioPanel
            onSubmit={handleSendMessage}
            disabled={isStreaming || !isReady}
          />
        )
      default:
        return (
          <TemplateLibrary
            onSelectTemplate={handleSelectTemplate}
          />
        )
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar onSelectChat={handleSelectChat} currentChatId={chatId} />
      <div className="flex flex-1 flex-col overflow-hidden relative z-0">
        {/* Mode Toggle Header - always show except in config */}
        {viewMode !== 'config' && (
          <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
            <div className="flex items-center justify-center gap-4">
              {/* Back button when in chat */}
              {viewMode === 'chat' && (
                <button
                  onClick={handleReturnToInitialView}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                  Volver
                </button>
              )}
              <ModeToggle
                mode={appMode}
                onModeChange={handleModeChange}
                disabled={isStreaming || isGenerating}
              />
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto">
          {renderMainContent()}
        </div>
        <MessageInput
          onSend={handleSendMessage}
          disabled={isStreaming || !isReady || isGenerating}
        />
      </div>
    </div>
  )
}
