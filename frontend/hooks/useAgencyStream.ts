'use client'

import { useState, useCallback, useRef } from 'react'
import { ENDPOINTS, API_CONFIG } from '@/lib/api-client'
import type { ToolCall, ToolResult } from '@/types/chat'

interface StreamState {
  isStreaming: boolean
  currentTool: string | null
  messageChunks: string[]
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  error: Error | null
  isComplete: boolean
}

export function useAgencyStream() {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    currentTool: null,
    messageChunks: [],
    toolCalls: [],
    toolResults: [],
    error: null,
    isComplete: false,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const stream = useCallback(async (message: string, chatId: string) => {
    // Reset state
    setState({
      isStreaming: true,
      currentTool: null,
      messageChunks: [],
      toolCalls: [],
      toolResults: [],
      error: null,
      isComplete: false,
    })

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (API_CONFIG.apiToken) {
      headers['Authorization'] = `Bearer ${API_CONFIG.apiToken}`
    }

    try {
      console.log('[SSE] Sending request to:', ENDPOINTS.getResponseStream)
      console.log('[SSE] Payload:', { message: message.substring(0, 50), chat_id: chatId })
      
      const response = await fetch(ENDPOINTS.getResponseStream, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, chat_id: chatId }),
        signal: abortControllerRef.current.signal,
      })

      console.log('[SSE] Response status:', response.status, response.statusText)
      console.log('[SSE] Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[SSE] Response error:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      if (!response.body) {
        console.error('[SSE] No response body!')
        throw new Error('No response body')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let currentEventType = ''

      console.log('[SSE] Starting to read stream...')

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[SSE] Stream ended')
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          
          if (trimmedLine.startsWith('event: ')) {
            currentEventType = trimmedLine.slice(7).trim()
            console.log('[SSE] Event type:', currentEventType)
          } else if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6).trim()
            if (!data || data === '[DONE]') {
              console.log('[SSE] Received [DONE] marker')
              continue
            }

            try {
              const parsed = JSON.parse(data)
              console.log('[SSE] Event data:', currentEventType || '(no event type)', parsed)
              handleStreamEvent(currentEventType, parsed)
            } catch (e) {
              console.error('[SSE] Failed to parse SSE data:', e, 'Raw data:', data.substring(0, 200))
            }
          } else if (trimmedLine === '') {
            // Empty line separates events - reset for next event
            currentEventType = ''
          }
        }
      }

      setState((prev) => ({ ...prev, isStreaming: false, isComplete: true }))
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setState((prev) => ({ ...prev, isStreaming: false }))
        return
      }
      setState((prev) => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error : new Error(String(error)),
        isComplete: true,
      }))
    }
  }, [])

  const handleStreamEvent = useCallback((eventType: string, data: any) => {
    console.log('[SSE Handler] Processing event:', eventType, data)
    switch (eventType) {
      case 'new_agent':
        // Agent activated - could show toast here
        setState((prev) => ({ ...prev, currentTool: 'Agent Activated' }))
        break

      case 'tool':
      case 'function_call':
        // Tool call started
        const toolName = data.name || data.tool_name || 'Unknown Tool'
        const toolArgs = typeof data.arguments === 'string' 
          ? JSON.parse(data.arguments) 
          : (data.arguments || data.tool_input || {})
        
        setState((prev) => ({
          ...prev,
          currentTool: toolName,
          toolCalls: [
            ...prev.toolCalls,
            {
              name: toolName,
              arguments: toolArgs,
              timestamp: Date.now(),
            },
          ],
        }))
        break

      case 'function_call_output':
        // Tool result received
        const resultName = data.name || data.tool_name || 'Unknown Tool'
        const resultOutput = data.output || ''
        
        setState((prev) => ({
          ...prev,
          toolResults: [
            ...prev.toolResults,
            {
              name: resultName,
              output: resultOutput,
              timestamp: Date.now(),
            },
          ],
          currentTool: null,
        }))
        break

      case 'message':
        // Message chunk received
        const content = data.content || data.text || ''
        if (content) {
          setState((prev) => ({
            ...prev,
            messageChunks: [...prev.messageChunks, content],
          }))
        }
        break

      case 'messages':
      case 'final_response':
        // Final response with complete message
        console.log('[SSE Handler] Processing messages/final_response event:', data)
        
        // Process new_messages array (like test-stream.html does)
        if (data.new_messages && Array.isArray(data.new_messages)) {
          // Extract all messages including tool calls and assistant message
          let assistantContent = ''
          const newToolCalls: ToolCall[] = []
          const newToolResults: ToolResult[] = []
          
          data.new_messages.forEach((msg: any) => {
            if (msg.type === 'function_call') {
              const toolName = msg.name || 'Unknown Tool'
              const toolArgs = typeof msg.arguments === 'string' 
                ? JSON.parse(msg.arguments) 
                : (msg.arguments || {})
              newToolCalls.push({
                name: toolName,
                arguments: toolArgs,
                timestamp: Date.now(),
              })
            } else if (msg.type === 'function_call_output') {
              newToolResults.push({
                name: msg.name || 'Unknown Tool',
                output: msg.output || '',
                timestamp: Date.now(),
              })
            } else if (msg.type === 'message' && msg.role === 'assistant') {
              assistantContent = Array.isArray(msg.content)
                ? msg.content.map((c: any) => c.text || c).join('')
                : (msg.content || '')
            }
          })
          
          console.log('[SSE Handler] Extracted:', {
            contentLength: assistantContent.length,
            toolCalls: newToolCalls.length,
            toolResults: newToolResults.length,
          })
          
          // Update state with complete message
          setState((prev) => ({
            ...prev,
            messageChunks: assistantContent ? [assistantContent] : prev.messageChunks,
            toolCalls: newToolCalls.length > 0 ? [...prev.toolCalls, ...newToolCalls] : prev.toolCalls,
            toolResults: newToolResults.length > 0 ? [...prev.toolResults, ...newToolResults] : prev.toolResults,
            isComplete: true,
            isStreaming: false,
            currentTool: null,
          }))
        } else if (data.final_output || data.content) {
          // Fallback: use final_output or content directly
          const finalContent = data.final_output || data.content
          console.log('[SSE Handler] Using final_output/content:', finalContent?.substring(0, 100))
          setState((prev) => ({
            ...prev,
            messageChunks: [finalContent],
            isComplete: true,
            isStreaming: false,
          }))
        } else {
          console.warn('[SSE Handler] messages event but no content found:', data)
        }
        break

      case 'end':
      case 'done':
        console.log('[SSE Handler] Stream ended')
        setState((prev) => ({ ...prev, isStreaming: false, isComplete: true }))
        break

      case '':
        // No event type - might be a data-only line, try to process as message
        if (data.content || data.text) {
          const content = data.content || data.text
          setState((prev) => ({
            ...prev,
            messageChunks: [...prev.messageChunks, content],
          }))
        }
        break

      default:
        // Unknown event type - log for debugging
        if (eventType) {
          console.warn('[SSE Handler] Unknown SSE event:', eventType, data)
        }
    }
  }, [])

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setState({
      isStreaming: false,
      currentTool: null,
      messageChunks: [],
      toolCalls: [],
      toolResults: [],
      error: null,
      isComplete: false,
    })
  }, [])

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setState((prev) => ({ ...prev, isStreaming: false }))
  }, [])

  return {
    stream,
    reset,
    cancel,
    ...state,
    fullMessage: state.messageChunks.join(''),
  }
}

