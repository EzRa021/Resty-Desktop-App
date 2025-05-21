"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/lib/store/auth"
import { useSocketStore } from "@/lib/store/socket"
import { useRouter, usePathname } from "next/navigation"

export function useAuth({ requireAuth = false } = {}) {
  const { user, sessionId, isAuthenticated, isLoading, error, login, logout, checkSession } = useAuthStore()
  const { socket, isConnected } = useSocketStore()
  const router = useRouter()
  const pathname = usePathname()

  // Check session when socket connects
  useEffect(() => {
    if (isConnected && sessionId && !isAuthenticated && !isLoading) {
      checkSession().catch((error) => {
        console.error("Session verification failed:", error)
      })
    }
  }, [isConnected, sessionId, isAuthenticated, isLoading, checkSession])

  // Handle authentication requirement
  useEffect(() => {
    if (requireAuth && !isLoading) {
      if (!isAuthenticated) {
        // Only redirect to login if not already there
        if (!pathname.startsWith("/login")) {
          router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
        }
      }
    }
  }, [requireAuth, isAuthenticated, isLoading, router, pathname])

  // Set up socket event listeners for auth events
  useEffect(() => {
    if (!socket) return

    // Handle session expiration
    const handleSessionExpired = () => {
      logout()
    }

    // Handle forced logout (e.g., admin action)
    const handleForcedLogout = () => {
      logout()
    }

    socket.on("auth:sessionExpired", handleSessionExpired)
    socket.on("auth:forcedLogout", handleForcedLogout)

    return () => {
      socket.off("auth:sessionExpired", handleSessionExpired)
      socket.off("auth:forcedLogout", handleForcedLogout)
    }
  }, [socket, logout])

  return {
    user,
    sessionId,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    checkSession,
  }
}
