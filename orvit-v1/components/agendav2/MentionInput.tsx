'use client';

import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Paperclip, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface MentionUser {
  id: number;
  name: string;
  avatar?: string | null;
}

interface MentionInputProps {
  onSubmit: (content: string, mentionedUserIds: number[]) => Promise<void>;
  placeholder?: string;
  members: MentionUser[];
  disabled?: boolean;
}

export function MentionInput({
  onSubmit,
  placeholder = 'Escribir comentario...',
  members,
  disabled = false,
}: MentionInputProps) {
  const [value, setValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionedUserIds = useRef<Set<number>>(new Set());

  const filteredMembers =
    mentionQuery !== null
      ? members
          .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 5)
      : [];

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setValue(text);
    const cursor = e.target.selectionStart ?? text.length;
    const textUpToCursor = text.slice(0, cursor);
    const atMatch = textUpToCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(cursor - atMatch[0].length);
    } else {
      setMentionQuery(null);
      setMentionStart(null);
    }
  };

  const handleSelectMention = (user: MentionUser) => {
    if (mentionStart === null) return;
    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursorPos);
    const newValue = `${before}@${user.name} ${after}`;
    setValue(newValue);
    mentionedUserIds.current.add(user.id);
    setMentionQuery(null);
    setMentionStart(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSubmit = async () => {
    if (!value.trim() || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit(value.trim(), Array.from(mentionedUserIds.current));
      setValue('');
      mentionedUserIds.current.clear();
      setMentionQuery(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setMentionQuery(null);
    }
  };

  return (
    <div className="relative">
      {/* Mention dropdown */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[200px]">
          {filteredMembers.map((user) => (
            <button
              key={user.id}
              className="flex items-center gap-2 px-3 py-1.5 w-full hover:bg-muted text-sm text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectMention(user);
              }}
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={user.avatar ?? undefined} />
                <AvatarFallback className="text-xs">
                  {user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        className={cn(
          'flex gap-2 items-end border rounded-lg p-2 bg-background transition-shadow',
          'focus-within:ring-1 focus-within:ring-ring',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || submitting}
          className="border-0 p-0 focus-visible:ring-0 resize-none text-sm min-h-[36px] max-h-[120px] flex-1"
          rows={1}
        />
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" type="button" disabled={disabled}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            className="h-7 w-7 p-0"
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || submitting || disabled}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1 ml-1">
        Cmd+Enter para enviar · @ para mencionar
      </p>
    </div>
  );
}
