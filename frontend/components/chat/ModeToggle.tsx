'use client'

import { cn } from '@/lib/utils'
import { Package, Sparkles } from 'lucide-react'

export type AppMode = 'packages' | 'exploration'

interface ModeToggleProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  disabled?: boolean
}

export function ModeToggle({ mode, onModeChange, disabled }: ModeToggleProps) {
  return (
    <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg">
      <button
        onClick={() => onModeChange('packages')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00594C]',
          mode === 'packages'
            ? 'bg-[#00594C] text-white shadow-md'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Package className="h-4 w-4" />
        <span>Paquetes Directivos</span>
      </button>
      <button
        onClick={() => onModeChange('exploration')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#AD841F]',
          mode === 'exploration'
            ? 'bg-[#AD841F] text-white shadow-md'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Sparkles className="h-4 w-4" />
        <span>Exploración Guiada</span>
      </button>
    </div>
  )
}

export default ModeToggle
