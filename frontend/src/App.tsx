import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import ReactMarkdown from "react-markdown"
import "./App.css"
import { ProductCards } from "./components/ProductCards"
import type { CartItem } from "./types/order"

import { sendChatMessageStream } from "./services/chatApi"
import type { ChatMessage } from "./types/chat"

import { AuthButton } from "./components/AuthButton"
import { useAuth } from "./contexts/AuthContext"

export interface StoreBranch {
  code: string
  name: string
  address: string
  phone: string
}

export const storeBranches: StoreBranch[] = [
  {
    code: "PP-BKK1",
    name: "Phnom Penh BKK1 Store",
    address: "Boeung Keng Kang 1, Phnom Penh",
    phone: "023 900 101",
  },
  {
    code: "PP-TTP",
    name: "Phnom Penh Toul Tom Poung Store",
    address: "Toul Tom Poung, Phnom Penh",
    phone: "023 900 102",
  },
  {
    code: "SR-CENTRAL",
    name: "Siem Reap Central Store",
    address: "Central Siem Reap",
    phone: "063 900 103",
  },
]

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
  const { user } = useAuth()
  const [selectedStore, setSelectedStore] = useState<StoreBranch>(storeBranches[0])
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [logoUrl, setLogoUrl] = useState("/src/assets/store.png")

  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      `Hello! I’m your retail shopping assistant for the ${storeBranches[0].name}. What product can I help you find today?`,
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
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsStoreDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
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

    let assistantMessageId: string | null = null

    try {
      await sendChatMessageStream(
        {
          message: trimmedMessage || "Analyze this uploaded image.",
          previous_response_id: previousResponseId,
          store_code: selectedStore.code,
        },
        (chunk) => {
          if (!assistantMessageId) {
            assistantMessageId = crypto.randomUUID()
            const initialAssistantMessage: ChatMessage = {
              id: assistantMessageId,
              role: "assistant",
              content: "",
              toolExecutions: undefined,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
            setMessages((current) => [...current, initialAssistantMessage])
            setIsLoading(false)
          }

          const targetId = assistantMessageId
          if (chunk.type === "tools" && chunk.tool_executions) {
            setMessages((current) =>
              current.map((msg) =>
                msg.id === targetId
                  ? { ...msg, toolExecutions: chunk.tool_executions }
                  : msg
              )
            )
          } else if (chunk.type === "response_id" && chunk.response_id) {
            setPreviousResponseId(chunk.response_id)
          } else if (chunk.type === "content" && chunk.delta) {
            setMessages((current) =>
              current.map((msg) =>
                msg.id === targetId
                  ? { ...msg, content: msg.content + chunk.delta }
                  : msg
              )
            )
          } else if (chunk.type === "error" && chunk.detail) {
            setError(chunk.detail)
          }
        },
        controller.signal,
      )
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

  function startNewConversation(store: StoreBranch = selectedStore) {
    abortControllerRef.current?.abort()

    setMessages([
      createMessage(
        "assistant",
        `Hello! I’m your retail shopping assistant for the ${store.name}. What product can I help you find today?`,
      ),
    ])
    setPreviousResponseId(null)
    setInput("")
    setError(null)
    setIsLoading(false)
  }

  function handleStoreChange(store: StoreBranch) {
    setSelectedStore(store)
    setIsStoreDropdownOpen(false)
    startNewConversation(store)
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

  function updateCartItemQuantity(sku: string, nextQuantity: number) {
    setCartItems((current) => {
      if (nextQuantity === 0) {
        return current.filter((item) => item.sku !== sku)
      }
      return current.map((item) =>
        item.sku === sku
          ? { ...item, quantity: Math.max(Math.min(nextQuantity, 99), 1) }
          : item
      )
    })
  }

  const cartQuantity = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  const cartSubtotal = cartItems.reduce(
    (total, item) => total + Number(item.unitPrice) * item.quantity,
    0,
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img
            src={logoUrl}
            alt="Store logo"
            className="brand-avatar-img"
            onError={() => {
              setLogoUrl("https://img.icons8.com/color/96/shop.png")
            }}
          />

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

          <div className="store-selector-container" ref={dropdownRef}>
            <button
              className="store-selector-button"
              type="button"
              onClick={() => setIsStoreDropdownOpen((prev) => !prev)}
              aria-expanded={isStoreDropdownOpen}
              aria-haspopup="listbox"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="store-icon">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{selectedStore.name}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dropdown-caret">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isStoreDropdownOpen && (
              <div className="store-dropdown-menu" role="listbox">
                <div className="store-dropdown-header">Select store branch</div>
                {storeBranches.map((store) => (
                  <button
                    key={store.code}
                    type="button"
                    role="option"
                    aria-selected={selectedStore.code === store.code}
                    className={`store-dropdown-item ${selectedStore.code === store.code ? "store-dropdown-item--active" : ""
                      }`}
                    onClick={() => handleStoreChange(store)}
                  >
                    <div className="store-item-name">{store.name}</div>
                    <div className="store-item-address">{store.address}</div>
                    <div className="store-item-phone">{store.phone}</div>
                  </button>
                ))}
                <div className="store-dropdown-divider" />
                <button
                  type="button"
                  className="store-dropdown-reset"
                  onClick={() => {
                    startNewConversation(selectedStore);
                    setIsStoreDropdownOpen(false);
                  }}
                >
                  Reset Current Chat
                </button>
              </div>
            )}
          </div>

          <AuthButton />
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
                  <img src={logoUrl} alt="Assistant logo" className="message-avatar-img" />
                )}

                {message.role === "user" && (
                  user?.image ? (
                    <img src={user.image} alt="User avatar" className="user-avatar-img" />
                  ) : (
                    <div className="user-avatar-fallback">
                      {user ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  )
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
                <img src={logoUrl} alt="Assistant logo" className="message-avatar-img" />

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
                disabled={(!input.trim() && !selectedImage) || isLoading}
              >
                {isLoading ? "Sent" : "Send"}
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

                      <div className="cart-item-details">
                        <strong>{item.name}</strong>
                        <div className="cart-item-meta">
                          <span className="cart-item-unit-price">${item.unitPrice}</span>
                          <span className="cart-item-total-price">
                            Total: ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                          </span>
                        </div>

                        <div className="cart-item-qty-control">
                          <button
                            type="button"
                            className="qty-btn"
                            aria-label="Decrease quantity"
                            disabled={item.quantity <= 1}
                            onClick={() => updateCartItemQuantity(item.sku, item.quantity - 1)}
                          >
                            −
                          </button>
                          <span className="cart-item-qty-val">{item.quantity}</span>
                          <button
                            type="button"
                            className="qty-btn"
                            aria-label="Increase quantity"
                            onClick={() => updateCartItemQuantity(item.sku, item.quantity + 1)}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="cart-item-remove"
                            onClick={() => updateCartItemQuantity(item.sku, 0)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="cart-summary-row">
                    <span>Subtotal</span>
                    <strong>${cartSubtotal.toFixed(2)}</strong>
                  </div>
                </div>

                <button
                  className="checkout-button"
                  type="button"
                  onClick={() => {
                    window.alert(
                      `Checkout form for ${selectedStore.name} will open here.`,
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