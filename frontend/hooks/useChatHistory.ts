'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ChatSession, Message } from '@/types/chat'

const STORAGE_KEY = 'imss_diabetes_chat_sessions'

export function useChatHistory(chatId: string | null) {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [allSessions, setAllSessions] = useState<ChatSession[]>([])

  // Load all sessions from localStorage
  const loadSessions = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const sessions = JSON.parse(stored) as ChatSession[]
        // Remove duplicates by chatId
        const uniqueSessions = sessions.reduce((acc, session) => {
          if (!acc.find(s => s.chatId === session.chatId)) {
            acc.push(session)
          }
          return acc
        }, [] as ChatSession[])
        setAllSessions(uniqueSessions.sort((a, b) => b.updatedAt - a.updatedAt))
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    }
  }, [])

  // Load current session
  useEffect(() => {
    if (!chatId) {
      setCurrentSession(null)
      return
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const sessions = JSON.parse(stored) as ChatSession[]
        const session = sessions.find((s) => s.chatId === chatId)
        if (session) {
          setCurrentSession(session)
        } else {
          // Create new session
          const newSession: ChatSession = {
            chatId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            firstMessage: '',
            messages: [],
          }
          setCurrentSession(newSession)
        }
      } else {
        // First session ever
        const newSession: ChatSession = {
          chatId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          firstMessage: '',
          messages: [],
        }
        setCurrentSession(newSession)
      }
    } catch (error) {
      console.error('Failed to load current session:', error)
    }
  }, [chatId])

  // Load all sessions on mount
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Save session to localStorage
  const saveSession = useCallback(
    (messages: Message[], firstMessage?: string) => {
      if (!chatId || !currentSession) return

      const updatedSession: ChatSession = {
        ...currentSession,
        messages,
        updatedAt: Date.now(),
        firstMessage: firstMessage || currentSession.firstMessage || messages[0]?.content || '',
      }

      setCurrentSession(updatedSession)

      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        const sessions: ChatSession[] = stored ? JSON.parse(stored) : []
        
        const existingIndex = sessions.findIndex((s) => s.chatId === chatId)
        if (existingIndex >= 0) {
          sessions[existingIndex] = updatedSession
        } else {
          sessions.push(updatedSession)
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
        loadSessions()
      } catch (error) {
        console.error('Failed to save session:', error)
      }
    },
    [chatId, currentSession, loadSessions]
  )

  // Add a message to current session
  const addMessage = useCallback(
    (message: Message) => {
      if (!currentSession) return

      const updatedMessages = [...currentSession.messages, message]
      const firstMessage = currentSession.firstMessage || message.content
      saveSession(updatedMessages, firstMessage)
    },
    [currentSession, saveSession]
  )

  // Load a specific session
  const loadSession = useCallback(
    (targetChatId: string) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const sessions = JSON.parse(stored) as ChatSession[]
          const session = sessions.find((s) => s.chatId === targetChatId)
          if (session) {
            setCurrentSession(session)
            return session
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      }
      return null
    },
    []
  )

  // Delete a session
  const deleteSession = useCallback(
    (targetChatId: string) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const sessions = JSON.parse(stored) as ChatSession[]
          const filtered = sessions.filter((s) => s.chatId !== targetChatId)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
          loadSessions()

          // If deleting current session, clear it
          if (targetChatId === chatId) {
            setCurrentSession(null)
          }
        }
      } catch (error) {
        console.error('Failed to delete session:', error)
      }
    },
    [chatId, loadSessions]
  )

  // Update session title
  const updateSessionTitle = useCallback(
    (targetChatId: string, newTitle: string) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const sessions = JSON.parse(stored) as ChatSession[]
          const sessionIndex = sessions.findIndex((s) => s.chatId === targetChatId)
          if (sessionIndex >= 0) {
            sessions[sessionIndex] = {
              ...sessions[sessionIndex],
              title: newTitle,
              updatedAt: Date.now(),
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
            loadSessions()

            // If updating current session, update it
            if (targetChatId === chatId) {
              setCurrentSession(sessions[sessionIndex])
            }
          }
        }
      } catch (error) {
        console.error('Failed to update session title:', error)
      }
    },
    [chatId, loadSessions]
  )

  return {
    currentSession,
    allSessions,
    saveSession,
    addMessage,
    loadSession,
    deleteSession,
    updateSessionTitle,
    refreshSessions: loadSessions,
  }
}

