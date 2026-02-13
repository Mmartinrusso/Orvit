'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShoppingCart,
  ShoppingBag,
  Wrench,
  Calculator,
  Building2,
  Puzzle,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Module {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  isActive: boolean;
  dependencies: string[];
  enabledCompaniesCount?: number;
}

interface Company {
  id: number;
  name: string;
}

interface CompanyModuleStatus extends Module {
  isEnabled: boolean;
  companyModuleId: string | null;
}

const categoryIcons: Record<string, any> = {
  VENTAS: ShoppingCart,
  COMPRAS: ShoppingBag,
  MANTENIMIENTO: Wrench,
  COSTOS: Calculator,
  ADMINISTRACION: Building2,
  GENERAL: Puzzle,
};

const categoryColors: Record<string, string> = {
  VENTAS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  COMPRAS: 'bg-green-500/10 text-green-500 border-green-500/20',
  MANTENIMIENTO: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  COSTOS: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ADMINISTRACION: 'bg-muted text-muted-foreground border-border',
  GENERAL: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
};

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [companyModules, setCompanyModules] = useState<CompanyModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [togglingModule, setTogglingModule] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [modulesRes, companiesRes] = await Promise.all([
          fetch('/api/superadmin/modules'),
          fetch('/api/superadmin/companies'),
        ]);

        if (modulesRes.ok) {
          const data = await modulesRes.json();
          setModules(data.modules || []);
        }

        if (companiesRes.ok) {
          const data = await companiesRes.json();
          setCompanies(data.companies || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedCompany) {
      setCompanyModules([]);
      return;
    }

    async function fetchCompanyModules() {
      setLoadingCompany(true);
      try {
        const res = await fetch(`/api/superadmin/companies/${selectedCompany}/modules`);
        if (res.ok) {
          const data = await res.json();
          setCompanyModules(data.modules || []);
        }
      } catch (error) {
        console.error('Error fetching company modules:', error);
        toast.error('Error al cargar módulos de la empresa');
      } finally {
        setLoadingCompany(false);
      }
    }

    fetchCompanyModules();
  }, [selectedCompany]);

  const toggleCompanyModule = async (moduleId: string, isEnabled: boolean) => {
    if (!selectedCompany) return;

    setTogglingModule(moduleId);
    try {
      const res = await fetch(`/api/superadmin/companies/${selectedCompany}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, isEnabled }),
      });

      if (res.ok) {
        setCompanyModules(prev =>
          prev.map(m =>
            m.id === moduleId ? { ...m, isEnabled } : m
          )
        );
        toast.success(isEnabled ? 'Módulo habilitado' : 'Módulo deshabilitado');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al actualizar módulo');
      }
    } catch (error) {
      console.error('Error toggling module:', error);
      toast.error('Error al actualizar módulo');
    } finally {
      setTogglingModule(null);
    }
  };

  const enableAllModules = async () => {
    if (!selectedCompany) return;

    setLoadingCompany(true);
    try {
      const updates = companyModules.map(m => ({
        moduleId: m.id,
        isEnabled: true,
      }));

      const res = await fetch(`/api/superadmin/companies/${selectedCompany}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: updates }),
      });

      if (res.ok) {
        setCompanyModules(prev => prev.map(m => ({ ...m, isEnabled: true })));
        toast.success('Todos los módulos habilitados');
      }
    } catch (error) {
      console.error('Error enabling all modules:', error);
      toast.error('Error al habilitar módulos');
    } finally {
      setLoadingCompany(false);
    }
  };

  const disableAllModules = async () => {
    if (!selectedCompany) return;

    setLoadingCompany(true);
    try {
      const updates = companyModules.map(m => ({
        moduleId: m.id,
        isEnabled: false,
      }));

      const res = await fetch(`/api/superadmin/companies/${selectedCompany}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: updates }),
      });

      if (res.ok) {
        setCompanyModules(prev => prev.map(m => ({ ...m, isEnabled: false })));
        toast.success('Todos los módulos deshabilitados');
      }
    } catch (error) {
      console.error('Error disabling all modules:', error);
      toast.error('Error al deshabilitar módulos');
    } finally {
      setLoadingCompany(false);
    }
  };

  const modulesByCategory = modules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

  const companyModulesByCategory = companyModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, CompanyModuleStatus[]>);

  const filteredModules = modules.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredModulesByCategory = filteredModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, Module[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de Módulos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Administra los módulos disponibles y configura cuáles están habilitados por empresa
        </p>
      </div>

      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList>
          <TabsTrigger value="catalog">
            Catálogo de Módulos
          </TabsTrigger>
          <TabsTrigger value="companies">
            Módulos por Empresa
          </TabsTrigger>
        </TabsList>

        {/* Tab: Catálogo de Módulos */}
        <TabsContent value="catalog" className="space-y-6">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar módulos..."
              className="pl-9"
            />
          </div>

          {Object.entries(filteredModulesByCategory).map(([category, categoryModules]) => {
            const CategoryIcon = categoryIcons[category] || Puzzle;
            return (
              <Card key={category}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={cn("p-2 rounded-lg border", categoryColors[category])}>
                      <CategoryIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>{category}</CardTitle>
                      <CardDescription>
                        {categoryModules.length} módulos
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryModules.map((module) => (
                      <div
                        key={module.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {module.name}
                            </span>
                            {module.isActive ? (
                              <Badge className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20">
                                Activo
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] bg-muted text-muted-foreground border-border">
                                Inactivo
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {module.description || module.key}
                          </p>
                          {module.dependencies.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {module.dependencies.map((dep) => (
                                <Badge
                                  key={dep}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {dep}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="ml-4">
                          {module.enabledCompaniesCount || 0} empresas
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Tab: Módulos por Empresa */}
        <TabsContent value="companies" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Seleccionar Empresa</CardTitle>
                  <CardDescription>
                    Elige una empresa para gestionar sus módulos habilitados
                  </CardDescription>
                </div>
                {selectedCompany && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={enableAllModules}
                      disabled={loadingCompany}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Habilitar Todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disableAllModules}
                      disabled={loadingCompany}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Deshabilitar Todos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCompany(selectedCompany)}
                      disabled={loadingCompany}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedCompany?.toString() || ''}
                onValueChange={(value) => setSelectedCompany(parseInt(value))}
              >
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Selecciona una empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedCompany && (
            <>
              {loadingCompany ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : companyModules.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No hay módulos configurados</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(companyModulesByCategory).map(([category, categoryModules]) => {
                  const CategoryIcon = categoryIcons[category] || Puzzle;
                  const enabledCount = categoryModules.filter(m => m.isEnabled).length;
                  return (
                    <Card key={category}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={cn("p-2 rounded-lg border", categoryColors[category])}>
                              <CategoryIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{category}</CardTitle>
                              <CardDescription>
                                {enabledCount} de {categoryModules.length} habilitados
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {categoryModules.map((module) => (
                            <div
                              key={module.id}
                              className={cn(
                                "flex items-center justify-between p-4 rounded-lg border transition-all",
                                module.isEnabled
                                  ? "bg-primary/5 border-primary/20"
                                  : "bg-muted/30 border-border"
                              )}
                            >
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">
                                    {module.name}
                                  </span>
                                  {module.dependencies.length > 0 && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Requiere: {module.dependencies.join(', ')}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {module.description}
                                </p>
                              </div>
                              <div className="flex items-center space-x-4">
                                {togglingModule === module.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                  <Switch
                                    checked={module.isEnabled}
                                    onCheckedChange={(checked) =>
                                      toggleCompanyModule(module.id, checked)
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
