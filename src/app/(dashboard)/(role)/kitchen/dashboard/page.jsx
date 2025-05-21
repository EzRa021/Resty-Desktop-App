"use client"

import { Clock, Utensils, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { useBranch } from "@/lib/hooks/useBranch"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function KitchenDashboardPage() {
  const { user } = useAuth({ requireAuth: true })
  const { currentBranch } = useBranch()

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Kitchen Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user?.name || "Chef"}</h1>
          <div className="text-sm text-muted-foreground">
            {currentBranch?.name ? `Branch: ${currentBranch.name}` : ""}
          </div>
        </div>

        <div className="flex justify-center mb-4">
          <Button size="lg" className="w-full max-w-md" asChild>
            <Link href="/kitchen/queue">
              <Utensils className="mr-2 h-5 w-5" />
              View Order Queue
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Utensils className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">7</div>
              <p className="text-xs text-muted-foreground">Orders waiting to be prepared</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground">Orders being prepared</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Items running low</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Order Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] rounded-md border border-dashed flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Order queue will appear here</p>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Low Stock Ingredients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] rounded-md border border-dashed flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Low stock ingredients will appear here</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
