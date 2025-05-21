"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { LoginForm } from "@/components/auth/LoginForm"
import { useAuth } from "@/lib/hooks/useAuth"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()

  // Get redirect URL from query params
  const redirect = searchParams.get("redirect") || "/dashboard"

  // Check if user just registered
  const registered = searchParams.get("registered") === "true"

  useEffect(() => {
    // Show registration success message
    if (registered) {
      toast.success("Registration successful! Please log in with your credentials.")
    }
  }, [registered])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push(redirect)
    }
  }, [isAuthenticated, isLoading, router, redirect])

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  )
}
