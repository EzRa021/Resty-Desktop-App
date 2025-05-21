"use client"

import { useEffect } from "react"
import { useSocketStore } from "@/lib/store/socket"

/**
 * Hook to initialize and use the socket connection
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Whether to automatically connect on mount (default: true)
 * @returns {Object} Socket store methods and state
 */
export function useSocket({ autoConnect = true } = {}) {
  const {
    socket,
    isConnected,
    isConnecting,
    error: connectionError,
    initSocket,
    disconnect: disconnectSocket,
    emit,
    on,
    off,
  } = useSocketStore()

  // Auto-connect on mount if specified
  useEffect(() => {
    if (autoConnect && !socket && !isConnecting) {
      console.log("Auto-connecting socket...")
      initSocket()
    }

    // Clean up socket connection on unmount
    return () => {
      // We don't disconnect here to maintain the connection across the app
      // If you want to disconnect on component unmount, uncomment:
      // disconnectSocket();
    }
  }, [autoConnect, socket, isConnecting, initSocket])

  // Add effect to log socket status changes
  useEffect(() => {
    console.log("Socket connection status:", { isConnected, isConnecting, connectionError })
  }, [isConnected, isConnecting, connectionError])

  return {
    socket,
    isConnected,
    isConnecting,
    connectionError,
    connect: initSocket,
    disconnect: disconnectSocket,
    emit,
    on,
    off,
  }
}
