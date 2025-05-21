import { create } from "zustand"
import { io } from "socket.io-client"
import { useAuthStore } from "./auth"

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  serverUrl: null,

  // Initialize socket connection
  initSocket: (url) => {
    const { socket } = get()

    // Don't initialize if already connected or connecting
    if (socket || get().isConnecting) return

    set({ isConnecting: true, error: null })

    try {
      // Try to get the socket URL from different sources with fallbacks
      const socketUrl = url || process.env.NEXT_PUBLIC_SOCKET_URL || window.SOCKET_URL || "http://localhost:8000"

      console.log("Connecting to socket at:", socketUrl)
      set({ serverUrl: socketUrl })

      // Get session ID from localStorage
      const sessionId = localStorage.getItem('sessionId')
      console.log("Initializing socket with session ID:", sessionId)

      const newSocket = io(socketUrl, {
        transports: ["websocket", "polling"], // Add polling as fallback
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        auth: {
          sessionId: sessionId || undefined
        }
      })

      // Set up event listeners
      newSocket.on("connect", () => {
        console.log("Socket connected with ID:", newSocket.id)
        set({ isConnected: true, isConnecting: false, error: null })
      })

      newSocket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason)
        set({ isConnected: false })
      })

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error)
        console.error("Failed to connect to server at:", socketUrl)
        console.error("Please check that your server is running and accessible")

        set({
          isConnected: false,
          isConnecting: false,
          error: `Failed to connect to server at ${socketUrl}. Please check that your server is running and accessible.`,
        })
      })

      newSocket.on("error", (error) => {
        console.error("Socket error:", error)
        set({ error: error.message || "Socket error occurred" })
      })

      // Listen for auth errors
      newSocket.on("auth_error", (error) => {
        console.error("Socket auth error:", error)
        set({ error: "Authentication failed. Please log in again." })
      })

      set({ socket: newSocket })
    } catch (error) {
      console.error("Error initializing socket:", error)
      set({
        isConnecting: false,
        error: error.message || "Failed to initialize socket connection",
      })
    }
  },

  // Set server URL manually
  setServerUrl: (url) => {
    if (!url) return

    const { socket } = get()
    if (socket) {
      socket.disconnect()
    }

    set({ serverUrl: url })
    get().initSocket(url)
  },

  // Disconnect socket
  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, isConnected: false })
    }
  },

  // Emit an event
  emit: (event, data, callback) => {
    const { socket, isConnected } = get()

    if (!socket || !isConnected) {
      console.error("Cannot emit event: socket not connected")
      if (callback) callback({ success: false, error: "Socket not connected" })
      return false
    }

    // Get current session ID and update auth if needed
    const sessionId = localStorage.getItem('sessionId')
    if (sessionId && (!socket.auth || socket.auth.sessionId !== sessionId)) {
      console.log("Updating socket auth before emit:", sessionId)
      socket.auth = { sessionId }
      // Reconnect to apply new auth
      socket.disconnect().connect()
    }

    socket.emit(event, data, callback)
    return true
  },

  // Reset socket state (for logout)
  resetSocketState: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
    }

    set({
      socket: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    })
  },
}))
