'use client'

import { useState, useCallback } from 'react'
import { ENDPOINTS, API_CONFIG } from '@/lib/api-client'
import type { PackageParams, PackagePayload, GeneratePackageResponse } from '@/types/package'

interface UsePackageGeneratorReturn {
  generatePackage: (params: PackageParams, chatId: string, userEmail?: string) => Promise<PackagePayload | null>
  isGenerating: boolean
  error: Error | null
  reset: () => void
}

export function usePackageGenerator(): UsePackageGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generatePackage = useCallback(async (params: PackageParams, chatId: string, userEmail?: string): Promise<PackagePayload | null> => {
    setIsGenerating(true)
    setError(null)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (API_CONFIG.apiToken) {
      headers['Authorization'] = `Bearer ${API_CONFIG.apiToken}`
    }

    try {
      console.log('[PackageGenerator] Generating package:', { templateId: params.templateId, chatId })

      const payload: Record<string, any> = { params, chatId }
      if (userEmail) payload.user_email = userEmail

      const response = await fetch(`${API_CONFIG.baseURL}/${API_CONFIG.agency}/generate_package`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data: GeneratePackageResponse = await response.json()

      if (!data.success || !data.package) {
        throw new Error(data.error || 'Failed to generate package')
      }

      console.log('[PackageGenerator] Package generated successfully:', data.package.title)
      return data.package as PackagePayload

    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err))
      console.error('[PackageGenerator] Error:', errorObj)
      setError(errorObj)
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const reset = useCallback(() => {
    setIsGenerating(false)
    setError(null)
  }, [])

  return {
    generatePackage,
    isGenerating,
    error,
    reset,
  }
}

export default usePackageGenerator
