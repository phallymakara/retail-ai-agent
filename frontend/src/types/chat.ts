export interface ChatRequest {
    message: string
    previous_response_id?: string | null
    store_code?: string | null
    conversation_id?: string | null
    auth_user_id?: string | null
    user_email?: string | null
    user_role?: string | null
    is_authenticated?: boolean
    guest_question_count?: number
    has_image?: boolean
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

export interface ConversationSummary {
    id: string
    auth_user_id: string | null
    store_code: string | null
    title: string
    response_id: string | null
    created_at: string
    updated_at: string
}

export interface ChatMessageDetail {
    id: string
    role: "user" | "assistant"
    content: string
    tool_executions?: ToolExecution[] | null
    response_id?: string | null
    created_at: string
}

export interface ConversationDetail extends ConversationSummary {
    messages: ChatMessageDetail[]
}