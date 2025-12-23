'use client'

import { Download, FileText } from 'lucide-react'
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
    <a 
      href={fullUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block no-underline"
    >
      <Card className="my-4 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getFileIcon()}</span>
            <div>
              <p className="font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground">Click to download</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-2">
            <Download className="h-4 w-4" />
            Download
          </div>
        </CardContent>
      </Card>
    </a>
  )
}

