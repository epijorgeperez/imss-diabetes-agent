'use client'

import { getBackendFileUrl } from '@/lib/api-client'

interface ImageViewerProps {
  src: string
  alt?: string
  title?: string
}

export function ImageViewer({ src, alt, title }: ImageViewerProps) {
  const fullUrl = getBackendFileUrl(src)

  return (
    <div className="my-4 rounded-lg border bg-muted/50 p-4">
      {title && (
        <p className="mb-2 text-sm font-medium text-muted-foreground">{title}</p>
      )}
      <div className="relative w-full overflow-hidden rounded-md">
        <img
          src={fullUrl}
          alt={alt || title || 'Image'}
          className="max-h-[600px] w-full object-contain"
        />
      </div>
    </div>
  )
}

