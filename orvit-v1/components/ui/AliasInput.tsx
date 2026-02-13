'use client'

import { useState, KeyboardEvent } from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AliasInputProps {
  value: string[]
  onChange: (aliases: string[]) => void
  placeholder?: string
  maxAliases?: number
}

export function AliasInput({
  value = [],
  onChange,
  placeholder = 'Agregar alias...',
  maxAliases = 10,
}: AliasInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addAlias = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    if (value.length >= maxAliases) return
    if (value.some(a => a.toLowerCase() === trimmed.toLowerCase())) return

    onChange([...value, trimmed])
    setInputValue('')
  }

  const removeAlias = (index: number) => {
    const newAliases = value.filter((_, i) => i !== index)
    onChange(newAliases)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      addAlias()
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeAlias(value.length - 1)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
          disabled={value.length >= maxAliases}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addAlias}
          disabled={!inputValue.trim() || value.length >= maxAliases}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((alias, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="pl-2 pr-1 py-1 gap-1 text-xs"
            >
              {alias}
              <button
                type="button"
                onClick={() => removeAlias(index)}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {value.length >= maxAliases && (
        <p className="text-xs text-muted-foreground">
          Máximo {maxAliases} aliases permitidos
        </p>
      )}
    </div>
  )
}
