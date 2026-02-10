'use client'

import { ChatInterface } from '@/components/chat/ChatInterface'
import { AuthGate, useUserContext } from '@/components/auth/AuthGate'
import { Building2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

function AppContent() {
  const { user, logout } = useUserContext()

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Agente Analítico de Diabetes</h1>
              <p className="text-xs text-muted-foreground">IMSS - Instituto Mexicano del Seguro Social</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user.nombre}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main chat interface */}
      <ChatInterface userEmail={user.email} />
    </div>
  )
}

export default function Home() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  )
}

