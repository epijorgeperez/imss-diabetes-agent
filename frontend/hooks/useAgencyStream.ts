'use client'

import { useState, useCallback, useRef } from 'react'
import { ENDPOINTS, API_CONFIG, getAccessKeyHeaders } from '@/lib/api-client'
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

  const stream = useCallback(async (message: string, chatId: string, userEmail?: string) => {
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
      ...getAccessKeyHeaders(),
    }

    if (API_CONFIG.apiToken) {
      headers['Authorization'] = `Bearer ${API_CONFIG.apiToken}`
    }

    try {
      const payload: Record<string, string> = { message, chat_id: chatId }
      if (userEmail) payload.user_email = userEmail

      console.log('[SSE] Sending request to:', ENDPOINTS.getResponseStream)
      console.log('[SSE] Payload:', { message: message.substring(0, 50), chat_id: chatId })
      
      const response = await fetch(ENDPOINTS.getResponseStream, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
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
        const toolName = data.name || data.tool_name || data.function_name || 'Unknown Tool'
        const toolArgs = typeof data.arguments === 'string' 
          ? JSON.parse(data.arguments) 
          : (data.arguments || data.tool_input || data.input || {})
        
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
        // Try to find the tool name from various possible fields
        const rawOutput = data.output ?? data.result ?? data.tool_output
        let resultOutput = ''
        if (typeof rawOutput === 'string') {
          resultOutput = rawOutput
        } else if (typeof rawOutput === 'object' && rawOutput !== null) {
          resultOutput = JSON.stringify(rawOutput, null, 2)
        } else if (rawOutput !== undefined && rawOutput !== null) {
          resultOutput = String(rawOutput)
        }
        
        setState((prev) => {
          // Try to find the tool name from various possible fields
          let resultName = data.name || data.tool_name || data.function_name
          
          // If no name in result, try to match with the most recent tool call without a result
          if (!resultName) {
            const lastToolCall = prev.toolCalls[prev.toolCalls.length - 1]
            if (lastToolCall && !prev.toolResults.some(r => r.name === lastToolCall.name)) {
              resultName = lastToolCall.name
            } else {
              resultName = 'Unknown Tool'
            }
          }
          
          return {
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
          }
        })
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
        
        // PRIORITY: Use final_output directly if available (most reliable)
        const finalOutput = data.final_output || data.content
        
        // Process new_messages array for tool calls
        const newToolCalls: ToolCall[] = []
        const newToolResults: ToolResult[] = []
        let assistantContentFromMessages = ''
        
        if (data.new_messages && Array.isArray(data.new_messages)) {
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
              const resultToolName = msg.name || msg.tool_name || msg.function_name ||
                (() => {
                  const lastToolCall = newToolCalls[newToolCalls.length - 1]
                  if (lastToolCall) return lastToolCall.name
                  const prevToolCall = state.toolCalls[state.toolCalls.length - 1]
                  if (prevToolCall && !state.toolResults.some(r => r.name === prevToolCall.name)) {
                    return prevToolCall.name
                  }
                  return 'Unknown Tool'
                })()
              const rawMsgOutput = msg.output ?? msg.result ?? msg.tool_output
              let msgOutput = ''
              if (typeof rawMsgOutput === 'string') {
                msgOutput = rawMsgOutput
              } else if (typeof rawMsgOutput === 'object' && rawMsgOutput !== null) {
                msgOutput = JSON.stringify(rawMsgOutput, null, 2)
              } else if (rawMsgOutput !== undefined && rawMsgOutput !== null) {
                msgOutput = String(rawMsgOutput)
              }
              newToolResults.push({
                name: resultToolName,
                output: msgOutput,
                timestamp: Date.now(),
              })
            } else if (msg.type === 'message' && msg.role === 'assistant') {
              assistantContentFromMessages = Array.isArray(msg.content)
                ? msg.content.map((c: any) => c.text || c).join('')
                : (msg.content || '')
            }
          })
        }
        
        // Use final_output as primary source, fallback to parsed content from messages
        const finalContent = finalOutput || assistantContentFromMessages
        
        console.log('[SSE Handler] Extracted:', {
          finalOutputLength: finalOutput?.length || 0,
          contentFromMessagesLength: assistantContentFromMessages.length,
          toolCalls: newToolCalls.length,
          toolResults: newToolResults.length,
          usingFinalOutput: !!finalOutput,
        })
        
        if (finalContent) {
          setState((prev) => {
            // If we got new tool calls from the final response, REPLACE the streaming ones
            // (streaming tool calls are often partial/incomplete)
            const finalToolCalls = newToolCalls.length > 0 ? newToolCalls : prev.toolCalls
            const finalToolResults = newToolResults.length > 0 ? newToolResults : prev.toolResults
            
            return {
              ...prev,
              messageChunks: [finalContent],  // Always replace with new content
              toolCalls: finalToolCalls,
              toolResults: finalToolResults,
              isComplete: true,
              isStreaming: false,
              currentTool: null,
            }
          })
        } else {
          console.warn('[SSE Handler] messages event but no content found:', data)
          setState((prev) => ({
            ...prev,
            isComplete: true,
            isStreaming: false,
            currentTool: null,
          }))
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

