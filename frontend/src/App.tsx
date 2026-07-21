import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import ReactMarkdown from "react-markdown"
import "./App.css"
import { ProductCards } from "./components/ProductCards"
import type { CartItem, OrderResponse } from "./types/order"
import { createOrder, getUserOrders } from "./services/orderApi"

import {
  deleteConversation,
  getConversationDetails,
  getUserConversations as getSavedConversations,
  sendChatMessageStream,
} from "./services/chatApi"
import type { ChatMessage, ConversationSummary } from "./types/chat"

import { AuthButton } from "./components/AuthButton"
import { DiscoverPage } from "./components/DiscoverPage"
import { InventoryProposalCard } from "./components/InventoryProposalCard"
import { ReorderAlertsCard } from "./components/ReorderAlertsCard"
import { AuditReportCard } from "./components/AuditReportCard"
import { DemandForecastCard } from "./components/DemandForecastCard"
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

export const ALL_BRANCHES_STORE: StoreBranch = {
  code: "",
  name: "All Store Branches",
  address: "All Locations across Cambodia",
  phone: "Multi-branch Overview",
}

const customerSuggestedQuestions = [
  "Do you have fresh milk in Siem Reap?",
  "Show me active promotions",
  "Find jasmine rice",
  "Which products are available at BKK1?",
]

const staffSuggestedQuestions = [
  "Show AI sales & demand forecast for stockouts",
  "Which items are low in stock or need reordering?",
  "Transfer 10 units of MILK-UHT-1L from PP-BKK1 to PP-TTP",
  "Generate inventory report for PP-BKK1",
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

const GUEST_QUESTION_LIMIT = 3

function App() {
  const { user } = useAuth()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [guestQuestionCount, setGuestQuestionCount] = useState<number>(() => {
    const saved = localStorage.getItem("guest_question_count")
    return saved ? parseInt(saved, 10) || 0 : 0
  })

  const isGuestLimitReached = !user && guestQuestionCount >= GUEST_QUESTION_LIMIT

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
  const [activeView, setActiveView] = useState<"chat" | "discover">("chat")

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [customerPhone, setCustomerPhone] = useState("")
  const [fulfillmentType, setFulfillmentType] = useState<"pickup" | "delivery">("pickup")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [customerNote, setCustomerNote] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pay_at_store">("cash")
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<OrderResponse | null>(null)

  // Left Sidebar & History State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<"chat" | "orders">("chat")

  const isStaffUser = Boolean(
    user?.email &&
    (user.email.toLowerCase().includes("admin") || user.email.toLowerCase().includes("staff"))
  )

  useEffect(() => {
    if (isStaffUser && sidebarTab === "orders") {
      setSidebarTab("chat")
    }
  }, [isStaffUser, sidebarTab])

  type OrderDateFilter = "all" | "today" | "yesterday" | "week" | "month"
  const [orderDateFilter, setOrderDateFilter] = useState<OrderDateFilter>("all")

  const [userOrders, setUserOrders] = useState<OrderResponse[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [orderHistoryError, setOrderHistoryError] = useState<string | null>(null)

  const filteredUserOrders = useMemo(() => {
    if (orderDateFilter === "all") return userOrders

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)

    return userOrders.filter((order) => {
      const orderDate = new Date(order.created_at)

      if (orderDateFilter === "today") {
        return orderDate >= startOfToday
      }

      if (orderDateFilter === "yesterday") {
        return orderDate >= startOfYesterday && orderDate < startOfToday
      }

      if (orderDateFilter === "week") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return orderDate >= sevenDaysAgo
      }

      if (orderDateFilter === "month") {
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        )
      }

      return true
    })
  }, [userOrders, orderDateFilter])

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [userConversations, setUserConversations] = useState<ConversationSummary[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [chatHistoryError, setChatHistoryError] = useState<string | null>(null)

  const fetchUserOrders = async () => {
    if (!user) return
    setIsLoadingOrders(true)
    setOrderHistoryError(null)
    try {
      const orders = await getUserOrders(user.id)
      setUserOrders(orders)
    } catch (err) {
      setOrderHistoryError(
        err instanceof Error ? err.message : "Failed to load order history.",
      )
    } finally {
      setIsLoadingOrders(false)
    }
  }

  const fetchUserConversations = async () => {
    if (!user) return
    setIsLoadingConversations(true)
    setChatHistoryError(null)
    try {
      const convs = await getSavedConversations(user.id)
      setUserConversations(convs)
    } catch (err) {
      setChatHistoryError(
        err instanceof Error ? err.message : "Failed to load chat history.",
      )
    } finally {
      setIsLoadingConversations(false)
    }
  }

  useEffect(() => {
    if (user && isSidebarOpen) {
      if (sidebarTab === "chat") {
        void fetchUserConversations()
      } else if (sidebarTab === "orders") {
        void fetchUserOrders()
      }
    }
  }, [user, isSidebarOpen, sidebarTab])

  async function loadSelectedConversation(convId: string) {
    setIsLoading(true)
    setError(null)

    try {
      const conv = await getConversationDetails(convId)
      setCurrentConversationId(conv.id)
      setPreviousResponseId(conv.response_id)

      if (conv.store_code) {
        const foundStore = storeBranches.find((s) => s.code === conv.store_code)
        if (foundStore) {
          setSelectedStore(foundStore)
        }
      }

      const loadedMessages: ChatMessage[] = conv.messages.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        toolExecutions: msg.tool_executions ? (msg.tool_executions as any) : undefined,
        timestamp: new Date(msg.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }))

      setMessages(loadedMessages)
    } catch (err) {
      setChatHistoryError(
        err instanceof Error ? err.message : "Failed to load conversation details.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDeleteConversation(convId: string, event: React.MouseEvent) {
    event.stopPropagation()
    try {
      await deleteConversation(convId)
      setUserConversations((prev) => prev.filter((c) => c.id !== convId))
      if (currentConversationId === convId) {
        startNewConversation()
      }
    } catch (err) {
      setChatHistoryError(
        err instanceof Error ? err.message : "Failed to delete conversation.",
      )
    }
  }

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

    if (!user && guestQuestionCount >= GUEST_QUESTION_LIMIT) {
      setError("You have reached the limit of 3 questions for guest users. signed in require")
      setIsAuthModalOpen(true)
      return
    }

    if (!user) {
      setGuestQuestionCount((prev) => {
        const next = prev + 1
        localStorage.setItem("guest_question_count", String(next))
        return next
      })
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
          conversation_id: currentConversationId,
          auth_user_id: user?.id,
          user_email: user?.email,
          user_role: (user?.email && (user.email.toLowerCase().includes("admin") || user.email.toLowerCase().includes("staff"))) ? "staff" : "customer",
          is_authenticated: Boolean(user),
          guest_question_count: guestQuestionCount,
          has_image: Boolean(activeImage),
        },
        (chunk) => {
          if (chunk.type === "conversation_id" && chunk.conversation_id) {
            setCurrentConversationId(chunk.conversation_id)
            return
          }

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
    if (isGuestLimitReached) {
      setError("You have reached the limit of 3 questions for guest users.")
      setIsAuthModalOpen(true)
      return
    }
    void submitMessage(input, selectedImage)
  }

  async function handlePlaceOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || cartItems.length === 0) {
      setIsAuthModalOpen(true)
      return
    }

    setIsPlacingOrder(true)
    setError(null)

    try {
      const order = await createOrder({
        store_code: selectedStore.code,
        customer_name: user.name,
        customer_phone: customerPhone,
        customer_email: user.email,
        auth_user_id: user.id,
        is_authenticated: true,
        fulfillment_type: fulfillmentType,
        delivery_address: fulfillmentType === "delivery" ? deliveryAddress : null,
        customer_note: customerNote || null,
        payment_method: paymentMethod,
        items: cartItems.map((item) => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      })

      setPlacedOrder(order)
      setCartItems([])
      setIsCheckoutOpen(false)
      setIsCartOpen(false)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to place order. Please try again.",
      )
    } finally {
      setIsPlacingOrder(false)
    }
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
    setCurrentConversationId(null)
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
          <button
            type="button"
            className="logo-toggle-btn"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            title="Toggle Sidebar"
          >
            <img
              src={logoUrl}
              alt="Store logo"
              className="brand-avatar-img"
              onError={() => {
                setLogoUrl("https://img.icons8.com/color/96/shop.png")
              }}
            />
          </button>

          <div className="brand-info">
            <h1>{isStaffUser ? "Staff Inventory Assistant" : "Shopping Assistant"}</h1>
          </div>
        </div>

        <div className="header-actions">
          {!isStaffUser && (
            activeView === "chat" ? (
              <button
                type="button"
                className="discover-button"
                onClick={() => setActiveView("discover")}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Discover</span>
              </button>
            ) : (
              <button
                type="button"
                className="chat-nav-button"
                onClick={() => setActiveView("chat")}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Chat Assistant</span>
              </button>
            )
          )}

          {!isStaffUser && (
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
          )}

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

                {/* All Store Branches Option */}
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedStore.code === ALL_BRANCHES_STORE.code}
                  className={`store-dropdown-item ${selectedStore.code === ALL_BRANCHES_STORE.code ? "store-dropdown-item--active" : ""}`}
                  onClick={() => handleStoreChange(ALL_BRANCHES_STORE)}
                >
                  <div className="store-item-name">All Store Branches</div>
                  <div className="store-item-address">View & audit stock across all retail branches</div>
                </button>
                <div className="store-dropdown-divider" />

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

          <AuthButton
            externalIsOpen={isAuthModalOpen}
            onRequestClose={() => setIsAuthModalOpen(false)}
          />
        </div>
      </header>

      {activeView === "discover" ? (
        <DiscoverPage
          onAddToCart={addToCart}
          storeName={selectedStore.name}
          onSwitchToChat={() => setActiveView("chat")}
        />
      ) : (
        <div className="app-body">
        {isSidebarOpen && (
          <aside className="app-sidebar">
            <div className="sidebar-tabs">
              <button
                type="button"
                className={`sidebar-tab ${sidebarTab === "chat" || isStaffUser ? "sidebar-tab--active" : ""}`}
                onClick={() => setSidebarTab("chat")}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span>Chat History</span>
              </button>

              {!isStaffUser && (
                <button
                  type="button"
                  className={`sidebar-tab ${sidebarTab === "orders" ? "sidebar-tab--active" : ""}`}
                  onClick={() => setSidebarTab("orders")}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <span>Order History</span>
                </button>
              )}
            </div>

            <div className="sidebar-content">
              {!user ? (
                <div className="sidebar-auth-prompt">
                  <p>Sign in to view your chat history.</p>
                  <button
                    type="button"
                    className="sidebar-signin-btn"
                    onClick={() => setIsAuthModalOpen(true)}
                  >
                    Sign in
                  </button>
                </div>
              ) : (sidebarTab === "chat" || isStaffUser) ? (
                <div className="sidebar-section">
                  <button
                    type="button"
                    className="sidebar-new-chat-btn"
                    onClick={() => startNewConversation(selectedStore)}
                  >
                    + New Chat
                  </button>

                  {isLoadingConversations ? (
                    <div className="sidebar-loading">Loading saved chats...</div>
                  ) : chatHistoryError ? (
                    <div className="sidebar-error">{chatHistoryError}</div>
                  ) : userConversations.length === 0 ? (
                    <div className="sidebar-empty">No past chat conversations found.</div>
                  ) : (
                    <div className="sidebar-list">
                      {userConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`sidebar-item ${
                            conv.id === currentConversationId ? "sidebar-item--active" : ""
                          }`}
                          onClick={() => void loadSelectedConversation(conv.id)}
                        >
                          <div className="sidebar-item-info">
                            <strong className="sidebar-item-title">{conv.title}</strong>
                            <span className="sidebar-item-sub">
                              {new Date(conv.updated_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="sidebar-item-delete"
                            onClick={(e) => void handleDeleteConversation(conv.id, e)}
                            title="Delete chat"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="sidebar-section">
                  <div className="order-filter-chips">
                    <button
                      type="button"
                      className={`filter-chip ${orderDateFilter === "all" ? "filter-chip--active" : ""}`}
                      onClick={() => setOrderDateFilter("all")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orderDateFilter === "today" ? "filter-chip--active" : ""}`}
                      onClick={() => setOrderDateFilter("today")}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orderDateFilter === "yesterday" ? "filter-chip--active" : ""}`}
                      onClick={() => setOrderDateFilter("yesterday")}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orderDateFilter === "week" ? "filter-chip--active" : ""}`}
                      onClick={() => setOrderDateFilter("week")}
                    >
                      This Week
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${orderDateFilter === "month" ? "filter-chip--active" : ""}`}
                      onClick={() => setOrderDateFilter("month")}
                    >
                      This Month
                    </button>
                  </div>

                  {isLoadingOrders ? (
                    <div className="sidebar-loading">Loading order history...</div>
                  ) : orderHistoryError ? (
                    <div className="sidebar-error">{orderHistoryError}</div>
                  ) : userOrders.length === 0 ? (
                    <div className="sidebar-empty">You haven’t placed any orders yet.</div>
                  ) : filteredUserOrders.length === 0 ? (
                    <div className="sidebar-empty">No orders found for this period.</div>
                  ) : (
                    <div className="sidebar-list">
                      {filteredUserOrders.map((order) => (
                        <div key={order.id} className="sidebar-order-card">
                          <div className="sidebar-order-top">
                            <strong>Order #{order.order_number}</strong>
                            <span className={`order-status-badge status--${order.status}`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="sidebar-order-store">{order.store_name}</div>
                          <div className="sidebar-order-items-preview">
                            {order.items.map((it) => (
                              <div key={it.sku} className="sidebar-order-item-row">
                                <span>{it.name} × {it.quantity}</span>
                                <strong>${it.line_total}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="sidebar-order-bottom">
                            <span>{new Date(order.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                            <strong className="sidebar-order-total">${order.total_amount} {order.currency}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

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
                      <>
                        {message.toolExecutions.map((exec, idx) => {
                          if (
                            (exec.name === "propose_stock_adjustment" || exec.name === "propose_stock_transfer") &&
                            exec.result &&
                            typeof exec.result === "object" &&
                            !("error" in exec.result)
                          ) {
                            return <InventoryProposalCard key={`proposal-${idx}`} proposal={exec.result as any} />
                          }
                          if (exec.name === "predictive_demand_forecast" && Array.isArray(exec.result)) {
                            return (
                              <DemandForecastCard
                                key={`forecast-${idx}`}
                                forecasts={exec.result as any}
                                onProposeAction={(promptText) => void submitMessage(promptText)}
                              />
                            )
                          }
                          if (exec.name === "check_reorder_alerts" && Array.isArray(exec.result)) {
                            return <ReorderAlertsCard key={`reorder-${idx}`} alerts={exec.result as any} />
                          }
                          if (exec.name === "get_inventory_audit_logs" && Array.isArray(exec.result)) {
                            return <AuditReportCard key={`audit-${idx}`} auditLogs={exec.result as any} />
                          }
                          if (
                            exec.name === "generate_inventory_report" &&
                            exec.result &&
                            typeof exec.result === "object" &&
                            !("error" in exec.result)
                          ) {
                            return <AuditReportCard key={`report-${idx}`} report={exec.result as any} />
                          }
                          return null
                        })}

                        <ProductCards
                          executions={message.toolExecutions}
                          onAddToCart={addToCart}
                          isStaff={isStaffUser}
                        />
                      </>
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
                  {(
                    user?.email &&
                    (user.email.toLowerCase().includes("admin") || user.email.toLowerCase().includes("staff"))
                      ? staffSuggestedQuestions
                      : customerSuggestedQuestions
                  ).map((question) => (
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
            {!user && isGuestLimitReached && (
              <p className="guest-limit-text">You have reached the limit of 3 questions for guest users.</p>
            )}

            {error && (
              <div className="error-message" role="alert">
                <span>{error}</span>

                {!user && (
                  <button
                    type="button"
                    className="error-auth-button"
                    onClick={() => setIsAuthModalOpen(true)}
                  >
                    Sign in
                  </button>
                )}

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
                disabled={isGuestLimitReached || isLoading}
                onClick={handlePlusClick}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
              </button>

              <textarea
                value={input}
                disabled={isGuestLimitReached || isLoading}
                placeholder={
                  isGuestLimitReached
                    ? "Guest question limit reached (3/3). Please sign in to continue."
                    : "Ask about products, stock, stores, or promotions..."
                }
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
                disabled={isGuestLimitReached || (!input.trim() && !selectedImage) || isLoading}
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
    </div>
  )}

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
                          className="cart-item-image"
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

                {!user ? (
                  <div className="cart-auth-notice">
                    <div className="cart-auth-message">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>You must be signed in to place an order.</span>
                    </div>
                    <button
                      className="checkout-button checkout-button--signin"
                      type="button"
                      onClick={() => {
                        setIsCartOpen(false)
                        setIsAuthModalOpen(true)
                      }}
                    >
                      Sign in to checkout
                    </button>
                  </div>
                ) : (
                  <button
                    className="checkout-button"
                    type="button"
                    onClick={() => setIsCheckoutOpen(true)}
                  >
                    Continue to checkout
                  </button>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      {/* Checkout Dialog Modal */}
      {isCheckoutOpen && user && (
        <div className="checkout-overlay" onClick={() => setIsCheckoutOpen(false)}>
          <div className="checkout-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="checkout-dialog__header">
              <h2>Checkout Order</h2>
              <button type="button" onClick={() => setIsCheckoutOpen(false)}>✕</button>
            </div>

            <form onSubmit={handlePlaceOrder} className="checkout-form">
              <div className="form-group">
                <label>Store Branch</label>
                <input type="text" disabled value={selectedStore.name} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Customer Name</label>
                  <input type="text" disabled value={user.name} />
                </div>
                <div className="form-group">
                  <label>Customer Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 012345678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Fulfillment Type</label>
                <div className="fulfillment-options">
                  <button
                    type="button"
                    className={`fulfillment-option ${fulfillmentType === "pickup" ? "active" : ""}`}
                    onClick={() => setFulfillmentType("pickup")}
                  >
                    🏪 Pickup at Store
                  </button>
                  <button
                    type="button"
                    className={`fulfillment-option ${fulfillmentType === "delivery" ? "active" : ""}`}
                    onClick={() => setFulfillmentType("delivery")}
                  >
                    🛵 Delivery
                  </button>
                </div>
              </div>

              {fulfillmentType === "delivery" && (
                <label>
                  Delivery Address *
                  <textarea
                    required
                    placeholder="Enter full delivery address in Cambodia..."
                    rows={2}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </label>
              )}

              <label>
                Payment Method
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash" | "pay_at_store")}
                >
                  <option value="cash">Cash on Delivery / Pickup</option>
                  <option value="pay_at_store">Pay at Store Counter</option>
                </select>
              </label>

              <label>
                Order Note (Optional)
                <input
                  type="text"
                  placeholder="Special instructions..."
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                />
              </label>

              <div className="checkout-order-summary">
                <div className="summary-row">
                  <span>Items count:</span>
                  <span>{cartQuantity}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Amount:</span>
                  <strong>${cartSubtotal.toFixed(2)}</strong>
                </div>
              </div>

              <div className="checkout-actions">
                <button
                  type="button"
                  className="checkout-cancel-btn"
                  onClick={() => setIsCheckoutOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="checkout-submit-btn"
                  disabled={isPlacingOrder || !customerPhone.trim() || (fulfillmentType === "delivery" && !deliveryAddress.trim())}
                >
                  {isPlacingOrder ? "Placing Order..." : `Place Order ($${cartSubtotal.toFixed(2)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Success Confirmation Modal */}
      {placedOrder && (
        <div className="order-success-overlay" onClick={() => setPlacedOrder(null)}>
          <div className="order-success-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon">✓</div>
            <h2>Order Confirmed!</h2>
            <p className="order-number">Order #{placedOrder.order_number}</p>
            <p className="order-store">Store: {placedOrder.store_name}</p>
            <div className="order-total-badge">
              Total Paid: ${placedOrder.total_amount} {placedOrder.currency}
            </div>

            <div className="placed-items-list">
              <h4>Order Items ({placedOrder.items.length}):</h4>
              {placedOrder.items.map((item) => (
                <div key={item.sku} className="placed-item-row">
                  <span>{item.name} x {item.quantity}</span>
                  <strong>${item.line_total}</strong>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="order-done-btn"
              onClick={() => setPlacedOrder(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default App