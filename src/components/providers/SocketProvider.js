"use client"

import { useEffect } from "react"
import { useSocketStore } from "@/lib/store/socket"

export function SocketProvider({ children }) {
  const { initSocket, socket } = useSocketStore()

  // Initialize socket connection when the app starts
  useEffect(() => {
    if (!socket) {
      initSocket()
    }

    // We don't disconnect on unmount to maintain the connection across the app
    // If you want to clean up on app close, you'd need to handle that separately
  }, [initSocket, socket])

  return children
}
