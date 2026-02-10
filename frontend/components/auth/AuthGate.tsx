'use client'

import { useState, type ReactNode, type FormEvent } from 'react'
import { useUser } from '@/hooks/useUser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Building2, LogIn, UserPlus, Loader2, LogOut } from 'lucide-react'

interface AuthGateProps {
  children: ReactNode
}

const EMAIL_DOMAIN = 'imss.gob.mx'

export function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading, register, login, logout } = useUser()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form fields
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [adscripcion, setAdscripcion] = useState('')

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex h-full flex-col">
        {/* Inject user info + logout into the app */}
        <UserContext.Provider value={{ user, logout }}>
          {children}
        </UserContext.Provider>
      </div>
    )
  }

  const validateEmail = (email: string): boolean => {
    const domain = email.split('@').pop()?.toLowerCase()
    return domain === EMAIL_DOMAIN
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const trimmedEmail = email.trim().toLowerCase()

      if (!validateEmail(trimmedEmail)) {
        throw new Error(`El correo debe ser del dominio @${EMAIL_DOMAIN}`)
      }

      if (mode === 'register') {
        if (!nombre.trim()) throw new Error('El nombre es requerido')
        if (!adscripcion.trim()) throw new Error('La adscripción es requerida')
        await register(nombre.trim(), trimmedEmail, adscripcion.trim())
      } else {
        await login(trimmedEmail)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-7 w-7" />
          </div>
          <CardTitle>Agente Analítico de Diabetes</CardTitle>
          <CardDescription>IMSS — Instituto Mexicano del Seguro Social</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="nombre" className="text-sm font-medium">
                    Nombre completo
                  </label>
                  <Input
                    id="nombre"
                    placeholder="Dr. Juan Pérez López"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="adscripcion" className="text-sm font-medium">
                    Adscripción
                  </label>
                  <Input
                    id="adscripcion"
                    placeholder="OOAD Jalisco / UMF 34 / Delegación Norte"
                    value={adscripcion}
                    onChange={(e) => setAdscripcion(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Correo institucional
              </label>
              <Input
                id="email"
                type="email"
                placeholder={`usuario@${EMAIL_DOMAIN}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Solo correos @{EMAIL_DOMAIN}
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : mode === 'register' ? (
                <UserPlus className="mr-2 h-4 w-4" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {mode === 'register' ? 'Registrarme' : 'Entrar'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setError(null)
                }}
              >
                {mode === 'login' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Context for passing user + logout to child components ---
import { createContext, useContext } from 'react'
import type { User } from '@/types/user'

interface UserContextValue {
  user: User
  logout: () => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function useUserContext() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUserContext must be used within AuthGate')
  return ctx
}
