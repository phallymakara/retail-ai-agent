export interface ChatRequest {
    message: string
    previous_response_id?: string | null
    store_code?: string | null
}

export interface ToolExecution {
    name: string
    arguments: Record<string, unknown>
    result: unknown
}

export interface ChatResponse {
    answer: string
    response_id: string
    tools_used: string[]
    tool_executions: ToolExecution[]
}

export interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    toolExecutions?: ToolExecution[]
    timestamp?: string
    imageUrl?: string
}