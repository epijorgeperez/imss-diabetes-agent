'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/types/user'
import { API_CONFIG } from '@/lib/api-client'

const STORAGE_KEY = 'imss_diabetes_user'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setUser(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load user from localStorage:', error)
    }
    setIsLoading(false)
  }, [])

  const register = useCallback(
    async (nombre: string, email: string, adscripcion: string): Promise<User> => {
      const response = await fetch(`${API_CONFIG.baseURL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, adscripcion }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: 'Error de conexión' }))
        throw new Error(data.detail || `Error ${response.status}`)
      }

      const data = await response.json()
      const newUser: User = {
        nombre: data.user.nombre,
        email: data.user.email,
        adscripcion: data.user.adscripcion,
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
      setUser(newUser)
      return newUser
    },
    []
  )

  const login = useCallback(async (email: string): Promise<User> => {
    const response = await fetch(`${API_CONFIG.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({ detail: 'Error de conexión' }))
      throw new Error(data.detail || `Error ${response.status}`)
    }

    const data = await response.json()
    const loggedInUser: User = {
      nombre: data.user.nombre,
      email: data.user.email,
      adscripcion: data.user.adscripcion,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser))
    setUser(loggedInUser)
    return loggedInUser
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  return { user, isLoading, register, login, logout }
}
