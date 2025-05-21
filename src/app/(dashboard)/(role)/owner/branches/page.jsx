"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowUpDown,
  ChevronDown,
  Clock,
  Filter,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Store,
  Trash2,
} from "lucide-react"

import { useBranch } from "@/lib/hooks/useBranch"
import { useAuth } from "@/lib/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { BranchCard } from "@/components/branches/branch-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"

export default function BranchesPage() {
  const router = useRouter()
  const { user } = useAuth({ requireAuth: true })
  const { branches, isLoading, error, fetchBranches, deleteBranch, setCurrentBranch } = useBranch()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBranches, setSelectedBranches] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortField, setSortField] = useState("name")
  const [sortDirection, setSortDirection] = useState("asc")
  const [filterActive, setFilterActive] = useState("all")
  const [viewMode, setViewMode] = useState("table")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (user?.restaurantId) {
      fetchBranches(user.restaurantId)
    }
  }, [user, fetchBranches])

  // Reset selected branches when branches change
  useEffect(() => {
    setSelectedBranches([])
  }, [branches])

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(`Error: ${error}`)
    }
  }, [error])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedBranches(filteredBranches.map((branch) => branch._id))
    } else {
      setSelectedBranches([])
    }
  }

  const handleSelectBranch = (branchId, checked) => {
    if (checked) {
      setSelectedBranches([...selectedBranches, branchId])
    } else {
      setSelectedBranches(selectedBranches.filter((id) => id !== branchId))
    }
  }

  const handleDeleteSelected = async () => {
    try {
      const deletePromises = selectedBranches.map((branchId) => deleteBranch(branchId))
      await Promise.all(deletePromises)
      toast.success(`Successfully deleted ${selectedBranches.length} branches`)
      setSelectedBranches([])
      setIsDeleteDialogOpen(false)

      // Refresh branches
      if (user?.restaurantId) {
        fetchBranches(user.restaurantId)
      }
    } catch (error) {
      toast.error(`Failed to delete branches: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleViewBranch = (branch) => {
    setCurrentBranch(branch)
    router.push(`/admin/branches/${branch._id}`)
  }

  const handleEditBranch = (branch) => {
    setCurrentBranch(branch)
    router.push(`/admin/branches/edit/${branch._id}`)
  }

  const handleDeleteBranch = async (branchId) => {
    try {
      await deleteBranch(branchId)
      toast.success("Branch deleted successfully")

      // Refresh branches
      if (user?.restaurantId) {
        fetchBranches(user.restaurantId)
      }
    } catch (error) {
      toast.error(`Failed to delete branch: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Filter and sort branches
  const filteredBranches = branches
    .filter((branch) => {
      // Filter by search query
      const matchesSearch =
        branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.address?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.address?.state?.toLowerCase().includes(searchQuery.toLowerCase())

      // Filter by active status
      const matchesActive =
        filterActive === "all" ||
        (filterActive === "active" && branch.isActive) ||
        (filterActive === "inactive" && !branch.isActive)

      return matchesSearch && matchesActive
    })
    .sort((a, b) => {
      // Handle nested fields
      if (sortField === "address.city") {
        const aValue = a.address?.city || ""
        const bValue = b.address?.city || ""
        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      // Handle regular fields
      const aValue = a[sortField] || ""
      const bValue = b[sortField] || ""

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return sortDirection === "asc"
          ? aValue === bValue
            ? 0
            : aValue
              ? -1
              : 1
          : aValue === bValue
            ? 0
            : aValue
              ? 1
              : -1
      }

      return 0
    })

  // Pagination
  const totalPages = Math.ceil(filteredBranches.length / itemsPerPage)
  const paginatedBranches = filteredBranches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
                <BreadcrumbPage>Branches</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Branch Management</h1>
            <Button onClick={() => router.push("/admin/branches/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Branch
            </Button>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search branches..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Filter Branches</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={filterActive === "all"}
                    onCheckedChange={() => setFilterActive("all")}
                  >
                    All Branches
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filterActive === "active"}
                    onCheckedChange={() => setFilterActive("active")}
                  >
                    Active Only
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filterActive === "inactive"}
                    onCheckedChange={() => setFilterActive("inactive")}
                  >
                    Inactive Only
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden md:flex">
                    <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                    Sort
                    <ChevronDown className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortField === "name" && sortDirection === "asc"}
                    onCheckedChange={() => {
                      setSortField("name")
                      setSortDirection("asc")
                    }}
                  >
                    Name (A-Z)
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortField === "name" && sortDirection === "desc"}
                    onCheckedChange={() => {
                      setSortField("name")
                      setSortDirection("desc")
                    }}
                  >
                    Name (Z-A)
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortField === "address.city" && sortDirection === "asc"}
                    onCheckedChange={() => {
                      setSortField("address.city")
                      setSortDirection("asc")
                    }}
                  >
                    City (A-Z)
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortField === "address.city" && sortDirection === "desc"}
                    onCheckedChange={() => {
                      setSortField("address.city")
                      setSortDirection("desc")
                    }}
                  >
                    City (Z-A)
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortField === "isActive" && sortDirection === "asc"}
                    onCheckedChange={() => {
                      setSortField("isActive")
                      setSortDirection("asc")
                    }}
                  >
                    Status (Active first)
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortField === "isActive" && sortDirection === "desc"}
                    onCheckedChange={() => {
                      setSortField("isActive")
                      setSortDirection("desc")
                    }}
                  >
                    Status (Inactive first)
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("table")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M3 15h18" />
                    <path d="M9 3v18" />
                    <path d="M15 3v18" />
                  </svg>
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("grid")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <rect width="7" height="7" x="3" y="3" rx="1" />
                    <rect width="7" height="7" x="14" y="3" rx="1" />
                    <rect width="7" height="7" x="14" y="14" rx="1" />
                    <rect width="7" height="7" x="3" y="14" rx="1" />
                  </svg>
                </Button>
              </div>
            </div>

            {selectedBranches.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedBranches.length} selected</span>
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the selected{" "}
                        {selectedBranches.length} branches and all data associated with them.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteSelected}
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
          viewMode === "table" ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-4" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="p-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : filteredBranches.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No branches found"
            description={
              searchQuery ? "Try adjusting your search or filters" : "Get started by adding your first branch"
            }
            action={
              searchQuery ? (
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => router.push("/admin/branches/new")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Branch
                </Button>
              )
            }
          />
        ) : viewMode === "table" ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedBranches.length > 0 && selectedBranches.length === paginatedBranches.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all branches"
                      />
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-1 p-0 font-medium"
                        onClick={() => handleSort("name")}
                      >
                        Name
                        {sortField === "name" && <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-1 p-0 font-medium"
                        onClick={() => handleSort("address.city")}
                      >
                        Location
                        {sortField === "address.city" && <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-1 p-0 font-medium"
                        onClick={() => handleSort("isActive")}
                      >
                        Status
                        {sortField === "isActive" && <ArrowUpDown className="ml-1 h-3 w-3" />}
                      </Button>
                    </TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBranches.map((branch) => (
                    <TableRow key={branch._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedBranches.includes(branch._id)}
                          onCheckedChange={(checked) => handleSelectBranch(branch._id, checked)}
                          aria-label={`Select ${branch.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <MapPin className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {branch.address?.city}, {branch.address?.state}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Phone className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                          <span>{branch.contactInfo?.phone || "N/A"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={branch.isActive ? "default" : "secondary"}
                          className={branch.isActive ? "bg-green-500" : ""}
                        >
                          {branch.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Clock className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {branch.operatingHours?.monday?.open} - {branch.operatingHours?.monday?.close}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewBranch(branch)}>View details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditBranch(branch)}>Edit branch</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteBranch(branch._id)}
                            >
                              Delete branch
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>Rows per page:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number.parseInt(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-16">
                      <SelectValue placeholder={itemsPerPage.toString()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredBranches.length)}{" "}
                  of {filteredBranches.length}
                </div>
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </CardFooter>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedBranches.map((branch) => (
              <BranchCard
                key={branch._id}
                branch={branch}
                isSelected={selectedBranches.includes(branch._id)}
                onSelect={(checked) => handleSelectBranch(branch._id, checked)}
                onView={() => handleViewBranch(branch)}
                onEdit={() => handleEditBranch(branch)}
                onDelete={() => handleDeleteBranch(branch._id)}
              />
            ))}
          </div>
        )}

        {viewMode === "grid" && filteredBranches.length > 0 && (
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <span>Items per page:</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number.parseInt(value))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue placeholder={itemsPerPage.toString()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="12">12</SelectItem>
                    <SelectItem value="16">16</SelectItem>
                    <SelectItem value="24">24</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredBranches.length)}{" "}
                of {filteredBranches.length}
              </div>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>
    </>
  )
}
