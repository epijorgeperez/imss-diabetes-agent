export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001',
  apiToken: process.env.NEXT_PUBLIC_API_TOKEN,
  timeout: 120000,
  agency: 'imss-diabetes',
} as const

export const ENDPOINTS = {
  getResponse: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/get_response`,
  getResponseStream: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/get_response_stream`,
  getMetadata: `${API_CONFIG.baseURL}/${API_CONFIG.agency}/get_metadata`,
  docs: `${API_CONFIG.baseURL}/docs`,
} as const

export function getBackendFileUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  // Transform relative paths like /files/outputs/graph.png to full backend URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_CONFIG.baseURL}${cleanPath}`
}

