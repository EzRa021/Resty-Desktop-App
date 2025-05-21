"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Building2, Calendar, Clock, Edit, Globe, MapPin, Phone, Store, Trash2, User } from "lucide-react"

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
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function BranchDetailsClientPage() {
  const router = useRouter()
  const params = useParams()
  const branchId = params.id
  const { getBranch, deleteBranch } = useBranch()

  const [branch, setBranch] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
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

  const handleDelete = async () => {
    try {
      await deleteBranch(branchId)
      toast.success("Branch deleted successfully")
      router.push("/admin/branches")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred"
      toast.error(`Failed to delete branch: ${errorMessage}`)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString) => {
    // Convert 24-hour format to 12-hour format
    const [hours, minutes] = timeString.split(":")
    const hour = Number.parseInt(hours, 10)
    const ampm = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
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
                <BreadcrumbPage>{isLoading ? "Loading..." : branch?.name || "Branch Details"}</BreadcrumbPage>
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
              <h1 className="text-2xl font-bold tracking-tight">
                {isLoading ? <Skeleton className="h-8 w-48" /> : branch?.name || "Branch Details"}
              </h1>
              {!isLoading && branch && (
                <Badge
                  variant={branch.isActive ? "default" : "secondary"}
                  className={branch.isActive ? "bg-green-500 ml-2" : "ml-2"}
                >
                  {branch.isActive ? "Active" : "Inactive"}
                </Badge>
              )}
            </div>

            {!isLoading && branch && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => router.push(`/admin/branches/edit/${branchId}`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Branch
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Branch
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the branch "{branch.name}" and all
                        data associated with it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6">
              <Store className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Error Loading Branch</h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={() => router.push("/admin/branches")}>
                Return to Branches
              </Button>
            </CardContent>
          </Card>
        ) : branch ? (
          <Tabs defaultValue="details">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Branch Details</TabsTrigger>
              <TabsTrigger value="hours">Operating Hours</TabsTrigger>
              <TabsTrigger value="meta">Metadata</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Branch Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Branch Name</h3>
                      <p className="text-base">{branch.name}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                      <Badge
                        variant={branch.isActive ? "default" : "secondary"}
                        className={branch.isActive ? "bg-green-500 mt-1" : "mt-1"}
                      >
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Restaurant ID</h3>
                      <p className="text-base font-mono text-sm">{branch.restaurantId}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Street</h3>
                      <p className="text-base">{branch.address?.street}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">City</h3>
                        <p className="text-base">{branch.address?.city}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">State</h3>
                        <p className="text-base">{branch.address?.state}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">ZIP Code</h3>
                        <p className="text-base">{branch.address?.zipCode}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Country</h3>
                        <p className="text-base">{branch.address?.country}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Phone</h3>
                      <p className="text-base">{branch.contactInfo?.phone || "N/A"}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
                      <p className="text-base">{branch.contactInfo?.email || "N/A"}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Website</h3>
                      <p className="text-base">N/A</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Additional Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Branch ID</h3>
                      <p className="text-base font-mono text-sm">{branch._id}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Created By</h3>
                      <p className="text-base font-mono text-sm">{branch.createdBy || "N/A"}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
                      <p className="text-base">{formatDate(branch.createdAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="hours">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Operating Hours
                  </CardTitle>
                  <CardDescription>The hours of operation for this branch</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(branch.operatingHours || {}).map(([day, hours]) => (
                      <Card key={day} className="overflow-hidden">
                        <CardHeader className="bg-muted/50 p-4">
                          <CardTitle className="text-base capitalize">{day}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Open</p>
                              <p className="text-base">{formatTime(hours.open)}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Close</p>
                              <p className="text-base">{formatTime(hours.close)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meta">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Metadata
                  </CardTitle>
                  <CardDescription>System information about this branch</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Branch ID</h3>
                        <p className="text-base font-mono text-sm">{branch._id}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Restaurant ID</h3>
                        <p className="text-base font-mono text-sm">{branch.restaurantId}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
                        <p className="text-base">{formatDate(branch.createdAt)}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Created By</h3>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <p className="text-base font-mono text-sm">{branch.createdBy || "N/A"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Last Updated</h3>
                        <p className="text-base">{branch.updatedAt ? formatDate(branch.updatedAt) : "Never"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Updated By</h3>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <p className="text-base font-mono text-sm">{branch.updatedBy || "N/A"}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Document Type</h3>
                      <p className="text-base">{branch.type || "branch"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </>
  )
}
