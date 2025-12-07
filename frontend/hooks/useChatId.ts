'use client'

import { useState, useEffect, useCallback } from 'react'

export function useChatId() {
  const [chatId, setChatId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('imss_diabetes_chat_id')
    if (saved) {
      setChatId(saved)
    } else {
      const newId = crypto.randomUUID()
      setChatId(newId)
      localStorage.setItem('imss_diabetes_chat_id', newId)
    }
    setIsReady(true)
  }, [])

  const resetChat = useCallback(() => {
    const newId = crypto.randomUUID()
    setChatId(newId)
    localStorage.setItem('imss_diabetes_chat_id', newId)
  }, [])

  return { chatId, resetChat, isReady }
}

