export interface SidebarItem {
  name: string;
  href?: string;
  icon: any;
  description: string;
  children?: SidebarItem[];
  badge?: number | string;
  badgeVariant?: 'default' | 'destructive' | 'warning';
}

export interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

/**
 * Determina si un href está activo comparando con el pathname actual.
 * Evita falsos positivos (ej: '/administracion/costos' no activa '/administracion/compras').
 */
export function checkIsActive(pathname: string, href: string | undefined): boolean {
  if (!href) return false;
  if (pathname === href) return true;
  if (pathname.startsWith(href)) {
    const nextChar = pathname[href.length];
    return !nextChar || nextChar === '/' || nextChar === '?';
  }
  return false;
}
