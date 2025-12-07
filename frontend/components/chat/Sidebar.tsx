'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Menu, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useChatHistory } from '@/hooks/useChatHistory'
import { useChatId } from '@/hooks/useChatId'
import type { ChatSession } from '@/types/chat'
import { cn } from '@/lib/utils'

interface SidebarProps {
  onSelectChat: (chatId: string) => void
  currentChatId: string | null
}

export function Sidebar({ onSelectChat, currentChatId }: SidebarProps) {
  const { chatId, resetChat } = useChatId()
  const { allSessions, deleteSession } = useChatHistory(chatId)
  const [isOpen, setIsOpen] = useState(false)

  const handleNewChat = () => {
    resetChat()
    setIsOpen(false)
    // Trigger a page refresh or state update to load new chat
    window.location.reload()
  }

  const handleSelectChat = (sessionChatId: string) => {
    onSelectChat(sessionChatId)
    setIsOpen(false)
  }

  const handleDeleteChat = (e: React.MouseEvent, sessionChatId: string) => {
    e.stopPropagation()
    if (confirm('¿Eliminar esta conversación?')) {
      deleteSession(sessionChatId)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `Hace ${diffMins} min`
    if (diffHours < 24) return `Hace ${diffHours} h`
    if (diffDays < 7) return `Hace ${diffDays} días`
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  const getPreview = (session: ChatSession) => {
    if (session.firstMessage) {
      return session.firstMessage.length > 50
        ? session.firstMessage.substring(0, 50) + '...'
        : session.firstMessage
    }
    return 'Nueva conversación'
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SidebarContent
            allSessions={allSessions}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            formatDate={formatDate}
            getPreview={getPreview}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden w-80 border-r bg-muted/30 lg:block">
        <SidebarContent
          allSessions={allSessions}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          formatDate={formatDate}
          getPreview={getPreview}
        />
      </div>
    </>
  )
}

interface SidebarContentProps {
  allSessions: ChatSession[]
  currentChatId: string | null
  onSelectChat: (chatId: string) => void
  onNewChat: () => void
  onDeleteChat: (e: React.MouseEvent, chatId: string) => void
  formatDate: (timestamp: number) => string
  getPreview: (session: ChatSession) => string
}

function SidebarContent({
  allSessions,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  formatDate,
  getPreview,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Conversaciones</h2>
            <p className="text-xs text-muted-foreground">
              {allSessions.length} {allSessions.length === 1 ? 'conversación' : 'conversaciones'}
            </p>
          </div>
        </div>
        <Button onClick={onNewChat} className="w-full" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Conversación
        </Button>
      </div>

      {/* Chat list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {allSessions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>No hay conversaciones aún</p>
              <p className="mt-2">Crea una nueva para comenzar</p>
            </div>
          ) : (
            <div className="space-y-1">
              {allSessions.map((session) => (
                <button
                  key={session.chatId}
                  onClick={() => onSelectChat(session.chatId)}
                  className={cn(
                    'group relative w-full rounded-lg p-3 text-left transition-colors hover:bg-accent',
                    currentChatId === session.chatId && 'bg-accent'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {session.firstMessage?.[0]?.toUpperCase() || 'N'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {getPreview(session)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(session.updatedAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => onDeleteChat(e, session.chatId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

