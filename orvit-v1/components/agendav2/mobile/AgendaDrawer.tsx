'use client';

import { useEffect } from 'react';
import { X, Sun, Moon, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgendaV2Sidebar, type AgendaV2SidebarProps } from '../AgendaV2Sidebar';
import { useTheme } from '@/components/providers/ThemeProvider';

type SidebarPassThroughProps = Omit<AgendaV2SidebarProps, 'asideStyle'>;

interface AgendaDrawerProps extends SidebarPassThroughProps {
  open: boolean;
  onClose: () => void;
}

export function AgendaDrawer({ open, onClose, ...sidebarProps }: AgendaDrawerProps) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const themes = [
    { key: 'light' as const, icon: Sun, label: 'Claro' },
    { key: 'dark' as const, icon: Moon, label: 'Oscuro' },
    { key: 'metal' as const, icon: Zap, label: 'Metal' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 flex flex-col transition-transform duration-300 ease-out w-[min(288px,85vw)] bg-card shadow-xl',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-4 shrink-0 border-b border-border"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 16px)',
            paddingBottom: '12px',
          }}
        >
          <span className="text-[15px] font-bold text-foreground">Agenda</span>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="flex items-center justify-center rounded-full active:scale-90 transition-transform w-8 h-8 bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* AgendaV2Sidebar fills the rest */}
        <div className="flex-1 overflow-y-auto">
          <AgendaV2Sidebar
            {...sidebarProps}
            asideStyle={{ width: '100%', borderRight: 'none', height: 'auto' }}
          />
        </div>

        {/* Theme selector */}
        <div className="shrink-0 border-t border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Tema</p>
          <div className="flex gap-2">
            {themes.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    theme === t.key
                      ? 'bg-primary/10 text-primary'
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
      </div>
    </>
  );
}
