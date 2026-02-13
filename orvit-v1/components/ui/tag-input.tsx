'use client';

import { useState, KeyboardEvent, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  maxTags?: number;
  className?: string;
  disabled?: boolean;
}

export function TagInput({
  value = [],
  onChange,
  placeholder = 'Agregar etiqueta...',
  suggestions = [],
  maxTags = 10,
  className,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue.trim());
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeTag(value.length - 1);
    }
  };

  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (
      normalizedTag &&
      !value.includes(normalizedTag) &&
      value.length < maxTags
    ) {
      onChange([...value, normalizedTag]);
    }
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (index: number) => {
    const newTags = [...value];
    newTags.splice(index, 1);
    onChange(newTags);
  };

  // Filtrar sugerencias
  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.includes(s.toLowerCase())
  );

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[42px]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Tags */}
        {value.map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex items-center gap-1 px-2 py-1"
          >
            <Tag className="w-3 h-3" />
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}

        {/* Input */}
        {value.length < maxTags && !disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(inputValue.length > 0 || suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={value.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
            disabled={disabled}
          />
        )}
      </div>

      {/* Sugerencias */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
          {filteredSuggestions.slice(0, 10).map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => addTag(suggestion)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
            >
              <Plus className="w-3 h-3" />
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Contador */}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {value.length}/{maxTags} etiquetas
        </p>
      )}
    </div>
  );
}

// Componente simplificado para mostrar tags (solo lectura)
export function TagDisplay({
  tags,
  className,
}: {
  tags: string[];
  className?: string;
}) {
  if (!tags || tags.length === 0) {
    return <span className="text-muted-foreground text-sm">Sin etiquetas</span>;
  }

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map((tag, index) => (
        <Badge key={index} variant="outline" className="text-xs">
          <Tag className="w-3 h-3 mr-1" />
          {tag}
        </Badge>
      ))}
    </div>
  );
}
