"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ChevronRight,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Utensils,
} from "lucide-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { useBranch } from "@/lib/hooks/useBranch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ThemeToggle"
import { BranchSelector } from "@/components/dashboard/BranchSelector"

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { currentBranch } = useBranch()
  const { isMobile } = useSidebar()

  // Get the role from the user or from the URL path
  const role = user?.role || pathname.split("/")[1]

  // Define navigation items based on user role
  const navItems = React.useMemo(() => {
    const items = []

    // Dashboard - for all users
    const dashboardPath = role ? `/${role}/dashboard` : "/dashboard"
    items.push({
      title: "Dashboard",
      url: dashboardPath,
      icon: LayoutDashboard,
      isActive: pathname === dashboardPath,
    })

    // POS - for cashiers, waiters, managers, admins, owners
    if (["cashier", "waiter", "manager", "admin", "owner", "super-admin"].includes(role)) {
      const posBasePath = `/${role}/pos`
      items.push({
        title: "Point of Sale",
        url: posBasePath,
        icon: ShoppingCart,
        isActive: pathname.startsWith(posBasePath),
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
        isActive: pathname.startsWith(kitchenBasePath),
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
        isActive: pathname.startsWith(inventoryBasePath),
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
        isActive: pathname.startsWith(menuBasePath),
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
        isActive: pathname.startsWith(staffBasePath),
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
        url: `${branchesBasePath}/`,
        icon: Store,
        isActive: pathname.startsWith(branchesBasePath),
        items: [
          {
            title: "Manage Branches",
            url: `${branchesBasePath}/`,
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
        isActive: pathname.startsWith(reportsBasePath),
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
      isActive: pathname.startsWith(settingsBasePath),
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
  }, [pathname, role])

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

  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={role ? `/${role}/dashboard` : "/dashboard"}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Utensils className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user?.restaurantName || "Restaurant"}</span>
                  <span className="truncate text-xs">{currentBranch?.name || "Default Branch"}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Branch Selector for admin/owner users */}
        {["admin", "owner", "super-admin"].includes(role) && <BranchSelector />}
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={item.isActive}>
                    <Link href={item.url}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.items?.length ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction className="data-[state=open]:rotate-90">
                          <ChevronRight className="size-4" />
                          <span className="sr-only">Toggle</span>
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : null}
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Secondary Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            {secondaryNavItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild size="sm">
                  <Link href={item.url}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
                    <AvatarFallback className="rounded-lg">
                      {user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name || "User"}</span>
                    <span className="truncate text-xs">{user?.email || "user@example.com"}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} />
                      <AvatarFallback className="rounded-lg">
                        {user?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name || "User"}</span>
                      <span className="truncate text-xs">{user?.email || "user@example.com"}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${role}/settings/profile`}>
                    <Settings className="mr-2 size-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ThemeToggle variant="item" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
