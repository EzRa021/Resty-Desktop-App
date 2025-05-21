"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"

export function TimeInput({ value, onChange, placeholder = "HH:MM", disabled = false }) {
  const [hours, setHours] = useState("")
  const [minutes, setMinutes] = useState("")

  // Parse the value into hours and minutes when it changes
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":")
      setHours(h)
      setMinutes(m)
    }
  }, [value])

  // Format and validate hours
  const handleHoursChange = (e) => {
    const newHours = e.target.value.replace(/[^0-9]/g, "").slice(0, 2)

    if (newHours === "" || (Number.parseInt(newHours) >= 0 && Number.parseInt(newHours) <= 23)) {
      setHours(newHours)

      // Only update the full value if we have both hours and minutes
      if (newHours && minutes) {
        const paddedHours = newHours.padStart(2, "0")
        onChange(`${paddedHours}:${minutes}`)
      }
    }
  }

  // Format and validate minutes
  const handleMinutesChange = (e) => {
    const newMinutes = e.target.value.replace(/[^0-9]/g, "").slice(0, 2)

    if (newMinutes === "" || (Number.parseInt(newMinutes) >= 0 && Number.parseInt(newMinutes) <= 59)) {
      setMinutes(newMinutes)

      // Only update the full value if we have both hours and minutes
      if (hours && newMinutes) {
        const paddedHours = hours.padStart(2, "0")
        const paddedMinutes = newMinutes.padStart(2, "0")
        onChange(`${paddedHours}:${paddedMinutes}`)
      }
    }
  }

  // Handle blur to format the time properly
  const handleBlur = () => {
    if (hours || minutes) {
      const paddedHours = hours ? hours.padStart(2, "0") : "00"
      const paddedMinutes = minutes ? minutes.padStart(2, "0") : "00"
      onChange(`${paddedHours}:${paddedMinutes}`)
    }
  }

  return (
    <div className="flex items-center">
      <Input
        type="text"
        value={hours}
        onChange={handleHoursChange}
        onBlur={handleBlur}
        placeholder="HH"
        className="w-16 text-center"
        maxLength={2}
        disabled={disabled}
      />
      <span className="mx-1 text-lg">:</span>
      <Input
        type="text"
        value={minutes}
        onChange={handleMinutesChange}
        onBlur={handleBlur}
        placeholder="MM"
        className="w-16 text-center"
        maxLength={2}
        disabled={disabled}
      />
    </div>
  )
}
