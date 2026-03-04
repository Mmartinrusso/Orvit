'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Inbox, Repeat, BarChart2, Briefcase, Sun, Moon, Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCompany } from '@/contexts/CompanyContext';

export type MobileView = 'home' | 'board' | 'inbox' | 'dashboard' | 'reporting' | 'portfolio' | 'fixed-tasks';

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: MobileView) => void;
}

const NAV_ITEMS = [
  { id: 'inbox' as const, icon: Inbox, label: 'Bandeja' },
  { id: 'fixed-tasks' as const, icon: Repeat, label: 'Tareas Fijas' },
  { id: 'reporting' as const, icon: BarChart2, label: 'Reportes' },
  { id: 'portfolio' as const, icon: Briefcase, label: 'Portfolio' },
];

export function MobileMoreSheet({ open, onOpenChange, onNavigate }: MobileMoreSheetProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { currentCompany } = useCompany();

  const themes = [
    { key: 'light' as const, icon: Sun, label: 'Claro' },
    { key: 'dark' as const, icon: Moon, label: 'Oscuro' },
    { key: 'metal' as const, icon: Zap, label: 'Metal' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl bg-background px-0 pb-8">
        {/* Handle bar */}
        <div className="flex justify-center mt-3 mb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Navigation items */}
        <div className="px-4 space-y-0.5 mt-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onOpenChange(false);
              }}
              className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <item.icon className="h-4 w-4 text-foreground" />
              </div>
              <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-border mx-4 my-3" />

        {/* Theme selector */}
        <div className="px-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Tema</p>
          <div className="flex gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-colors',
                    theme === t.key
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mx-4 my-3" />

        {/* User profile */}
        <div className="px-4 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.avatar ?? undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
              {user?.name?.slice(0, 2).toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user?.name ?? 'Usuario'}</p>
            <p className="text-xs text-muted-foreground truncate">{currentCompany?.name ?? ''}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
