'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeSelector } from '@/components/ui/theme-selector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, LogOut } from 'lucide-react';

interface SelectionNavbarProps {
  backHref?: string;
  backLabel?: string;
  showBackButton?: boolean;
}

export default function SelectionNavbar({ 
  backHref, 
  backLabel,
  showBackButton = true 
}: SelectionNavbarProps) {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <div className="w-full bg-card/50 backdrop-blur-sm border-b border-border/30">
      <div className="w-full px-6 py-4">
        <div className="flex justify-between items-center">
          {showBackButton && backHref ? (
            <button
              onClick={() => router.push(backHref)}
              className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-all duration-200 text-sm font-medium group"
            >
              <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" />
              {backLabel || 'Volver'}
            </button>
          ) : (
            <div></div>
          )}
          
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-center">
              <h1 className="text-xl font-bold text-foreground">ORVIT</h1>
              <p className="text-xs text-muted-foreground">Sistema de Gestión</p>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ThemeSelector />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cambiar tema</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

