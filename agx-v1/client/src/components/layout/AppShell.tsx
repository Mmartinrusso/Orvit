import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { IconRail } from './IconRail';
import { CommandPalette } from '@/components/common';
import { useQuickAction } from '@/hooks/useQuickAction';

export function AppShell() {
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const quickAction = useQuickAction();

  const handleQuickAction = useCallback((action: string) => {
    quickAction.mutate({ action: action as any });
  }, [quickAction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K - Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      // Ctrl+1-5 - Quick navigation
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        const pages = ['/', '/tasks', '/opportunities', '/tickets', '/settings'];
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          navigate(pages[num - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-dark-bg overflow-hidden">
      <IconRail />
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          <Outlet />
        </div>
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onQuickAction={handleQuickAction}
      />
    </div>
  );
}
