'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Menu, MessageSquare, Plus, Trash2, Pencil, Check, X, MoreVertical } from 'lucide-react'
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
  const { allSessions, deleteSession, updateSessionTitle } = useChatHistory(chatId)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleNewChat = () => {
    resetChat()
    setMobileOpen(false)
    window.location.reload()
  }

  const handleSelectChat = (sessionChatId: string) => {
    onSelectChat(sessionChatId)
    setMobileOpen(false)
  }

  const handleDeleteChat = (sessionChatId: string) => {
    if (confirm('¿Eliminar esta conversación?')) {
      deleteSession(sessionChatId)
      if (sessionChatId === currentChatId) {
        window.location.reload()
      }
    }
  }

  const handleRenameChat = (sessionChatId: string, newTitle: string) => {
    updateSessionTitle(sessionChatId, newTitle)
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

  const getTitle = (session: ChatSession) => {
    if (session.title) return session.title
    if (session.firstMessage) {
      return session.firstMessage.length > 35
        ? session.firstMessage.substring(0, 35) + '...'
        : session.firstMessage
    }
    return 'Nueva conversación'
  }

  const sidebarContent = (
    <SidebarContent
      allSessions={allSessions}
      currentChatId={currentChatId}
      onSelectChat={handleSelectChat}
      onNewChat={handleNewChat}
      onDeleteChat={handleDeleteChat}
      onRenameChat={handleRenameChat}
      formatDate={formatDate}
      getTitle={getTitle}
    />
  )

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-background border shadow-sm"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Mobile sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-80 bg-background border-r transform transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </div>

      {/* Desktop sidebar - ensure it doesn't block content */}
      <div className="hidden lg:flex w-80 border-r bg-muted/30 flex-col h-full shrink-0">
        {sidebarContent}
      </div>
    </>
  )
}

interface SidebarContentProps {
  allSessions: ChatSession[]
  currentChatId: string | null
  onSelectChat: (chatId: string) => void
  onNewChat: () => void
  onDeleteChat: (chatId: string) => void
  onRenameChat: (chatId: string, newTitle: string) => void
  formatDate: (timestamp: number) => string
  getTitle: (session: ChatSession) => string
}

function SidebarContent({
  allSessions,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  formatDate,
  getTitle,
}: SidebarContentProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.chatId)
    setEditTitle(getTitle(session))
    setMenuOpenId(null)
  }

  const handleSaveEdit = (sessionChatId: string) => {
    if (editTitle.trim()) {
      onRenameChat(sessionChatId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const handleDelete = (chatId: string) => {
    setMenuOpenId(null)
    onDeleteChat(chatId)
  }

  const toggleMenu = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    setMenuOpenId(menuOpenId === chatId ? null : chatId)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4 shrink-0">
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

      {/* Chat list - simple div with overflow-y-auto instead of ScrollArea */}
      <div className="flex-1 overflow-y-auto p-2">
        {allSessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>No hay conversaciones aún</p>
            <p className="mt-2">Crea una nueva para comenzar</p>
          </div>
        ) : (
          <div className="space-y-1">
            {allSessions.map((session) => (
              <div
                key={session.chatId}
                onClick={() => editingId !== session.chatId && onSelectChat(session.chatId)}
                className={cn(
                  'rounded-lg p-2 transition-colors cursor-pointer',
                  currentChatId === session.chatId && 'bg-accent',
                  editingId !== session.chatId && 'hover:bg-accent'
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Simple avatar - no Radix */}
                  <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">
                    {(session.title || session.firstMessage)?.[0]?.toUpperCase() || 'N'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {editingId === session.chatId ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(session.chatId)
                            else if (e.key === 'Escape') handleCancelEdit()
                          }}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSaveEdit(session.chatId) }}
                          className="p-1 rounded hover:bg-green-100"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelEdit() }}
                          className="p-1 rounded hover:bg-red-100"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="truncate text-sm font-medium leading-tight">
                          {getTitle(session)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(session.updatedAt)}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Menu button */}
                  {editingId !== session.chatId && (
                    <div className="relative shrink-0" ref={menuOpenId === session.chatId ? menuRef : undefined}>
                      <button
                        onClick={(e) => toggleMenu(e, session.chatId)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      
                      {menuOpenId === session.chatId && (
                        <div 
                          className="absolute right-0 top-full mt-1 w-40 rounded-md border bg-popover p-1 shadow-lg z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleStartEdit(session)}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar nombre
                          </button>
                          <button
                            onClick={() => handleDelete(session.chatId)}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
