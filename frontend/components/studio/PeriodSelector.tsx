'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Calendar, ArrowRight } from 'lucide-react'

interface PeriodSelectorProps {
  startYear: number
  endYear: number
  onStartChange: (year: number) => void
  onEndChange: (year: number) => void
}

const MIN_YEAR = 2015
const MAX_YEAR = new Date().getFullYear()

const QUICK_RANGES = [
  { label: 'Último año', start: MAX_YEAR, end: MAX_YEAR },
  { label: 'Últimos 3 años', start: MAX_YEAR - 2, end: MAX_YEAR },
  { label: 'Últimos 5 años', start: MAX_YEAR - 4, end: MAX_YEAR },
]

export function PeriodSelector({ 
  startYear, 
  endYear, 
  onStartChange, 
  onEndChange 
}: PeriodSelectorProps) {
  const handleStartChange = (value: string) => {
    const year = parseInt(value, 10)
    if (!isNaN(year) && year >= MIN_YEAR && year <= MAX_YEAR) {
      onStartChange(year)
      // Auto-adjust end year if needed
      if (year > endYear) {
        onEndChange(year)
      }
    }
  }

  const handleEndChange = (value: string) => {
    const year = parseInt(value, 10)
    if (!isNaN(year) && year >= MIN_YEAR && year <= MAX_YEAR) {
      onEndChange(year)
      // Auto-adjust start year if needed
      if (year < startYear) {
        onStartChange(year)
      }
    }
  }

  const setQuickRange = (start: number, end: number) => {
    onStartChange(start)
    onEndChange(end)
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Periodo de análisis
      </label>
      
      {/* Quick range buttons */}
      <div className="flex flex-wrap gap-2">
        {QUICK_RANGES.map((range) => {
          const isSelected = startYear === range.start && endYear === range.end
          return (
            <button
              key={range.label}
              type="button"
              onClick={() => setQuickRange(range.start, range.end)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                'border focus:outline-none focus:ring-2 focus:ring-primary/50',
                isSelected
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-background hover:bg-muted border-border hover:border-primary/30'
              )}
            >
              {range.label}
            </button>
          )
        })}
      </div>

      {/* Year range inputs */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={startYear}
            onChange={(e) => handleStartChange(e.target.value)}
            className="pl-10 text-center"
            placeholder="Desde"
          />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            min={MIN_YEAR}
            max={MAX_YEAR}
            value={endYear}
            onChange={(e) => handleEndChange(e.target.value)}
            className="pl-10 text-center"
            placeholder="Hasta"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Datos disponibles desde {MIN_YEAR} hasta {MAX_YEAR}
      </p>
    </div>
  )
}

