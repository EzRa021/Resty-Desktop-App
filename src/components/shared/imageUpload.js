"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X } from "lucide-react"

export function ImageUpload({ onImageUpload, currentImage, maxSizeInMB = 5 }) {
  const [previewUrl, setPreviewUrl] = useState(currentImage || null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const maxSizeInBytes = maxSizeInMB * 1024 * 1024

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError(null)

    // Check file size
    if (file.size > maxSizeInBytes) {
      setError(`File size exceeds ${maxSizeInMB}MB limit`)
      return
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed")
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      const base64String = event.target.result
      setPreviewUrl(base64String)
      onImageUpload(base64String)
    }

    reader.onerror = () => {
      setError("Error reading file")
    }

    reader.readAsDataURL(file)
  }

  const handleButtonClick = () => {
    fileInputRef.current.click()
  }

  const handleRemoveImage = () => {
    setPreviewUrl(null)
    onImageUpload(null)
    fileInputRef.current.value = ""
  }

  return (
    <div className="space-y-2">
      <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />

      {previewUrl ? (
        <div className="relative w-full max-w-xs">
          <img
            src={previewUrl || "/placeholder.svg"}
            alt="Preview"
            className="h-40 w-full rounded-md object-cover border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
            onClick={handleRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 cursor-pointer hover:border-primary"
          onClick={handleButtonClick}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Click to upload logo</p>
          <p className="text-xs text-muted-foreground">PNG, JPG or GIF (max. {maxSizeInMB}MB)</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
