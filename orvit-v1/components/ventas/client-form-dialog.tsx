'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, User, FileText, DollarSign, Building2, Truck, AlertTriangle, StickyNote, Plus, ChevronDown, MapPin, CreditCard, Clock, Receipt, Phone, Users, Calendar, X, Edit3, Save, BarChart3, ChevronsUpDown, Check } from 'lucide-react';
import { Client } from '@/lib/types/sales';
import { useCompany } from '@/contexts/CompanyContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { cn } from '@/lib/utils';
import { useApiClient } from '@/hooks/use-api-client';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { validateCUIT } from '@/lib/ventas/cuit-validator';
import { ClientAnalyticsTab } from './analytics/client-analytics-tab';

const clientSchema = z.object({
  // Datos básicos
  legalName: z.string().min(1, 'La razón social es requerida'),
  name: z.string().optional(),
  email: z.string().email('Email inválido').min(1, 'El email es requerido'),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  cuit: z.string().optional().refine(
    (val) => !val || val.trim() === '' || validateCUIT(val).valid,
    (val) => ({ message: (val && validateCUIT(val).error) || 'CUIT inválido' })
  ),
  taxCondition: z.enum(['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final']),
  clientTypeId: z.string().optional(),
  deliveryZoneId: z.string().optional(),
  sellerId: z.union([z.number(), z.literal('fabrica')]).optional(),
  contactPerson: z.string().optional(),
  observations: z.string().optional(),
  grossIncome: z.string().optional(),
  activityStartDate: z.string().optional(),
  // Condición de Facturación (T1, T2, Mixto)
  tipoCondicionVenta: z.enum(['FORMAL', 'INFORMAL', 'MIXTO']).optional(),
  porcentajeFormal: z.number().min(1).max(99).optional(),
  // Datos financieros
  saleCondition: z.string().optional(),
  paymentTerms: z.number().min(0).optional(),
  creditLimit: z.number().min(0).optional(),
  receivesCheck: z.boolean().optional(),
  checkTerms: z.number().min(0).optional(),
  hasPendingMerchandise: z.boolean().optional(),
  merchandisePendingDays: z.number().min(0).optional(),
  invoiceDueDays: z.number().min(0).optional(),
  accountBlockDays: z.number().min(0).optional(),
  extraBonusDescription: z.string().optional(),
  // Tope de cheques con tipo
  hasCheckLimit: z.boolean().optional(),
  checkLimitType: z.enum(['CANTIDAD', 'SALDO']).optional(),
  checkLimit: z.number().min(0).optional(),
  // Override temporal de límites (duración de cambios)
  creditLimitOverride: z.number().min(0).optional(),
  creditLimitOverrideDays: z.number().min(0).optional(),
  merchandisePendingDaysOverride: z.number().min(0).optional(),
  merchandisePendingDaysOverrideDays: z.number().min(0).optional(),
  tempCreditLimit: z.number().min(0).optional(),
  tempCreditLimitOverride: z.number().min(0).optional(),
  tempCreditLimitOverrideDays: z.number().min(0).optional(),
  // Comercial y logística
  transportCompanyId: z.string().optional(),
  businessSectorId: z.string().optional(),
  settlementPeriod: z.enum(['SEMANAL', 'QUINCENAL', 'MENSUAL']).optional(),
  requiresPurchaseOrder: z.boolean().optional(),
  isDeliveryBlocked: z.boolean().optional(),
  deliveryBlockedReason: z.string().optional(),
  quickNote: z.string().optional(),
  quickNoteExpiry: z.string().optional(),
  discountListId: z.string().optional(),
  defaultPriceListId: z.number().optional(),
  // Nuevos campos extendidos
  whatsapp: z.string().optional(),
  municipalRetentionType: z.string().optional(),
  parentClientId: z.string().optional(),
  visitDays: z.array(z.string()).optional(),
  deliveryDays: z.array(z.string()).optional(),
  // Exenciones impositivas
  isVatPerceptionExempt: z.boolean().optional(),
  vatPerceptionExemptUntil: z.string().optional(),
  vatPerceptionExemptCertificate: z.string().optional(),
  isVatRetentionExempt: z.boolean().optional(),
  vatRetentionExemptUntil: z.string().optional(),
  isGrossIncomeExempt: z.boolean().optional(),
  grossIncomeExemptUntil: z.string().optional(),
  isMunicipalExempt: z.boolean().optional(),
  municipalExemptUntil: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: (client: Client) => void;
}

interface ClientType { id: string; name: string; description?: string; }
interface DeliveryZone { id: string; name: string; description?: string; }
interface TransportCompany { id: string; name: string; description?: string; }
interface BusinessSector { id: string; name: string; description?: string; }
interface Seller { id: string; name: string; email: string; }
interface DiscountList { id: string; name: string; description?: string; isActive: boolean; }
interface PriceList { id: number; name: string; description?: string; isActive: boolean; }

// Mini dialog para crear inline
function InlineCreateDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  isLoading
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: (name: string) => Promise<void>;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit(name.trim());
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Crear {title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="inline-name">Nombre *</Label>
              <Input
                id="inline-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Nombre del ${title.toLowerCase()}`}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Configuración de campos habilitados (desde API)
interface FormConfig {
  enabledFields: Record<string, boolean>;
  isLoaded: boolean;
}

// Botón para eliminar campo en modo edición
function FieldRemoveButton({
  featureId,
  featureName,
  isImportant = false,
  onRemove
}: {
  featureId: string;
  featureName: string;
  isImportant?: boolean;
  onRemove: (featureId: string, featureName: string, isImportant: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
      onClick={() => onRemove(featureId, featureName, isImportant)}
      title={`Ocultar ${featureName}`}
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ClientFormDialog({ open, onOpenChange, onClientCreated }: ClientFormDialogProps) {
  const { post, put, get } = useApiClient();
  const [isLoading, setIsLoading] = useState(false);
  const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [transportCompanies, setTransportCompanies] = useState<TransportCompany[]>([]);
  const [businessSectors, setBusinessSectors] = useState<BusinessSector[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [discountLists, setDiscountLists] = useState<DiscountList[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [allClients, setAllClients] = useState<{ id: string; legalName: string; name?: string }[]>([]);
  const [parentClientSearch, setParentClientSearch] = useState('');
  const [parentClientOpen, setParentClientOpen] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [temporalChangesOpen, setTemporalChangesOpen] = useState(false);
  const [taxExemptionsOpen, setTaxExemptionsOpen] = useState(false);

  // Configuración de campos habilitados
  const [formConfig, setFormConfig] = useState<FormConfig>({
    enabledFields: {},
    isLoaded: false,
  });

  // Modo de edición de configuración
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<{ open: boolean; featureId: string; featureName: string } | null>(null);

  // Helper para verificar si una funcionalidad está habilitada
  const isFeatureEnabled = (featureId: string): boolean => {
    if (!formConfig.isLoaded) return true; // Mientras carga, mostrar todo (fallback)
    return formConfig.enabledFields[featureId] === true; // Solo mostrar si explícitamente habilitado
  };

  // Helper para deshabilitar un campo
  const handleDisableField = async (featureId: string, featureName: string, isImportant: boolean = false) => {
    // Si es importante, pedir confirmación primero
    if (isImportant) {
      setConfirmDisable({ open: true, featureId, featureName });
      return;
    }

    // Si no es importante, deshabilitar directamente
    await toggleFeature(featureId, false);
  };

  // Toggle de feature
  const toggleFeature = async (featureId: string, enabled: boolean) => {
    const prevConfig = formConfig.enabledFields;
    const newConfig = { ...prevConfig, [featureId]: enabled };
    setFormConfig({ enabledFields: newConfig, isLoaded: true });

    const { error } = await put('/api/ventas/client-form-config', { enabledFields: newConfig });
    if (error) {
      setFormConfig({ enabledFields: prevConfig, isLoaded: true });
      return;
    }
    toast.success(enabled ? 'Campo habilitado' : 'Campo deshabilitado');
    await reloadConfig();
  };

  // Estados para dialogs inline
  const [createTransportOpen, setCreateTransportOpen] = useState(false);
  const [createSectorOpen, setCreateSectorOpen] = useState(false);
  const [isCreatingInline, setIsCreatingInline] = useState(false);

  const { currentCompany } = useCompany();
  const { mode: viewMode } = useViewMode();
  const isExtendedMode = viewMode === 'E';

  // Verificar si es Pretensados Córdoba para ocultar nota rápida
  const isPretensadosCordoba = currentCompany?.name?.toLowerCase().includes('pretensados') &&
                               currentCompany?.name?.toLowerCase().includes('cordoba');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      taxCondition: 'consumidor_final',
      paymentTerms: 0,
      checkTerms: 0,
      creditLimit: 0,
      saleCondition: 'contado',
      activityStartDate: new Date().toISOString().split('T')[0],
      tipoCondicionVenta: 'FORMAL',
      porcentajeFormal: 50,
      invoiceDueDays: 15,
      checkLimitType: 'SALDO',
      visitDays: [],
      deliveryDays: [],
      isVatPerceptionExempt: false,
      isVatRetentionExempt: false,
      isGrossIncomeExempt: false,
      isMunicipalExempt: false,
    }
  });

  const taxCondition = watch('taxCondition');
  const saleCondition = watch('saleCondition');
  const receivesCheck = watch('receivesCheck');
  const hasPendingMerchandise = watch('hasPendingMerchandise');
  const tipoCondicionVenta = watch('tipoCondicionVenta');
  const isDeliveryBlocked = watch('isDeliveryBlocked');
  const hasCheckLimit = watch('hasCheckLimit');
  const isVatPerceptionExempt = watch('isVatPerceptionExempt');
  const isVatRetentionExempt = watch('isVatRetentionExempt');
  const isGrossIncomeExempt = watch('isGrossIncomeExempt');
  const isMunicipalExempt = watch('isMunicipalExempt');
  const visitDays = watch('visitDays') || [];
  const deliveryDays = watch('deliveryDays') || [];

  // Auto-format CUIT with dashes (XX-XXXXXXXX-X)
  const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbers = e.target.value.replace(/\D/g, '');
    let formatted: string;
    if (numbers.length <= 2) {
      formatted = numbers;
    } else if (numbers.length <= 10) {
      formatted = `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    } else {
      formatted = `${numbers.slice(0, 2)}-${numbers.slice(2, 10)}-${numbers.slice(10, 11)}`;
    }
    setValue('cuit', formatted, { shouldValidate: true });
  };

  // Función para recargar la configuración
  const reloadConfig = async () => {
    const { data } = await get('/api/ventas/client-form-config');
    if (data) {
      setFormConfig({ enabledFields: data.enabledFields || {}, isLoaded: true });
    }
  };

  // Cargar datos cuando se abre el dialog
  useEffect(() => {
    if (open && currentCompany) {
      const fetchData = async () => {
        try {
          const [typesRes, zonesRes, transportRes, sectorsRes, usersRes, listsRes, priceListsRes, clientsRes, configRes] = await Promise.all([
            get(`/api/client-types?companyId=${currentCompany.id}`),
            get(`/api/delivery-zones?companyId=${currentCompany.id}`),
            get(`/api/transport-companies?companyId=${currentCompany.id}`),
            get(`/api/business-sectors?companyId=${currentCompany.id}`),
            get('/api/users'),
            get(`/api/discount-lists?companyId=${currentCompany.id}`),
            get(`/api/ventas/listas-precios`),
            get('/api/clients?minimal=true&limit=50'),
            get('/api/ventas/client-form-config'),
          ]);

          setClientTypes(typesRes.data || []);
          setDeliveryZones(zonesRes.data || []);
          setTransportCompanies(transportRes.data || []);
          setBusinessSectors(sectorsRes.data || []);
          setSellers(usersRes.data || []);
          setDiscountLists(listsRes.data || []);
          const priceListsData = priceListsRes.data;
          setPriceLists(Array.isArray(priceListsData) ? priceListsData : (priceListsData?.data || []));
          const clientsData = clientsRes.data;
          const clientsList = clientsData?.data || (Array.isArray(clientsData) ? clientsData : []);
          setAllClients(clientsList);
          const configData = configRes.data || { enabledFields: {} };
          setFormConfig({
            enabledFields: configData.enabledFields || {},
            isLoaded: true,
          });
        } catch (error) {
          console.error('Error cargando datos:', error);
        }
      };
      fetchData();
    }
  }, [open, currentCompany]);

  // Búsqueda debounced de clientes padre para el Combobox
  useEffect(() => {
    if (!parentClientSearch || parentClientSearch.length < 2) return;

    const timer = setTimeout(async () => {
      setIsSearchingClients(true);
      const { data } = await get(`/api/clients?minimal=true&limit=20&search=${encodeURIComponent(parentClientSearch)}`);
      if (data) {
        const clientsList = data?.data || (Array.isArray(data) ? data : []);
        setAllClients(clientsList);
      }
      setIsSearchingClients(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [parentClientSearch]);

  // Crear transporte inline
  const handleCreateTransport = async (name: string) => {
    if (!currentCompany) return;
    setIsCreatingInline(true);
    const { data, error } = await post('/api/transport-companies', { name, companyId: currentCompany.id });
    if (data) {
      setTransportCompanies(prev => [...prev, data]);
      setValue('transportCompanyId', data.id);
      toast.success('Empresa de transporte creada');
    }
    setIsCreatingInline(false);
  };

  // Crear sector inline
  const handleCreateSector = async (name: string) => {
    if (!currentCompany) return;
    setIsCreatingInline(true);
    const { data, error } = await post('/api/business-sectors', { name, companyId: currentCompany.id });
    if (data) {
      setBusinessSectors(prev => [...prev, data]);
      setValue('businessSectorId', data.id);
      toast.success('Rubro/Sector creado');
    }
    setIsCreatingInline(false);
  };

  const onSubmit = async (data: ClientFormData) => {
    setIsLoading(true);

    // Ensure CUIT is stored in formatted XX-XXXXXXXX-X format
    const cuitFormatted = data.cuit ? (validateCUIT(data.cuit).formatted || data.cuit) : undefined;

    const submitData: any = {
      ...data,
      cuit: cuitFormatted,
      activityStartDate: data.activityStartDate || new Date().toISOString().split('T')[0]
    };

    const currentSellerId = watch('sellerId');
    if (currentSellerId === 'fabrica') {
      submitData.sellerId = 'fabrica';
    } else if (currentSellerId !== undefined && currentSellerId !== null) {
      submitData.sellerId = currentSellerId;
    }

    const { data: newClientData, error } = await post('/api/clients', submitData);

    if (error) {
      setIsLoading(false);
      return;
    }

    const newClient: Client = {
      id: newClientData.id,
      name: newClientData.name,
      email: newClientData.email,
      phone: newClientData.phone,
      address: newClientData.address,
      cuit: newClientData.cuit || undefined,
      taxCondition: newClientData.taxCondition || 'consumidor_final',
      discounts: (newClientData.discounts || []).map((d: any) => ({
        id: d.id, clientId: d.clientId, name: d.name,
        percentage: d.percentage || undefined, amount: d.amount || undefined,
        categoryId: d.categoryId || undefined, productId: d.productId || undefined,
        minQuantity: d.minQuantity || undefined, isActive: d.isActive,
        validFrom: d.validFrom ? new Date(d.validFrom) : undefined,
        validUntil: d.validUntil ? new Date(d.validUntil) : undefined,
        notes: d.notes || undefined,
        createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt),
      })),
      priceLists: (newClientData.priceLists || []).map((pl: any) => ({
        id: pl.id, clientId: pl.clientId, priceListId: pl.priceListId,
        priceListName: pl.priceListName, isDefault: pl.isDefault, isActive: pl.isActive,
        createdAt: new Date(pl.createdAt), updatedAt: new Date(pl.updatedAt),
      })),
      creditLimit: newClientData.creditLimit || undefined,
      currentBalance: newClientData.currentBalance || 0,
      paymentTerms: newClientData.paymentTerms || 0,
      isActive: newClientData.isActive !== undefined ? newClientData.isActive : true,
      observations: newClientData.observations || undefined,
      createdAt: new Date(newClientData.createdAt),
      updatedAt: new Date(newClientData.updatedAt),
    };

    onClientCreated(newClient);
    toast.success('Cliente creado correctamente');
    reset();
    onOpenChange(false);
    setIsLoading(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Nuevo Cliente
              </span>
              <div className="flex items-center gap-2">
                {isEditMode && (
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-warning-muted rounded">
                    Modo edición: Click en <X className="inline h-3 w-3" /> para ocultar campos
                  </span>
                )}
                <Button
                  type="button"
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="gap-1.5"
                >
                  {isEditMode ? (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-4 w-4" />
                      Configurar
                    </>
                  )}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
            <form id="client-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Tabs defaultValue="identificacion" className="w-full">
                <TabsList>
                  <TabsTrigger value="identificacion">
                    <User className="w-4 h-4 mr-1.5" />
                    Identificación
                  </TabsTrigger>
                  <TabsTrigger value="contacto">
                    <MapPin className="w-4 h-4 mr-1.5" />
                    Contacto
                  </TabsTrigger>
                  <TabsTrigger value="financiero">
                    <CreditCard className="w-4 h-4 mr-1.5" />
                    Financiero
                  </TabsTrigger>
                  <TabsTrigger value="comercial">
                    <Truck className="w-4 h-4 mr-1.5" />
                    Comercial
                  </TabsTrigger>
                  {(isFeatureEnabled('taxExemptions') || isFeatureEnabled('municipalRetention')) && (
                    <TabsTrigger value="impuestos">
                      <Receipt className="w-4 h-4 mr-1.5" />
                      Impuestos
                    </TabsTrigger>
                  )}
                  {isEditMode && client?.id && (
                    <TabsTrigger value="analytics">
                      <BarChart3 className="w-4 h-4 mr-1.5" />
                      Analytics
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: IDENTIFICACIÓN */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <TabsContent value="identificacion" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="legalName">Razón Social *</Label>
                      <Input
                        id="legalName"
                        {...register('legalName')}
                        placeholder="Ej: Empresa S.A."
                        autoFocus
                      />
                      {errors.legalName && (
                        <p className="text-sm text-destructive mt-1">{errors.legalName.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="name">Nombre Comercial</Label>
                      <Input id="name" {...register('name')} placeholder="Nombre de fantasía" />
                    </div>

                    {isFeatureEnabled('clientType') && (
                      <div>
                        <Label htmlFor="clientTypeId" className="flex items-center justify-between">
                          Tipo de Cliente
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="clientType"
                              featureName="Tipo de Cliente"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Select
                          onValueChange={(value) => setValue('clientTypeId', value === 'none' ? undefined : value)}
                          defaultValue={watch('clientTypeId') || 'none'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin tipo</SelectItem>
                            {clientTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="taxCondition">Condición Fiscal *</Label>
                      <Select
                        onValueChange={(value) => setValue('taxCondition', value as any)}
                        defaultValue={watch('taxCondition')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona condición" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                          <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                          <SelectItem value="monotributo">Monotributo</SelectItem>
                          <SelectItem value="exento">Exento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(taxCondition === 'responsable_inscripto' || taxCondition === 'monotributo') && (
                      <div>
                        <Label htmlFor="cuit">CUIT</Label>
                        <Input
                          id="cuit"
                          {...register('cuit')}
                          placeholder="30-12345678-9"
                          onChange={handleCuitChange}
                          maxLength={13}
                        />
                        {errors.cuit && (
                          <p className="text-sm text-destructive mt-1">{errors.cuit.message}</p>
                        )}
                      </div>
                    )}

                    {isFeatureEnabled('taxDetails') && (
                      <>
                        <div>
                          <Label htmlFor="grossIncome" className="flex items-center justify-between">
                            Ingresos Brutos
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="taxDetails"
                                featureName="Datos Impositivos Extendidos"
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Input id="grossIncome" {...register('grossIncome')} placeholder="Nro. inscripción" />
                        </div>

                        <div>
                          <Label htmlFor="activityStartDate">Inicio de Actividades</Label>
                          <DatePicker
                            value={watch('activityStartDate')}
                            onChange={(date) => setValue('activityStartDate', date)}
                            placeholder="Fecha inicio"
                          />
                        </div>
                      </>
                    )}

                    {isFeatureEnabled('seller') && (
                    <div>
                      <Label htmlFor="sellerId" className="flex items-center justify-between">
                        Vendedor
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="seller"
                            featureName="Vendedor"
                            isImportant={true}
                            onRemove={handleDisableField}
                          />
                        )}
                      </Label>
                      <Select
                        onValueChange={(value) => {
                          if (value === 'none') setValue('sellerId', undefined);
                          else if (value === 'fabrica') setValue('sellerId', 'fabrica' as any);
                          else setValue('sellerId', parseInt(value));
                        }}
                        defaultValue={watch('sellerId') === 'fabrica' ? 'fabrica' : (watch('sellerId') ? watch('sellerId')?.toString() : 'none')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin vendedor</SelectItem>
                          <SelectItem value="fabrica">Fábrica Directo</SelectItem>
                          {sellers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    )}

                    {/* Condición de Facturación - Solo visible en modo Extended */}
                    {isExtendedMode && (
                      <div className="md:col-span-2 p-3 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium mb-2 block">Condición de Facturación</Label>
                        <div className="flex items-center gap-4">
                          <Select
                            onValueChange={(value) => {
                              setValue('tipoCondicionVenta', value as 'FORMAL' | 'INFORMAL' | 'MIXTO');
                              if (value !== 'MIXTO') setValue('porcentajeFormal', undefined);
                              else setValue('porcentajeFormal', 50);
                            }}
                            value={tipoCondicionVenta || 'FORMAL'}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FORMAL">T1 (Formal)</SelectItem>
                              <SelectItem value="INFORMAL">T2 (Informal)</SelectItem>
                              <SelectItem value="MIXTO">T3 (Mixto)</SelectItem>
                            </SelectContent>
                          </Select>
                          {tipoCondicionVenta === 'MIXTO' && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                max="99"
                                {...register('porcentajeFormal', { valueAsNumber: true })}
                                placeholder="50"
                                className="w-20"
                              />
                              <span className="text-sm text-muted-foreground">% T1</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: CONTACTO */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <TabsContent value="contacto" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register('email')}
                        placeholder="correo@ejemplo.com"
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                      )}
                    </div>

                    {/* Teléfono principal - CORE (no removible) */}
                    <div>
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input id="phone" {...register('phone')} placeholder="+54 11 1234-5678" />
                    </div>

                    {/* Tel. Alternativo - Opcional */}
                    {isFeatureEnabled('phone') && (
                      <div>
                        <Label htmlFor="alternatePhone" className="flex items-center justify-between">
                          Tel. Alternativo
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="phone"
                              featureName="Teléfono Alternativo"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Input id="alternatePhone" {...register('alternatePhone')} placeholder="+54 11 9876-5432" />
                      </div>
                    )}

                    {isFeatureEnabled('whatsapp') && (
                      <div>
                        <Label htmlFor="whatsapp" className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-success" />
                            WhatsApp
                          </span>
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="whatsapp"
                              featureName="WhatsApp"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Input id="whatsapp" {...register('whatsapp')} placeholder="+54 9 351 1234567" />
                      </div>
                    )}

                    {isFeatureEnabled('contactPerson') && (
                      <div>
                        <Label htmlFor="contactPerson" className="flex items-center justify-between">
                          Contacto Principal
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="contactPerson"
                              featureName="Contacto Principal"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Input id="contactPerson" {...register('contactPerson')} placeholder="Nombre del contacto" />
                      </div>
                    )}

                    {isFeatureEnabled('basicAddress') && (
                      <>
                        <div className="md:col-span-2">
                          <Label htmlFor="address" className="flex items-center justify-between">
                            Dirección
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="basicAddress"
                                featureName="Dirección y Código Postal"
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Input id="address" {...register('address')} placeholder="Av. Corrientes 1234" />
                        </div>

                        <div>
                          <Label htmlFor="postalCode" className="flex items-center justify-between">
                            Código Postal
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="basicAddress"
                                featureName="Dirección y Código Postal"
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Input id="postalCode" {...register('postalCode')} placeholder="C1000" />
                        </div>
                      </>
                    )}

                    {isFeatureEnabled('extendedAddress') && (
                      <>
                        <div>
                          <Label htmlFor="city" className="flex items-center justify-between">
                            Ciudad
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="extendedAddress"
                                featureName="Dirección Extendida"
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Input id="city" {...register('city')} placeholder="CABA" />
                        </div>

                        <div>
                          <Label htmlFor="province" className="flex items-center justify-between">
                            Provincia
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="extendedAddress"
                                featureName="Dirección Extendida"
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Input id="province" {...register('province')} placeholder="Buenos Aires" />
                        </div>
                      </>
                    )}

                    {isFeatureEnabled('extendedAddress') && (
                      <div>
                        <Label htmlFor="deliveryZoneId">Zona de Reparto</Label>
                        <Select
                          onValueChange={(value) => setValue('deliveryZoneId', value === 'none' ? undefined : value)}
                          defaultValue={watch('deliveryZoneId') || 'none'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona zona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin zona</SelectItem>
                            {deliveryZones.map((z) => (
                              <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {isFeatureEnabled('observations') && (
                      <div className="md:col-span-2">
                        <Label htmlFor="observations" className="flex items-center justify-between">
                          Observaciones
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="observations"
                              featureName="Observaciones"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Textarea
                          id="observations"
                          {...register('observations')}
                          placeholder="Notas adicionales..."
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: FINANCIERO */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <TabsContent value="financiero" className="space-y-4 mt-4">
                  {/* Condiciones de Venta */}
                  {isFeatureEnabled('saleCondition') && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="saleCondition" className="flex items-center justify-between">
                          Condición de Venta
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="saleCondition"
                              featureName="Condición de Venta"
                              isImportant={true}
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Select
                          onValueChange={(value) => {
                            setValue('saleCondition', value);
                            if (value === 'contado') setValue('creditLimit', undefined);
                          }}
                          defaultValue={watch('saleCondition')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contado">Contado</SelectItem>
                            <SelectItem value="cuenta_corriente">Cuenta Corriente</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="transferencia">Transferencia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="paymentTerms" className="flex items-center justify-between">
                          Plazo Pago (días)
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="saleCondition"
                              featureName="Condición de Venta"
                              isImportant={true}
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Input
                          id="paymentTerms"
                          type="number"
                          min="0"
                          {...register('paymentTerms', { valueAsNumber: true })}
                          placeholder="0"
                        />
                      </div>

                      {isFeatureEnabled('invoiceConfig') && (
                        <div>
                          <Label htmlFor="invoiceDueDays" className="flex items-center justify-between">
                            Vto. Facturas (días)
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="invoiceConfig"
                                featureName="Configuración de Facturación"
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Input
                            id="invoiceDueDays"
                            type="number"
                            min="0"
                            {...register('invoiceDueDays', { valueAsNumber: true })}
                            placeholder="15"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Límites y Bloqueos */}
                  {isFeatureEnabled('creditLimit') && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      {saleCondition === 'cuenta_corriente' && (
                        <div>
                          <Label htmlFor="creditLimit" className="flex items-center justify-between">
                            Límite de Crédito
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="creditLimit"
                                featureName="Límite de Crédito"
                                isImportant={true}
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Input
                            id="creditLimit"
                            type="number"
                            min="0"
                            step="0.01"
                            {...register('creditLimit', { valueAsNumber: true })}
                            placeholder="0.00"
                          />
                        </div>
                      )}

                      <div>
                        <Label htmlFor="accountBlockDays" className="flex items-center justify-between">
                          Días p/ Bloqueo Cta. Cte.
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="creditLimit"
                              featureName="Límite de Crédito"
                              isImportant={true}
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Input
                          id="accountBlockDays"
                          type="number"
                          min="0"
                          {...register('accountBlockDays', { valueAsNumber: true })}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <Label htmlFor="merchandisePendingDays" className="flex items-center justify-between">
                          Días Merc. Pendiente
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="creditLimit"
                              featureName="Límite de Crédito"
                              isImportant={true}
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Input
                          id="merchandisePendingDays"
                          type="number"
                          min="0"
                          {...register('merchandisePendingDays', { valueAsNumber: true })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Cheques */}
                  {isFeatureEnabled('checkManagement') && (
                    <div className="p-3 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium flex items-center gap-2">
                          Cheques
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="checkManagement"
                              featureName="Gestión de Cheques"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Switch
                          id="receivesCheck"
                          checked={receivesCheck || false}
                          onCheckedChange={(checked) => {
                            setValue('receivesCheck', checked);
                            if (!checked) setValue('checkTerms', undefined);
                          }}
                        />
                      </div>

                      {receivesCheck && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="checkTerms" className="text-xs">Plazos (días)</Label>
                            <Input
                              id="checkTerms"
                              type="number"
                              min="0"
                              {...register('checkTerms', { valueAsNumber: true })}
                              placeholder="30, 60, 90"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Tope de Cheques</Label>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={hasCheckLimit || false}
                                onCheckedChange={(checked) => {
                                  setValue('hasCheckLimit', checked);
                                  if (!checked) setValue('checkLimit', undefined);
                                }}
                              />
                              {hasCheckLimit && (
                                <>
                                  <Select
                                    value={watch('checkLimitType') || 'SALDO'}
                                    onValueChange={(v) => setValue('checkLimitType', v as any)}
                                  >
                                    <SelectTrigger className="w-24 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="CANTIDAD">Cant.</SelectItem>
                                      <SelectItem value="SALDO">Saldo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    min="0"
                                    {...register('checkLimit', { valueAsNumber: true })}
                                    className="w-24 h-8"
                                    placeholder="0"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bonificación Extra */}
                  {isFeatureEnabled('extraBonus') && (
                    <div>
                      <Label htmlFor="extraBonusDescription" className="flex items-center justify-between">
                        Bonificación Extra
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="extraBonus"
                            featureName="Bonificación Extra"
                            onRemove={handleDisableField}
                          />
                        )}
                      </Label>
                      <Input
                        id="extraBonusDescription"
                        {...register('extraBonusDescription')}
                        placeholder="Ej: 10% EXTRA VIGUETAS-BLOQUES POR PAGO 30 DIAS"
                      />
                    </div>
                  )}

                  {/* Cambios Temporales - Collapsible */}
                  {isFeatureEnabled('temporalOverrides') && (
                  <Collapsible open={temporalChangesOpen} onOpenChange={setTemporalChangesOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" type="button">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Cambios Temporales (Duración de Cambios)
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="temporalOverrides"
                              featureName="Cambios Temporales de Límites"
                              onRemove={(featureId, featureName, isImportant) => {
                                handleDisableField(featureId, featureName, isImportant);
                              }}
                            />
                          )}
                        </span>
                        <ChevronDown className={cn("w-4 h-4 transition-transform", temporalChangesOpen && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <p className="text-xs text-muted-foreground mb-3">
                        Valores temporales que vuelven al original después de X días.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Override Límite de Crédito */}
                        <div className="p-3 border rounded-lg space-y-2">
                          <Label className="text-sm font-medium">Límite de Crédito</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Valor</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                {...register('creditLimitOverride', { valueAsNumber: true })}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Días</Label>
                              <Input
                                type="number"
                                min="0"
                                {...register('creditLimitOverrideDays', { valueAsNumber: true })}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Override Días Mercadería */}
                        <div className="p-3 border rounded-lg space-y-2">
                          <Label className="text-sm font-medium">Días Merc. Pendiente</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Valor</Label>
                              <Input
                                type="number"
                                min="0"
                                {...register('merchandisePendingDaysOverride', { valueAsNumber: true })}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Días</Label>
                              <Input
                                type="number"
                                min="0"
                                {...register('merchandisePendingDaysOverrideDays', { valueAsNumber: true })}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Override Límite Crédito Temporal */}
                        <div className="p-3 border rounded-lg space-y-2">
                          <Label className="text-sm font-medium">Límite Créd. Temporal</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Valor</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                {...register('tempCreditLimitOverride', { valueAsNumber: true })}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Días</Label>
                              <Input
                                type="number"
                                min="0"
                                {...register('tempCreditLimitOverrideDays', { valueAsNumber: true })}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  )}
                </TabsContent>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: COMERCIAL */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <TabsContent value="comercial" className="space-y-4 mt-4">
                  {/* Logística */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isFeatureEnabled('transport') && (
                      <div>
                        <Label className="flex items-center justify-between">
                          Empresa de Transporte
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="transport"
                              featureName="Empresa de Transporte"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <div className="flex gap-2">
                          <Select
                            onValueChange={(value) => setValue('transportCompanyId', value === 'none' ? undefined : value)}
                            value={watch('transportCompanyId') || 'none'}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin transporte</SelectItem>
                              {transportCompanies.map((tc) => (
                                <SelectItem key={tc.id} value={tc.id}>{tc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setCreateTransportOpen(true)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {isFeatureEnabled('businessSector') && (
                      <div>
                        <Label className="flex items-center justify-between">
                          Rubro / Sector
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="businessSector"
                              featureName="Rubro / Sector"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <div className="flex gap-2">
                          <Select
                            onValueChange={(value) => setValue('businessSectorId', value === 'none' ? undefined : value)}
                            value={watch('businessSectorId') || 'none'}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin rubro</SelectItem>
                              {businessSectors.map((bs) => (
                                <SelectItem key={bs.id} value={bs.id}>{bs.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setCreateSectorOpen(true)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {isFeatureEnabled('settlementPeriod') && (
                      <div>
                        <Label className="flex items-center justify-between">
                          Periodo de Liquidación
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="settlementPeriod"
                              featureName="Período de Liquidación"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Select
                          onValueChange={(value) => setValue('settlementPeriod', value === 'none' ? undefined : value as any)}
                          defaultValue={watch('settlementPeriod') || 'none'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin definir</SelectItem>
                            <SelectItem value="SEMANAL">Semanal</SelectItem>
                            <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                            <SelectItem value="MENSUAL">Mensual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {isFeatureEnabled('priceLists') && (
                      <>
                        <div>
                          <Label className="flex items-center justify-between">
                            Lista de Precios
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="priceLists"
                                featureName="Listas de Precios"
                                isImportant={true}
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Select
                            onValueChange={(value) => setValue('defaultPriceListId', value === 'none' ? undefined : parseInt(value))}
                            defaultValue={watch('defaultPriceListId')?.toString() || 'none'}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Precio base</SelectItem>
                              {priceLists.filter(pl => pl.isActive).map((list) => (
                                <SelectItem key={list.id} value={list.id.toString()}>{list.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="flex items-center justify-between">
                            Lista de Descuentos
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="priceLists"
                                featureName="Listas de Precios"
                                isImportant={true}
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Select
                            onValueChange={(value) => setValue('discountListId', value === 'none' ? undefined : value)}
                            defaultValue={watch('discountListId') || 'none'}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin lista</SelectItem>
                              {discountLists.map((list) => (
                                <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {isFeatureEnabled('subclients') && (
                      <div>
                        <Label className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            Cliente Padre (Subcliente de)
                          </span>
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="subclients"
                              featureName="Subclientes"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Popover open={parentClientOpen} onOpenChange={setParentClientOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={parentClientOpen}
                              className="w-full justify-between font-normal"
                            >
                              {watch('parentClientId')
                                ? allClients.find((c) => c.id === watch('parentClientId'))?.legalName || 'Cliente seleccionado'
                                : 'Sin cliente padre'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Buscar cliente..."
                                value={parentClientSearch}
                                onValueChange={setParentClientSearch}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {isSearchingClients ? 'Buscando...' : 'No se encontraron clientes'}
                                </CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="none"
                                    onSelect={() => {
                                      setValue('parentClientId', undefined);
                                      setParentClientOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !watch('parentClientId') ? "opacity-100" : "opacity-0")} />
                                    Sin cliente padre
                                  </CommandItem>
                                  {allClients.map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.id}
                                      onSelect={() => {
                                        setValue('parentClientId', c.id);
                                        setParentClientOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", watch('parentClientId') === c.id ? "opacity-100" : "opacity-0")} />
                                      {c.legalName}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {isFeatureEnabled('purchaseOrder') && (
                      <div className="flex items-center gap-3 md:col-span-2">
                        <Switch
                          id="requiresPurchaseOrder"
                          checked={watch('requiresPurchaseOrder') || false}
                          onCheckedChange={(checked) => setValue('requiresPurchaseOrder', checked)}
                        />
                        <Label htmlFor="requiresPurchaseOrder" className="cursor-pointer flex items-center gap-2">
                          Exige Orden de Compra
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="purchaseOrder"
                              featureName="Orden de Compra"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                      </div>
                    )}
                  </div>

                  {/* Días de Visita y Entrega */}
                  {isFeatureEnabled('visitDeliveryDays') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 border rounded-lg space-y-3">
                        <Label className="font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Días de Visita
                          </span>
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="visitDeliveryDays"
                              featureName="Días de Visita/Entrega"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                          {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'].map((day) => (
                            <div key={day} className="flex items-center gap-1.5">
                              <Checkbox
                                id={`visit-${day}`}
                                checked={visitDays.includes(day)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setValue('visitDays', [...visitDays, day]);
                                  } else {
                                    setValue('visitDays', visitDays.filter((d: string) => d !== day));
                                  }
                                }}
                              />
                              <Label htmlFor={`visit-${day}`} className="text-xs cursor-pointer">
                                {day.slice(0, 2)}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 border rounded-lg space-y-3">
                        <Label className="font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Días de Entrega
                          </span>
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="visitDeliveryDays"
                              featureName="Días de Visita/Entrega"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                          {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'].map((day) => (
                            <div key={day} className="flex items-center gap-1.5">
                              <Checkbox
                                id={`delivery-${day}`}
                                checked={deliveryDays.includes(day)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setValue('deliveryDays', [...deliveryDays, day]);
                                  } else {
                                    setValue('deliveryDays', deliveryDays.filter((d: string) => d !== day));
                                  }
                                }}
                              />
                              <Label htmlFor={`delivery-${day}`} className="text-xs cursor-pointer">
                                {day.slice(0, 2)}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bloqueo de Entregas */}
                  {isFeatureEnabled('deliveryBlock') && (
                    <div className="p-3 border border-destructive/20 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          Bloqueo de Entregas
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="deliveryBlock"
                              featureName="Bloqueo de Entregas"
                              onRemove={handleDisableField}
                            />
                          )}
                        </Label>
                        <Switch
                          checked={isDeliveryBlocked || false}
                          onCheckedChange={(checked) => {
                            setValue('isDeliveryBlocked', checked);
                            if (!checked) setValue('deliveryBlockedReason', undefined);
                          }}
                        />
                      </div>
                      {isDeliveryBlocked && (
                        <div>
                          <Label htmlFor="deliveryBlockedReason" className="text-xs">Razón del bloqueo</Label>
                          <Input
                            id="deliveryBlockedReason"
                            {...register('deliveryBlockedReason')}
                            placeholder="Motivo del bloqueo"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nota Rápida - Oculto para Pretensados Córdoba */}
                  {isFeatureEnabled('quickNote') && !isPretensadosCordoba && (
                    <div className="p-3 border rounded-lg space-y-3">
                      <Label className="font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <StickyNote className="w-4 h-4" />
                          Nota Rápida
                        </span>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="quickNote"
                            featureName="Nota Rápida"
                            onRemove={handleDisableField}
                          />
                        )}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Se muestra al vender a este cliente.
                      </p>
                      <Textarea
                        {...register('quickNote')}
                        placeholder="Ej: Solo entrega en horario matutino..."
                        rows={2}
                      />
                      <div>
                        <Label className="text-xs">Vigencia (opcional)</Label>
                        <DatePicker
                          value={watch('quickNoteExpiry')}
                          onChange={(date) => setValue('quickNoteExpiry', date)}
                          placeholder="Sin vencimiento"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: IMPUESTOS */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {(isFeatureEnabled('taxExemptions') || isFeatureEnabled('municipalRetention')) && (
                  <TabsContent value="impuestos" className="space-y-4 mt-4">
                    {/* Tipo de Retención Municipal */}
                    {isFeatureEnabled('municipalRetention') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="flex items-center justify-between">
                            Tipo de Retención Municipal
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="municipalRetention"
                                featureName="Retención Municipal"
                                onRemove={handleDisableField}
                              />
                            )}
                          </Label>
                          <Select
                            onValueChange={(value) => setValue('municipalRetentionType', value === 'none' ? undefined : value)}
                            defaultValue={watch('municipalRetentionType') || 'none'}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin definir</SelectItem>
                              <SelectItem value="CONVENIO_MULTILATERAL">Convenio Multilateral</SelectItem>
                              <SelectItem value="LOCAL">Local</SelectItem>
                              <SelectItem value="EXENTO">Exento</SelectItem>
                              <SelectItem value="NO_APLICA">No Aplica</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Exenciones Impositivas */}
                    {isFeatureEnabled('taxExemptions') && (
                    <Collapsible open={taxExemptionsOpen} onOpenChange={setTaxExemptionsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" type="button">
                        <span className="flex items-center gap-2">
                          <Receipt className="w-4 h-4" />
                          Exenciones Impositivas
                          {isEditMode && (
                            <FieldRemoveButton
                              featureId="taxExemptions"
                              featureName="Exenciones Impositivas"
                              onRemove={(featureId, featureName, isImportant) => {
                                handleDisableField(featureId, featureName, isImportant);
                              }}
                            />
                          )}
                        </span>
                        <ChevronDown className={cn("w-4 h-4 transition-transform", taxExemptionsOpen && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-4">
                      {/* Percepción IVA */}
                      <div className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Exento de Percepción de IVA</Label>
                          <Switch
                            checked={isVatPerceptionExempt || false}
                            onCheckedChange={(checked) => {
                              setValue('isVatPerceptionExempt', checked);
                              if (!checked) {
                                setValue('vatPerceptionExemptUntil', undefined);
                                setValue('vatPerceptionExemptCertificate', undefined);
                              }
                            }}
                          />
                        </div>
                        {isVatPerceptionExempt && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Vigente hasta</Label>
                              <DatePicker
                                value={watch('vatPerceptionExemptUntil')}
                                onChange={(date) => setValue('vatPerceptionExemptUntil', date)}
                                placeholder="Sin vencimiento"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Nro. Certificado</Label>
                              <Input
                                {...register('vatPerceptionExemptCertificate')}
                                placeholder="Nro. certificado"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Retención IVA */}
                      <div className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Exento de Retención de IVA</Label>
                          <Switch
                            checked={isVatRetentionExempt || false}
                            onCheckedChange={(checked) => {
                              setValue('isVatRetentionExempt', checked);
                              if (!checked) setValue('vatRetentionExemptUntil', undefined);
                            }}
                          />
                        </div>
                        {isVatRetentionExempt && (
                          <div>
                            <Label className="text-xs">Vigente hasta</Label>
                            <DatePicker
                              value={watch('vatRetentionExemptUntil')}
                              onChange={(date) => setValue('vatRetentionExemptUntil', date)}
                              placeholder="Sin vencimiento"
                            />
                          </div>
                        )}
                      </div>

                      {/* Ingresos Brutos */}
                      <div className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Exento de Ingresos Brutos</Label>
                          <Switch
                            checked={isGrossIncomeExempt || false}
                            onCheckedChange={(checked) => {
                              setValue('isGrossIncomeExempt', checked);
                              if (!checked) setValue('grossIncomeExemptUntil', undefined);
                            }}
                          />
                        </div>
                        {isGrossIncomeExempt && (
                          <div>
                            <Label className="text-xs">Vigente hasta</Label>
                            <DatePicker
                              value={watch('grossIncomeExemptUntil')}
                              onChange={(date) => setValue('grossIncomeExemptUntil', date)}
                              placeholder="Sin vencimiento"
                            />
                          </div>
                        )}
                      </div>

                      {/* Municipal */}
                      <div className="p-3 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Exento de Impuestos Municipales</Label>
                          <Switch
                            checked={isMunicipalExempt || false}
                            onCheckedChange={(checked) => {
                              setValue('isMunicipalExempt', checked);
                              if (!checked) setValue('municipalExemptUntil', undefined);
                            }}
                          />
                        </div>
                        {isMunicipalExempt && (
                          <div>
                            <Label className="text-xs">Vigente hasta</Label>
                            <DatePicker
                              value={watch('municipalExemptUntil')}
                              onChange={(date) => setValue('municipalExemptUntil', date)}
                              placeholder="Sin vencimiento"
                            />
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                    )}
                  </TabsContent>
                )}

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* TAB: ANALYTICS */}
                {/* ═══════════════════════════════════════════════════════════ */}
                {isEditMode && client?.id && (
                  <TabsContent value="analytics" className="mt-4">
                    <ClientAnalyticsTab clientId={client.id} />
                  </TabsContent>
                )}
              </Tabs>
            </form>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" form="client-form" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogs para crear inline */}
      <InlineCreateDialog
        open={createTransportOpen}
        onOpenChange={setCreateTransportOpen}
        title="Empresa de Transporte"
        onSubmit={handleCreateTransport}
        isLoading={isCreatingInline}
      />
      <InlineCreateDialog
        open={createSectorOpen}
        onOpenChange={setCreateSectorOpen}
        title="Rubro/Sector"
        onSubmit={handleCreateSector}
        isLoading={isCreatingInline}
      />

      {/* Dialog de confirmación para campos importantes */}
      <AlertDialog open={confirmDisable?.open || false} onOpenChange={(open) => {
        if (!open) setConfirmDisable(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
              ¿Ocultar campo importante?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Estás a punto de ocultar el campo <strong>{confirmDisable?.featureName}</strong>.
              </p>
              <p className="text-warning-muted-foreground">
                Este campo es considerado importante para la gestión de clientes. ¿Estás seguro de que deseas ocultarlo?
              </p>
              <p className="text-xs text-muted-foreground">
                Podrás volver a habilitarlo desde Ventas → Configuración → Clientes.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (confirmDisable) {
                  await toggleFeature(confirmDisable.featureId, false);
                  setConfirmDisable(null);
                }
              }}
            >
              Sí, ocultar campo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
