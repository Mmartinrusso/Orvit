# AgendaV2 Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the agenda page to AgendaV2, fix the comment system, add @mentions, build a proper mobile layout (soft UI), integrate the contextual sidebar, and apply UX polish across the module.

**Architecture:** Mobile-first — new mobile layout lives in `components/agendav2/mobile/`, detected via a `useIsMobile` hook in `AgendaV2Page`. Desktop keeps existing layout. Sidebar context is managed via a lightweight React context provider set in `app/administracion/agenda/layout.tsx`. Comments are extracted from `TaskDetailPanel` into a dedicated `TaskCommentThread` component.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query v5, Prisma, Sonner (toasts), dnd-kit (drag & drop), date-fns

**Design doc:** `docs/plans/2026-03-03-agendav2-improvements-design.md`

---

## Phase 0 — Migration & Cleanup

### Task 1: Wire AgendaV2Page to the agenda page

**Files:**
- Modify: `app/administracion/agenda/page.tsx`

**Step 1: Replace the page content**

Replace the entire file with:

```tsx
'use client';

import dynamic from 'next/dynamic';

const AgendaV2Page = dynamic(
  () => import('@/components/agendav2/AgendaV2Page').then(m => ({ default: m.AgendaV2Page })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 gap-2">
        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
        <span className="text-sm text-muted-foreground">Cargando agenda...</span>
      </div>
    ),
  }
);

export default function AgendaPage() {
  return <AgendaV2Page />;
}
```

**Step 2: Verify the page loads**

```bash
cd orvit-v1 && npm run dev
```

Navigate to `/administracion/agenda`. Expected: AgendaV2 renders without errors.

**Step 3: Commit**

```bash
git add app/administracion/agenda/page.tsx
git commit -m "feat(agenda): wire AgendaV2Page to main agenda route"
```

---

### Task 2: Delete v1 agenda components

**Files:**
- Delete: `components/agenda/` (entire folder)

**Step 1: Check for remaining imports**

```bash
cd orvit-v1
grep -r "from '@/components/agenda'" --include="*.tsx" --include="*.ts" .
grep -r "from '@/components/tasks/TareasContent'" --include="*.tsx" --include="*.ts" .
```

Expected: zero results after migration. If any files still import from v1, update them first.

**Step 2: Delete the folder**

```bash
rm -rf orvit-v1/components/agenda
```

**Step 3: Build check**

```bash
cd orvit-v1 && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no new errors related to `components/agenda`.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore(agenda): remove v1 agenda components (replaced by agendav2)"
```

---

## Phase 1 — Comment System

### Task 3: Fix comment rendering in TaskDetailPanel

**Context:** Comments exist in the DB and are returned by the API, but `TaskDetailPanel.tsx` renders them incorrectly. The task's `comments` array has shape: `{ id, content, createdAt, user: { name, avatar } }`.

**Files:**
- Modify: `components/agendav2/TaskDetailPanel.tsx`
- Create: `components/agendav2/TaskCommentThread.tsx`

**Step 1: Read the current comment section in TaskDetailPanel**

Search for where comments are rendered (look for `task.comments` or `comment` in the file). Identify the broken rendering block.

**Step 2: Create TaskCommentThread component**

Create `components/agendav2/TaskCommentThread.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { AgendaTask } from '@/lib/agenda/types';

type Comment = NonNullable<AgendaTask['comments']>[number];

interface TaskCommentThreadProps {
  comments: Comment[];
  onEditComment: (commentId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}

export function TaskCommentThread({
  comments,
  onEditComment,
  onDeleteComment,
}: TaskCommentThreadProps) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!editContent.trim()) return;
    try {
      await onEditComment(commentId, editContent.trim());
      setEditingId(null);
    } catch {
      toast.error('Error al editar el comentario');
    }
  };

  const handleConfirmDelete = async (commentId: number) => {
    try {
      await onDeleteComment(commentId);
      setDeletingId(null);
    } catch {
      toast.error('Error al eliminar el comentario');
    }
  };

  if (!comments || comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No hay comentarios aún.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const isOwn = user?.id === comment.user?.id;
        const isEditing = editingId === comment.id;
        const isDeleting = deletingId === comment.id;

        return (
          <div key={comment.id} className="flex gap-3 group">
            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
              <AvatarImage src={comment.user?.avatar ?? undefined} />
              <AvatarFallback className="text-xs">
                {comment.user?.name?.slice(0, 2).toUpperCase() ?? '??'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold">{comment.user?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="text-sm min-h-[60px] resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 px-2 gap-1" onClick={() => handleSaveEdit(comment.id)}>
                      <Check className="h-3 w-3" /> Guardar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : isDeleting ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">¿Eliminar este comentario?</span>
                  <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => handleConfirmDelete(comment.id)}>
                    Sí
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setDeletingId(null)}>
                    No
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              )}
            </div>

            {isOwn && !isEditing && !isDeleting && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleStartEdit(comment)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDeletingId(comment.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Replace the comment section in TaskDetailPanel**

Find the comment rendering section and replace it with `<TaskCommentThread>`. Also wire up the `onEditComment` and `onDeleteComment` handlers using the existing API calls in the panel (search for `PATCH /api/agenda/tasks/[id]/comments` and `DELETE` equivalents).

**Step 4: Verify manually**

Navigate to a task that has existing comments. Confirm they render with author, relative date, and text. Confirm edit and delete work for own comments.

**Step 5: Commit**

```bash
git add components/agendav2/TaskCommentThread.tsx components/agendav2/TaskDetailPanel.tsx
git commit -m "fix(agenda): fix comment rendering, extract TaskCommentThread component"
```

---

### Task 4: Add @mentions in comment input

**Files:**
- Create: `components/agendav2/MentionInput.tsx`
- Modify: `components/agendav2/TaskDetailPanel.tsx`
- Modify: `app/api/agenda/tasks/[id]/comments/route.ts`

**Step 1: Create MentionInput component**

Create `components/agendav2/MentionInput.tsx`:

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Send } from 'lucide-react';

interface MentionUser {
  id: number;
  name: string;
  avatar?: string | null;
}

interface MentionInputProps {
  onSubmit: (content: string, mentionedUserIds: number[]) => Promise<void>;
  placeholder?: string;
  members: MentionUser[];
}

export function MentionInput({ onSubmit, placeholder = 'Escribir comentario...', members }: MentionInputProps) {
  const [value, setValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionedUserIds = useRef<Set<number>>(new Set());

  const filteredMembers = mentionQuery !== null
    ? members.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
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
    const before = value.slice(0, mentionStart);
    const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
    const newValue = `${before}@${user.name} ${after}`;
    setValue(newValue);
    mentionedUserIds.current.add(user.id);
    setMentionQuery(null);
    setMentionStart(null);
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(value.trim(), Array.from(mentionedUserIds.current));
      setValue('');
      mentionedUserIds.current.clear();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[200px]">
          {filteredMembers.map(user => (
            <button
              key={user.id}
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted text-sm text-left"
              onMouseDown={(e) => { e.preventDefault(); handleSelectMention(user); }}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatar ?? undefined} />
                <AvatarFallback className="text-xs">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              {user.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end border rounded-lg p-2 bg-background focus-within:ring-1 focus-within:ring-ring">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="border-0 p-0 focus-visible:ring-0 resize-none text-sm min-h-[36px] max-h-[120px]"
          rows={1}
        />
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleSubmit}
            disabled={!value.trim() || submitting}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1 ml-1">⌘+Enter para enviar · @ para mencionar</p>
    </div>
  );
}
```

**Step 2: Update the comments API route to handle mentionedUserIds**

In `app/api/agenda/tasks/[id]/comments/route.ts`, update the POST handler to accept and store `mentionedUserIds`, then trigger Discord + in-app notifications for each mentioned user.

Find the POST handler and add after creating the comment:

```typescript
// After creating the comment:
if (body.mentionedUserIds?.length) {
  // Send Discord notification for each mentioned user
  // Import from lib/discord/agenda-notifications or lib/discord/notifications
  for (const mentionedUserId of body.mentionedUserIds) {
    // Get mentioned user's info
    const mentionedUser = await prisma.user.findUnique({ where: { id: mentionedUserId } });
    if (mentionedUser) {
      // Fire-and-forget Discord DM (don't block the response)
      import('@/lib/discord/notifications').then(({ sendDiscordDM }) => {
        sendDiscordDM(mentionedUser, `Te mencionaron en una tarea: "${task.title}"`).catch(() => {});
      });
    }
  }
}
```

**Step 3: Replace the comment input in TaskDetailPanel with MentionInput**

Find the comment textarea in `TaskDetailPanel` and replace it with `<MentionInput>`. Pass the task's group members as `members` prop.

**Step 4: Verify manually**

Type `@` in the comment input. Confirm the dropdown appears with team members. Select one, send the comment. Confirm the mention appears in the rendered comment.

**Step 5: Commit**

```bash
git add components/agendav2/MentionInput.tsx components/agendav2/TaskDetailPanel.tsx app/api/agenda/tasks/[id]/comments/route.ts
git commit -m "feat(agenda): add @mention system with Discord notification in comments"
```

---

## Phase 2 — UX Polish

### Task 5: Add confirmation dialog for task deletion

**Files:**
- Modify: `components/agendav2/TaskCard.tsx`
- Modify: `components/agendav2/BoardColumn.tsx` (or wherever delete is called)

**Step 1: Find where task delete is triggered**

Search for the delete handler in the agendav2 components:
```bash
grep -r "handleDelete\|onDelete\|deleteTask" orvit-v1/components/agendav2/ --include="*.tsx"
```

**Step 2: Replace confirm() with AlertDialog**

Wherever task deletion is triggered, replace any `confirm()` call or direct delete with an `AlertDialog` from shadcn/ui:

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// In the component, wrap the delete button:
<AlertDialog>
  <AlertDialogTrigger asChild>
    <DropdownMenuItem
      onSelect={(e) => e.preventDefault()}
      className="text-destructive focus:text-destructive"
    >
      <Trash2 className="h-4 w-4 mr-2" />
      Eliminar
    </DropdownMenuItem>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta acción no se puede deshacer. La tarea y todos sus datos serán eliminados permanentemente.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive hover:bg-destructive/90"
        onClick={() => onDelete(task.id)}
      >
        Eliminar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 3: Verify manually**

Click delete on a task card. Confirm the AlertDialog appears. Click Cancel — dialog closes, task remains. Click Eliminar — task is deleted.

**Step 4: Commit**

```bash
git add components/agendav2/
git commit -m "feat(agenda): add confirmation AlertDialog before task deletion"
```

---

### Task 6: Relative dates in task cards

**Files:**
- Modify: `components/agendav2/TaskCard.tsx`

**Step 1: Create a helper function**

Add to the top of `TaskCard.tsx` (or a shared utils file if one exists):

```tsx
import { differenceInDays, isToday, isTomorrow, isPast, format } from 'date-fns';
import { es } from 'date-fns/locale';

function formatDueDate(date: Date | string | null | undefined): { label: string; urgent: boolean } {
  if (!date) return { label: '', urgent: false };
  const d = new Date(date);
  if (isToday(d)) return { label: 'Vence hoy', urgent: true };
  if (isTomorrow(d)) return { label: 'Vence mañana', urgent: false };
  if (isPast(d)) {
    const days = Math.abs(differenceInDays(d, new Date()));
    return { label: `Venció hace ${days} día${days !== 1 ? 's' : ''}`, urgent: true };
  }
  const days = differenceInDays(d, new Date());
  if (days <= 7) return { label: `En ${days} día${days !== 1 ? 's' : ''}`, urgent: false };
  return { label: format(d, 'd MMM', { locale: es }), urgent: false };
}
```

**Step 2: Use the helper in the card render**

Replace wherever `task.dueDate` is formatted as a raw date with:

```tsx
{task.dueDate && (() => {
  const { label, urgent } = formatDueDate(task.dueDate);
  return (
    <span className={`text-xs ${urgent ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
      {label}
    </span>
  );
})()}
```

**Step 3: Write a unit test**

Create `tests/agenda/format-due-date.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll extract formatDueDate to a shared util file to test it
// For now test the logic inline:
describe('formatDueDate', () => {
  const NOW = new Date('2026-03-03T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it('returns "Vence hoy" for today', () => {
    const result = formatDueDate(new Date('2026-03-03T18:00:00Z'));
    expect(result.label).toBe('Vence hoy');
    expect(result.urgent).toBe(true);
  });

  it('returns "Venció hace X días" for past dates', () => {
    const result = formatDueDate(new Date('2026-03-01T12:00:00Z'));
    expect(result.label).toBe('Venció hace 2 días');
    expect(result.urgent).toBe(true);
  });

  it('returns "En X días" for near future', () => {
    const result = formatDueDate(new Date('2026-03-06T12:00:00Z'));
    expect(result.label).toBe('En 3 días');
    expect(result.urgent).toBe(false);
  });
});
```

**Step 4: Run the test**

```bash
cd orvit-v1 && npx vitest run tests/agenda/format-due-date.test.ts
```

Expected: PASS (after extracting the function to `lib/agenda/date-utils.ts` and importing in the test)

**Step 5: Commit**

```bash
git add components/agendav2/TaskCard.tsx lib/agenda/date-utils.ts tests/agenda/format-due-date.test.ts
git commit -m "feat(agenda): show relative due dates in task cards (Vence hoy, Venció hace X días)"
```

---

### Task 7: Persistent filters via localStorage

**Files:**
- Create: `lib/agenda/filter-persistence.ts`
- Modify: `components/agendav2/AgendaV2Page.tsx` (or wherever filter state lives)

**Step 1: Create the persistence helpers**

Create `lib/agenda/filter-persistence.ts`:

```typescript
const STORAGE_KEY_PREFIX = 'orvit_agenda_filters_';

export interface AgendaFilters {
  priorities: string[];
  statuses: string[];
  dateFrom: string | null;
  dateTo: string | null;
  assigneeIds: number[];
  groupId: number | null;
}

export const DEFAULT_FILTERS: AgendaFilters = {
  priorities: [],
  statuses: [],
  dateFrom: null,
  dateTo: null,
  assigneeIds: [],
  groupId: null,
};

export function saveFilters(companyId: number, filters: AgendaFilters): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${companyId}`,
      JSON.stringify(filters)
    );
  } catch {
    // localStorage unavailable (SSR or private browsing)
  }
}

export function loadFilters(companyId: number): AgendaFilters {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${companyId}`);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function clearFilters(companyId: number): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${companyId}`);
  } catch {}
}

export function hasActiveFilters(filters: AgendaFilters): boolean {
  return (
    filters.priorities.length > 0 ||
    filters.statuses.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.assigneeIds.length > 0 ||
    filters.groupId !== null
  );
}
```

**Step 2: Write unit tests**

Create `tests/agenda/filter-persistence.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { saveFilters, loadFilters, clearFilters, hasActiveFilters, DEFAULT_FILTERS } from '@/lib/agenda/filter-persistence';

describe('filter-persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing saved', () => {
    expect(loadFilters(1)).toEqual(DEFAULT_FILTERS);
  });

  it('saves and loads filters', () => {
    const filters = { ...DEFAULT_FILTERS, priorities: ['HIGH', 'URGENT'] };
    saveFilters(1, filters);
    expect(loadFilters(1)).toEqual(filters);
  });

  it('isolates filters per company', () => {
    saveFilters(1, { ...DEFAULT_FILTERS, priorities: ['HIGH'] });
    saveFilters(2, { ...DEFAULT_FILTERS, priorities: ['LOW'] });
    expect(loadFilters(1).priorities).toEqual(['HIGH']);
    expect(loadFilters(2).priorities).toEqual(['LOW']);
  });

  it('hasActiveFilters returns false for defaults', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('hasActiveFilters returns true when filter is set', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, priorities: ['HIGH'] })).toBe(true);
  });
});
```

**Step 3: Run tests**

```bash
cd orvit-v1 && npx vitest run tests/agenda/filter-persistence.test.ts
```

Expected: all PASS.

**Step 4: Wire into AgendaV2Page**

In `AgendaV2Page.tsx`, replace the initial filter state with `loadFilters(currentCompany.id)` and call `saveFilters` whenever filters change:

```tsx
// Init
const [filters, setFilters] = useState<AgendaFilters>(() =>
  typeof window !== 'undefined' ? loadFilters(currentCompany.id) : DEFAULT_FILTERS
);

// On change
const updateFilters = (newFilters: AgendaFilters) => {
  setFilters(newFilters);
  saveFilters(currentCompany.id, newFilters);
};
```

Add a "Limpiar filtros" button in the filter panel, visible only when `hasActiveFilters(filters)`:

```tsx
{hasActiveFilters(filters) && (
  <Button variant="ghost" size="sm" onClick={() => {
    updateFilters(DEFAULT_FILTERS);
    clearFilters(currentCompany.id);
  }}>
    Limpiar filtros
  </Button>
)}
```

**Step 5: Commit**

```bash
git add lib/agenda/filter-persistence.ts tests/agenda/filter-persistence.test.ts components/agendav2/AgendaV2Page.tsx
git commit -m "feat(agenda): persist filters in localStorage per company, add clear filters button"
```

---

### Task 8: Skeleton loaders for task cards

**Files:**
- Create: `components/agendav2/TaskCardSkeleton.tsx`
- Modify: `components/agendav2/BoardView.tsx` (or wherever loading state is handled)

**Step 1: Create the skeleton**

Create `components/agendav2/TaskCardSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function TaskCardSkeleton() {
  return (
    <div className="p-3 border rounded-lg space-y-2 bg-card">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
}

export function TaskColumnSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

**Step 2: Replace spinner with skeleton in loading states**

In `BoardView.tsx` (and any other view that shows a loading state), find the loading check and replace the generic spinner with `<TaskColumnSkeleton>`.

**Step 3: Commit**

```bash
git add components/agendav2/TaskCardSkeleton.tsx components/agendav2/BoardView.tsx
git commit -m "feat(agenda): replace generic spinners with skeleton loaders in task views"
```

---

### Task 9: Quick actions on hover (desktop task cards)

**Files:**
- Modify: `components/agendav2/TaskCard.tsx`

**Step 1: Add hover action bar**

In `TaskCard.tsx`, add a row of quick action buttons that appear on hover (use Tailwind `group` / `group-hover`):

```tsx
// Wrap the card with group class
<div className="group relative ...existing classes...">
  {/* existing card content */}

  {/* Quick actions — visible on hover */}
  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    {/* Change status */}
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="h-6 w-6 p-0"
          onClick={(e) => { e.stopPropagation(); onStatusChange(task.id); }}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Cambiar estado</TooltipContent>
    </Tooltip>

    {/* Open detail */}
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="h-6 w-6 p-0"
          onClick={(e) => { e.stopPropagation(); onOpen(task); }}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Abrir detalle</TooltipContent>
    </Tooltip>
  </div>
</div>
```

**Step 2: Verify manually**

Hover over a task card on desktop. Quick action buttons appear in the top-right corner. Clicking them doesn't open the task detail (stopPropagation works).

**Step 3: Commit**

```bash
git add components/agendav2/TaskCard.tsx
git commit -m "feat(agenda): add quick action buttons on task card hover (desktop)"
```

---

## Phase 3 — Sidebar Contextual

### Task 10: Create SidebarContext provider

**Files:**
- Create: `contexts/SidebarContext.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/layout/Navbar.tsx`

**Step 1: Create the context**

Create `contexts/SidebarContext.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type SidebarMode = 'global' | 'agenda';

interface SidebarContextValue {
  mode: SidebarMode;
  setMode: (mode: SidebarMode) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  mode: 'global',
  setMode: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SidebarMode>('global');
  return (
    <SidebarContext.Provider value={{ mode, setMode }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
```

**Step 2: Add SidebarProvider to root layout**

In `app/layout.tsx`, wrap the existing providers with `<SidebarProvider>`.

**Step 3: Set agenda mode in agenda layout**

Create (or modify) `app/administracion/agenda/layout.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useSidebar } from '@/contexts/SidebarContext';

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  const { setMode } = useSidebar();

  useEffect(() => {
    setMode('agenda');
    return () => setMode('global');
  }, [setMode]);

  return <>{children}</>;
}
```

**Step 4: Modify Navbar to render AgendaV2Sidebar in agenda mode**

In `components/layout/Navbar.tsx`, import `useSidebar` and `AgendaV2Sidebar`. Add conditional rendering:

```tsx
const { mode } = useSidebar();

// In the render, where the sidebar content is shown:
{mode === 'agenda' ? (
  <AgendaV2Sidebar
    // pass the required props — check what AgendaV2Sidebar expects
    // and source them from the same place AgendaV2Page sources them
  />
) : (
  // existing sidebar navigation
)}
```

Note: You'll need to read `AgendaV2Sidebar`'s props and provide them. The groups/tasks data may need to be fetched here or passed via a shared context.

**Step 5: Verify manually**

Navigate to `/administracion/agenda`. The sidebar should show the agenda navigation. Navigate away. The sidebar returns to global navigation.

**Step 6: Commit**

```bash
git add contexts/SidebarContext.tsx app/administracion/agenda/layout.tsx components/layout/Navbar.tsx app/layout.tsx
git commit -m "feat(sidebar): contextual sidebar transforms to AgendaV2Sidebar on /agenda routes"
```

---

## Phase 4 — Mobile Layout

### Task 11: Create mobile detection hook and layout shell

**Files:**
- Create: `hooks/use-is-mobile.ts`
- Create: `components/agendav2/mobile/AgendaMobileLayout.tsx`
- Modify: `components/agendav2/AgendaV2Page.tsx`

**Step 1: Create useIsMobile hook**

Create `hooks/use-is-mobile.ts`:

```typescript
import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
```

**Step 2: Create AgendaMobileLayout shell**

Create `components/agendav2/mobile/AgendaMobileLayout.tsx`:

```tsx
'use client';

import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AgendaMobileLayoutProps {
  children: ReactNode;
  activeTab: 'home' | 'tasks' | 'dashboard' | 'profile';
  onTabChange: (tab: 'home' | 'tasks' | 'dashboard' | 'profile') => void;
  onCreateTask: () => void;
}

export function AgendaMobileLayout({
  children,
  activeTab,
  onTabChange,
  onCreateTask,
}: AgendaMobileLayoutProps) {
  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: '#F5F3EF' }}
    >
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <BottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCreateTask={onCreateTask}
      />
    </div>
  );
}
```

**Step 3: Create BottomNav**

Create `components/agendav2/mobile/BottomNav.tsx`:

```tsx
'use client';

import { Home, ListTodo, BarChart2, User, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'home' | 'tasks' | 'dashboard' | 'profile';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onCreateTask: () => void;
}

const TABS = [
  { id: 'home' as Tab, icon: Home, label: 'Inicio' },
  { id: 'tasks' as Tab, icon: ListTodo, label: 'Tareas' },
];

const TABS_RIGHT = [
  { id: 'dashboard' as Tab, icon: BarChart2, label: 'Dashboard' },
  { id: 'profile' as Tab, icon: User, label: 'Perfil' },
];

export function BottomNav({ activeTab, onTabChange, onCreateTask }: BottomNavProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-4 pb-safe"
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0 -1px 0 rgba(0,0,0,0.06), 0 -4px 12px rgba(0,0,0,0.04)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        paddingTop: '8px',
      }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex flex-col items-center gap-0.5 min-w-[44px]',
            activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          <tab.icon className={cn('h-5 w-5', activeTab === tab.id && 'stroke-[2.5]')} />
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}

      {/* Central FAB */}
      <button
        onClick={onCreateTask}
        className="flex items-center justify-center h-12 w-12 rounded-full shadow-lg"
        style={{ backgroundColor: '#06b6d4' }}
      >
        <Plus className="h-5 w-5 text-white stroke-[2.5]" />
      </button>

      {TABS_RIGHT.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex flex-col items-center gap-0.5 min-w-[44px]',
            activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          <tab.icon className={cn('h-5 w-5', activeTab === tab.id && 'stroke-[2.5]')} />
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Wire mobile detection into AgendaV2Page**

In `AgendaV2Page.tsx`, add at the top of the component:

```tsx
const isMobile = useIsMobile();

if (isMobile) {
  return <AgendaMobilePage tasks={tasks} /* ...other needed props */ />;
}
// ... existing desktop render
```

Create `components/agendav2/mobile/AgendaMobilePage.tsx` as the mobile page controller (manages which mobile screen is shown).

**Step 5: Verify on mobile viewport**

In browser devtools, toggle device emulation (iPhone 14 size). Confirm the bottom nav appears and the desktop layout is hidden.

**Step 6: Commit**

```bash
git add hooks/use-is-mobile.ts components/agendav2/mobile/ components/agendav2/AgendaV2Page.tsx
git commit -m "feat(agenda/mobile): add mobile detection and layout shell with BottomNav"
```

---

### Task 12: Build mobile HomeScreen (WeekStrip + Projects + Today's tasks)

**Files:**
- Create: `components/agendav2/mobile/WeekStrip.tsx`
- Create: `components/agendav2/mobile/ProgressRing.tsx`
- Create: `components/agendav2/mobile/TaskCardMobile.tsx`
- Create: `components/agendav2/mobile/AgendaHomeScreen.tsx`

**Step 1: Create ProgressRing**

Create `components/agendav2/mobile/ProgressRing.tsx`:

```tsx
interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function ProgressRing({ percent, size = 36, strokeWidth = 3, color = '#06b6d4' }: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x={size / 2} y={size / 2 + 4}
        textAnchor="middle"
        fontSize={size * 0.28}
        fontWeight="600"
        fill="currentColor"
      >
        {percent}%
      </text>
    </svg>
  );
}
```

**Step 2: Create WeekStrip**

Create `components/agendav2/mobile/WeekStrip.tsx`:

```tsx
'use client';

import { addDays, startOfWeek, format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function WeekStrip({ selectedDate, onSelectDate }: WeekStripProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="px-4 pt-2 pb-3">
      {/* Day labels */}
      <div className="flex justify-between mb-1">
        {days.map((day) => (
          <span key={day.toISOString()} className="text-[10px] text-muted-foreground w-9 text-center uppercase">
            {format(day, 'EEEEE', { locale: es })}
          </span>
        ))}
      </div>
      {/* Day pills */}
      <div className="flex justify-between">
        {days.map((day) => {
          const selected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                selected
                  ? 'bg-white text-foreground font-semibold'
                  : 'text-muted-foreground',
                today && !selected && 'text-foreground font-semibold',
              )}
              style={selected ? {
                boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
              } : {}}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: Create TaskCardMobile**

Create `components/agendav2/mobile/TaskCardMobile.tsx`:

```tsx
'use client';

import { ProgressRing } from './ProgressRing';
import { MessageSquare, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgendaTask } from '@/lib/agenda/types';

interface TaskCardMobileProps {
  task: AgendaTask;
  onTap: (task: AgendaTask) => void;
  onComplete: (taskId: number) => void;
}

export function TaskCardMobile({ task, onTap, onComplete }: TaskCardMobileProps) {
  const subtaskCount = task.subtasks?.length ?? 0;
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length ?? 0;
  const progress = subtaskCount > 0 ? Math.round((completedSubtasks / subtaskCount) * 100) : 0;
  const commentCount = task.comments?.length ?? 0;
  const isDone = task.status === 'COMPLETED';

  return (
    <div
      onClick={() => onTap(task)}
      className="mx-4 mb-2 p-4 rounded-2xl bg-white cursor-pointer active:scale-[0.98] transition-transform"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {task.group && (
            <span className="text-[11px] font-medium text-muted-foreground mb-1 block">
              {task.group.name}
            </span>
          )}
          <p className={cn(
            'text-sm font-semibold leading-snug',
            isDone && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {subtaskCount > 0 && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CheckSquare className="h-3 w-3" />
                {completedSubtasks}/{subtaskCount}
              </span>
            )}
            {commentCount > 0 && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {commentCount}
              </span>
            )}
          </div>
        </div>
        {subtaskCount > 0 && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <ProgressRing percent={progress} size={36} />
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
          className={cn(
            'h-5 w-5 rounded border-2 shrink-0 mt-0.5 transition-colors',
            isDone ? 'bg-green-500 border-green-500' : 'border-gray-300'
          )}
        />
      </div>
    </div>
  );
}
```

**Step 4: Create AgendaHomeScreen**

Create `components/agendav2/mobile/AgendaHomeScreen.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, Bell, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WeekStrip } from './WeekStrip';
import { TaskCardMobile } from './TaskCardMobile';
import { useAuth } from '@/contexts/AuthContext';
import type { AgendaTask } from '@/lib/agenda/types';

interface AgendaHomeScreenProps {
  tasks: AgendaTask[];
  onTaskTap: (task: AgendaTask) => void;
  onTaskComplete: (taskId: number) => void;
  onMenuOpen: () => void;
}

export function AgendaHomeScreen({ tasks, onTaskTap, onTaskComplete, onMenuOpen }: AgendaHomeScreenProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { user } = useAuth();

  const todayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    const due = format(new Date(t.dueDate), 'yyyy-MM-dd');
    const sel = format(selectedDate, 'yyyy-MM-dd');
    return due === sel;
  });

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={onMenuOpen}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar ?? undefined} />
            <AvatarFallback className="text-xs">{user?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-sm font-medium"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {format(selectedDate, 'MMM, yyyy', { locale: es })}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button className="h-9 w-9 rounded-full flex items-center justify-center bg-white"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <Bell className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Week strip */}
      <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Today's tasks */}
      <div className="px-4 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {format(selectedDate, "d 'de' MMMM", { locale: es })}
        </h2>
        <span className="h-5 w-5 rounded-full bg-foreground text-background text-[11px] font-bold flex items-center justify-center">
          {todayTasks.length}
        </span>
      </div>

      {todayTasks.length === 0 ? (
        <div className="mx-4 p-6 rounded-2xl bg-white text-center"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p className="text-sm text-muted-foreground">No hay tareas para este día</p>
        </div>
      ) : (
        <div>
          {todayTasks.map(task => (
            <TaskCardMobile
              key={task.id}
              task={task}
              onTap={onTaskTap}
              onComplete={onTaskComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Wire HomeScreen into AgendaMobilePage**

Create `components/agendav2/mobile/AgendaMobilePage.tsx` and use `AgendaMobileLayout` + `AgendaHomeScreen`.

**Step 6: Verify on mobile viewport**

In devtools, emulate iPhone 14. Navigate to `/administracion/agenda`. Confirm:
- Top bar with avatar, month picker, bell
- Week strip with day pills
- Today's task cards with progress rings

**Step 7: Commit**

```bash
git add components/agendav2/mobile/
git commit -m "feat(agenda/mobile): build HomeScreen with WeekStrip, TaskCardMobile and ProgressRing"
```

---

### Task 13: Mobile Task Detail (full screen)

**Files:**
- Create: `components/agendav2/mobile/TaskDetailMobile.tsx`

**Step 1: Create the component**

Create `components/agendav2/mobile/TaskDetailMobile.tsx`:

```tsx
'use client';

import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TaskCommentThread } from '../TaskCommentThread';
import { MentionInput } from '../MentionInput';
import type { AgendaTask } from '@/lib/agenda/types';

interface TaskDetailMobileProps {
  task: AgendaTask;
  onBack: () => void;
  onEditComment: (commentId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
  onAddComment: (content: string, mentionedUserIds: number[]) => Promise<void>;
  members: Array<{ id: number; name: string; avatar?: string | null }>;
}

export function TaskDetailMobile({
  task, onBack, onEditComment, onDeleteComment, onAddComment, members
}: TaskDetailMobileProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b sticky top-0 bg-background z-10">
        <button onClick={onBack} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold flex-1 truncate">{task.title}</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-32">
        {/* Status + Priority */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">{task.status}</Badge>
          {task.priority && <Badge variant="outline">{task.priority}</Badge>}
          {task.dueDate && (
            <Badge variant="outline">
              {new Date(task.dueDate).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
            </Badge>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Descripción</h3>
            <p className="text-sm">{task.description}</p>
          </div>
        )}

        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Subtareas ({task.subtasks.filter(s => s.completed).length}/{task.subtasks.length})
            </h3>
            <div className="space-y-2">
              {task.subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 text-sm">
                  <div className={`h-4 w-4 rounded border-2 ${sub.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'}`} />
                  <span className={sub.completed ? 'line-through text-muted-foreground' : ''}>{sub.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Comentarios
          </h3>
          <TaskCommentThread
            comments={task.comments ?? []}
            onEditComment={onEditComment}
            onDeleteComment={onDeleteComment}
          />
        </div>
      </div>

      {/* Sticky comment input */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-background border-t"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
        <MentionInput
          onSubmit={onAddComment}
          members={members}
          placeholder="Comentar..."
        />
      </div>
    </div>
  );
}
```

**Step 2: Wire into AgendaMobilePage**

When a task card is tapped, push `TaskDetailMobile` as the current view (use a simple state machine: `'home' | 'task-detail'` + `selectedTask`).

**Step 3: Verify manually**

Tap a task card on mobile. Full-screen task detail pushes in. Back arrow returns to home list. Comment input is sticky at the bottom.

**Step 4: Commit**

```bash
git add components/agendav2/mobile/TaskDetailMobile.tsx components/agendav2/mobile/AgendaMobilePage.tsx
git commit -m "feat(agenda/mobile): full-screen task detail with comments and sticky input"
```

---

### Task 14: Mobile drawer with AgendaV2Sidebar

**Files:**
- Create: `components/agendav2/mobile/AgendaDrawer.tsx`

**Step 1: Create the drawer**

Create `components/agendav2/mobile/AgendaDrawer.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgendaV2Sidebar } from '../AgendaV2Sidebar';

interface AgendaDrawerProps {
  open: boolean;
  onClose: () => void;
  // Pass through AgendaV2Sidebar props
  groups: Parameters<typeof AgendaV2Sidebar>[0]['groups'];
  tasks: Parameters<typeof AgendaV2Sidebar>[0]['tasks'];
  activeView: Parameters<typeof AgendaV2Sidebar>[0]['activeView'];
  onViewChange: Parameters<typeof AgendaV2Sidebar>[0]['onViewChange'];
  selectedGroupId: Parameters<typeof AgendaV2Sidebar>[0]['selectedGroupId'];
  onSelectGroup: Parameters<typeof AgendaV2Sidebar>[0]['onSelectGroup'];
}

export function AgendaDrawer({ open, onClose, ...sidebarProps }: AgendaDrawerProps) {
  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 w-72 bg-white shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Agenda</span>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto h-full pb-8">
          <AgendaV2Sidebar {...sidebarProps} />
        </div>
      </div>
    </>
  );
}
```

**Step 2: Wire drawer into AgendaHomeScreen**

In `AgendaHomeScreen`, the avatar button calls `onMenuOpen`. In `AgendaMobilePage`, `onMenuOpen` sets `drawerOpen = true`.

**Step 3: Verify manually**

Tap the avatar in the top bar. Drawer slides in from left showing the agenda sidebar. Tap backdrop to close.

**Step 4: Commit**

```bash
git add components/agendav2/mobile/AgendaDrawer.tsx
git commit -m "feat(agenda/mobile): left drawer with AgendaV2Sidebar navigation"
```

---

## Final Tasks

### Task 15: Update daily log

Update `.claude/daily-logs/2026-03-03.md` with what was implemented.

### Task 16: Smoke test all changes

Run through the full flow manually:

1. Desktop: navigate to `/administracion/agenda` → AgendaV2 loads ✓
2. Desktop: sidebar transforms to agenda navigation ✓
3. Desktop: comments render, edit, delete work ✓
4. Desktop: `@mention` dropdown appears, notification fires ✓
5. Desktop: delete task shows AlertDialog ✓
6. Desktop: filters persist across page refreshes ✓
7. Mobile: bottom nav visible, FAB works ✓
8. Mobile: week strip, task cards with progress rings ✓
9. Mobile: tap task → full screen detail ✓
10. Mobile: avatar → drawer with sidebar ✓

### Task 17: Final commit + PR

```bash
cd orvit-v1
npm run build 2>&1 | tail -5
```

Expected: successful build (or only pre-existing errors).

```bash
git add -A
git commit -m "feat(agenda): AgendaV2 migration, mobile layout, comments, @mentions, UX polish"
```
