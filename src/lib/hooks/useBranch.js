"use client"

import { useEffect } from "react"
import { useBranchStore } from "@/lib/store/branch"
import { useAuthStore } from "@/lib/store/auth"
import { useSocketStore } from "@/lib/store/socket"

export function useBranch() {
  const {
    branches,
    currentBranch,
    isLoading,
    error,
    fetchBranches,
    setCurrentBranch,
    initializeBranchFromUser,
    clearBranchData,
  } = useBranchStore()

  const { user, isAuthenticated, sessionId } = useAuthStore()
  const { socket, isConnected, emit } = useSocketStore()

  // Initialize branch data when user logs in
  useEffect(() => {
    if (isAuthenticated && user && !currentBranch) {
      console.log("Initializing branch from user data:", user)
      // Initialize branch from user data
      const initialized = initializeBranchFromUser(user)
      console.log("Branch initialized from user data:", initialized)

      // For admin/owner users, fetch all branches
      if (
        isConnected &&
        user.restaurantId &&
        ["owner", "admin", "super-admin"].includes(user.role) &&
        branches.length === 0 &&
        !isLoading
      ) {
        console.log("Fetching branches for restaurant:", user.restaurantId)
        fetchBranches(user.restaurantId).catch((error) => {
          console.error("Failed to fetch branches:", error)
        })
      }
    }
  }, [
    isAuthenticated,
    user,
    currentBranch,
    isConnected,
    branches.length,
    isLoading,
    initializeBranchFromUser,
    fetchBranches,
  ])

  // Get a branch by ID
  const getBranch = async (branchId) => {
    if (!socket || !isConnected) {
      return { success: false, error: "Socket not connected" }
    }

    if (!sessionId) {
      return { success: false, error: "No active session" }
    }

    return new Promise((resolve) => {
      emit("branches:get", { branchId, sessionId }, (response) => {
        resolve(response)
      })
    })
  }

  // Create a new branch
  const createBranch = async (branchData) => {
    if (!socket || !isConnected) {
      return { success: false, error: "Socket not connected" }
    }

    if (!sessionId) {
      return { success: false, error: "No active session" }
    }

    return new Promise((resolve) => {
      // Include sessionId in the payload
      emit("branches:create", { ...branchData, sessionId }, (response) => {
        if (response.success && user?.restaurantId) {
          // Refresh branches list
          fetchBranches(user.restaurantId)
        }
        resolve(response)
      })
    })
  }

  // Update a branch
  const updateBranch = async (branchData) => {
    if (!socket || !isConnected) {
      return { success: false, error: "Socket not connected" }
    }

    if (!sessionId) {
      return { success: false, error: "No active session" }
    }

    return new Promise((resolve) => {
      // Include sessionId in the payload
      emit("branches:update", { ...branchData, sessionId }, (response) => {
        if (response.success && user?.restaurantId) {
          // Refresh branches list
          fetchBranches(user.restaurantId)
        }
        resolve(response)
      })
    })
  }

  // Delete a branch
  const deleteBranch = async (branchId) => {
    if (!socket || !isConnected) {
      return { success: false, error: "Socket not connected" }
    }

    if (!sessionId) {
      return { success: false, error: "No active session" }
    }

    return new Promise((resolve, reject) => {
      // Include sessionId in the payload
      emit("branches:delete", { branchId, sessionId }, (response) => {
        if (response.success && user?.restaurantId) {
          // Refresh branches list
          fetchBranches(user.restaurantId)
          resolve(response)
        } else {
          reject(new Error(response.error || "Failed to delete branch"))
        }
      })
    })
  }

  return {
    branches,
    currentBranch,
    isLoading,
    error,
    fetchBranches,
    getBranch,
    createBranch,
    updateBranch,
    deleteBranch,
    setCurrentBranch,
    clearBranchData,
  }
}
