'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface UserOption {
  id: number;
  name: string;
  avatar?: string | null;
}

interface UserFilterPillsProps {
  users: UserOption[];
  selectedUserId: number | null;
  onSelect: (userId: number | null) => void;
  /** Optional label shown before pills (e.g. "Para:" or "De:") */
  label?: string;
  /** Label for the "all" pill. Default: "Todos" */
  allLabel?: string;
}

export function UserFilterPills({ users, selectedUserId, onSelect, label, allLabel = 'Todos' }: UserFilterPillsProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-5 py-1.5">
      {label && (
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider mr-0.5">
          {label}
        </span>
      )}
      {/* "Todos" pill */}
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200',
          selectedUserId === null
            ? 'bg-foreground text-background'
            : 'bg-muted/60 text-muted-foreground'
        )}
      >
        {allLabel}
      </button>

      {users.map((u) => {
        const isActive = selectedUserId === u.id;
        const initials = u.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        return (
          <button
            key={u.id}
            onClick={() => onSelect(isActive ? null : u.id)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 pl-1 pr-3 py-0.5 rounded-full text-xs font-medium transition-all duration-200',
              isActive
                ? 'bg-foreground text-background'
                : 'bg-muted/60 text-muted-foreground'
            )}
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback
                className={cn(
                  'text-[8px] font-bold',
                  isActive ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'
                )}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[80px]">{u.name.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}
