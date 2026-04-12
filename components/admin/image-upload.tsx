'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X } from 'lucide-react'

type ImageUploadProps = {
  existingUrl?: string | null
  existingPath?: string | null
}

export function ImageUpload({ existingUrl, existingPath }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null)
  const [hasNewFile, setHasNewFile] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setPreview(URL.createObjectURL(file))
      setHasNewFile(true)
    }
  }

  function handleRemove() {
    setPreview(null)
    setHasNewFile(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Product preview"
            className="h-32 w-32 rounded-lg border border-border object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 size-6"
            onClick={handleRemove}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : (
        <div
          className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-6" />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        name="image"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {!hasNewFile && existingPath && (
        <input type="hidden" name="existingImagePath" value={existingPath} />
      )}
      {!preview && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Choose image
        </Button>
      )}
    </div>
  )
}
