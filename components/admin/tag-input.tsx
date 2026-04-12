'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

type TagInputProps = {
  initialTags?: string[]
}

export function TagInput({ initialTags = [] }: TagInputProps) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(value: string) {
    const trimmed = value.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed])
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const input = inputRef.current
      if (input && input.value.trim()) {
        addTag(input.value)
        input.value = ''
      }
    }
    if (e.key === 'Backspace' && inputRef.current?.value === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        ref={inputRef}
        type="text"
        placeholder="Type a flavor and press Enter"
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          if (e.target.value.trim()) {
            addTag(e.target.value)
            e.target.value = ''
          }
        }}
      />
      <input type="hidden" name="flavors" value={JSON.stringify(tags)} />
    </div>
  )
}
