import { useState } from "react"
import type { FormEvent } from "react"
import { createPortal } from "react-dom"

import { useAuth } from "../contexts/AuthContext"
import { authClient } from "../lib/auth"

type AuthMode = "sign-in" | "sign-up"

export interface AuthButtonProps {
    externalIsOpen?: boolean
    onRequestClose?: () => void
}

export function AuthButton({ externalIsOpen, onRequestClose }: AuthButtonProps = {}) {
    const {
        user,
        isLoading,
        refreshSession,
        signOut,
    } = useAuth()

    const [internalIsOpen, setInternalIsOpen] = useState(false)
    const isOpen = externalIsOpen || internalIsOpen

    function closeModal() {
        setInternalIsOpen(false)
        onRequestClose?.()
    }

    function openModal() {
        setInternalIsOpen(true)
    }

    const [mode, setMode] = useState<AuthMode>("sign-in")
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isSubmitting, setIsSubmitting] =
        useState(false)
    const [error, setError] = useState<string | null>(
        null,
    )
    const [message, setMessage] = useState<
        string | null
    >(null)

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault()
        setError(null)
        setMessage(null)
        setIsSubmitting(true)

        try {
            const result =
                mode === "sign-up"
                    ? await authClient.signUp.email({
                        name: name.trim(),
                        email: email.trim(),
                        password,
                    })
                    : await authClient.signIn.email({
                        email: email.trim(),
                        password,
                    })

            if (result.error) {
                setError(
                    result.error.message ??
                        "Authentication failed. Please try again.",
                )
                return
            }

            await refreshSession()

            if (mode === "sign-up") {
                setMessage(
                    "Account created successfully. Check your email if verification is enabled.",
                )
            } else {
                closeModal()
            }

            setPassword("")
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Authentication failed.",
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleGoogleSignIn() {
        setError(null)
        setMessage(null)

        try {
            await authClient.signIn.social({
                provider: "google",
                callbackURL: window.location.origin,
            })
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Google sign-in failed.",
            )
        }
    }

    function changeMode(nextMode: AuthMode) {
        setMode(nextMode)
        setError(null)
        setMessage(null)
    }

    if (isLoading) {
        return (
            <button
                className="auth-header-button"
                type="button"
                disabled
            >
                Loading...
            </button>
        )
    }

    if (user) {
        return (
            <div className="account-menu">
                <button
                    className="account-button"
                    type="button"
                    onClick={() => isOpen ? closeModal() : openModal()}
                >
                    {user.image ? (
                        <img src={user.image} alt={user.name} />
                    ) : (
                        <span>
                            {user.name.charAt(0).toUpperCase()}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <div className="account-dropdown">
                        <p>{user.email}</p>

                        <button
                            type="button"
                            className="account-dropdown-signout-btn"
                            onClick={() => void signOut()}
                        >
                            Sign out
                        </button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <>
            <button
                className="auth-header-button"
                type="button"
                onClick={openModal}
            >
                Sign in
            </button>

            {isOpen && createPortal(
                <div
                    className="auth-overlay"
                    onClick={closeModal}
                >
                    <section
                        className="auth-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="auth-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="auth-dialog__header">
                            <div>
                                <span>Retail Assistant</span>
                                <h2 id="auth-title">
                                    {mode === "sign-in"
                                        ? "Sign in"
                                        : "Create your account"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                aria-label="Close"
                                onClick={closeModal}
                            >
                                ×
                            </button>
                        </div>

                        <form
                            className="auth-form"
                            onSubmit={handleSubmit}
                        >
                            {mode === "sign-up" && (
                                <label>
                                    Full name
                                    <input
                                        type="text"
                                        value={name}
                                        minLength={2}
                                        maxLength={150}
                                        required
                                        autoComplete="name"
                                        placeholder="Enter your name"
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                    />
                                </label>
                            )}

                            <label>
                                Email address
                                <input
                                    type="email"
                                    value={email}
                                    required
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                />
                            </label>

                            <label>
                                Password
                                <input
                                    type="password"
                                    value={password}
                                    minLength={8}
                                    required
                                    autoComplete={
                                        mode === "sign-up"
                                            ? "new-password"
                                            : "current-password"
                                    }
                                    placeholder="Minimum 8 characters"
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                />
                            </label>

                            {error && (
                                <div className="auth-error">
                                    {error}
                                </div>
                            )}

                            {message && (
                                <div className="auth-success">
                                    {message}
                                </div>
                            )}

                            <button
                                className="auth-submit-button"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? "Please wait..."
                                    : mode === "sign-in"
                                        ? "Sign in"
                                        : "Create account"}
                            </button>
                        </form>

                        <div className="auth-divider">
                            <span>or continue with Google</span>
                        </div>

                        <button
                            className="google-auth-button"
                            type="button"
                            onClick={() =>
                                void handleGoogleSignIn()
                            }
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: "10px", display: "block" }}>
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                            </svg>
                            Continue with Google
                        </button>

                        <p className="auth-switch">
                            {mode === "sign-in"
                                ? "Don't have an account?"
                                : "Already have an account?"}

                            <button
                                type="button"
                                onClick={() =>
                                    changeMode(
                                        mode === "sign-in"
                                            ? "sign-up"
                                            : "sign-in",
                                    )
                                }
                            >
                                {mode === "sign-in"
                                    ? "Create account"
                                    : "Sign in"}
                            </button>
                        </p>
                    </section>
                </div>,
                document.body
            )}
        </>
    )
}