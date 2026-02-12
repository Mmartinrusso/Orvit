import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ListTodo, Search, Ticket, Settings, Moon, Sun, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTheme, useSidebar } from '@/context';
import { cn } from '@/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Home', shortcut: '1' },
  { path: '/tasks', icon: ListTodo, label: 'Tasks', shortcut: '2' },
  { path: '/opportunities', icon: Search, label: 'Opportunities', shortcut: '3' },
  { path: '/tickets', icon: Ticket, label: 'Tickets', shortcut: '4' },
];

const bottomItems = [
  { path: '/settings', icon: Settings, label: 'Settings', shortcut: '5' },
];

export function IconRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isExpanded, toggleSidebar } = useSidebar();

  return (
    <nav className={cn(
      'flex flex-col py-3 transition-all duration-200 relative border-r',
      'bg-white border-slate-200',
      'dark:bg-slate-950 dark:border-slate-800',
      isExpanded ? 'w-60 px-3' : 'w-[56px] items-center'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center mb-5', isExpanded ? 'gap-2.5 px-2' : 'justify-center')}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
          <span className="text-white font-black text-xs tracking-tight">AGX</span>
        </div>
        {isExpanded && (
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-white text-sm leading-none">AGX</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-none mt-0.5">Dev Tool</span>
          </div>
        )}
      </div>

      <div className={cn('h-px bg-slate-200 dark:bg-slate-800 my-1', isExpanded ? 'mx-1' : 'w-6')} />

      {/* Main nav */}
      <div className="flex flex-col gap-0.5 flex-1 mt-1">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              title={isExpanded ? undefined : label}
              className={cn(
                'rounded-lg flex items-center transition-all duration-150 relative group',
                isExpanded ? 'h-9 px-2.5 gap-2.5' : 'w-9 h-9 justify-center mx-auto',
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-slate-300'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-500 dark:bg-blue-400 rounded-r-full" />
              )}
              <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {isExpanded && (
                <span className={cn('text-[13px] truncate', isActive ? 'font-semibold' : 'font-medium')}>
                  {label}
                </span>
              )}
              {isExpanded && (
                <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  {navItems.find(n => n.path === path)?.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-0.5">
        {bottomItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              title={isExpanded ? undefined : label}
              className={cn(
                'rounded-lg flex items-center transition-all duration-150 relative',
                isExpanded ? 'h-9 px-2.5 gap-2.5' : 'w-9 h-9 justify-center mx-auto',
                isActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-slate-300'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-blue-500 dark:bg-blue-400 rounded-r-full" />
              )}
              <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {isExpanded && <span className={cn('text-[13px] truncate', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>}
            </button>
          );
        })}

        <div className={cn('h-px bg-slate-200 dark:bg-slate-800 my-1', isExpanded ? 'mx-1' : 'w-6')} />

        <button
          onClick={toggleTheme}
          title={isExpanded ? undefined : 'Toggle theme'}
          className={cn(
            'rounded-lg flex items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-slate-300 transition-all duration-150',
            isExpanded ? 'h-9 px-2.5 gap-2.5' : 'w-9 h-9 justify-center mx-auto'
          )}
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.5} /> : <Moon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.5} />}
          {isExpanded && <span className="text-[13px] font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>}
        </button>

        <button
          onClick={toggleSidebar}
          title={isExpanded ? undefined : 'Expand'}
          className={cn(
            'rounded-lg flex items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-400 transition-all duration-150',
            isExpanded ? 'h-9 px-2.5 gap-2.5' : 'w-9 h-9 justify-center mx-auto'
          )}
        >
          {isExpanded ? <ChevronsLeft className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.5} /> : <ChevronsRight className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.5} />}
          {isExpanded && <span className="text-[13px] font-medium">Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
