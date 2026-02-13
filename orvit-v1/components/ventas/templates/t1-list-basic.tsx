/**
 * T1 - Basic List Template
 * Simple table with search and basic actions
 * Use this for: Simple data views, readonly lists, basic CRUD
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Search, Plus, MoreVertical, Edit, Trash2, Eye, Package } from 'lucide-react';

interface Product {
  id: number;
  codigo: string;
  nombre: string;
  precio: number;
  stock: number;
  status: 'activo' | 'inactivo';
}

// Mock data
const MOCK_PRODUCTS: Product[] = [
  { id: 1, codigo: 'PRD-001', nombre: 'Tornillo M8', precio: 150, stock: 45, status: 'activo' },
  { id: 2, codigo: 'PRD-002', nombre: 'Tuerca M8', precio: 80, stock: 120, status: 'activo' },
  { id: 3, codigo: 'PRD-003', nombre: 'Arandela', precio: 30, stock: 8, status: 'activo' },
  { id: 4, codigo: 'PRD-004', nombre: 'Perno M10', precio: 200, stock: 0, status: 'inactivo' },
];

export function T1ListBasic() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [loading, setLoading] = useState(false);

  // Simple search filter
  const filteredProducts = products.filter(product =>
    product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    alert('Abrir modal de creación');
  };

  const handleEdit = (id: number) => {
    alert(`Editar producto ${id}`);
  };

  const handleDelete = (id: number) => {
    if (confirm('¿Eliminar este producto?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleView = (id: number) => {
    alert(`Ver detalles de producto ${id}`);
  };

  if (loading) {
    return <LoadingState message="Cargando productos..." />;
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Package className="w-5 h-5" />
            Productos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona el catálogo de productos
          </p>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Productos ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No se encontraron productos"
              description={searchTerm ? 'Intenta con otros términos de búsqueda' : 'Crea tu primer producto para comenzar'}
              action={!searchTerm ? {
                label: 'Crear Producto',
                onClick: handleCreate,
                icon: Plus,
              } : undefined}
              secondaryAction={searchTerm ? {
                label: 'Limpiar búsqueda',
                onClick: () => setSearchTerm(''),
              } : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">
                      {product.codigo}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.nombre}
                    </TableCell>
                    <TableCell className="text-right">
                      ${product.precio.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={product.stock === 0 ? 'destructive' : product.stock < 10 ? 'secondary' : 'outline'}>
                        {product.stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={product.status === 'activo' ? 'default' : 'secondary'}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(product.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(product.id)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
