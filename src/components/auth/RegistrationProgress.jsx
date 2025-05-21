import { CheckCircle, Circle } from "lucide-react"

export function RegistrationProgress({ currentStep }) {
  const steps = [
    { id: 1, name: "Restaurant" },
    { id: 2, name: "Branch" },
    { id: 3, name: "User" },
  ]

  return (
    <div className="relative">
      <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-border" />
      <div
        className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300"
        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
      />
      <div className="relative z-10 flex justify-between">
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                currentStep > step.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : currentStep === step.id
                    ? "border-primary bg-background text-primary"
                    : "border-border bg-background text-muted-foreground"
              }`}
            >
              {currentStep > step.id ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
            </div>
            <span
              className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}
            >
              {step.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
