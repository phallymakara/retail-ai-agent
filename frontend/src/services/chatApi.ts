import type { ChatRequest, ChatResponse } from "../types/chat"

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

export async function sendChatMessage(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
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

  return (await response.json()) as ChatResponse
}