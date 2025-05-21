"use client"

import { useState, useEffect } from "react"
import { useRegistrationStore } from "@/lib/store/registration"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2 } from "lucide-react"

export function BranchForm() {
  const {
    branches,
    setBranch,
    setBranchContact,
    setBranchLocation,
    addBranch,
    removeBranch,
    restaurant,
    nextStep,
    prevStep,
    setBranchFormValid,
    errors,
    setErrors,
  } = useRegistrationStore()

  const [activeTab, setActiveTab] = useState("0")
  const [formErrors, setFormErrors] = useState([])

  // Validate form on mount and when values change
  useEffect(() => {
    validateForm()
  }, [branches])

  const validateForm = () => {
    const newErrors = branches.map((branch) => {
      const branchErrors = {}

      if (!branch.name.trim()) {
        branchErrors.name = "Branch name is required"
      } else if (branch.name.length > 100) {
        branchErrors.name = "Branch name must be less than 100 characters"
      }

      if (!branch.location.address.trim()) {
        branchErrors.address = "Branch address is required"
      } else if (branch.location.address.length > 200) {
        branchErrors.address = "Address must be less than 200 characters"
      }

      if (branch.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(branch.contact.email)) {
        branchErrors.email = "Invalid email format"
      }

      if (branch.contact.phone && !/^\+?[1-9]\d{1,14}$/.test(branch.contact.phone)) {
        branchErrors.phone = "Invalid phone number format"
      }

      return branchErrors
    })

    setFormErrors(newErrors)
    setErrors("branch", newErrors)

    // Check if all branches are valid
    const isValid = newErrors.every((errors) => Object.keys(errors).length === 0)
    setBranchFormValid(isValid)
    useRegistrationStore.getState().updateIsComplete()

    return isValid
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (validateForm()) {
      nextStep()
    }
  }

  const handleAddBranch = () => {
    addBranch()
    // Set active tab to the new branch
    setActiveTab(branches.length.toString())
  }

  const handleRemoveBranch = (index) => {
    removeBranch(index)
    // If we're removing the active tab, set active tab to the previous one
    if (Number.parseInt(activeTab) === index) {
      setActiveTab(Math.max(0, index - 1).toString())
    } else if (Number.parseInt(activeTab) > index) {
      // If we're removing a tab before the active one, adjust the active tab index
      setActiveTab((Number.parseInt(activeTab) - 1).toString())
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Branch Information</CardTitle>
          <CardDescription>
            {restaurant.isBranchMultiple
              ? "Add information about your restaurant branches. You can add multiple branches."
              : "Add information about your restaurant location."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-flow-col auto-cols-max gap-2">
                {branches.map((_, index) => (
                  <TabsTrigger key={index} value={index.toString()} className="px-4">
                    {index === 0 ? "Main Branch" : `Branch ${index + 1}`}
                  </TabsTrigger>
                ))}
              </TabsList>

              {restaurant.isBranchMultiple && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddBranch}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Branch
                </Button>
              )}
            </div>

            {branches.map((branch, index) => (
              <TabsContent key={index} value={index.toString()} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">
                      {index === 0 ? "Main Branch Details" : `Branch ${index + 1} Details`}
                    </h3>

                    {restaurant.isBranchMultiple && branches.length > 1 && (
                      <Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveBranch(index)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Branch
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`branch-name-${index}`}>
                      Branch Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`branch-name-${index}`}
                      placeholder="e.g., Downtown Location"
                      value={branch.name}
                      onChange={(e) => setBranch(index, { name: e.target.value })}
                      className={formErrors[index]?.name ? "border-destructive" : ""}
                    />
                    {formErrors[index]?.name && <p className="text-sm text-destructive">{formErrors[index].name}</p>}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`branch-address-${index}`}>
                      Address <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id={`branch-address-${index}`}
                      placeholder="Full address of the branch"
                      value={branch.location.address}
                      onChange={(e) => setBranchLocation(index, { address: e.target.value })}
                      className={formErrors[index]?.address ? "border-destructive" : ""}
                      rows={3}
                    />
                    {formErrors[index]?.address && (
                      <p className="text-sm text-destructive">{formErrors[index].address}</p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor={`branch-email-${index}`}>Contact Email</Label>
                      <Input
                        id={`branch-email-${index}`}
                        type="email"
                        placeholder="branch@restaurant.com"
                        value={branch.contact.email}
                        onChange={(e) => setBranchContact(index, { email: e.target.value })}
                        className={formErrors[index]?.email ? "border-destructive" : ""}
                      />
                      {formErrors[index]?.email && (
                        <p className="text-sm text-destructive">{formErrors[index].email}</p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`branch-phone-${index}`}>Contact Phone</Label>
                      <Input
                        id={`branch-phone-${index}`}
                        placeholder="+1234567890"
                        value={branch.contact.phone}
                        onChange={(e) => setBranchContact(index, { phone: e.target.value })}
                        className={formErrors[index]?.phone ? "border-destructive" : ""}
                      />
                      {formErrors[index]?.phone && (
                        <p className="text-sm text-destructive">{formErrors[index].phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={prevStep}>
            Back to Restaurant
          </Button>
          <Button type="submit">Continue to User Setup</Button>
        </CardFooter>
      </Card>
    </form>
  )
}
