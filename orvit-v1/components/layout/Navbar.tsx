'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, User, LogOut, Sun, Moon, AlertTriangle, Play, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import AreaSelector from './AreaSelector';
import SectorSelector from './SectorSelector';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import PlantStopDialog from '@/components/plant/PlantStopDialog';
import PlantResumeDialog from '@/components/plant/PlantResumeDialog';
import ToolRequestDialog from '@/components/plant/ToolRequestDialog';
import { useNavigationPermissions } from '@/hooks/use-navigation-permissions';
import { ThemeSelector } from '@/components/ui/theme-selector';

interface NavbarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export default function Navbar({ isSidebarOpen, toggleSidebar }: NavbarProps) {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const { currentCompany, currentSector, currentArea } = useCompany();
  const { canStopPlant } = useNavigationPermissions();
  const [mounted, setMounted] = useState(false);
  const [isPlantStopOpen, setIsPlantStopOpen] = useState(false);
  const [isPlantResumeOpen, setIsPlantResumeOpen] = useState(false);
  const [isToolRequestOpen, setIsToolRequestOpen] = useState(false);
  const [activePlantStopId, setActivePlantStopId] = useState<string | null>(null);
  
  // Evitar problemas de hidratación
  useEffect(() => {
    setMounted(true);
  }, []);

  // Buscar parada activa cuando el sector cambie
  useEffect(() => {
    // Por ahora no hay estado de sector, así que no buscamos paradas activas
    // En el futuro se puede implementar un sistema de estado de sector
    setActivePlantStopId(null);
  }, [currentSector, currentCompany]);

  const fetchActivePlantStop = async () => {
    try {
      const response = await fetch(`/api/plant/stop?companyId=${currentCompany?.id}&sectorId=${currentSector?.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setActivePlantStopId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching active plant stop:', error);
    }
  };

  // Solo mostrar el botón si el usuario tiene permisos y hay un sector seleccionado
  const canShowPlantControls = user && canStopPlant && currentSector;
  // Por ahora la planta nunca está parada ya que no hay campo estado
  const isPlantStopped = false;
  
  return (
    <header className={`border-b h-16 px-4 flex items-center ${
      theme === 'light' ? 'bg-white border-border/20' : 'bg-black border-white/5'
    }`}>
      <div className="flex items-center md:hidden mr-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="flex-1 flex items-center space-x-4">
        {currentCompany && currentArea && (
          <>
            <AreaSelector />
            {currentArea.name !== 'Administración' && <SectorSelector />}
          </>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Plant Control Buttons - Solo para usuarios con permisos */}
        {canShowPlantControls && (
          <>
            {isPlantStopped ? (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsToolRequestOpen(true)}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-300"
                >
                  <Package className="h-4 w-4 mr-2" />
                                      <span className="hidden sm:inline">Solicitar Productos</span>
                    <span className="sm:hidden">Productos</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPlantResumeOpen(true)}
                  className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 hover:border-green-300"
                >
                  <Play className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Reactivar Planta</span>
                  <span className="sm:hidden">Reactivar</span>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlantStopOpen(true)}
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-300"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Parar Planta</span>
                <span className="sm:hidden">Parar</span>
              </Button>
            )}
            <Separator orientation="vertical" className="h-8" />
          </>
        )}

        {/* Notifications */}
        <NotificationPanel />
        
        {/* Theme selector */}
        <ThemeSelector />
        
        <Separator orientation="vertical" className="h-8" />
        
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center space-x-2">
              <User className="h-5 w-5 md:mr-2" />
              <span className="hidden md:inline-block font-medium">
                {user?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/administracion/configuracion" className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Plant Control Dialogs */}
      <PlantStopDialog
        isOpen={isPlantStopOpen}
        onClose={() => setIsPlantStopOpen(false)}
      />
      
      <PlantResumeDialog
        isOpen={isPlantResumeOpen}
        onClose={() => setIsPlantResumeOpen(false)}
        plantStopId={activePlantStopId || undefined}
      />

      <ToolRequestDialog
        isOpen={isToolRequestOpen}
        onClose={() => setIsToolRequestOpen(false)}
        plantStopId={activePlantStopId || undefined}
      />
    </header>
  );
}