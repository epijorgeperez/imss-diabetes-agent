export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001',
  apiToken: process.env.NEXT_PUBLIC_API_TOKEN,
  timeout: 120000,
  agency: 'imss-diabetes',
} as const

export const ENDPOINTS = {
  getResponse: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/get_response`,
  getResponseStream: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/stream_response`, // Custom endpoint with real-time events
  getMetadata: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/get_metadata`,
  generatePackage: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/generate_package`,
  getTemplates: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/templates`,
  docs: `${API_CONFIG.baseURL}/docs`,
} as const

export function getBackendFileUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  // Use relative paths for /files/* to leverage Next.js rewrites
  // This proxies through frontend to avoid CORS issues
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (cleanPath.startsWith('/files/')) {
    return cleanPath // Let Next.js rewrites handle proxying to backend
  }
  return `${API_CONFIG.baseURL}${cleanPath}`
}

