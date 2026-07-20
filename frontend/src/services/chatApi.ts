import type {
  ChatRequest,
  ConversationDetail,
  ConversationSummary,
} from "../types/chat"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"

export class ChatApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ChatApiError"
    this.status = status
  }
}

export interface ChatStreamChunk {
  type: "tools" | "response_id" | "content" | "done" | "error" | "conversation_id"
  tool_executions?: any[]
  response_id?: string
  conversation_id?: string
  delta?: string
  detail?: string
}

export async function sendChatMessageStream(
  request: ChatRequest,
  onChunk: (chunk: ChatStreamChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const error = await response.json()

      if (typeof error.detail === "string") {
        message = error.detail
      }
    } catch {
      // Keep the fallback error message.
    }

    throw new ChatApiError(message, response.status)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("No readable stream response")
  }

  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const cleanLine = line.trim()
        if (!cleanLine.startsWith("data: ")) continue

        const jsonStr = cleanLine.substring(6)
        try {
          const chunk: ChatStreamChunk = JSON.parse(jsonStr)
          onChunk(chunk)
        } catch (e) {
          console.error("Error parsing stream chunk:", e)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function getUserConversations(
  authUserId: string,
  signal?: AbortSignal,
): Promise<ConversationSummary[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/chat/conversations/user/${encodeURIComponent(
      authUserId,
    )}`,
    { signal },
  )

  if (!response.ok) {
    throw new ChatApiError("Failed to fetch conversation history", response.status)
  }

  return (await response.json()) as ConversationSummary[]
}

export async function getConversationDetails(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/chat/conversations/${encodeURIComponent(
      conversationId,
    )}`,
    { signal },
  )

  if (!response.ok) {
    throw new ChatApiError("Failed to fetch conversation details", response.status)
  }

  return (await response.json()) as ConversationDetail
}

export async function deleteConversation(
  conversationId: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/chat/conversations/${encodeURIComponent(
      conversationId,
    )}`,
    {
      method: "DELETE",
      signal,
    },
  )

  if (!response.ok) {
    throw new ChatApiError("Failed to delete conversation", response.status)
  }
}