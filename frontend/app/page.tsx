'use client'

import { ChatInterface } from '@/components/chat/ChatInterface'
import { Building2 } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center gap-3 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Agente Analítico de Diabetes</h1>
            <p className="text-xs text-muted-foreground">IMSS - Instituto Mexicano del Seguro Social</p>
          </div>
        </div>
      </header>

      {/* Main chat interface */}
      <ChatInterface />
    </div>
  )
}

