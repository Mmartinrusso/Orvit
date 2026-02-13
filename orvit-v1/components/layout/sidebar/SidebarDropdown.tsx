'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SidebarItem } from './types';
import { checkIsActive } from './types';

interface SidebarDropdownProps {
  item: SidebarItem;
  isOpen: boolean;
  pathname: string;
  openGroups: { [key: string]: boolean };
  setOpenGroups: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  onHover: (href: string) => void;
  onClick: (href?: string, e?: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Renderiza un grupo colapsable del sidebar con soporte para subgrupos anidados.
 * Cuando isOpen=false (sidebar colapsado): icono + tooltip + hijos como iconos.
 * Cuando isOpen=true: grupo desplegable con chevron y lista de hijos.
 */
export function SidebarDropdown({
  item,
  isOpen,
  pathname,
  openGroups,
  setOpenGroups,
  onHover,
  onClick,
}: SidebarDropdownProps) {
  const children = item.children || [];

  // Sidebar colapsado: grupo como ícono con hijos expandibles verticalmente
  if (!isOpen) {
    const hasActiveChild = children.some(child => checkIsActive(pathname, child.href));
    const isOpenGroup = openGroups[item.name] ?? hasActiveChild;

    return (
      <li className="flex flex-col items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              aria-label={item.name}
              aria-expanded={isOpenGroup}
              className={cn(
                'h-8 w-8 flex items-center justify-center rounded-md',
                'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              onClick={() => setOpenGroups((prev) => ({ ...prev, [item.name]: !isOpenGroup }))}
            >
              <item.icon className="h-4 w-4 shrink-0" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.name}
          </TooltipContent>
        </Tooltip>

        {isOpenGroup && (
          <ul className="mt-1 w-full flex flex-col items-center gap-0.5">
            {children.map((child: SidebarItem, childIndex: number) => {
              const isActive = checkIsActive(pathname, child.href);
              return (
                <li key={`${item.name}-${child.href || childIndex}`} className="flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={child.href || '#'}
                        prefetch={true}
                        aria-label={child.name}
                        onMouseEnter={() => onHover(child.href || '')}
                        onClick={() => onClick(child.href)}
                        className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                          'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          isActive && 'bg-sidebar-primary text-sidebar-primary-foreground'
                        )}
                      >
                        <child.icon className="h-4 w-4" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {child.name}
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  // Sidebar expandido: grupo desplegable con chevron
  const hasActiveChild = children.some(child => {
    if (!child.href) return false;
    return checkIsActive(pathname, child.href);
  });
  const isOpenGroup = openGroups[item.name] ?? hasActiveChild;

  return (
    <li>
      <div className="flex items-center">
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors w-full text-left',
            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
          onClick={() => setOpenGroups((prev) => ({ ...prev, [item.name]: !isOpenGroup }))}
        >
          <item.icon className={cn('h-4 w-4 shrink-0 text-sidebar-foreground')} />
          <span>{item.name}</span>
        </button>
        <button
          className="ml-auto px-1.5 focus:outline-none"
          onClick={e => {
            e.stopPropagation();
            setOpenGroups((prev) => ({ ...prev, [item.name]: !isOpenGroup }));
          }}
          tabIndex={-1}
          aria-label={isOpenGroup ? 'Cerrar grupo' : 'Abrir grupo'}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-sidebar-foreground/70 transition-transform',
              isOpenGroup ? 'rotate-90' : ''
            )}
          />
        </button>
      </div>
      {isOpenGroup && (
        <ul className="pl-6 flex flex-col gap-0.5 mt-1">
          {children.map((child: SidebarItem, childIdx: number) => {
            // Si el hijo tiene sus propios children, renderizar como subgrupo
            if (child.children && Array.isArray(child.children)) {
              return (
                <SidebarSubgroup
                  key={`${item.name}-child-${child.name}`}
                  parentName={item.name}
                  child={child}
                  pathname={pathname}
                  openGroups={openGroups}
                  setOpenGroups={setOpenGroups}
                  onHover={onHover}
                  onClick={onClick}
                />
              );
            }

            // Link normal
            const isActive = checkIsActive(pathname, child.href);
            return (
              <li key={`${item.name}-child-${child.href || childIdx}`}>
                <Link
                  href={child.href || '#'}
                  prefetch={true}
                  onMouseEnter={() => onHover(child.href || '')}
                  onClick={(e) => onClick(child.href, e)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
                    isActive && "border-l-2 border-l-sidebar-primary-foreground"
                  )}
                >
                  <child.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{child.name}</span>
                  {child.badge !== undefined && child.badge !== 0 && (
                    <span className={cn(
                      "ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded-full min-w-[18px] text-center",
                      child.badgeVariant === 'destructive' && "bg-red-500 text-white",
                      child.badgeVariant === 'warning' && "bg-yellow-500 text-black",
                      (!child.badgeVariant || child.badgeVariant === 'default') && "bg-sidebar-primary/20 text-sidebar-primary-foreground"
                    )}>
                      {child.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/**
 * Subgrupo anidado dentro de un SidebarDropdown (tercer nivel).
 */
function SidebarSubgroup({
  parentName,
  child,
  pathname,
  openGroups,
  setOpenGroups,
  onHover,
  onClick,
}: {
  parentName: string;
  child: SidebarItem;
  pathname: string;
  openGroups: { [key: string]: boolean };
  setOpenGroups: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  onHover: (href: string) => void;
  onClick: (href?: string, e?: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const subchildren = child.children || [];
  const hasActiveSubchild = subchildren.some((subchild: SidebarItem) => {
    return checkIsActive(pathname, subchild.href);
  });
  const isSubgroupOpen = openGroups[child.name] ?? hasActiveSubchild;

  return (
    <li>
      <div className="flex items-center">
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors w-full text-left',
            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
          onClick={() => setOpenGroups((prev) => ({ ...prev, [child.name]: !isSubgroupOpen }))}
        >
          <child.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{child.name}</span>
        </button>
        <button
          className="ml-auto px-1.5 focus:outline-none"
          onClick={e => {
            e.stopPropagation();
            setOpenGroups((prev) => ({ ...prev, [child.name]: !isSubgroupOpen }));
          }}
          tabIndex={-1}
          aria-label={isSubgroupOpen ? 'Cerrar subgrupo' : 'Abrir subgrupo'}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-sidebar-foreground/70 transition-transform',
              isSubgroupOpen ? 'rotate-90' : ''
            )}
          />
        </button>
      </div>
      {isSubgroupOpen && (
        <ul className="pl-6 flex flex-col gap-0.5 mt-1">
          {subchildren.map((subchild: SidebarItem, subchildIdx: number) => {
            const isSubchildActive = checkIsActive(pathname, subchild.href);
            return (
              <li key={`${child.name}-subchild-${subchild.href || subchildIdx}`}>
                <Link
                  href={subchild.href || '#'}
                  prefetch={true}
                  onMouseEnter={() => onHover(subchild.href || '')}
                  onClick={(e) => onClick(subchild.href, e)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                    "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isSubchildActive && "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
                    isSubchildActive && "border-l-2 border-l-sidebar-primary-foreground"
                  )}
                >
                  <subchild.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{subchild.name}</span>
                  {subchild.badge !== undefined && subchild.badge !== 0 && (
                    <span className={cn(
                      "ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded-full min-w-[18px] text-center",
                      subchild.badgeVariant === 'destructive' && "bg-red-500 text-white",
                      subchild.badgeVariant === 'warning' && "bg-yellow-500 text-black",
                      (!subchild.badgeVariant || subchild.badgeVariant === 'default') && "bg-sidebar-primary/20 text-sidebar-primary-foreground"
                    )}>
                      {subchild.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
