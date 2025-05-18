"use client"

import { useState, useEffect } from "react"
import { io } from "socket.io-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast, Toaster } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  ImageIcon,
  ArrowUpDown,
  Filter,
} from "lucide-react"

// Form validation schema
const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().optional(),
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  branchId: z.string().min(1, "Branch ID is required"),
  displayOrder: z.coerce.number().int().default(0),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  isActive: z.boolean().default(true),
})

// Filter form schema
const filterSchema = z.object({
  search: z.string().optional(),
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  branchId: z.string().min(1, "Branch ID is required"),
  active: z.enum(["true", "false"]),
  sort: z.enum(["displayOrder", "name", "createdAt"]),
  order: z.enum(["asc", "desc"]),
})

export default function CategoryManagement() {
  const [socket, setSocket] = useState(null)
  const [categories, setCategories] = useState([])
  const [updateId, setUpdateId] = useState(null)
  const [sessionId, setSessionId] = useState("")
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Category form
  const categoryForm = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
      restaurantId: "test-restaurant-id",
      branchId: "test-branch-id",
      displayOrder: 0,
      imageUrl: "",
      isActive: true,
    },
  })

  // Filter form
  const filterForm = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: "",
      restaurantId: "test-restaurant-id",
      branchId: "test-branch-id",
      active: "true",
      sort: "displayOrder",
      order: "asc",
    },
  })

  useEffect(() => {
    // Get session ID from local storage
    const storedSessionId = localStorage.getItem("sessionId")
    if (storedSessionId) {
      setSessionId(storedSessionId)
    } else {
      toast.error("Authentication Error", {
        description: "No session ID found. Please log in.",
      })
    }

    // Connect to WebSocket server
    const newSocket = io("http://localhost:8000", {
      withCredentials: true,
      transports: ["websocket"],
    })

    newSocket.on("connect", () => {
      console.log("Connected to Socket.IO server")
      setSocket(newSocket)
      setLoading(false)

      // Only fetch categories if we have a session ID
      if (storedSessionId) {
        fetchCategories(newSocket, filterForm.getValues())
      }
    })

    newSocket.on("connect_error", (err) => {
      console.error("Connection error:", err)
      toast.error("Connection Error", {
        description: `Failed to connect: ${err.message}`,
      })
      setLoading(false)
    })

    // Set up event listeners for category operations
    newSocket.on("category:created", (category) => {
      setCategories((prev) => [...prev, category])
      toast.success("Category Created", {
        description: "Category has been created successfully",
      })
    })

    newSocket.on("category:updated", (category) => {
      setCategories((prev) => prev.map((c) => (c._id === category._id ? category : c)))
      toast.success("Category Updated", {
        description: "Category has been updated successfully",
      })
    })

    newSocket.on("category:deleted", ({ id }) => {
      setCategories((prev) => prev.filter((c) => c._id !== id))
      toast.success("Category Deleted", {
        description: "Category has been deleted successfully",
      })
    })

    newSocket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server")
      toast.warning("Disconnected", {
        description: "Lost connection to the server",
      })
    })

    return () => {
      if (newSocket) {
        newSocket.disconnect()
      }
    }
  }, [])

  const fetchCategories = (socketInstance, filterData) => {
    const currentSocket = socketInstance || socket

    if (!currentSocket) {
      toast.error("Connection Error", {
        description: "Socket not connected",
      })
      return
    }

    setLoading(true)
    currentSocket.emit("category:getAll", filterData, (response) => {
      setLoading(false)
      if (response.success) {
        setCategories(response.categories)
        toast.success("Categories Loaded", {
          description: `Loaded ${response.categories.length} categories`,
        })
      } else {
        toast.error("Error", {
          description: `Failed to fetch categories: ${response.message}`,
        })
      }
    })
  }

  const onCategorySubmit = (data) => {
    if (!socket) {
      toast.error("Connection Error", {
        description: "Socket not connected",
      })
      return
    }

    if (!sessionId) {
      toast.error("Authentication Error", {
        description: "No session ID found. Please log in.",
      })
      return
    }

    // Prepare form data including sessionId
    const formData = {
      ...data,
      sessionId: sessionId,
    }

    setLoading(true)

    if (updateId) {
      socket.emit("category:update", { ...formData, id: updateId }, (response) => {
        setLoading(false)
        if (response.success) {
          toast.success("Success", {
            description: "Category updated successfully",
          })
          setUpdateId(null)
          resetCategoryForm()
        } else {
          toast.error("Error", {
            description: `Failed to update category: ${response.message}`,
          })
        }
      })
    } else {
      socket.emit("category:create", formData, (response) => {
        setLoading(false)
        if (response.success) {
          toast.success("Success", {
            description: "Category created successfully",
          })
          resetCategoryForm()
        } else {
          toast.error("Error", {
            description: `Failed to create category: ${response.message}`,
          })
        }
      })
    }
  }

  const resetCategoryForm = () => {
    categoryForm.reset({
      name: "",
      description: "",
      restaurantId: "test-restaurant-id",
      branchId: "test-branch-id",
      displayOrder: 0,
      imageUrl: "",
      isActive: true,
    })
  }

  const handleEdit = (category) => {
    setUpdateId(category._id)
    categoryForm.reset({
      name: category.name,
      description: category.description || "",
      restaurantId: category.restaurantId,
      branchId: category.branchId,
      displayOrder: category.displayOrder,
      imageUrl: category.imageUrl || "",
      isActive: category.isActive,
    })
  }

  const handleDelete = (category) => {
    setCategoryToDelete(category)
    setIsDeleting(true)
  }

  const confirmDelete = () => {
    if (!socket || !categoryToDelete) {
      return
    }

    if (!sessionId) {
      toast.error("Authentication Error", {
        description: "No session ID found. Please log in.",
      })
      return
    }

    setLoading(true)
    socket.emit("category:delete", { id: categoryToDelete._id, sessionId }, (response) => {
      setLoading(false)
      setIsDeleting(false)
      setCategoryToDelete(null)

      if (!response.success) {
        toast.error("Error", {
          description: `Failed to delete category: ${response.message}`,
        })
      }
    })
  }

  const onFilterSubmit = (data) => {
    fetchCategories(socket, data)
    setIsFilterOpen(false)
  }

  const setTestSessionId = () => {
    const id = prompt("Enter session ID for testing:")
    if (id) {
      localStorage.setItem("sessionId", id)
      setSessionId(id)
      toast.success("Session ID Set", {
        description: "Session ID set successfully",
      })
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Category Management</h1>
          <p className="text-muted-foreground">Create and manage your menu categories</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={sessionId ? "outline" : "destructive"} className="gap-1">
            {sessionId ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                <span>Authenticated</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3" />
                <span>Not authenticated</span>
              </>
            )}
          </Badge>

          {!sessionId && (
            <Button size="sm" onClick={setTestSessionId}>
              Set Test Session ID
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Form Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{updateId ? "Update Category" : "Create New Category"}</CardTitle>
            <CardDescription>
              {updateId ? "Edit the category details below" : "Add a new category to your menu"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...categoryForm}>
              <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
                <FormField
                  control={categoryForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Category name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={categoryForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Category description (optional)" className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={categoryForm.control}
                    name="restaurantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restaurant ID</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={categoryForm.control}
                    name="branchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch ID</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={categoryForm.control}
                    name="displayOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Order</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={categoryForm.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={categoryForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>This category will be visible to customers</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={!sessionId || loading} className="flex-1">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {updateId ? "Update Category" : "Create Category"}
                  </Button>

                  {updateId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setUpdateId(null)
                        resetCategoryForm()
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Categories Table Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Showing {categories.length} categories</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search..."
                  className="w-[200px] pl-8"
                  value={filterForm.watch("search")}
                  onChange={(e) => {
                    filterForm.setValue("search", e.target.value)
                    // Debounce search
                    const timeoutId = setTimeout(() => {
                      onFilterSubmit(filterForm.getValues())
                    }, 500)
                    return () => clearTimeout(timeoutId)
                  }}
                />
              </div>

              <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Filter Categories</DialogTitle>
                    <DialogDescription>Adjust the filters to find specific categories</DialogDescription>
                  </DialogHeader>

                  <Form {...filterForm}>
                    <form onSubmit={filterForm.handleSubmit(onFilterSubmit)} className="space-y-4 py-4">
                      <FormField
                        control={filterForm.control}
                        name="restaurantId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Restaurant ID</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={filterForm.control}
                        name="branchId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Branch ID</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={filterForm.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="true">Active Only</SelectItem>
                                <SelectItem value="false">Inactive Only</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={filterForm.control}
                          name="sort"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sort By</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sort by" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="displayOrder">Display Order</SelectItem>
                                  <SelectItem value="name">Name</SelectItem>
                                  <SelectItem value="createdAt">Created Date</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={filterForm.control}
                          name="order"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Order</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Order" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="asc">Ascending</SelectItem>
                                  <SelectItem value="desc">Descending</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <DialogFooter>
                        <Button type="submit">Apply Filters</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Button
                onClick={() => fetchCategories(socket, filterForm.getValues())}
                variant="outline"
                size="icon"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {categories.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="hidden md:table-cell">Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {category.imageUrl ? (
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-muted">
                              <img
                                src={category.imageUrl || "/placeholder.svg"}
                                alt={category.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null
                                  e.target.src = "https://via.placeholder.com/40"
                                }}
                              />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-muted">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span>{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="line-clamp-1">{category.description || "-"}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{category.displayOrder}</TableCell>
                      <TableCell>
                        <Badge variant={category.isActive ? "success" : "secondary"}>
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(category)}
                            disabled={!sessionId}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(category)}
                            disabled={!sessionId}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Info className="h-10 w-10 text-muted-foreground mb-2" />
                <h3 className="text-lg font-medium">No categories found</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first category or adjust your filters</p>
                <Button onClick={() => resetCategoryForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Category
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category {categoryToDelete?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-center font-medium">Loading...</p>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}
