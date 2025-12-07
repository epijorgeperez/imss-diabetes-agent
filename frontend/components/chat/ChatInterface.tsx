'use client'

import { useState, useEffect, useCallback } from 'react'
import { useChatId } from '@/hooks/useChatId'
import { useChatHistory } from '@/hooks/useChatHistory'
import { useAgencyStream } from '@/hooks/useAgencyStream'
import { Sidebar } from './Sidebar'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { useToast } from '@/components/ui/use-toast'
import { generateId } from '@/lib/utils'
import type { Message } from '@/types/chat'

export function ChatInterface() {
  const { chatId, isReady } = useChatId()
  const {
    currentSession,
    saveSession,
    addMessage,
    loadSession,
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
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])

  // Load messages from current session
  useEffect(() => {
    if (currentSession) {
      setMessages(currentSession.messages)
    } else {
      setMessages([])
    }
  }, [currentSession])

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
        await stream(content, chatId)
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
    [chatId, isReady, addMessage, stream, resetStream]
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

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onSelectChat={handleSelectChat} currentChatId={chatId} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            currentTool={currentTool}
            streamingContent={isStreaming ? fullMessage : undefined}
          />
          <MessageInput
            onSend={handleSendMessage}
            disabled={isStreaming || !isReady}
          />
        </div>
      </div>
    </div>
  )
}
