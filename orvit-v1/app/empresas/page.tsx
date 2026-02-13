'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { usePermission } from '@/hooks/use-permissions';
import { useAreaPermissions } from '@/hooks/use-area-permissions';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Wrench, Building2, Phone, BadgeInfo, FileText, MapPin, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import SelectionNavbar from '@/components/layout/SelectionNavbar';

export default function EmpresasPage() {
  const { user, loading: authLoading } = useAuth();
  const { setCurrentCompany } = useCompany();
  const { canAccessAdministration, canAccessMaintenance, isLoading: loadingAreaPermissions } = useAreaPermissions();
  const { theme } = useTheme();
  
  // Solo ADMIN_ENTERPRISE puede crear empresas
  const canAddCompany = user?.role === 'ADMIN_ENTERPRISE';
  
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [enteringCompanyId, setEnteringCompanyId] = useState<number | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const autoRedirectedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const response = await fetch('/api/companies');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al obtener empresas');
      setCompanies(data);

      // Auto-redirect: si el usuario no es ADMIN_ENTERPRISE y tiene solo 1 empresa,
      // seleccionarla automáticamente y saltar a áreas
      if (data.length === 1 && user?.role !== 'ADMIN_ENTERPRISE' && !autoRedirectedRef.current) {
        autoRedirectedRef.current = true;
        setCurrentCompany(data[0]);
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentCompany', JSON.stringify(data[0]));
        }
        router.push('/areas');
        return;
      }
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Función para verificar permisos de una empresa específica
  const checkCompanyPermissions = async (companyId: number): Promise<{ canAccessAdministration: boolean; canAccessMaintenance: boolean }> => {
    try {
      const [adminResponse, maintenanceResponse] = await Promise.all([
        fetch(`/api/permissions/check?permission=ingresar_administracion&companyId=${companyId}`, {
          method: 'GET',
          credentials: 'include',
        }),
        fetch(`/api/permissions/check?permission=ingresar_mantenimiento&companyId=${companyId}`, {
          method: 'GET',
          credentials: 'include',
        }),
      ]);

      const adminData = adminResponse.ok ? await adminResponse.json() : { hasPermission: false };
      const maintenanceData = maintenanceResponse.ok ? await maintenanceResponse.json() : { hasPermission: false };

      return {
        canAccessAdministration: adminData.hasPermission || false,
        canAccessMaintenance: maintenanceData.hasPermission || false,
      };
    } catch (error) {
      console.error('Error verificando permisos de empresa:', error);
      return { canAccessAdministration: false, canAccessMaintenance: false };
    }
  };

  // Función para manejar el clic en una empresa con verificación de permisos
  const handleCompanyClick = async (company: any) => {
    setPermissionError(null);
    setEnteringCompanyId(company.id);
    
    try {
      // Verificar si el usuario es owner de la empresa (tiene rol ADMIN en esa empresa)
      const isOwner = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'ADMIN_ENTERPRISE';
      
      // Si no es owner, verificar permisos específicos para esta empresa
      if (!isOwner) {
        const companyPermissions = await checkCompanyPermissions(company.id);
        
        if (!companyPermissions.canAccessAdministration && !companyPermissions.canAccessMaintenance) {
          setPermissionError('No tenés permisos para acceder a esta empresa. Contactá a tu administrador.');
          setEnteringCompanyId(null);
          return;
        }
      }
      
      setCurrentCompany(company);
      if (typeof window !== 'undefined') {
        localStorage.setItem('currentCompany', JSON.stringify(company));
      }
      
      // Navegar a áreas para que el usuario elija qué área acceder
      router.push('/areas');
    } catch (error) {
      setPermissionError('Error al acceder a la empresa. Intentá de nuevo.');
      setEnteringCompanyId(null);
    }
  };

  // Loading state con skeletons
  if (authLoading || loadingAreaPermissions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

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
        <SelectionNavbar showBackButton={false} />
      </header>

      {/* Main */}
      <main className="relative z-10 w-full px-4 py-10">
        <div className="w-full max-w-5xl mx-auto">
          {/* Título centrado */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-1">Mis Empresas</h2>
            <p className="text-sm text-muted-foreground">Selecciona una empresa para continuar</p>
          </div>
          
          {/* Alert de permisos */}
          {permissionError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{permissionError}</AlertDescription>
            </Alert>
          )}
          
          {/* Grid de empresas */}
          <div className={`grid gap-4 ${
            companies.length === 1 
              ? 'grid-cols-1 max-w-md mx-auto' 
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}>
            {/* Loading state con skeletons */}
            {loadingCompanies && (
              <>
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-[180px]">
                    <CardContent className="p-5">
                      <Skeleton className="h-14 w-14 rounded-xl mb-4" />
                      <Skeleton className="h-5 w-3/4 mb-3" />
                      <Skeleton className="h-3 w-full mb-2" />
                      <Skeleton className="h-3 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
            
            {/* Empty state */}
            {!loadingCompanies && companies.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-base font-semibold text-foreground mb-1">No tenés empresas asignadas</h3>
                <p className="text-sm text-muted-foreground">Contactá a tu administrador para que te asigne una empresa.</p>
              </div>
            )}
            
            {/* Cards de empresas */}
            {!loadingCompanies && companies.map((company) => {
              const isDark = theme === 'dark';
              const logoUrl = isDark 
                ? (company?.logoDark || company?.logo) 
                : (company?.logoLight || company?.logo);
              const isEntering = enteringCompanyId === company.id;
              const isDisabled = enteringCompanyId !== null;
              
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleCompanyClick(company)}
                  disabled={isDisabled}
                  aria-label={`Entrar a ${company.name}`}
                  className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Card className="group relative hover:border-foreground/15 hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
                    <CardContent className="p-5">
                      {/* Logo y nombre */}
                      <div className="flex items-center gap-3 mb-4">
                        {logoUrl ? (
                          <div className="w-14 h-14 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0 p-2 shadow-sm group-hover:shadow-md transition-all">
                            <img 
                              src={logoUrl} 
                              alt={`Logo de ${company.name}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-all">
                            <Building2 className="h-7 w-7 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {company.name}
                          </h3>
                        </div>
                      </div>
                      
                      {/* Información */}
                      <div className="space-y-2 pt-3 border-t border-border/50">
                        {company.cuit && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground leading-5">
                            <BadgeInfo className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate">CUIT: {company.cuit}</span>
                          </div>
                        )}
                        {company.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground leading-5">
                            <Phone className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate">{company.phone}</span>
                          </div>
                        )}
                        {company.address && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground leading-5">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate">{company.address}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Affordance visual: Entrar / Entrando... */}
                      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-end gap-2 text-sm text-muted-foreground group-hover:text-primary transition-colors">
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
            
            {/* Tarjeta de agregar empresa */}
            {canAddCompany && (
              <AddCompanyDialog onCompanyCreated={fetchCompanies} />
            )}
          </div>
        </div>
      </main>

      {/* Footer sticky */}
      <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        © 2025 ORVIT. Todos los derechos reservados.
      </footer>
    </div>
  );
}

function AddCompanyDialog({ onCompanyCreated }: { onCompanyCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    cuit: '',
    address: '',
    phone: '',
    email: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al crear la empresa');
      setSuccess('Empresa creada exitosamente');
      setFormData({ name: '', cuit: '', address: '', phone: '', email: '', description: '' });
      onCompanyCreated();
      setTimeout(() => setIsOpen(false), 800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="group relative bg-card border border-dashed border-border rounded-xl p-5 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 cursor-pointer overflow-hidden">
          {/* Efecto de fondo sutil al hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-200 pointer-events-none" />
          
          <div className="relative flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/15 group-hover:border-primary/30 transition-all">
              <Plus className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold text-base text-foreground mb-1 group-hover:text-primary transition-colors">Agregar Empresa</h3>
            <p className="text-xs text-muted-foreground">Crear nueva empresa</p>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear nueva empresa</DialogTitle>
          <DialogDescription>
            Completa los datos para registrar una nueva empresa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">Nombre de la Empresa</label>
              <Input
                type="text"
                id="name"
                required
                autoComplete="off"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="cuit" className="block text-sm font-medium">CUIT</label>
              <Input
                type="text"
                id="cuit"
                required
                autoComplete="off"
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium">Dirección</label>
              <Input
                type="text"
                id="address"
                required
                autoComplete="off"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium">Teléfono</label>
              <Input
                type="text"
                id="phone"
                required
                autoComplete="off"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium">Email</label>
              <Input
                type="email"
                id="email"
                required
                autoComplete="off"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={loading}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium">Dedicación (¿A qué se dedica la empresa?)</label>
              <Input
                type="text"
                id="description"
                autoComplete="off"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>
          {error && (
            <div className="mb-2 p-2 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900 rounded-lg">{error}</div>
          )}
          {success && (
            <div className="mb-2 p-2 text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900 rounded-lg">{success}</div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear empresa'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 