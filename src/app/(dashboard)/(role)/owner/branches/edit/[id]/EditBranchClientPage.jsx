"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"

import { useBranch } from "@/lib/hooks/useBranch"
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
import { Skeleton } from "@/components/ui/skeleton"

export default function EditBranchClientPage({ params }) {
  const router = useRouter()
  const branchId = params.id
  const { getBranch, updateBranch } = useBranch()

  const [branch, setBranch] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchBranchDetails = async () => {
      try {
        setIsLoading(true)
        const result = await getBranch(branchId)
        if (result.success) {
          setBranch(result.branch)
        } else {
          setError(result.error || "Failed to fetch branch details")
          toast.error(result.error || "Failed to fetch branch details")
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred"
        setError(errorMessage)
        toast.error(`Error: ${errorMessage}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBranchDetails()
  }, [branchId, getBranch])

  const handleSubmit = async (formData) => {
    try {
      setIsSubmitting(true)

      // Preserve the restaurant ID and branch ID
      const branchData = {
        ...formData,
        _id: branchId,
        restaurantId: branch.restaurantId,
      }

      const result = await updateBranch(branchData)

      if (result.success) {
        toast.success("Branch updated successfully")
        router.push(`/admin/branches/${branchId}`)
      } else {
        toast.error(result.error || "Failed to update branch")
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
                <BreadcrumbLink href={`/admin/branches/${branchId}`}>
                  {isLoading ? "Loading..." : branch?.name || "Branch Details"}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Edit</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => router.push(`/admin/branches/${branchId}`)}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">
                {isLoading ? <Skeleton className="h-8 w-48" /> : `Edit ${branch?.name || "Branch"}`}
              </h1>
            </div>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <h3 className="mt-4 text-lg font-semibold">Error Loading Branch</h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={() => router.push("/admin/branches")}>
                Return to Branches
              </Button>
            </CardContent>
          </Card>
        ) : branch ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit Branch</CardTitle>
              <CardDescription>Update branch information. All fields marked with * are required.</CardDescription>
            </CardHeader>
            <CardContent>
              <BranchForm initialData={branch} onSubmit={handleSubmit} isSubmitting={isSubmitting} isEditing={true} />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}
