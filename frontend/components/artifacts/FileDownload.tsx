'use client'

import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getBackendFileUrl } from '@/lib/api-client'

interface FileDownloadProps {
  href: string
  children?: React.ReactNode
  filename?: string
}

export function FileDownload({ href, children, filename }: FileDownloadProps) {
  const fullUrl = getBackendFileUrl(href)
  const displayName = children || filename || href.split('/').pop() || 'Download File'

  const handleDownload = () => {
    window.open(fullUrl, '_blank')
  }

  const getFileIcon = () => {
    const ext = href.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return '📄'
      case 'csv':
      case 'xlsx':
      case 'xls':
        return '📊'
      case 'png':
      case 'jpg':
      case 'jpeg':
        return '🖼️'
      default:
        return '📎'
    }
  }

  return (
    <Card 
      className="my-4 border-primary/20 bg-primary/5 relative z-10 cursor-pointer hover:bg-primary/10 transition-colors"
      onClick={handleDownload}
      style={{ pointerEvents: 'auto' }}
    >
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getFileIcon()}</span>
          <div>
            <p className="font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">Click to download</p>
          </div>
        </div>
        <Button 
          onClick={(e) => {
            e.stopPropagation()
            handleDownload()
          }} 
          variant="outline" 
          size="sm"
          className="relative z-10"
          style={{ pointerEvents: 'auto' }}
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </CardContent>
    </Card>
  )
}

