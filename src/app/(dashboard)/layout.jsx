"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/hooks/useAuth"
import { useBranch } from "@/lib/hooks/useBranch"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading } = useAuth({ requireAuth: true })
  // Add this line to initialize branch data
  const { fetchBranches } = useBranch()

  // Add a useEffect to fetch branches when user is authenticated
  useEffect(() => {
    if (user && isAuthenticated && user.restaurantId && ["owner", "admin", "super-admin"].includes(user.role)) {
      console.log("Fetching branches for restaurant:", user.restaurantId)
      fetchBranches(user.restaurantId).catch((error) => {
        console.error("Failed to fetch branches:", error)
      })
    }
  }, [user, isAuthenticated, fetchBranches])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isLoading, isAuthenticated, router])

  // Redirect to role-specific dashboard if on the wrong dashboard
  useEffect(() => {
    if (user && isAuthenticated && !isLoading) {
      const role = user.role

      // Define role-specific dashboard paths
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

      // Get the current role from the pathname
      const currentRolePath = pathname.split("/")[1]
      const expectedRolePath = roleDashboardPaths[role]?.split("/")[1]

      // If user is on the wrong dashboard, redirect to the correct one
      // Skip this check for the main /dashboard route which handles its own redirection
      if (
        expectedRolePath &&
        currentRolePath !== expectedRolePath &&
        pathname !== "/dashboard" &&
        !pathname.startsWith("/_next")
      ) {
        console.log(`Redirecting from ${pathname} to ${roleDashboardPaths[role]}`)
        router.replace(roleDashboardPaths[role])
      }
    }
  }, [user, isAuthenticated, isLoading, pathname, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  // Get the current role from the pathname for the sidebar
  const currentRole = pathname.split("/")[1] || user?.role || ""

  return (
    <SidebarProvider>
      <AppSidebar userRole={currentRole} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
