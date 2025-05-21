"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"

import { useBranch } from "@/lib/hooks/useBranch"
import { useAuth } from "@/lib/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { BranchForm } from "@/components/branches/branch-form"

export default function NewBranchPage() {
  const router = useRouter()
  const { user } = useAuth({ requireAuth: true })
  const { createBranch } = useBranch()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (formData) => {
    if (!user?.restaurantId) {
      toast.error("Restaurant ID is required")
      return
    }

    try {
      setIsSubmitting(true)

      // Add restaurant ID to form data
      const branchData = {
        ...formData,
        restaurantId: user.restaurantId,
      }

      const result = await createBranch(branchData)

      if (result.success) {
        toast.success("Branch created successfully")
        router.push("/admin/branches")
      } else {
        toast.error(result.error || "Failed to create branch")
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin/branches">Branches</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>New Branch</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => router.push("/admin/branches")}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">Create New Branch</h1>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Branch Information</CardTitle>
            <CardDescription>Add a new branch to your restaurant. Fill in all required fields.</CardDescription>
          </CardHeader>
          <CardContent>
            <BranchForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"

import { useBranch } from "@/lib/hooks/useBranch"
import { useAuth } from "@/lib/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { BranchForm } from "@/components/branches/branch-form"

export default function NewBranchPage() {
  const router = useRouter()
  const { user } = useAuth({ requireAuth: true })
  const { createBranch } = useBranch()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (formData) => {
    if (!user?.restaurantId) {
      toast.error("Restaurant ID is required")
      return
    }

    try {
      setIsSubmitting(true)

      // Add restaurant ID to form data
      const branchData = {
        ...formData,
        restaurantId: user.restaurantId,
      }

      const result = await createBranch(branchData)

      if (result.success) {
        toast.success("Branch created successfully")
        router.push("/admin/branches")
      } else {
        toast.error(result.error || "Failed to create branch")
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin/branches">Branches</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>New Branch</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => router.push("/admin/branches")}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">Create New Branch</h1>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Branch Information</CardTitle>
            <CardDescription>Add a new branch to your restaurant. Fill in all required fields.</CardDescription>
          </CardHeader>
          <CardContent>
            <BranchForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
