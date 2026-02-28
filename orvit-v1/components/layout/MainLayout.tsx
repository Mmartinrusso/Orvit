'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import NavigationLoader from '@/components/layout/NavigationLoader';
import PageHeader from '@/components/layout/PageHeader';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarContext } from '@/contexts/SidebarContext';

// Re-export para compatibilidad
export { useSidebarContext } from '@/contexts/SidebarContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHoverOpen, setIsHoverOpen] = useState(false);
  const [preventClose, setPreventClose] = useState(false);
  
  // Handle sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
      }
    };
    
    // Initial check solo al montar
    if (typeof window !== 'undefined') {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    }
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []); // Sin dependencias para que solo se ejecute al montar

  // Control scroll del body cuando se abre el sidebar en móvil
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      if (isMobile) {
        if (isSidebarOpen) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = 'auto';
        }
      }
      
      return () => {
        document.body.style.overflow = 'auto';
      };
    }
  }, [isSidebarOpen, isMobile]);

  
  // Don't show layout on login, sector selection, or areas pages
  if (pathname === '/login' || pathname === '/sectores' || pathname === '/areas' || pathname === '/empresas') {
    return <>{children}</>;
  }
  
  const toggleSidebar = () => {
    setIsHoverOpen(false); // Reset hover al usar toggle manual
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen, toggleSidebar, isHoverOpen, setIsHoverOpen, preventClose, setPreventClose }}>
      <div className="flex h-screen w-full bg-sidebar" style={{overflow: isSidebarOpen && isMobile ? 'hidden' : 'auto'}}>
        {/* Zona de hover para abrir sidebar - solo desktop cuando está cerrado */}
        {!isSidebarOpen && !isMobile && (
          <div
            className="hidden md:block fixed left-0 top-0 h-full w-3 z-50 cursor-pointer"
            onMouseEnter={() => {
              setIsSidebarOpen(true);
            }}
          />
        )}
        {/* Sidebar - al costado, no por encima */}
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
        <div
          className="flex-1 flex flex-col overflow-hidden transition-all duration-100 ease-out bg-sidebar w-full"
          onClick={() => {
            // Cerrar sidebar al hacer clic fuera (en desktop)
            if (isSidebarOpen && !isMobile && !preventClose) {
              setIsHoverOpen(false);
              setIsSidebarOpen(false);
            }
          }}
        >
        {/* Bottom Bar - Solo visible en móviles cuando sidebar está cerrado (solo para ciertas rutas) */}
        <div className={cn(
          "md:hidden",
          pathname === '/maquinas' || pathname.startsWith('/mantenimiento') || pathname.startsWith('/produccion') || pathname.startsWith('/administracion') ? "block" : "hidden"
        )}>
          {!isSidebarOpen && (
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
              <div className="flex items-center justify-center p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsSidebarOpen(true);
                  }}
                  className="p-2"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <NavigationLoader />
        <PageHeader />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-0 bg-background">
          <div className={cn(
            "flex flex-col",
            (pathname === '/maquinas' || pathname.startsWith('/mantenimiento') || pathname.startsWith('/produccion') || pathname.startsWith('/administracion')) && "pb-16 md:pb-0"
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
    </SidebarContext.Provider>
  );
}