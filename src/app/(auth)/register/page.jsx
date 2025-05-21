"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useRegistrationStore } from "@/lib/store/registration"
import { useSocket } from "@/lib/hooks/useSocket"
import { RestaurantForm } from "@/components/auth/RestaurantForm"
import { BranchForm } from "@/components/auth/BranchForm"
import { UserForm } from "@/components/auth/UserForm"
import { RegistrationProgress } from "@/components/auth/RegistrationProgress"

export default function RegisterPage() {
  const router = useRouter()
  const { step, setStep, restaurant, branches, user, isComplete, resetRegistration, setSocket } = useRegistrationStore()

  // Use the global socket connection
  const { socket, isConnected, connectionError } = useSocket()

  useEffect(() => {
    // Reset registration state when component mounts
    resetRegistration()

    // Set the socket in the registration store
    if (socket) {
      setSocket(socket)
    }
  }, [resetRegistration, setSocket, socket])

  const handleSubmitRegistration = () => {
    if (!isComplete || !socket) return

    const registrationData = {
      restaurant,
      branches,
      user,
    }

    // Show loading toast
    const loadingToast = toast.loading("Creating your restaurant account...")

    socket.emit("registration:register", registrationData, (response) => {
      // Dismiss loading toast
      toast.dismiss(loadingToast)

      if (response.success) {
        // Registration successful
        toast.success("Registration successful! Redirecting to login...")
        setTimeout(() => {
          router.push("/login?registered=true")
        }, 1500)
      } else {
        // Handle registration errors
        console.error("Registration failed:", response.errors || response.message)
        toast.error(`Registration failed: ${response.errors?.join(", ") || response.message}`)
      }
    })
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-utensils"
              >
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              </svg>
            </div>
            <span className="text-xl font-bold">RestaurantOS</span>
          </Link>
          <h1 className="text-2xl font-bold">Create Your Restaurant Account</h1>
          <p className="text-muted-foreground">Complete all steps to set up your restaurant management system</p>

          {connectionError && (
            <div className="mt-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p>Connection error: {connectionError}</p>
              <p>Please check your internet connection and try again.</p>
            </div>
          )}
        </div>

        <RegistrationProgress currentStep={step} />

        <div className="mt-8">
          {step === 1 && <RestaurantForm />}
          {step === 2 && <BranchForm />}
          {step === 3 && <UserForm onComplete={handleSubmitRegistration} />}
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
