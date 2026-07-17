import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import ReactMarkdown from "react-markdown"
import "./App.css"
import { ProductCards } from "./components/ProductCards"
import type { CartItem } from "./types/order"

import { sendChatMessage } from "./services/chatApi"
import type { ChatMessage } from "./types/chat"

const suggestedQuestions = [
  "Do you have fresh milk in Siem Reap?",
  "Show me active promotions",
  "Find jasmine rice",
  "Which products are low in stock?",
]

function createMessage(
  role: ChatMessage["role"],
  content: string,
  imageUrl?: string,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    imageUrl,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      "Hello! I’m your retail shopping assistant. I can help you find products, check store availability, and discover current promotions.",
    ),
  ])

  const [input, setInput] = useState("")
  const [previousResponseId, setPreviousResponseId] = useState<
    string | null
  >(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handlePlusClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === "string") {
          setSelectedImage(result)
        }
      }
      reader.readAsDataURL(file)
    }
    event.target.value = ""
  }

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    })
  }, [messages, isLoading])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  async function submitMessage(message: string, imageSrc?: string | null) {
    const trimmedMessage = message.trim()
    const activeImage = imageSrc || selectedImage

    if ((!trimmedMessage && !activeImage) || isLoading) {
      return
    }

    const userMessage = createMessage(
      "user",
      trimmedMessage || "[Uploaded Image]",
      activeImage || undefined,
    )

    setMessages((current) => [...current, userMessage])
    setInput("")
    setSelectedImage(null)
    setError(null)
    setIsLoading(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await sendChatMessage(
        {
          message: trimmedMessage || "Analyze this uploaded image.",
          previous_response_id: previousResponseId,
        },
        controller.signal,
      )

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        toolExecutions: response.tool_executions,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }

      setMessages((current) => [...current, assistantMessage])
      setPreviousResponseId(response.response_id)
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to contact the retail assistant.",
      )
    } finally {
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitMessage(input, selectedImage)
  }

  function startNewConversation() {
    abortControllerRef.current?.abort()

    setMessages([
      createMessage(
        "assistant",
        "Hello! I’m your retail shopping assistant. What product can I help you find today?",
      ),
    ])
    setPreviousResponseId(null)
    setInput("")
    setError(null)
    setIsLoading(false)
  }
  function addToCart(item: CartItem) {
    setCartItems((current) => {
      const existing = current.find(
        (cartItem) => cartItem.sku === item.sku,
      )

      if (!existing) {
        return [...current, item]
      }

      return current.map((cartItem) =>
        cartItem.sku === item.sku
          ? {
              ...cartItem,
              quantity:
                cartItem.quantity + item.quantity,
            }
          : cartItem,
      )
    })

    setIsCartOpen(true)
  }

  const cartQuantity = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-avatar-wrapper">
            <div className="brand-avatar">D</div>
            <span className="brand-status-dot" />
          </div>

          <div className="brand-info">
            <h1>Shopping Assistant</h1>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="cart-button"
            onClick={() => setIsCartOpen(true)}
          >
            Cart
            {cartQuantity > 0 && (
              <span>{cartQuantity}</span>
            )}
          </button>

          <button
            className="new-chat-button"
            type="button"
            onClick={startNewConversation}
          >
            New conversation
          </button>

          <button type="button" className="menu-button" aria-label="Menu">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M5 12a2 2 0 11-4 0 2 2 0 014 0zm7 0a2 2 0 11-4 0 2 2 0 014 0zm7 0a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="chat-layout">
        <section className="chat-panel">
          <div className="message-list" aria-live="polite">
            <div className="date-divider">
              <span>Today</span>
            </div>

            {messages.map((message) => (
              <article
                className={`message-row message-row--${message.role}`}
                key={message.id}
              >
                {message.role === "assistant" && (
                  <div className="message-avatar" aria-hidden="true">
                    D
                  </div>
                )}

                <div className="message-content">
                  <div className="message-bubble">
                    {message.imageUrl && (
                      <div className="message-image">
                        <img src={message.imageUrl} alt="Uploaded attachment" />
                      </div>
                    )}

                    {message.role === "assistant" ? (
                      <ReactMarkdown
                        components={{
                          a: ({ children, ...props }) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {children}
                            </a>
                          ),
                          img: () => null,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p>{message.content}</p>
                    )}

                  </div>

                  {message.role === "assistant" &&
                    message.toolExecutions && (
                      <ProductCards
                        executions={message.toolExecutions}
                        onAddToCart={addToCart}
                      />
                    )}

                  <div className="message-meta">
                    <span className="message-time">
                      {message.timestamp || "10:24 AM"}
                    </span>
                    {message.role === "user" && (
                      <span className="message-status">✓✓</span>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {isLoading && (
              <article className="message-row message-row--assistant">
                <div className="message-avatar" aria-hidden="true">
                  AI
                </div>

                <div className="message-content">
                  <div className="message-label">Retail Assistant</div>

                  <div className="message-bubble typing-bubble">
                    <span />
                    <span />
                    <span />
                    <span className="sr-only">
                      Retail assistant is thinking
                    </span>
                  </div>
                </div>
              </article>
            )}

            {messages.length === 1 && (
              <div className="suggestions">
                <p>Try asking:</p>

                <div className="suggestion-grid">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void submitMessage(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="composer-section">
            {error && (
              <div className="error-message" role="alert">
                <span>{error}</span>

                <button type="button" onClick={() => setError(null)}>
                  Dismiss
                </button>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: "none" }}
            />

            {selectedImage && (
              <div className="composer-image-preview">
                <img src={selectedImage} alt="Selected preview" />
                <button
                  type="button"
                  className="remove-preview-button"
                  onClick={() => setSelectedImage(null)}
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            )}

            <form className="composer" onSubmit={handleSubmit}>
              <button
                type="button"
                className="composer-plus-button"
                aria-label="Add attachment"
                onClick={handlePlusClick}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </button>

              <textarea
                value={input}
                disabled={isLoading}
                placeholder="Ask about products, stock, stores, or promotions..."
                rows={1}
                aria-label="Message"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />

              <button
                type="submit"
                className="send-button"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? "Thinking..." : "Send"}
              </button>
            </form>

            <p className="composer-help">
              Press Enter to send. Use Shift + Enter for a new line.
            </p>
          </div>
        </section>
      </main>

      {isCartOpen && (
        <div
          className="cart-overlay"
          onClick={() => setIsCartOpen(false)}
        >
          <aside
            className="cart-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cart-drawer__header">
              <h2>Your cart</h2>

              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
              >
                Close
              </button>
            </div>

            {cartItems.length === 0 ? (
              <p className="empty-cart">
                Your cart is empty.
              </p>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map((item) => (
                    <div className="cart-item" key={item.sku}>
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                        />
                      )}

                      <div>
                        <strong>{item.name}</strong>
                        <p>
                          {item.quantity} × ${item.unitPrice}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="checkout-button"
                  type="button"
                  onClick={() => {
                    window.alert(
                      "Checkout form will open here.",
                    )
                  }}
                >
                  Continue to checkout
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

export default App