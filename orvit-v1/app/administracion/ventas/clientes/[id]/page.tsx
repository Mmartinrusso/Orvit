'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { usePermission } from '@/hooks/use-permissions';
import { formatDate } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, User, Mail, Phone, MapPin, CreditCard, Calendar, Plus, FileText, Info, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Client, TAX_CONDITION_LABELS } from '@/lib/types/sales';
import { toast } from 'sonner';
import { CurrentAccountStatement } from '@/components/ventas/current-account-statement';

interface Factura {
  id: string;
  numero: string;
  fecha: Date;
  tipo: 'A' | 'B' | 'C';
  total: number;
  saldo: number;
  estado: 'pagada' | 'pendiente' | 'parcial' | 'vencida';
  vencimiento?: Date;
}

interface Pago {
  id: string;
  fecha: Date;
  monto: number;
  metodo: string;
  facturaId: string;
  facturaNumero: string;
  observaciones?: string;
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission: canAssignPriceLists } = usePermission('ventas.listas_precios.assign');
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);

  useEffect(() => {
    if (params.id) {
      loadClientData(params.id as string);
      loadFacturasAndPagos(params.id as string);
    }
  }, [params.id]);

  const loadFacturasAndPagos = async (clientId: string) => {
    // TODO: Reemplazar con llamada real a la API
    // Por ahora, datos mock
    const mockFacturas: Factura[] = [
      {
        id: '1',
        numero: '0001-00001234',
        fecha: new Date('2024-01-15'),
        tipo: 'A',
        total: 50000,
        saldo: 50000,
        estado: 'pendiente',
        vencimiento: new Date('2024-02-15')
      },
      {
        id: '2',
        numero: '0001-00001235',
        fecha: new Date('2024-01-20'),
        tipo: 'A',
        total: 75000,
        saldo: 0,
        estado: 'pagada',
        vencimiento: new Date('2024-02-20')
      },
      {
        id: '3',
        numero: '0001-00001236',
        fecha: new Date('2024-02-01'),
        tipo: 'A',
        total: 100000,
        saldo: 25000,
        estado: 'parcial',
        vencimiento: new Date('2024-03-01')
      }
    ];

    const mockPagos: Pago[] = [
      {
        id: '1',
        fecha: new Date('2024-02-20'),
        monto: 75000,
        metodo: 'Transferencia',
        facturaId: '2',
        facturaNumero: '0001-00001235',
        observaciones: 'Pago completo'
      },
      {
        id: '2',
        fecha: new Date('2024-02-15'),
        monto: 75000,
        metodo: 'Cheque',
        facturaId: '3',
        facturaNumero: '0001-00001236',
        observaciones: 'Pago parcial'
      }
    ];

    setFacturas(mockFacturas);
    setPagos(mockPagos);
  };

  const loadClientData = async (clientId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        // Transformar datos de la API al formato Client
        const clientData: Client = {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          cuit: data.cuit || undefined,
          taxCondition: data.taxCondition || 'consumidor_final',
          discounts: (data.discounts || []).map((d: any) => ({
            id: d.id,
            clientId: d.clientId,
            name: d.name,
            percentage: d.percentage || undefined,
            amount: d.amount || undefined,
            categoryId: d.categoryId || undefined,
            productId: d.productId || undefined,
            minQuantity: d.minQuantity || undefined,
            isActive: d.isActive,
            validFrom: d.validFrom ? new Date(d.validFrom) : undefined,
            validUntil: d.validUntil ? new Date(d.validUntil) : undefined,
            notes: d.notes || undefined,
            createdAt: new Date(d.createdAt),
            updatedAt: new Date(d.updatedAt),
          })),
          priceLists: (data.priceLists || []).map((pl: any) => ({
            id: pl.id,
            clientId: pl.clientId,
            priceListId: pl.priceListId,
            priceListName: pl.priceListName,
            isDefault: pl.isDefault,
            isActive: pl.isActive,
            createdAt: new Date(pl.createdAt),
            updatedAt: new Date(pl.updatedAt),
          })),
          creditLimit: data.creditLimit || undefined,
          currentBalance: data.currentBalance || 0,
          paymentTerms: data.paymentTerms || 0,
          isActive: data.isActive !== undefined ? data.isActive : true,
          observations: data.observations || undefined,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        };
        setClient(clientData);
      } else {
        toast.error('Error al cargar datos del cliente');
      }
    } catch (error) {
      console.error('Error loading client data:', error);
      toast.error('Error al cargar datos del cliente');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  // formatDate imported from @/lib/date-utils

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'pagada': 'default',
      'pendiente': 'outline',
      'parcial': 'secondary',
      'vencida': 'destructive'
    };
    
    const labels: Record<string, string> = {
      'pagada': 'Pagada',
      'pendiente': 'Pendiente',
      'parcial': 'Parcial',
      'vencida': 'Vencida'
    };

    return (
      <Badge variant={variants[estado] || 'outline'}>
        {labels[estado] || estado}
      </Badge>
    );
  };

  const saldoTotal = facturas.reduce((sum, f) => sum + f.saldo, 0);
  const totalFacturado = facturas.reduce((sum, f) => sum + f.total, 0);
  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
  const facturasPendientes = facturas.filter(f => f.saldo > 0).length;

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Cliente no encontrado</h2>
          <p className="text-muted-foreground mb-4">El cliente solicitado no existe o no tienes permisos para verlo.</p>
          <Button onClick={() => router.push('/administracion/ventas/clientes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Clientes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="ventas.clientes.view">
      <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/administracion/ventas/clientes')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{client.name}</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Detalle del cliente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button>
              Nueva Cotización
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">
              <Info className="w-4 h-4 mr-2" />
              Información General
            </TabsTrigger>
            <TabsTrigger value="cuentas">
              <CreditCard className="w-4 h-4 mr-2" />
              Cuentas Corrientes
            </TabsTrigger>
          </TabsList>

          {/* Tab: Información General */}
          <TabsContent value="general" className="space-y-6 mt-6">
            {/* Client Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{client.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Teléfono</p>
                        <p className="font-medium">{client.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Dirección</p>
                        <p className="font-medium">{client.address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Condición Fiscal</p>
                      <Badge variant="outline" className="mt-1">
                        {TAX_CONDITION_LABELS[client.taxCondition]}
                      </Badge>
                    </div>

                    {client.cuit && (
                      <div>
                        <p className="text-sm text-muted-foreground">CUIT</p>
                        <p className="font-medium font-mono">{client.cuit}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-muted-foreground">Estado</p>
                      <Badge variant={client.isActive ? 'default' : 'secondary'} className="mt-1">
                        {client.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {client.observations && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Observaciones</p>
                    <p className="text-sm bg-muted p-3 rounded-md">{client.observations}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Financial Info */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Información Financiera
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Actual</p>
                  <p className={`text-lg font-bold ${
                    client.currentBalance === 0 ? 'text-muted-foreground' : 
                    client.currentBalance > 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {client.currentBalance === 0 ? 'Sin saldo' : formatCurrency(client.currentBalance)}
                  </p>
                </div>

                {client.creditLimit && (
                  <div>
                    <p className="text-sm text-muted-foreground">Límite de Crédito</p>
                    <p className="text-lg font-bold">{formatCurrency(client.creditLimit)}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Plazo de Pago</p>
                  <p className="font-medium">{client.paymentTerms} días</p>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente desde</p>
                    <p className="text-sm font-medium">
                      {formatDate(client.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Descuentos y Listas de Precios */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Descuentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Descuentos</span>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.discounts && client.discounts.length > 0 ? (
                <div className="space-y-3">
                  {client.discounts.map((discount) => (
                    <div key={discount.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{discount.name}</p>
                          {discount.percentage && (
                            <p className="text-sm text-muted-foreground">
                              {discount.percentage}% de descuento
                            </p>
                          )}
                          {discount.amount && (
                            <p className="text-sm text-muted-foreground">
                              ${formatNumber(discount.amount, 2)} de descuento
                            </p>
                          )}
                          {discount.minQuantity && (
                            <p className="text-xs text-muted-foreground">
                              Cantidad mínima: {discount.minQuantity}
                            </p>
                          )}
                          {discount.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{discount.notes}</p>
                          )}
                        </div>
                        <Badge variant={discount.isActive ? 'default' : 'secondary'}>
                          {discount.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No hay descuentos configurados para este cliente
                </p>
              )}
            </CardContent>
          </Card>

          {/* Listas de Precios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Listas de Precios</span>
                {canAssignPriceLists && (
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.priceLists && client.priceLists.length > 0 ? (
                <div className="space-y-3">
                  {client.priceLists.map((priceList) => (
                    <div key={priceList.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{priceList.priceListName}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {priceList.priceListId}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {priceList.isDefault && (
                            <Badge variant="default">Por Defecto</Badge>
                          )}
                          <Badge variant={priceList.isActive ? 'default' : 'secondary'}>
                            {priceList.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No hay listas de precios asignadas a este cliente
                </p>
              )}
            </CardContent>
          </Card>
        </div>

            {/* TODO: Agregar pestañas para cotizaciones, ventas, etc. */}
            <Card>
              <CardHeader>
                <CardTitle>Historial de Actividad</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  El historial de cotizaciones y ventas estará disponible próximamente
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Cuentas Corrientes */}
          <TabsContent value="cuentas" className="space-y-6 mt-6">
            <CurrentAccountStatement clientId={client.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
} 