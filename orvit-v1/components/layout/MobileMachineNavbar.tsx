'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import Sidebar from './Sidebar';

interface MobileMachineNavbarProps {
  onAddMachine?: () => void;
}

export default function MobileMachineNavbar({ onAddMachine }: MobileMachineNavbarProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { currentCompany, currentSector } = useCompany();

  return (
    <>
      {/* Mobile-only navbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-background border-b border-border z-50 h-14">
        <div className="flex items-center justify-between px-4 h-full">
          {/* Hamburger menu */}
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" size="sm" className="p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menú de navegación</SheetTitle>
              </SheetHeader>
              <Sidebar isOpen={true} setIsOpen={setIsSidebarOpen} />
            </SheetContent>
          </Sheet>

          {/* Title */}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold">Máquinas</h1>
            {currentSector && (
              <p className="text-xs text-muted-foreground">{currentSector.name}</p>
            )}
          </div>

          {/* Add button */}
          {onAddMachine && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onAddMachine}
              disabled={!currentSector}
              title={!currentSector ? 'Debe seleccionar un sector primero' : 'Agregar máquina'}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Spacer for fixed navbar */}
      <div className="md:hidden h-14"></div>
    </>
  );
}
