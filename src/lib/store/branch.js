import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useSocketStore } from "./socket"
import { useAuthStore } from "./auth"

export const useBranchStore = create(
  persist(
    (set, get) => ({
      // Branch data
      branches: [],
      currentBranch: null,
      loading: false,
      error: null,

      // Fetch all branches for a restaurant
      fetchBranches: async (restaurantId) => {
        if (!restaurantId) {
          console.error('Restaurant ID is required')
          return
        }

        const socket = useSocketStore.getState().socket
        if (!socket?.connected) {
          console.error('Socket not connected')
          return
        }

        set({ loading: true, error: null })

        try {
          const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Request timed out'))
            }, 10000)

            socket.emit('branches:getAll', { restaurantId }, (response) => {
              clearTimeout(timeout)
              if (response.error) {
                reject(new Error(response.error))
              } else {
                resolve(response)
              }
            })
          })

          set({ 
            branches: response.branches || [], 
            loading: false,
            error: null 
          })
        } catch (error) {
          console.error('Error fetching branches:', error)
          set({ 
            error: error.message || 'Failed to fetch branches',
            loading: false,
            branches: [] 
          })
        }
      },

      // Set current branch
      setCurrentBranch: (branch) => {
        set({ currentBranch: branch })
      },

      // Initialize branch from user data
      initializeBranchFromUser: (user) => {
        if (user?.restaurantId) {
          get().fetchBranches(user.restaurantId)
        }
      },

      // Clear branch data (for logout)
      reset: () => {
        set({
          branches: [],
          currentBranch: null,
          loading: false,
          error: null
        })
      },
    }),
    {
      name: "branch-storage", // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        currentBranch: state.currentBranch,
      }),
    },
  ),
)
