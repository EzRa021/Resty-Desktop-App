"use client"

import { useState, useEffect } from "react"
import { useRegistrationStore } from "@/lib/store/registration"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"

export function UserForm({ onComplete }) {
  const { user, setUser, prevStep, setUserFormValid, errors, setErrors, isComplete } = useRegistrationStore()

  const [formErrors, setFormErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState("")

  // Validate form on mount and when values change
  useEffect(() => {
    validateForm()
  }, [user, confirmPassword])

  const validateForm = () => {
    const newErrors = {}

    if (!user.name.trim()) {
      newErrors.name = "Full name is required"
    } else if (user.name.length > 100) {
      newErrors.name = "Name must be less than 100 characters"
    }

    if (!user.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      newErrors.email = "Invalid email format"
    }

    if (!user.password) {
      newErrors.password = "Password is required"
    } else if (user.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    } else if (!/[a-zA-Z]/.test(user.password) || !/[0-9]/.test(user.password)) {
      newErrors.password = "Password must contain at least one letter and one number"
    }

    if (user.password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (user.phone && !/^\+?[1-9]\d{1,14}$/.test(user.phone)) {
      newErrors.phone = "Invalid phone number format"
    }

    setFormErrors(newErrors)
    setErrors("user", newErrors)
    setUserFormValid(Object.keys(newErrors).length === 0)
    useRegistrationStore.getState().updateIsComplete()

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (validateForm() && onComplete) {
      onComplete()
    }
  }

  const toggleShowPassword = () => {
    setShowPassword(!showPassword)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Admin User Setup</CardTitle>
          <CardDescription>
            Create your administrator account. This account will have full access to manage your restaurant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="user-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-name"
                placeholder="John Doe"
                value={user.name}
                onChange={(e) => setUser({ name: e.target.value })}
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                placeholder="admin@restaurant.com"
                value={user.email}
                onChange={(e) => setUser({ email: e.target.value })}
                className={formErrors.email ? "border-destructive" : ""}
              />
              {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-phone">Phone Number</Label>
              <Input
                id="user-phone"
                placeholder="+1234567890"
                value={user.phone}
                onChange={(e) => setUser({ phone: e.target.value })}
                className={formErrors.phone ? "border-destructive" : ""}
              />
              {formErrors.phone && <p className="text-sm text-destructive">{formErrors.phone}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-password">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={user.password}
                  onChange={(e) => setUser({ password: e.target.value })}
                  className={formErrors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={toggleShowPassword}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </Button>
              </div>
              {formErrors.password && <p className="text-sm text-destructive">{formErrors.password}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={formErrors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={toggleShowPassword}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </Button>
              </div>
              {formErrors.confirmPassword && <p className="text-sm text-destructive">{formErrors.confirmPassword}</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={prevStep}>
            Back to Branch
          </Button>
          <Button type="submit">Complete Registration</Button>
        </CardFooter>
      </Card>
    </form>
  )
}
