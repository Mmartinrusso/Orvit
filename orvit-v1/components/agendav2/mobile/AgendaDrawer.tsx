'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgendaV2Sidebar, type AgendaV2SidebarProps } from '../AgendaV2Sidebar';

// Re-export the sidebar props shape (minus the asideStyle override which we control)
type SidebarPassThroughProps = Omit<AgendaV2SidebarProps, 'asideStyle'>;

interface AgendaDrawerProps extends SidebarPassThroughProps {
  open: boolean;
  onClose: () => void;
}

export function AgendaDrawer({ open, onClose, ...sidebarProps }: AgendaDrawerProps) {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={cn(
          'fixed left-0 top-0 bottom-0 z-50 flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          width: 'min(288px, 85vw)',
          backgroundColor: '#FFFFFF',
          boxShadow: open ? '4px 0 24px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 16px)',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            Agenda
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="flex items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{ width: '32px', height: '32px', backgroundColor: '#f1f5f9' }}
          >
            <X className="h-4 w-4" style={{ color: '#64748b' }} />
          </button>
        </div>

        {/* AgendaV2Sidebar fills the rest */}
        <div className="flex-1 overflow-y-auto">
          <AgendaV2Sidebar
            {...sidebarProps}
            asideStyle={{ width: '100%', borderRight: 'none', height: 'auto' }}
          />
        </div>
      </div>
    </>
  );
}
