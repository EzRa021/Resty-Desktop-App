"use client"
import {
  BarChart3,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Utensils,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/hooks/useAuth"
import { useBranch } from "@/lib/hooks/useBranch"
import { BranchSelector } from "./dasboard/BranchSelector"

export function AppSidebar({ userRole, ...props }) {
  const { user, logout } = useAuth()
  const { currentBranch } = useBranch()

  // Use provided userRole or get from user object
  const role = userRole || user?.role || "user"

  // Define navigation items based on user role
  const getNavItems = () => {
    const items = []

    // Dashboard - for all users
    const dashboardPath = role ? `/${role}/dashboard` : "/dashboard"
    items.push({
      title: "Dashboard",
      url: dashboardPath,
      icon: LayoutDashboard,
      isActive: true,
    })

    // POS - for cashiers, waiters, managers, admins, owners
    if (["cashier", "waiter", "manager", "admin", "owner", "super-admin"].includes(role)) {
      const posBasePath = `/${role}/pos`
      items.push({
        title: "Point of Sale",
        url: posBasePath,
        icon: ShoppingCart,
        items: [
          {
            title: "New Order",
            url: `${posBasePath}/new`,
          },
          {
            title: "Active Orders",
            url: `${posBasePath}/active`,
          },
          {
            title: "Completed Orders",
            url: `${posBasePath}/completed`,
          },
        ],
      })
    }

    // Kitchen - for kitchen staff, managers, admins, owners
    if (["kitchen", "manager", "admin", "owner", "super-admin"].includes(role)) {
      const kitchenBasePath = role === "kitchen" ? "/kitchen" : `/${role}/kitchen`
      items.push({
        title: "Kitchen",
        url: `${kitchenBasePath}/queue`,
        icon: Utensils,
        items: [
          {
            title: "Order Queue",
            url: `${kitchenBasePath}/queue`,
          },
          {
            title: "Recipes",
            url: `${kitchenBasePath}/recipes`,
          },
        ],
      })
    }

    // Inventory - for inventory staff, managers, admins, owners
    if (["inventory", "manager", "admin", "owner", "super-admin"].includes(role)) {
      const inventoryBasePath = role === "inventory" ? "/inventory" : `/${role}/inventory`
      items.push({
        title: "Inventory",
        url: `${inventoryBasePath}/stock`,
        icon: Package,
        items: [
          {
            title: "Stock Levels",
            url: `${inventoryBasePath}/stock`,
          },
          {
            title: "Suppliers",
            url: `${inventoryBasePath}/suppliers`,
          },
          {
            title: "Purchase Orders",
            url: `${inventoryBasePath}/orders`,
          },
        ],
      })
    }

    // Menu - for managers, admins, owners
    if (["manager", "admin", "owner", "super-admin"].includes(role)) {
      const menuBasePath = `/${role}/menu`
      items.push({
        title: "Menu",
        url: `${menuBasePath}/items`,
        icon: FileText,
        items: [
          {
            title: "Items",
            url: `${menuBasePath}/items`,
          },
          {
            title: "Categories",
            url: `${menuBasePath}/categories`,
          },
          {
            title: "Specials",
            url: `${menuBasePath}/specials`,
          },
        ],
      })
    }

    // Staff - for managers, admins, owners
    if (["manager", "admin", "owner", "super-admin"].includes(role)) {
      const staffBasePath = `/${role}/staff`
      items.push({
        title: "Staff",
        url: `${staffBasePath}/employees`,
        icon: Users,
        items: [
          {
            title: "Employees",
            url: `${staffBasePath}/employees`,
          },
          {
            title: "Schedules",
            url: `${staffBasePath}/schedules`,
          },
          {
            title: "Attendance",
            url: `${staffBasePath}/attendance`,
          },
        ],
      })
    }

    // Branches - for admins, owners
    if (["admin", "owner", "super-admin"].includes(role)) {
      const branchesBasePath = `/${role}/branches`
      items.push({
        title: "Branches",
        url: `${branchesBasePath}/manage`,
        icon: Store,
        items: [
          {
            title: "Manage Branches",
            url: `${branchesBasePath}/manage`,
          },
          {
            title: "Settings",
            url: `${branchesBasePath}/settings`,
          },
        ],
      })
    }

    // Reports - for managers, admins, owners
    if (["manager", "admin", "owner", "super-admin"].includes(role)) {
      const reportsBasePath = `/${role}/reports`
      items.push({
        title: "Reports",
        url: `${reportsBasePath}/sales`,
        icon: BarChart3,
        items: [
          {
            title: "Sales",
            url: `${reportsBasePath}/sales`,
          },
          {
            title: "Inventory",
            url: `${reportsBasePath}/inventory`,
          },
          {
            title: "Staff",
            url: `${reportsBasePath}/staff`,
          },
          {
            title: "Financial",
            url: `${reportsBasePath}/financial`,
          },
        ],
      })
    }

    // Settings - for all users
    const settingsBasePath = role ? `/${role}/settings` : "/settings"
    items.push({
      title: "Settings",
      url: `${settingsBasePath}/profile`,
      icon: Settings,
      items: [
        {
          title: "Profile",
          url: `${settingsBasePath}/profile`,
        },
        {
          title: "Preferences",
          url: `${settingsBasePath}/preferences`,
        },
      ],
    })

    return items
  }

  // Secondary navigation items
  const secondaryNavItems = [
    {
      title: "Help",
      url: `/${role}/help`,
      icon: Home,
    },
    {
      title: "Billing",
      url: `/${role}/billing`,
      icon: CreditCard,
    },
  ]

  // Branch projects for admin/owner
  const getBranchProjects = () => {
    if (!["admin", "owner", "super-admin"].includes(role)) {
      return []
    }

    return [
      {
        name: "Main Branch",
        url: `/${role}/branches/1`,
        icon: Store,
      },
      {
        name: "Downtown Branch",
        url: `/${role}/branches/2`,
        icon: Store,
      },
      {
        name: "Airport Branch",
        url: `/${role}/branches/3`,
        icon: Store,
      },
    ]
  }

  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={role ? `/${role}/dashboard` : "/dashboard"}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Utensils className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.restaurantName || "Restaurant"}</span>
                  <span className="truncate text-xs">{currentBranch?.name || "Default Branch"}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Branch Selector for admin/owner users */}
        {["admin", "owner", "super-admin"].includes(role) && <BranchSelector />}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={getNavItems()} />
        {["admin", "owner", "super-admin"].includes(role) && <NavProjects projects={getBranchProjects()} />}
        <NavSecondary items={secondaryNavItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={
            user || {
              name: user?.name || "User",
              email: user?.email || "user@example.com",
              avatar: user?.avatar || "/placeholder.svg",
            }
          }
          onLogout={handleLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
