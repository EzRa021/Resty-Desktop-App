"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/lib/store/auth"
import { useSocketStore } from "@/lib/store/socket"

export function AuthProvider({ children }) {
  const { sessionId, isAuthenticated, checkSession } = useAuthStore()
  const { socket, isConnected } = useSocketStore()

  // Check session when socket connects and we have a sessionId
  useEffect(() => {
    if (isConnected && sessionId && !isAuthenticated) {
      checkSession().catch((error) => {
        console.error("Session verification failed:", error)
      })
    }
  }, [isConnected, sessionId, isAuthenticated, checkSession])

  // Set up socket event listeners for auth events
  useEffect(() => {
    if (!socket) return

    // Handle auth success event
    const handleLoginSuccess = (data) => {
      console.log("Login success event received", data)
    }

    // Handle auth error event
    const handleLoginError = (data) => {
      console.error("Login error event received", data)
    }

    socket.on("auth:login:success", handleLoginSuccess)
    socket.on("auth:login:error", handleLoginError)

    return () => {
      socket.off("auth:login:success", handleLoginSuccess)
      socket.off("auth:login:error", handleLoginError)
    }
  }, [socket])

  return children
}
