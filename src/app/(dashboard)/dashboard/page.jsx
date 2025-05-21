"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/useAuth"

export default function DashboardRedirectPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    // Only redirect if authentication is complete (not loading) and user is authenticated
    if (!isLoading) {
      if (isAuthenticated && user) {
        // Redirect to role-specific dashboard
        const roleDashboardPaths = {
          owner: "/owner/dashboard",
          admin: "/admin/dashboard",
          "super-admin": "/admin/dashboard",
          manager: "/manager/dashboard",
          cashier: "/cashier/dashboard",
          waiter: "/waiter/dashboard",
          kitchen: "/kitchen/dashboard",
          inventory: "/inventory/dashboard",
        }

        const redirectPath = roleDashboardPaths[user.role]
        if (redirectPath) {
          console.log(`Redirecting to role dashboard: ${redirectPath}`)
          router.replace(redirectPath)
        }
      } else if (!isAuthenticated) {
        // If not authenticated, redirect to login
        router.replace("/login")
      }
    }
  }, [isLoading, isAuthenticated, user, router])

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  )
}
