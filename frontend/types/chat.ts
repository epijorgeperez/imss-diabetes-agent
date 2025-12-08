export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

export interface ToolCall {
  name: string
  arguments: any
  timestamp: number
}

export interface ToolResult {
  name: string
  output: string
  timestamp: number
}

export interface ChatSession {
  chatId: string
  createdAt: number
  firstMessage: string
  title?: string
  messages: Message[]
  updatedAt: number
}

export interface StreamEvent {
  type: 'new_agent' | 'tool' | 'function_call' | 'function_call_output' | 'message' | 'final_response' | 'messages' | 'error'
  data: any
}

