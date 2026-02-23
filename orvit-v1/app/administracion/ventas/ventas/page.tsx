'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/use-permissions';
import { formatDate } from '@/lib/date-utils';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Eye, CheckCircle, Truck, DollarSign, XCircle, TrendingUp, Package, Filter } from 'lucide-react';
import { Sale, SALE_STATUS_LABELS } from '@/lib/types/sales';
import { toast } from 'sonner';

export default function SalesPage() {
  const router = useRouter();
  const { hasPermission: canEditSale } = usePermission('EDIT_SALE');
  const { hasPermission: canCancelSale } = usePermission('CANCEL_SALE');

  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadSales();
  }, []);

  useEffect(() => {
    filterSales();
  }, [sales, searchTerm, statusFilter]);

  const loadSales = async () => {
    setLoading(true);
    try {
      // TODO: Implementar API de ventas
      const mockSales: Sale[] = [
        {
          id: '1',
          number: 'VTA-2024-001',
          clientId: '1',
          client: {
            id: '1',
            name: 'Constructora ABC S.A.',
            email: 'contacto@abc.com',
            phone: '+54 11 4123-4567',
            address: 'Av. Corrientes 1234, CABA',
            taxCondition: 'responsable_inscripto',
            discounts: [],
            currentBalance: 0,
            paymentTerms: 30,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          quoteId: '1',
          items: [
            {
              id: '1',
              product: {
                id: '1',
                name: 'Bloque Hormigón 20x20x40',
                code: 'BLQ-001',
                description: 'Bloque de hormigón para construcción',
                categoryId: 1,
                unit: 'unidad',
                costPrice: 250,
                minStock: 100,
                currentStock: 500,
                volume: 0.016,
                weight: 18.5,
                location: 'Depósito A-1',
                blocksPerM2: 25,
                isActive: true,
                images: [],
                files: [],
                companyId: 1,
                createdById: 1,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              quantity: 100,
              unitPrice: 300,
              discount: 0,
              subtotal: 30000
            }
          ],
          subtotal: 30000,
          tax: 0,
          total: 30000,
          paymentMethod: 'efectivo',
          status: 'confirmed',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          number: 'VTA-2024-002',
          clientId: '2',
          client: {
            id: '2',
            name: 'Juan Pérez',
            email: 'juan.perez@gmail.com',
            phone: '+54 11 9876-5432',
            address: 'San Martín 567, La Plata',
            taxCondition: 'consumidor_final',
            discounts: [],
            currentBalance: -25000,
            paymentTerms: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          quoteId: '2',
          items: [
            {
              id: '2',
              product: {
                id: '2',
                name: 'Cemento Portland',
                code: 'CEM-001',
                description: 'Cemento Portland tipo CPN 40',
                categoryId: 2,
                unit: 'bolsa',
                costPrice: 1200,
                minStock: 50,
                currentStock: 25,
                volume: 0.05,
                weight: 50,
                location: 'Depósito B-2',
                isActive: true,
                images: [],
                files: [],
                companyId: 1,
                createdById: 1,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              quantity: 20,
              unitPrice: 1400,
              discount: 0,
              subtotal: 28000
            }
          ],
          subtotal: 28000,
          tax: 0,
          total: 28000,
          paymentMethod: 'transferencia',
          status: 'delivered',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      setSales(mockSales);
    } catch (error) {
      console.error('Error loading sales:', error);
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  const filterSales = () => {
    let filtered = [...sales];

    if (searchTerm) {
      filtered = filtered.filter(sale => 
        sale.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.client.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'paid') {
        filtered = filtered.filter(sale => sale.paidDate !== undefined);
      } else {
        filtered = filtered.filter(sale => sale.status === statusFilter);
      }
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredSales(filtered);
  };

  const handleStatusChange = async (saleId: string, newStatus: string) => {
    try {
      // TODO: Implementar API de actualización de estado
      toast.success('Estado actualizado');
      await loadSales();
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const getStatusBadge = (sale: Sale) => {
    const config = {
      confirmed: { variant: 'default' as const, icon: CheckCircle, color: 'text-success' },
      delivered: { variant: 'secondary' as const, icon: Truck, color: 'text-info-muted-foreground' },
      cancelled: { variant: 'destructive' as const, icon: XCircle, color: 'text-destructive' }
    };
    
    // Si tiene paidDate, mostrar como pagada
    if (sale.paidDate) {
      return (
        <Badge variant="default" className="flex items-center gap-1 text-xs text-success">
          <DollarSign className="w-3 h-3" />
          Pagada
        </Badge>
      );
    }
    
    const statusConfig = config[sale.status as keyof typeof config];
    const Icon = statusConfig?.icon || CheckCircle;

    return (
      <Badge variant={statusConfig?.variant || 'default'} className="flex items-center gap-1 text-xs">
        <Icon className="w-3 h-3" />
        {SALE_STATUS_LABELS[sale.status as keyof typeof SALE_STATUS_LABELS] || sale.status}
      </Badge>
    );
  };

  const getSaleActions = (sale: Sale) => {
    if (!canEditSale) return null;

    if (sale.status === 'confirmed') {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleStatusChange(sale.id, 'delivered')}
        >
          <Truck className="w-4 h-4 mr-1" />
          Marcar Entregada
        </Button>
      );
    }

    if (sale.status === 'delivered' && !sale.paidDate) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleStatusChange(sale.id, 'mark_paid')}
          className="text-success hover:text-success"
        >
          <DollarSign className="w-4 h-4 mr-1" />
          Marcar Pagada
        </Button>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <PermissionGuard permission="VIEW_SALES">
        <div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="VIEW_SALES">
    <div className="space-y-6 p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gestión de Ventas</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Administra el registro de ventas confirmadas
            </p>
          </div>
          <Button 
            onClick={() => router.push('/administracion/ventas/cotizaciones')}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Package className="w-4 h-4 mr-2" />
            Ver Cotizaciones
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="responsive-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Confirmadas</p>
                  <p className="text-2xl font-bold">{sales.filter(s => s.status === 'confirmed').length}</p>
                </div>
                <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card className="responsive-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Entregadas</p>
                  <p className="text-2xl font-bold">{sales.filter(s => s.status === 'delivered').length}</p>
                </div>
                <Truck className="w-6 h-6 md:w-8 md:h-8 text-info-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="responsive-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pagadas</p>
                  <p className="text-2xl font-bold">{sales.filter(s => s.paidDate !== undefined).length}</p>
                </div>
                <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card className="responsive-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Mes</p>
                  <p className="text-xl md:text-2xl font-bold">
                    {formatCurrency(sales.reduce((sum, s) => sum + s.total, 0))}
                  </p>
                </div>
                <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="confirmed">Confirmadas</SelectItem>
                  <SelectItem value="delivered">Entregadas</SelectItem>
                  <SelectItem value="paid">Pagadas (con paidDate)</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-muted-foreground flex items-center">
                {filteredSales.length} venta(s) encontrada(s)
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Cotización</TableHead>
                    <TableHead className="hidden md:table-cell">Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No se encontraron ventas</p>
                          <Button 
                            variant="outline" 
                            onClick={() => router.push('/administracion/ventas/cotizaciones')}
                          >
                            <Package className="w-4 h-4 mr-2" />
                            Ver cotizaciones pendientes
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">{sale.number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sale.client.name}</p>
                            <p className="text-sm text-muted-foreground">{sale.client.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm hidden sm:table-cell">
                          {sale.quoteId ? `COT-${sale.quoteId}` : '-'}
                        </TableCell>
                        <TableCell className="text-sm hidden md:table-cell">
                          {formatDate(sale.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {formatCurrency(sale.total)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(sale)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/administracion/ventas/ventas/${sale.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {getSaleActions(sale)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
} 