'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SidebarItem } from './types';

interface SidebarLinkProps {
  item: SidebarItem;
  isActive: boolean;
  isOpen: boolean;
  onHover: (href: string) => void;
  onClick: (href?: string, e?: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Renderiza un link individual del sidebar.
 * Cuando isOpen=false, muestra solo el icono con tooltip.
 * Cuando isOpen=true, muestra icono + nombre + badge opcional.
 */
export function SidebarLink({ item, isActive, isOpen, onHover, onClick }: SidebarLinkProps) {
  if (!isOpen) {
    return (
      <li className="flex justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href || '#'}
              prefetch={true}
              aria-label={item.name}
              onMouseEnter={() => onHover(item.href || '')}
              onClick={(e) => onClick(item.href, e)}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive && 'bg-sidebar-primary text-sidebar-primary-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.name}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href || '#'}
        prefetch={true}
        onMouseEnter={() => onHover(item.href || '')}
        onClick={(e) => onClick(item.href, e)}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
          isActive && "border-l-2 border-l-sidebar-primary-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.name}</span>
        {item.badge !== undefined && item.badge !== 0 && (
          <span className={cn(
            "ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded-full min-w-[18px] text-center",
            item.badgeVariant === 'destructive' && "bg-red-500 text-white",
            item.badgeVariant === 'warning' && "bg-yellow-500 text-black",
            (!item.badgeVariant || item.badgeVariant === 'default') && "bg-sidebar-primary/20 text-sidebar-primary-foreground"
          )}>
            {item.badge}
          </span>
        )}
      </Link>
    </li>
  );
}
