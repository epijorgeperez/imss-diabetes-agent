'use client'

import { useState, useEffect, type ReactNode, type FormEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { KeyRound, Loader2 } from 'lucide-react'
import {
  API_CONFIG,
  getStoredAccessKey,
  setStoredAccessKey,
  clearStoredAccessKey,
} from '@/lib/api-client'

interface AccessKeyGateProps {
  children: ReactNode
}

/**
 * Simple pre-login gate: blocks access to the app until the user enters the
 * shared master access key. Meant to be shared only with authorized users
 * (e.g. via a secure channel), independent of the per-user email login.
 */
export function AccessKeyGate({ children }: AccessKeyGateProps) {
  const [checking, setChecking] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const verifyKey = async (candidate: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/auth/verify_key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: candidate }),
      })
      return response.ok
    } catch {
      return false
    }
  }

  // On mount, re-validate any previously stored key against the backend.
  useEffect(() => {
    const stored = getStoredAccessKey()
    if (!stored) {
      setChecking(false)
      return
    }
    verifyKey(stored).then((valid) => {
      if (valid) {
        setUnlocked(true)
      } else {
        clearStoredAccessKey()
      }
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const trimmed = key.trim()
      if (!trimmed) throw new Error('Ingresa la llave de acceso')

      const valid = await verifyKey(trimmed)
      if (!valid) throw new Error('Llave de acceso incorrecta')

      setStoredAccessKey(trimmed)
      setUnlocked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (unlocked) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>
            Este sistema requiere una llave de acceso proporcionada por el equipo del proyecto.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="access-key" className="text-sm font-medium">
                Llave de acceso
              </label>
              <Input
                id="access-key"
                type="password"
                placeholder="••••••••••••"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
