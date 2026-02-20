'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductDialog } from './ProductDialog';
import { toast } from 'sonner';
import { 
  Factory, 
  Settings, 
  Search, 
  Filter,
  Edit,
  Trash2,
  Loader2
} from 'lucide-react';

interface Line {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  measureKind: string;
  unitLabel: string;
  costMethod: string;
  active: boolean;
  line: Line;
  variant?: {
    name: string;
  };
  costHistory?: Array<{
    month: string;
    totalPerOutput: number;
  }>;
}

const measureKindLabels = {
  UNIT: 'Unidad',
  LENGTH: 'Longitud',
  AREA: 'Área',
  VOLUME: 'Volumen',
};

const costMethodLabels = {
  BATCH: 'Batch',
  VOLUMETRIC: 'Volumétrico',
  PER_UNIT_BOM: 'BOM por Unidad',
};

const costMethodColors = {
  BATCH: 'bg-info-muted text-info-muted-foreground border-info-muted',
  VOLUMETRIC: 'bg-success-muted text-success border-success-muted',
  PER_UNIT_BOM: 'bg-info-muted text-info-muted-foreground border-info-muted',
};

export function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsResponse, linesResponse] = await Promise.all([
        fetch('/api/costs/products'),
        fetch('/api/costs/lines'),
      ]);

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData);
      }

      if (linesResponse.ok) {
        const linesData = await linesResponse.json();
        setLines(linesData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.line.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (product.variant?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLine = selectedLine === 'all' || product.line.id === selectedLine;
    const matchesMethod = selectedMethod === 'all' || product.costMethod === selectedMethod;
    const matchesActive = showInactive || product.active;

    return matchesSearch && matchesLine && matchesMethod && matchesActive;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  const getLatestCost = (product: Product) => {
    if (!product.costHistory || product.costHistory.length === 0) {
      return null;
    }
    return product.costHistory[0].totalPerOutput;
  };

  if (loading) {
    return (
      <div className="surface-card border-2 border-border/30 rounded-xl p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-lg text-muted-foreground">Cargando productos...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Productos</h3>
          <p className="text-sm text-muted-foreground">
            {filteredProducts.length} de {products.length} productos
          </p>
        </div>
        <ProductDialog onProductCreated={loadData} />
      </div>

      {/* Filters */}
      <div className="surface-card border-2 border-border/30 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-input"
            />
          </div>

          <Select value={selectedLine} onValueChange={setSelectedLine}>
            <SelectTrigger className="bg-background border-input">
              <SelectValue placeholder="Todas las líneas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las líneas</SelectItem>
              {lines.map(line => (
                <SelectItem key={line.id} value={line.id}>
                  {line.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMethod} onValueChange={setSelectedMethod}>
            <SelectTrigger className="bg-background border-input">
              <SelectValue placeholder="Todos los métodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              <SelectItem value="BATCH">Batch</SelectItem>
              <SelectItem value="VOLUMETRIC">Volumétrico</SelectItem>
              <SelectItem value="PER_UNIT_BOM">BOM por Unidad</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="showInactive"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="showInactive" className="text-sm text-foreground">
              Mostrar inactivos
            </label>
          </div>
        </div>
      </div>

      {/* Products table */}
      <div className="surface-card border-2 border-border/30 rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30">
              <TableHead className="text-foreground">Producto</TableHead>
              <TableHead className="text-foreground">Línea</TableHead>
              <TableHead className="text-foreground">Método</TableHead>
              <TableHead className="text-foreground">Medida</TableHead>
              <TableHead className="text-foreground">Costo Actual</TableHead>
              <TableHead className="text-foreground">Estado</TableHead>
              <TableHead className="text-foreground">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Factory className="h-12 w-12 text-muted-foreground" />
                    <div className="text-muted-foreground">
                      {products.length === 0 
                        ? 'No hay productos registrados'
                        : 'No se encontraron productos con los filtros aplicados'
                      }
                    </div>
                    {products.length === 0 && (
                      <ProductDialog onProductCreated={loadData}>
                        <Button variant="outline" className="bg-card text-card-foreground border-border hover:bg-accent/50">
                          <Factory className="h-4 w-4 mr-2" />
                          Crear Primer Producto
                        </Button>
                      </ProductDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const latestCost = getLatestCost(product);
                
                return (
                  <TableRow key={product.id} className="border-border/30">
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">{product.name}</div>
                        {product.variant?.name && (
                          <div className="text-sm text-muted-foreground">
                            Variante: {product.variant.name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {product.line.name}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(costMethodColors[product.costMethod as keyof typeof costMethodColors], 'hover:bg-opacity-80')}>
                        {costMethodLabels[product.costMethod as keyof typeof costMethodLabels]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {measureKindLabels[product.measureKind as keyof typeof measureKindLabels]}
                      <span className="text-muted-foreground ml-1">({product.unitLabel})</span>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {latestCost !== null ? (
                        <span className="font-medium">
                          {formatCurrency(latestCost)}/{product.unitLabel}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin costo</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(product.active ? 'bg-success-muted text-success border-success-muted' : 'bg-muted text-foreground border-border', 'hover:bg-opacity-80')}>
                        {product.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-accent/50"
                          title="Configurar método"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-accent/50"
                          title="Editar producto"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          title="Eliminar producto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
