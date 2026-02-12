import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, ListTodo, Search, Ticket, Settings, Moon, Sun,
  Bug, TestTube, RefreshCw, Eye, FileText, Gauge, Command
} from 'lucide-react';
import { useTheme } from '@/context';
import { cn } from '@/utils';

interface CommandItem {
  id: string;
  label: string;
  icon: typeof Home;
  category: 'navigation' | 'quick-action' | 'config';
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onQuickAction?: (action: string) => void;
}

export function CommandPalette({ open, onClose, onQuickAction }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-home', label: 'Ir a Inicio', icon: Home, category: 'navigation', action: () => { navigate('/'); onClose(); }, shortcut: 'Ctrl+1' },
    { id: 'nav-tasks', label: 'Ir a Tasks', icon: ListTodo, category: 'navigation', action: () => { navigate('/tasks'); onClose(); }, shortcut: 'Ctrl+2' },
    { id: 'nav-opportunities', label: 'Ir a Oportunidades', icon: Search, category: 'navigation', action: () => { navigate('/opportunities'); onClose(); }, shortcut: 'Ctrl+3' },
    { id: 'nav-tickets', label: 'Ir a Tickets', icon: Ticket, category: 'navigation', action: () => { navigate('/tickets'); onClose(); }, shortcut: 'Ctrl+4' },
    { id: 'nav-settings', label: 'Ir a Settings', icon: Settings, category: 'navigation', action: () => { navigate('/settings'); onClose(); }, shortcut: 'Ctrl+5' },
    // Quick Actions
    { id: 'action-fix', label: 'Fix Bug', icon: Bug, category: 'quick-action', action: () => { onQuickAction?.('fix'); onClose(); } },
    { id: 'action-test', label: 'Escribir Tests', icon: TestTube, category: 'quick-action', action: () => { onQuickAction?.('test'); onClose(); } },
    { id: 'action-refactor', label: 'Refactorizar', icon: RefreshCw, category: 'quick-action', action: () => { onQuickAction?.('refactor'); onClose(); } },
    { id: 'action-review', label: 'Code Review', icon: Eye, category: 'quick-action', action: () => { onQuickAction?.('review'); onClose(); } },
    { id: 'action-docs', label: 'Documentar', icon: FileText, category: 'quick-action', action: () => { onQuickAction?.('docs'); onClose(); } },
    { id: 'action-optimize', label: 'Optimizar', icon: Gauge, category: 'quick-action', action: () => { onQuickAction?.('optimize'); onClose(); } },
    // Config
    { id: 'config-theme', label: theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro', icon: theme === 'dark' ? Sun : Moon, category: 'config', action: () => { toggleTheme(); onClose(); } },
  ], [navigate, onClose, onQuickAction, theme, toggleTheme]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  }, [query, commands]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector('[data-selected="true"]');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  const categoryLabels: Record<string, string> = {
    'navigation': 'Navegacion',
    'quick-action': 'Acciones Rapidas',
    'config': 'Configuracion',
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative max-w-lg mx-auto mt-[20vh] animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-surface overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <Command className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Buscar comando..."
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            <kbd className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-72 overflow-y-auto py-2">
            {filtered.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No se encontraron comandos</p>
            )}
            {filtered.map((cmd, index) => {
              const isSelected = index === selectedIndex;
              const showCategory = index === 0 || cmd.category !== filtered[index - 1].category;

              return (
                <div key={cmd.id}>
                  {showCategory && (
                    <p className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 px-4 pt-2 pb-1">
                      {categoryLabels[cmd.category] || cmd.category}
                    </p>
                  )}
                  <button
                    data-selected={isSelected}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-hover'
                    )}
                  >
                    <cmd.icon className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm flex-1">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
