'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Building2,
  Users,
  Puzzle,
  Search,
  Loader2,
  Check,
  FileStack,
  AlertTriangle,
  CreditCard,
  Mail,
  Phone,
  User,
  Shield,
  Eye,
  EyeOff,
  Crown,
  Ban,
  Info,
  Keyboard,
  Settings,
  Factory,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface PrimaryAdmin {
  id: number;
  name: string;
  email: string;
  phone: string | null;
}

interface Subscription {
  id: string;
  status: string;
  planId: string;
  planName: string;
  maxCompanies: number | null;
  companiesInPlan: number;
}

interface Company {
  id: number;
  name: string;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  templateId: string | null;
  templateName: string | null;
  usersCount: number;
  modulesCount: number;
  createdAt: string;
  isActive: boolean;
  primaryAdmin: PrimaryAdmin | null;
  subscription: Subscription | null;
  blockedByPlan: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  color: string;
  moduleKeys: string[];
  isDefault?: boolean;
}

interface OwnerWithSubscription {
  id: number;
  name: string;
  email: string;
  subscription: {
    id: string;
    status: string;
    planName: string;
    maxCompanies: number | null;
    companiesCount: number;
  };
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  TRIALING: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Trial' },
  ACTIVE: { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Activa' },
  PAST_DUE: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', label: 'Mora' },
  CANCELED: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Cancelada' },
  PAUSED: { bg: 'bg-gray-500/10', text: 'text-gray-500', label: 'Pausada' },
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [owners, setOwners] = useState<OwnerWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ViewMode config dialog
  const [viewModeDialogOpen, setViewModeDialogOpen] = useState(false);
  const [viewModeCompany, setViewModeCompany] = useState<Company | null>(null);
  const [viewModeConfig, setViewModeConfig] = useState({
    enabled: false,
    hotkey: 'ctrl+shift+t',
    pinEnabled: false,
    pin: '',
    sessionTimeout: 30,
  });
  const [viewModeLoading, setViewModeLoading] = useState(false);
  const [showViewModePin, setShowViewModePin] = useState(false);

  // Cost config dialog (Pretensados simulation)
  const [costConfigDialogOpen, setCostConfigDialogOpen] = useState(false);
  const [costConfigCompany, setCostConfigCompany] = useState<Company | null>(null);
  const [costConfig, setCostConfig] = useState({
    enablePretensadosSim: false,
    version: 'V1',
  });
  const [costConfigLoading, setCostConfigLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    cuit: '',
    email: '',
    phone: '',
    address: '',
    templateId: '',
    ownerId: '',
    // Admin principal
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
    useExistingAdmin: false,
  });

  // Módulos a habilitar (preview)
  const [enabledModulesPreview, setEnabledModulesPreview] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  // Calcular módulos habilitados cuando cambia template u owner
  useEffect(() => {
    if (!formData.templateId) {
      setEnabledModulesPreview([]);
      return;
    }

    const template = templates.find(t => t.id === formData.templateId);
    if (!template) {
      setEnabledModulesPreview([]);
      return;
    }

    // Si hay owner seleccionado, obtener sus módulos permitidos
    const owner = owners.find(o => o.id.toString() === formData.ownerId);

    // Por ahora, mostrar los módulos del template
    // La intersección real se hace en el backend
    setEnabledModulesPreview(template.moduleKeys || []);
  }, [formData.templateId, formData.ownerId, templates, owners]);

  async function fetchData() {
    try {
      const [companiesRes, templatesRes, subscriptionsRes] = await Promise.all([
        fetch('/api/superadmin/companies'),
        fetch('/api/superadmin/templates'),
        fetch('/api/superadmin/subscriptions'),
      ]);

      if (companiesRes.ok) {
        const data = await companiesRes.json();
        setCompanies(data.companies || []);
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
      }

      // Extraer owners con suscripciones activas
      if (subscriptionsRes.ok) {
        const data = await subscriptionsRes.json();
        const ownersList = (data.subscriptions || [])
          .filter((s: any) => s.status === 'ACTIVE' || s.status === 'TRIALING')
          .map((s: any) => ({
            id: s.user.id,
            name: s.user.name,
            email: s.user.email,
            subscription: {
              id: s.id,
              status: s.status,
              planName: s.planName,
              maxCompanies: s.maxCompanies,
              companiesCount: s.companiesCount,
            },
          }));
        setOwners(ownersList);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingCompany(null);
    const defaultTemplate = templates.find(t => t.isDefault);
    setFormData({
      name: '',
      cuit: '',
      email: '',
      phone: '',
      address: '',
      templateId: defaultTemplate?.id || '',
      ownerId: '',
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      adminPassword: '',
      useExistingAdmin: false,
    });
    setShowPassword(false);
    setDialogOpen(true);
  }

  function openEditDialog(company: Company) {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      cuit: company.cuit || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      templateId: company.templateId || '',
      ownerId: '',
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      adminPassword: '',
      useExistingAdmin: false,
    });
    setDialogOpen(true);
  }

  async function openViewModeDialog(company: Company) {
    setViewModeCompany(company);
    setViewModeLoading(true);
    setViewModeDialogOpen(true);

    try {
      const res = await fetch(`/api/company/${company.id}/view-config`);
      if (res.ok) {
        const data = await res.json();
        setViewModeConfig({
          enabled: data.enabled || false,
          hotkey: data.hotkey || 'ctrl+shift+t',
          pinEnabled: !!data.pinHash,
          pin: '',
          sessionTimeout: data.sessionTimeout || 30,
        });
      }
    } catch (error) {
      console.error('Error loading ViewMode config:', error);
    } finally {
      setViewModeLoading(false);
    }
  }

  async function handleSaveViewModeConfig() {
    if (!viewModeCompany) return;

    setViewModeLoading(true);
    try {
      const res = await fetch(`/api/company/${viewModeCompany.id}/view-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: viewModeConfig.enabled,
          hotkey: viewModeConfig.hotkey,
          pinEnabled: viewModeConfig.pinEnabled,
          pin: viewModeConfig.pin || undefined,
          sessionTimeout: viewModeConfig.sessionTimeout,
        }),
      });

      if (res.ok) {
        toast.success('Configuración de ViewMode guardada');
        setViewModeDialogOpen(false);
        setViewModeConfig(prev => ({ ...prev, pin: '' }));
      } else {
        toast.error('Error al guardar');
      }
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setViewModeLoading(false);
    }
  }

  async function openCostConfigDialog(company: Company) {
    setCostConfigCompany(company);
    setCostConfigLoading(true);
    setCostConfigDialogOpen(true);

    try {
      const res = await fetch(`/api/costos/config?companyId=${company.id}`);
      if (res.ok) {
        const data = await res.json();
        setCostConfig({
          enablePretensadosSim: data.enablePretensadosSim || false,
          version: data.version || 'V1',
        });
      }
    } catch (error) {
      console.error('Error loading cost config:', error);
    } finally {
      setCostConfigLoading(false);
    }
  }

  async function handleSaveCostConfig() {
    if (!costConfigCompany) return;

    setCostConfigLoading(true);
    try {
      const res = await fetch('/api/costos/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCompanyId: costConfigCompany.id,
          enablePretensadosSim: costConfig.enablePretensadosSim,
        }),
      });

      if (res.ok) {
        toast.success('Configuración de costos guardada');
        setCostConfigDialogOpen(false);
      } else {
        toast.error('Error al guardar configuración');
      }
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setCostConfigLoading(false);
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (!editingCompany && !formData.templateId) {
      toast.error('Debe seleccionar un template');
      return;
    }

    setSaving(true);
    try {
      const url = editingCompany
        ? `/api/superadmin/companies/${editingCompany.id}`
        : '/api/superadmin/companies';
      const method = editingCompany ? 'PUT' : 'POST';

      const payload: any = {
        name: formData.name,
        cuit: formData.cuit || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        templateId: formData.templateId || null,
      };

      // Solo en creación
      if (!editingCompany) {
        if (formData.ownerId) {
          payload.ownerId = parseInt(formData.ownerId);
        }
        if (formData.adminName && formData.adminEmail) {
          payload.adminName = formData.adminName;
          payload.adminEmail = formData.adminEmail;
          payload.adminPhone = formData.adminPhone || null;
          payload.adminPassword = formData.adminPassword || null;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingCompany ? 'Empresa actualizada' : 'Empresa creada');
        setDialogOpen(false);
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      toast.error('Error al guardar empresa');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(company: Company) {
    if (!confirm(`¿Eliminar la empresa "${company.name}"? Esta acción no se puede deshacer.`)) return;

    try {
      const res = await fetch(`/api/superadmin/companies/${company.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Empresa eliminada');
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al eliminar');
      }
    } catch (error) {
      toast.error('Error al eliminar empresa');
    }
  }

  // Generar password aleatorio
  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, adminPassword: password });
    setShowPassword(true);
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(search.toLowerCase()) ||
    company.cuit?.toLowerCase().includes(search.toLowerCase()) ||
    company.primaryAdmin?.name.toLowerCase().includes(search.toLowerCase()) ||
    company.primaryAdmin?.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: companies.length,
    active: companies.filter(c => c.isActive && !c.blockedByPlan).length,
    blocked: companies.filter(c => c.blockedByPlan).length,
    totalUsers: companies.reduce((sum, c) => sum + c.usersCount, 0),
  };

  // Verificar si el owner seleccionado puede crear más empresas
  const selectedOwner = owners.find(o => o.id.toString() === formData.ownerId);
  const canCreateMore = selectedOwner
    ? selectedOwner.subscription.maxCompanies === null ||
      selectedOwner.subscription.companiesCount < selectedOwner.subscription.maxCompanies
    : true;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Empresas</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gestiona todas las empresas registradas en el sistema
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Empresa
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Empresas Totales</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">Empresas Activas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Ban className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.blocked}</p>
                  <p className="text-sm text-muted-foreground">Bloqueadas por Plan</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-sm text-muted-foreground">Usuarios Totales</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, CUIT o administrador..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Admin Principal</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Template</TableHead>
                <TableHead className="text-center">Usuarios</TableHead>
                <TableHead className="text-center">Módulos</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => {
                const subStatus = company.subscription?.status
                  ? statusStyles[company.subscription.status]
                  : null;

                return (
                  <TableRow key={company.id} className={company.blockedByPlan ? 'opacity-60' : ''}>
                    {/* Empresa */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{company.name}</p>
                            {company.blockedByPlan && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Bloqueada por estado del plan</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {company.cuit && (
                            <p className="text-xs text-muted-foreground">{company.cuit}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Admin Principal */}
                    <TableCell>
                      {company.primaryAdmin ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-medium">{company.primaryAdmin.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{company.primaryAdmin.email}</span>
                          </div>
                          {company.primaryAdmin.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{company.primaryAdmin.phone}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin asignar</span>
                      )}
                    </TableCell>

                    {/* Plan */}
                    <TableCell>
                      {company.subscription ? (
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {company.subscription.planName}
                          </Badge>
                          {subStatus && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs block w-fit',
                                subStatus.bg,
                                subStatus.text
                              )}
                            >
                              {subStatus.label}
                            </Badge>
                          )}
                          {company.subscription.maxCompanies !== null && (
                            <p className="text-xs text-muted-foreground">
                              {company.subscription.companiesInPlan}/{company.subscription.maxCompanies} empresas
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>

                    {/* Template */}
                    <TableCell>
                      {company.templateName ? (
                        <Badge variant="outline" className="text-xs">
                          <FileStack className="h-3 w-3 mr-1" />
                          {company.templateName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Usuarios */}
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {company.usersCount}
                      </Badge>
                    </TableCell>

                    {/* Módulos */}
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        <Puzzle className="h-3 w-3 mr-1" />
                        {company.modulesCount}
                      </Badge>
                    </TableCell>

                    {/* Estado */}
                    <TableCell className="text-center">
                      {company.blockedByPlan ? (
                        <Badge className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          <Ban className="h-3 w-3 mr-1" />
                          Bloqueada
                        </Badge>
                      ) : (
                        <Badge
                          className={cn(
                            'text-xs',
                            company.isActive
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          )}
                        >
                          {company.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Acciones */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(company)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Puzzle className="h-4 w-4 mr-2" />
                            Gestionar Módulos
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Users className="h-4 w-4 mr-2" />
                            Ver Usuarios
                          </DropdownMenuItem>
                          {company.subscription && (
                            <DropdownMenuItem>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Ver Suscripción
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openViewModeDialog(company)}>
                            <Keyboard className="h-4 w-4 mr-2" />
                            Configurar ViewMode
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCostConfigDialog(company)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Configurar Simulación Costos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(company)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredCompanies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No se encontraron empresas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}
              </DialogTitle>
              <DialogDescription>
                {editingCompany
                  ? 'Modifica la información de la empresa'
                  : 'Crea una nueva empresa en el sistema'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Datos de la empresa */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Datos de la Empresa
                </h3>

                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre de la empresa"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CUIT</Label>
                    <Input
                      value={formData.cuit}
                      onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                      placeholder="XX-XXXXXXXX-X"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+54 ..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contacto@empresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Dirección de la empresa"
                  />
                </div>
              </div>

              {/* Solo para creación */}
              {!editingCompany && (
                <>
                  <Separator />

                  {/* Owner (suscripción) */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Propietario (Suscripción)
                    </h3>

                    <div className="space-y-2">
                      <Label>Cuenta del propietario</Label>
                      <Select
                        value={formData.ownerId}
                        onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un propietario (opcional)..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin propietario asignado</SelectItem>
                          {owners.map((owner) => {
                            const canCreate = owner.subscription.maxCompanies === null ||
                              owner.subscription.companiesCount < owner.subscription.maxCompanies;
                            return (
                              <SelectItem
                                key={owner.id}
                                value={owner.id.toString()}
                                disabled={!canCreate}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{owner.name}</span>
                                  <span className="text-muted-foreground text-xs">
                                    ({owner.email})
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {owner.subscription.planName}
                                  </Badge>
                                  {owner.subscription.maxCompanies !== null && (
                                    <span className="text-xs text-muted-foreground">
                                      {owner.subscription.companiesCount}/{owner.subscription.maxCompanies}
                                    </span>
                                  )}
                                  {!canCreate && (
                                    <Badge variant="destructive" className="text-xs">
                                      Límite alcanzado
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {selectedOwner && !canCreateMore && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Este propietario ha alcanzado el límite de empresas de su plan
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        La empresa heredará la suscripción del propietario seleccionado
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Admin principal */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Administrador Principal
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nombre del admin</Label>
                        <Input
                          value={formData.adminName}
                          onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                          placeholder="Nombre completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email del admin</Label>
                        <Input
                          type="email"
                          value={formData.adminEmail}
                          onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                          placeholder="admin@empresa.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Teléfono del admin</Label>
                        <Input
                          value={formData.adminPhone}
                          onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                          placeholder="+54 ..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contraseña</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              value={formData.adminPassword}
                              onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                              placeholder="Dejar vacío para auto-generar"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={generatePassword}
                          >
                            Generar
                          </Button>
                        </div>
                      </div>
                    </div>

                    {formData.adminName && formData.adminEmail && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Se creará un usuario y se asignará como administrador de esta empresa
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Template y módulos */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileStack className="h-4 w-4" />
                      Template y Módulos
                    </h3>

                    <div className="space-y-2">
                      <Label>Template de Módulos *</Label>
                      <Select
                        value={formData.templateId}
                        onValueChange={(value) => setFormData({ ...formData, templateId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: template.color }}
                                />
                                {template.name}
                                {template.isDefault && (
                                  <Badge variant="secondary" className="text-xs">
                                    Default
                                  </Badge>
                                )}
                                <span className="text-muted-foreground text-xs">
                                  ({template.moduleKeys?.length || 0} módulos)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Preview de módulos */}
                    {enabledModulesPreview.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Módulos que se habilitarán:
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                          {enabledModulesPreview.map((key) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              <Puzzle className="h-3 w-3 mr-1" />
                              {key}
                            </Badge>
                          ))}
                        </div>
                        {selectedOwner && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Solo se habilitarán los módulos permitidos por el plan del propietario
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || (!editingCompany && selectedOwner && !canCreateMore)}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {editingCompany ? 'Guardar Cambios' : 'Crear Empresa'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ViewMode Config Dialog */}
        <Dialog open={viewModeDialogOpen} onOpenChange={setViewModeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Configurar ViewMode
              </DialogTitle>
              <DialogDescription>
                {viewModeCompany?.name} - Configuración del modo dual
              </DialogDescription>
            </DialogHeader>

            {viewModeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* Habilitar ViewMode */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Habilitar ViewMode</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite activar el modo dual con atajo de teclado
                    </p>
                  </div>
                  <Switch
                    checked={viewModeConfig.enabled}
                    onCheckedChange={(checked) =>
                      setViewModeConfig(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>

                {viewModeConfig.enabled && (
                  <>
                    <Separator />

                    {/* Hotkey */}
                    <div className="space-y-2">
                      <Label>Atajo de Teclado</Label>
                      <Input
                        value={viewModeConfig.hotkey}
                        onChange={(e) =>
                          setViewModeConfig(prev => ({ ...prev, hotkey: e.target.value }))
                        }
                        placeholder="ctrl+shift+t"
                      />
                      <p className="text-xs text-muted-foreground">
                        Combinación para activar/desactivar (ej: ctrl+shift+t)
                      </p>
                    </div>

                    <Separator />

                    {/* PIN */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Requerir PIN</Label>
                          <p className="text-sm text-muted-foreground">
                            Solicitar PIN al activar
                          </p>
                        </div>
                        <Switch
                          checked={viewModeConfig.pinEnabled}
                          onCheckedChange={(checked) =>
                            setViewModeConfig(prev => ({ ...prev, pinEnabled: checked }))
                          }
                        />
                      </div>

                      {viewModeConfig.pinEnabled && (
                        <div className="space-y-2">
                          <Label>PIN</Label>
                          <div className="relative">
                            <Input
                              type={showViewModePin ? 'text' : 'password'}
                              value={viewModeConfig.pin}
                              onChange={(e) =>
                                setViewModeConfig(prev => ({ ...prev, pin: e.target.value }))
                              }
                              placeholder="Dejar vacío para mantener actual"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                              onClick={() => setShowViewModePin(!showViewModePin)}
                            >
                              {showViewModePin ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Session Timeout */}
                    <div className="space-y-2">
                      <Label>Tiempo de Sesión (minutos)</Label>
                      <Input
                        type="number"
                        value={viewModeConfig.sessionTimeout}
                        onChange={(e) =>
                          setViewModeConfig(prev => ({
                            ...prev,
                            sessionTimeout: parseInt(e.target.value) || 30,
                          }))
                        }
                        min={5}
                        max={480}
                      />
                      <p className="text-xs text-muted-foreground">
                        Se desactiva automáticamente tras este tiempo
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewModeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveViewModeConfig} disabled={viewModeLoading}>
                {viewModeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cost Config Dialog (Pretensados Simulation) */}
        <Dialog open={costConfigDialogOpen} onOpenChange={setCostConfigDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Configurar Simulación de Costos
              </DialogTitle>
              <DialogDescription>
                {costConfigCompany?.name} - Opciones especiales de simulación
              </DialogDescription>
            </DialogHeader>

            {costConfigLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* Habilitar Simulación Pretensados */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50/50">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Factory className="h-4 w-4 text-amber-600" />
                      Simulación por Producción
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Habilita cálculos especiales para empresas de prefabricados:
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside mt-2 space-y-1">
                      <li><strong>Viguetas:</strong> días × bancos × metros por banco</li>
                      <li><strong>Bloques:</strong> días × placas × unidades por placa</li>
                      <li><strong>Adoquines:</strong> días × m²/día × unidades por m²</li>
                    </ul>
                  </div>
                  <Switch
                    checked={costConfig.enablePretensadosSim}
                    onCheckedChange={(checked) =>
                      setCostConfig(prev => ({ ...prev, enablePretensadosSim: checked }))
                    }
                  />
                </div>

                {costConfig.enablePretensadosSim && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm text-green-800 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      La empresa podrá usar la simulación por producción en el módulo de Costos V2
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setCostConfigDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveCostConfig} disabled={costConfigLoading}>
                {costConfigLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
