import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
import type { ReactNode } from "react"

import { authClient } from "../lib/auth"

export interface AuthUser {
    id: string
    email: string
    name: string
    image: string | null
    emailVerified: boolean
}

interface AuthContextValue {
    user: AuthUser | null
    isLoading: boolean
    refreshSession: () => Promise<void>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(
    null,
)

interface AuthProviderProps {
    children: ReactNode
}

export function AuthProvider({
    children,
}: AuthProviderProps) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const refreshSession = useCallback(async () => {
        const result = await authClient.getSession()

        if (result.error || !result.data?.user) {
            setUser(null)
            return
        }

        const sessionUser = result.data.user

        setUser({
            id: sessionUser.id,
            email: sessionUser.email,
            name: sessionUser.name ?? sessionUser.email,
            image: sessionUser.image ?? null,
            emailVerified:
                sessionUser.emailVerified ?? false,
        })
    }, [])

    useEffect(() => {
        let active = true

        async function loadSession() {
            try {
                const result = await authClient.getSession()

                if (!active) {
                    return
                }

                if (result.data?.user) {
                    const sessionUser = result.data.user

                    setUser({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        name:
                            sessionUser.name ?? sessionUser.email,
                        image: sessionUser.image ?? null,
                        emailVerified:
                            sessionUser.emailVerified ?? false,
                    })
                }
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        void loadSession()

        return () => {
            active = false
        }
    }, [])

    const signOut = useCallback(async () => {
        await authClient.signOut()
        setUser(null)
    }, [])

    const value = useMemo(
        () => ({
            user,
            isLoading,
            refreshSession,
            signOut,
        }),
        [user, isLoading, refreshSession, signOut],
    )

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider",
        )
    }

    return context
}