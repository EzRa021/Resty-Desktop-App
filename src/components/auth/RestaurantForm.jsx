"use client"

import { useState, useEffect } from "react"
import { useRegistrationStore } from "@/lib/store/registration"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ImageUpload } from "@/components/shared/imageUpload"

export function RestaurantForm() {
  const { restaurant, setRestaurant, setRestaurantContact, nextStep, setRestaurantFormValid, errors, setErrors } =
    useRegistrationStore()

  const [formErrors, setFormErrors] = useState({})

  // Validate form on mount and when values change
  useEffect(() => {
    validateForm()
  }, [restaurant])

  const validateForm = () => {
    const newErrors = {}

    if (!restaurant.name.trim()) {
      newErrors.name = "Restaurant name is required"
    } else if (restaurant.name.length > 100) {
      newErrors.name = "Restaurant name must be less than 100 characters"
    }

    if (restaurant.contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(restaurant.contact.email)) {
      newErrors.email = "Invalid email format"
    }

    if (restaurant.contact.phone && !/^\+?[1-9]\d{1,14}$/.test(restaurant.contact.phone)) {
      newErrors.phone = "Invalid phone number format"
    }

    setFormErrors(newErrors)
    setErrors("restaurant", newErrors)
    setRestaurantFormValid(Object.keys(newErrors).length === 0)
    useRegistrationStore.getState().updateIsComplete()

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (validateForm()) {
      nextStep()
    }
  }

  const handleLogoUpload = (base64Image) => {
    setRestaurant({ logo: base64Image })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Information</CardTitle>
          <CardDescription>
            Tell us about your restaurant. This information will be used throughout the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="restaurant-name">
                Restaurant Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="restaurant-name"
                placeholder="e.g., Gourmet Delights"
                value={restaurant.name}
                onChange={(e) => setRestaurant({ name: e.target.value })}
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="multiple-branches"
                checked={restaurant.isBranchMultiple}
                onCheckedChange={(checked) => setRestaurant({ isBranchMultiple: checked })}
              />
              <Label htmlFor="multiple-branches">This restaurant has multiple branches</Label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="contact-email">Contact Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="contact@restaurant.com"
                  value={restaurant.contact.email}
                  onChange={(e) => setRestaurantContact({ email: e.target.value })}
                  className={formErrors.email ? "border-destructive" : ""}
                />
                {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contact-phone">Contact Phone</Label>
                <Input
                  id="contact-phone"
                  placeholder="+1234567890"
                  value={restaurant.contact.phone}
                  onChange={(e) => setRestaurantContact({ phone: e.target.value })}
                  className={formErrors.phone ? "border-destructive" : ""}
                />
                {formErrors.phone && <p className="text-sm text-destructive">{formErrors.phone}</p>}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Restaurant Logo</Label>
              <ImageUpload onImageUpload={handleLogoUpload} currentImage={restaurant.logo} maxSizeInMB={2} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit">Continue to Branch Information</Button>
        </CardFooter>
      </Card>
    </form>
  )
}
