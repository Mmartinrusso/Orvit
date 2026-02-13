'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useSectorPermissions } from '@/hooks/use-sector-permissions';
import SectorCard from '@/components/sectors/SectorCard';
import AddSectorDialog from '@/components/sectors/AddSectorDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wrench, Building2, Search, Plus, Factory } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import SelectionNavbar from '@/components/layout/SelectionNavbar';
import { Sector } from '@/lib/types';

export default function SectorSelection() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { currentCompany, sectors, currentSector, setSector, isLoading: companyLoading, currentArea, updateSectors } = useCompany();
  const { canCreateSector, canEditSector, canDeleteSector, isLoading: permissionsLoading } = useSectorPermissions();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [productionSectors, setProductionSectors] = useState<Sector[]>([]);
  const [loadingProductionSectors, setLoadingProductionSectors] = useState(false);
  const isSelectingSectorRef = useRef(false);
  const autoRedirectedRef = useRef(false);

  // Redirect to dashboard if sector is already selected (pero NO si estamos en la página de sectores)
  useEffect(() => {
    if (pathname === '/sectores' || isSelectingSectorRef.current) return;
    
    if (!authLoading && !companyLoading && isAuthenticated && currentSector && pathname !== '/sectores') {
      if (currentArea?.name.trim().toUpperCase() === 'MANTENIMIENTO') {
        router.push('/mantenimiento/dashboard');
      } else if (currentArea?.name.trim().toUpperCase() === 'PRODUCCIÓN') {
        router.push('/produccion/dashboard');
      } else {
        router.push('/areas');
      }
    }
  }, [authLoading, companyLoading, isAuthenticated, router, currentArea, pathname]);
  
  // Si no hay área seleccionada, redirigir a /areas
  useEffect(() => {
    if (!companyLoading && !currentArea) {
      router.push('/areas');
    }
  }, [companyLoading, currentArea, router]);

  // Cargar sectores de producción cuando estamos en el área de Producción
  const isProductionArea = currentArea?.name.trim().toUpperCase() === 'PRODUCCIÓN';

  useEffect(() => {
    if (isProductionArea && currentCompany && !loadingProductionSectors) {
      setLoadingProductionSectors(true);
      fetch(`/api/sectores?forProduction=true&companyId=${currentCompany.id}`)
        .then(res => res.json())
        .then(data => {
          setProductionSectors(data || []);
        })
        .catch(err => {
          console.error('Error cargando sectores de producción:', err);
          setProductionSectors([]);
        })
        .finally(() => {
          setLoadingProductionSectors(false);
        });
    }
  }, [isProductionArea, currentCompany?.id]);
  
  // Auto-redirect: si solo hay 1 sector disponible, seleccionarlo automáticamente
  const sectorsReady = isProductionArea ? !loadingProductionSectors : !companyLoading;
  const availableSectors = isProductionArea ? productionSectors : (sectors || []);
  useEffect(() => {
    if (!sectorsReady || availableSectors.length !== 1 || autoRedirectedRef.current || !currentArea) return;

    autoRedirectedRef.current = true;
    const sector = availableSectors[0];
    setSector(sector);

    const areaName = currentArea.name.trim().toUpperCase();
    if (areaName === 'MANTENIMIENTO') {
      router.replace('/mantenimiento/dashboard');
    } else if (areaName === 'PRODUCCIÓN') {
      router.replace('/produccion/dashboard');
    }
  }, [sectorsReady, availableSectors, currentArea, setSector, router]);

  if (authLoading || companyLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen dashboard-surface flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground text-lg">Cargando sectores...</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  if (!isAuthenticated) {
    return null; // Auth context will redirect to login
  }

  if (!currentArea) {
    return null; // Redirige automáticamente
  }

  // Filter sectors based on search query and area
  // Para Producción usamos productionSectors, para otras áreas usamos sectors del contexto
  const sectorsToShow = isProductionArea ? productionSectors : (sectors || []);

  const filteredSectors = sectorsToShow.filter(sector => {
    const matchesSearch = sector.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Determinar si está cargando
  const isLoadingSectors = isProductionArea ? loadingProductionSectors : companyLoading;
  
  return (
    <MainLayout>
      <div className="min-h-screen dashboard-surface relative overflow-hidden">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Patrón de puntos sutiles */}
          <div 
            className="absolute inset-0 opacity-40 dark:opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.3) 1px, transparent 1px)`,
              backgroundSize: '30px 30px',
            }}
          />
          
          {/* Formas geométricas decorativas */}
          <div className="absolute top-0 right-0 w-96 h-96 opacity-5 dark:opacity-10">
            <div 
              className="absolute top-20 right-20 w-64 h-64 rounded-full blur-3xl"
              style={{
                background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent)',
              }}
            />
          </div>
          <div className="absolute bottom-0 left-0 w-96 h-96 opacity-5 dark:opacity-10">
            <div 
              className="absolute bottom-20 left-20 w-64 h-64 rounded-full blur-3xl"
              style={{
                background: 'radial-gradient(circle, hsl(var(--primary) / 0.4), transparent)',
              }}
            />
          </div>
          
          {/* Líneas decorativas sutiles */}
          <div className="absolute inset-0 opacity-5 dark:opacity-10">
            <div 
              className="absolute top-0 left-1/4 w-px h-full"
              style={{
                background: 'linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.3), transparent)',
              }}
            />
            <div 
              className="absolute top-0 right-1/4 w-px h-full"
              style={{
                background: 'linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.3), transparent)',
              }}
            />
          </div>
        </div>
        
        <div className="relative z-10">
        {/* Navbar */}
        <SelectionNavbar 
          backHref="/areas"
          backLabel="Volver a áreas"
        />

        {/* Contenido principal */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Información de empresa y área */}
          {currentCompany && (() => {
            const isDark = theme === 'dark' || theme === 'black';
            const logoUrl = isDark 
              ? (currentCompany?.logoDark || currentCompany?.logo) 
              : (currentCompany?.logoLight || currentCompany?.logo);
            
            return (
            <div className="mb-6">
              <div className="bg-card border border-border rounded-xl p-4 max-w-2xl mx-auto">
                <div className="flex items-center justify-center gap-3">
                  {logoUrl ? (
                    <div className="w-12 h-12 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0 p-1.5">
                      <img 
                        src={logoUrl} 
                        alt={`Logo de ${currentCompany.name}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="text-center">
                    <h2 className="font-semibold text-base text-foreground">{currentCompany.name}</h2>
                    {currentArea && (
                      <p className="text-xs text-muted-foreground">
                        Área: <span className="font-medium text-primary">{currentArea.name}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* Título y descripción */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-1">Seleccionar Sector</h2>
            <p className="text-sm text-muted-foreground">
              Seleccione el sector en el que desea trabajar
            </p>
          </div>

          {/* Barra de búsqueda */}
          <div className="mb-8 flex justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-base border-2 border-border/30 focus:border-primary transition-colors"
              />
            </div>
          </div>
          
          {/* Grid de sectores */}
          <div className={`grid gap-4 max-w-5xl mx-auto ${
            filteredSectors.length === 1 
              ? 'grid-cols-1 max-w-sm' 
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}>
            {/* Mensaje de carga para producción */}
            {isProductionArea && loadingProductionSectors && (
              <div className="col-span-full text-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">Cargando sectores de producción...</p>
                </div>
              </div>
            )}

            {/* Mensaje cuando no hay sectores (para áreas que no son producción) */}
            {!isProductionArea && (!sectors || sectors.length === 0) && !companyLoading && (
              <div className="col-span-full text-center py-12">
                <div className="surface-card border-2 border-border/30 rounded-2xl p-8 max-w-md mx-auto">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <Wrench className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No hay sectores</h3>
                  <p className="text-muted-foreground mb-3 text-sm">
                    Esta área aún no tiene sectores configurados.
                  </p>
                  {canCreateSector && (
                    <p className="text-xs text-muted-foreground">
                      Usa el botón <span className="font-semibold">&quot;Agregar Sector&quot;</span> para crear el primero.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Mensaje cuando no hay sectores habilitados para Producción */}
            {isProductionArea && !loadingProductionSectors && productionSectors.length === 0 && !searchQuery && (
              <div className="col-span-full text-center py-12">
                <div className="surface-card border-2 border-border/30 rounded-2xl p-8 max-w-md mx-auto">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Factory className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Sin sectores de producción</h3>
                  <p className="text-muted-foreground text-sm mb-3">
                    No hay sectores habilitados para Producción.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Habilita sectores desde el área de <span className="font-semibold">Mantenimiento</span> editando cada sector.
                  </p>
                </div>
              </div>
            )}

            {/* Mensaje cuando no hay resultados de búsqueda */}
            {filteredSectors.length === 0 && sectorsToShow.length > 0 && searchQuery && (
              <div className="col-span-full text-center py-12">
                <div className="surface-card border-2 border-border/30 rounded-2xl p-8 max-w-md mx-auto">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Sin resultados</h3>
                  <p className="text-muted-foreground text-sm">
                    No se encontraron sectores que coincidan con tu búsqueda.
                  </p>
                </div>
              </div>
            )}

            {/* Tarjetas de sectores existentes */}
            {filteredSectors.map((sector) => (
              <SectorCard
                key={sector.id}
                sector={sector}
                canEdit={canEditSector && !isProductionArea}
                canDelete={canDeleteSector && !isProductionArea}
                onSelect={() => {
                  isSelectingSectorRef.current = true;
                  setSector(sector);
                  
                  setTimeout(() => {
                    const areaName = currentArea?.name.trim().toUpperCase();
                    if (areaName === 'MANTENIMIENTO') {
                      router.replace('/mantenimiento/dashboard');
                    } else if (areaName === 'PRODUCCIÓN') {
                      router.replace('/produccion/dashboard');
                    } else {
                      router.replace('/areas');
                    }
                    
                    setTimeout(() => {
                      isSelectingSectorRef.current = false;
                    }, 2000);
                  }, 100);
                }} 
              />
            ))}

            {/* Tarjeta para agregar sector (solo en áreas que no son Producción) */}
            {canCreateSector && !isProductionArea && (
              <AddSectorDialog>
                <div className="group relative bg-card border border-dashed border-border rounded-xl p-5 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer overflow-hidden">
                  {/* Efecto de fondo sutil al hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-200 pointer-events-none" />
                  
                  <div className="relative flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/15 group-hover:border-primary/30 transition-all">
                      <Plus className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-base text-foreground mb-1 group-hover:text-primary transition-colors">Agregar Sector</h3>
                    <p className="text-xs text-muted-foreground">Crear nuevo sector</p>
                  </div>
                </div>
              </AddSectorDialog>
            )}
          </div>
          
          {/* Información del usuario */}
          <div className="text-center mt-12 pt-8 border-t border-border/30">
            <p className="text-sm text-muted-foreground">
              Sesión iniciada como <span className="font-medium text-foreground">{user?.name}</span>
            </p>
          </div>
        </div>
        </div>
      </div>
    </MainLayout>
  );
}