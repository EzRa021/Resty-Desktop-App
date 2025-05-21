import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useSocketStore } from "./socket"
import { useBranchStore } from "./branch"

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // Auth state
      user: null,
      sessionId: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Set session ID and sync with localStorage
      setSessionId: (sessionId) => {
        if (sessionId) {
          localStorage.setItem('sessionId', sessionId)
        } else {
          localStorage.removeItem('sessionId')
        }
        set({ sessionId })
      },

      // Login
      login: async (email, password) => {
        set({ isLoading: true, error: null })

        try {
          const socket = useSocketStore.getState().socket

          if (!socket) {
            throw new Error("Socket not connected")
          }

          return new Promise((resolve, reject) => {
            socket.emit("auth:login", { email, password }, (response) => {
              if (response.success) {
                console.log("Login successful, user role:", response.user.role)
                
                // Set session ID in both store and localStorage
                get().setSessionId(response.session._id)

                set({
                  user: response.user,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                })

                // Initialize branch data
                useBranchStore.getState().initializeBranchFromUser(response.user)

                resolve(response)
              } else {
                set({
                  isLoading: false,
                  error: response.message || "Login failed",
                })
                reject(new Error(response.message || "Login failed"))
              }
            })
          })
        } catch (error) {
          set({
            isLoading: false,
            error: error.message || "Login failed",
          })
          throw error
        }
      },

      // Logout
      logout: async () => {
        const { sessionId } = get()
        set({ isLoading: true, error: null })

        try {
          const socket = useSocketStore.getState().socket

          if (!socket) {
            // Even if socket is not available, we should clear local state
            get().setSessionId(null)
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            })
            useBranchStore.getState().reset()
            return Promise.resolve({ success: true })
          }

          return new Promise((resolve, reject) => {
            socket.emit("auth:logout", { sessionId }, (response) => {
              // Always clear local state regardless of server response
              get().setSessionId(null)
              
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: response.success ? null : (response.message || "Logout failed"),
              })

              // Clear branch data
              useBranchStore.getState().reset()

              if (response.success) {
                resolve(response)
              } else {
                // Even though we report the error, we still clear local state
                reject(new Error(response.message || "Logout failed"))
              }
            })
          })
        } catch (error) {
          // Clear session even if there's an error
          get().setSessionId(null)
          
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.message || "Logout failed",
          })
          
          // Clear branch data
          useBranchStore.getState().reset()
          
          throw error
        }
      },

      // Check current session
      checkSession: async () => {
        const { sessionId } = get()
        if (!sessionId) {
          set({ isAuthenticated: false })
          return false
        }

        set({ isLoading: true, error: null })

        try {
          const socket = useSocketStore.getState().socket

          if (!socket) {
            throw new Error("Socket not connected")
          }

          return new Promise((resolve, reject) => {
            socket.emit("user:getCurrent", { sessionId }, (response) => {
              if (response.success) {
                set({
                  user: response.user,
                  isAuthenticated: true,
                  isLoading: false,
                  error: null,
                })

                // Initialize branch data
                useBranchStore.getState().initializeBranchFromUser(response.user)

                resolve(true)
              } else {
                // Clear session ID from both store and localStorage
                get().setSessionId(null)

                set({
                  user: null,
                  isAuthenticated: false,
                  isLoading: false,
                  error: response.message || "Session expired",
                })

                // Clear branch data
                useBranchStore.getState().reset()

                reject(new Error(response.message || "Session expired"))
              }
            })
          })
        } catch (error) {
          set({
            isLoading: false,
            error: error.message || "Failed to verify session",
          })
          return false
        }
      },

      // Clear auth state
      clearAuth: () => {
        // Clear session ID from both store and localStorage
        get().setSessionId(null)

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        })

        // Clear branch data
        useBranchStore.getState().reset()
      },
    }),
    {
      name: "auth-storage", // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Don't include sessionId here as it's handled separately
      }),
    },
  ),
)