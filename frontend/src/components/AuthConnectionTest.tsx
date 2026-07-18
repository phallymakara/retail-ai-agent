import { useEffect, useState } from "react"

import { authClient } from "../lib/auth"

export function AuthConnectionTest() {
    const [status, setStatus] = useState(
        "Checking Neon Auth...",
    )

    useEffect(() => {
        let active = true

        async function checkSession() {
            try {
                const result = await authClient.getSession()

                if (!active) {
                    return
                }

                if (result.error) {
                    setStatus(
                        `Neon Auth error: ${result.error.message}`,
                    )
                    return
                }

                if (result.data?.user) {
                    setStatus(
                        `Signed in as ${result.data.user.email}`,
                    )
                } else {
                    setStatus(
                        "Neon Auth connected — no active session",
                    )
                }
            } catch (error) {
                if (!active) {
                    return
                }

                setStatus(
                    error instanceof Error
                        ? error.message
                        : "Unable to connect to Neon Auth",
                )
            }
        }

        void checkSession()

        return () => {
            active = false
        }
    }, [])

    return (
        <div className="auth-test-status">
            {status}
        </div>
    )
}