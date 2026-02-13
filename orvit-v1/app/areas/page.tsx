'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Building2, Search, Settings, Wrench, Users, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAreaPermissions } from '@/hooks/use-area-permissions';
import { Area } from '@/lib/types';
import SelectionNavbar from '@/components/layout/SelectionNavbar';
import { Skeleton } from '@/components/ui/skeleton';

// Áreas fijas del sistema
const FIXED_AREAS = [
  { name: "Mantenimiento", icon: "wrench", iconComponent: Wrench },
  { name: "Administración", icon: "users", iconComponent: Users },
  { name: "Producción", icon: "settings", iconComponent: Settings },
];

export default function AreaSelection() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentCompany, setArea, isLoading: companyLoading } = useCompany();
  const { canAccessAdministration, canAccessMaintenance, canAccessProduction, isLoading: permissionsLoading } = useAreaPermissions();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [areaList, setAreaList] = useState<Area[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [enteringAreaId, setEnteringAreaId] = useState<number | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const autoRedirectedRef = useRef(false);

  // Función para crear las áreas fijas si no existen
  const ensureFixedAreas = async () => {
    if (!currentCompany) return;
    
    setLoadingAreas(true);
    try {
      // Obtener áreas existentes
      const response = await fetch(`/api/areas?companyId=${currentCompany.id}`);
      const existingAreas = await response.json();
      
      // Crear las áreas fijas que no existan
      const areasToCreate = FIXED_AREAS.filter(
        fixedArea => !existingAreas.some((area: Area) => area.name === fixedArea.name)
      );
      
      for (const areaToCreate of areasToCreate) {
        await fetch('/api/areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: areaToCreate.name,
            icon: areaToCreate.icon,
            companyId: currentCompany.id,
          }),
        });
      }
      
      // Obtener todas las áreas actualizadas
      const updatedResponse = await fetch(`/api/areas?companyId=${currentCompany.id}`);
      const updatedAreas = await updatedResponse.json();
      
      // Filtrar solo las áreas fijas en el orden correcto
      const orderedAreas = FIXED_AREAS.map(fixedArea => 
        updatedAreas.find((area: Area) => area.name === fixedArea.name)
      ).filter(Boolean);
      
      setAreaList(orderedAreas);
    } catch (error) {
      console.error('Error cargando áreas:', error);
    } finally {
      setLoadingAreas(false);
    }
  };
  
  // Cargar áreas al montar o al cambiar de empresa
  useEffect(() => {
    if (!currentCompany) return;
    ensureFixedAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany]);
  
  // Auto-redirect: si el usuario solo tiene permiso para 1 área, ir directo
  useEffect(() => {
    if (permissionsLoading || loadingAreas || areaList.length === 0 || autoRedirectedRef.current) return;

    const accessibleAreas = areaList.filter(area => {
      if (area.name === 'Administración') return canAccessAdministration;
      if (area.name === 'Mantenimiento') return canAccessMaintenance;
      if (area.name === 'Producción') return canAccessProduction;
      return true;
    });

    if (accessibleAreas.length === 1) {
      autoRedirectedRef.current = true;
      const area = accessibleAreas[0];
      setArea(area);
      if (area.name === 'Administración') {
        router.push('/administracion/dashboard');
      } else {
        router.push('/sectores');
      }
    }
  }, [permissionsLoading, loadingAreas, areaList, canAccessAdministration, canAccessMaintenance, canAccessProduction, setArea, router]);

  // Función para manejar el click en un área
  const handleAreaClick = async (area: Area) => {
    setPermissionError(null);
    setEnteringAreaId(area.id);
    
    try {
      // Verificar permisos
      let hasPermission = false;
      if (area.name === 'Administración') {
        hasPermission = canAccessAdministration;
      } else if (area.name === 'Mantenimiento') {
        hasPermission = canAccessMaintenance;
      } else if (area.name === 'Producción') {
        hasPermission = canAccessProduction;
      } else {
        hasPermission = true; // Otras áreas permitidas por defecto
      }
      
      if (!hasPermission) {
        setPermissionError('No tenés permisos para acceder a esta área. Contactá a tu administrador.');
        setEnteringAreaId(null);
        return;
      }
      
      setArea(area);
      // Administración va directo a su dashboard
      if (area.name === 'Administración') {
        router.push('/administracion/dashboard');
      } else {
        // Mantenimiento y Producción van a sectores
        router.push('/sectores');
      }
    } catch (error) {
      setPermissionError('Error al acceder al área. Intentá de nuevo.');
      setEnteringAreaId(null);
    }
  };

  // Loading state
  if (authLoading || companyLoading || permissionsLoading || loadingAreas) {
    return (
      <div className="min-h-dvh grid grid-rows-[auto_1fr_auto] bg-background text-foreground relative overflow-hidden">
        <header className="relative z-10 w-full">
          <SelectionNavbar backHref="/empresas" backLabel="Volver a empresas" />
        </header>
        <main className="relative z-10 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Cargando áreas...</p>
          </div>
        </main>
        <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
          © 2025 ORVIT. Todos los derechos reservados.
        </footer>
      </div>
    );
  }
  
  if (!isAuthenticated || !currentCompany) {
    return null; // Auth context will redirect to login
  }

  // Filter areas based on search query and permissions
  const filteredAreas = areaList
    .filter(area => {
      // Filtrar por búsqueda
      if (searchQuery && !area.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filtrar por permisos
      if (area.name === 'Administración') {
        return canAccessAdministration;
      }
      if (area.name === 'Mantenimiento') {
        return canAccessMaintenance;
      }
      if (area.name === 'Producción') {
        return canAccessProduction;
      }
      // Para otras áreas, permitir acceso por defecto
      return true;
    });
  
  const hasNoAccess = filteredAreas.length === 0 && !loadingAreas;
  const showSearch = areaList.length >= 4;

  // Función para obtener el ícono correcto
  const getAreaIcon = (areaName: string) => {
    const fixedArea = FIXED_AREAS.find(fa => fa.name === areaName);
    return fixedArea?.iconComponent || Building2;
  };
  
  // Descripciones cortas por área
  const getAreaDescription = (areaName: string) => {
    const descriptions: Record<string, string> = {
      'Mantenimiento': 'Gestión de máquinas y mantenimientos',
      'Administración': 'Gestión administrativa y operativa',
      'Producción': 'Control de producción y procesos',
    };
    return descriptions[areaName] || 'Acceder al área de trabajo';
  };

  const isDark = theme === 'dark';
  const logoUrl = currentCompany 
    ? (isDark 
        ? ((currentCompany as any)?.logoDark || currentCompany?.logo) 
        : ((currentCompany as any)?.logoLight || currentCompany?.logo))
    : null;

  return (
    <div className="min-h-dvh grid grid-rows-[auto_1fr_auto] bg-background text-foreground relative overflow-hidden">
      {/* Fondo */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="hidden md:block absolute inset-0 opacity-[0.08] dark:opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full">
        <SelectionNavbar backHref="/empresas" backLabel="Volver a empresas" />
      </header>

      {/* Main */}
      <main className="relative z-10 w-full px-4 py-10">
        <div className="w-full max-w-5xl mx-auto">
          {/* Título */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-foreground mb-1">Elegí un área</h1>
            <p className="text-sm text-muted-foreground">Seleccioná el área en la que querés trabajar</p>
          </div>
          
          {/* Chip de empresa */}
          {currentCompany && (
            <div className="mb-6 flex justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={`Logo de ${currentCompany.name}`}
                    className="w-5 h-5 object-contain"
                  />
                ) : (
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">{currentCompany.name}</span>
              </div>
            </div>
          )}
          
          {/* Alert de permisos */}
          {permissionError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{permissionError}</AlertDescription>
            </Alert>
          )}
          
          {/* Buscador - solo si hay >= 4 áreas */}
          {showSearch && (
            <div className="mb-6 flex justify-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar área..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background border-input"
                />
              </div>
            </div>
          )}
          
          {/* Empty state - sin acceso a ninguna área */}
          {hasNoAccess && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No tenés acceso a ninguna área</h3>
              <p className="text-sm text-muted-foreground">Contactá a tu administrador para que te asigne permisos.</p>
            </div>
          )}
          
          {/* Grid de áreas */}
          {!hasNoAccess && (
            <div className={`grid gap-4 ${
              filteredAreas.length === 1 
                ? 'grid-cols-1 max-w-md mx-auto' 
                : 'grid-cols-1 sm:grid-cols-2'
            }`}>
              {filteredAreas.map((area) => {
                const IconComponent = getAreaIcon(area.name);
                const isEntering = enteringAreaId === area.id;
                const isDisabled = enteringAreaId !== null;
                
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => handleAreaClick(area)}
                    disabled={isDisabled}
                    aria-label={`Entrar a ${area.name}`}
                    aria-busy={isEntering}
                    className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Card className="group relative hover:border-foreground/15 hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
                      <CardContent className="p-5">
                        {/* Ícono y título */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-all">
                            <IconComponent className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {area.name}
                            </h3>
                          </div>
                        </div>
                        
                        {/* Descripción */}
                        <p className="text-xs text-muted-foreground leading-5 mb-4">
                          {getAreaDescription(area.name)}
                        </p>
                        
                        {/* Footer: Entrar / Entrando... */}
                        <div className="pt-3 border-t border-border/50 flex items-center justify-end gap-2 text-sm text-muted-foreground group-hover:text-primary transition-colors">
                          {isEntering ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Entrando…</span>
                            </>
                          ) : (
                            <>
                              <span>Entrar</span>
                              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer sticky */}
      <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        © 2025 ORVIT. Todos los derechos reservados.
      </footer>
    </div>
  );
} 