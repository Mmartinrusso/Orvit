'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Search, X, Check, Layers } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { BundleBuilderDialog, BundleResult } from '@/components/ventas/bundle-builder-dialog';

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  salePrice?: number;
}

interface Client {
  id: string;
  legalName: string;
  name?: string;
}

interface QuoteItem {
  productId: string | null;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  isBundle?: boolean;
  costBreakdown?: { concepto: string; monto: number }[];
}

interface QuoteQuickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuoteCreated?: () => void;
}

export function QuoteQuickModal({ open, onOpenChange, onQuoteCreated }: QuoteQuickModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);

  // Estado para el input de producto actual
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);

  // Refs para control de foco
  const productInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Cargar clientes y productos al abrir
  useEffect(() => {
    if (open) {
      loadClients();
      loadProducts();
      resetForm();
    }
  }, [open]);

  const loadClients = async () => {
    try {
      const res = await fetch('/api/ventas/clientes');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/ventas/productos?active=true');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setItems([]);
    setProductSearch('');
    setSelectedProduct(null);
    setQuantity('1');
  };

  // Filtrar productos por búsqueda (código o nombre)
  const filteredProducts = products.filter(p => {
    const search = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(search) ||
      (p.sku && p.sku.toLowerCase().includes(search))
    );
  });

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductSearch(`${product.sku || ''} - ${product.name}`);
    setShowProductSearch(false);
    // Focus en cantidad
    setTimeout(() => quantityInputRef.current?.focus(), 100);
  };

  const handleQuantityKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  const addItem = () => {
    if (!selectedProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    const qty = parseFloat(quantity) || 1;
    if (qty <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    const newItem: QuoteItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      quantity: qty,
      unitPrice: selectedProduct.salePrice || 0,
      unit: selectedProduct.unit
    };

    setItems([...items, newItem]);

    // Reset para siguiente producto
    setProductSearch('');
    setSelectedProduct(null);
    setQuantity('1');

    // Focus en búsqueda de producto
    setTimeout(() => productInputRef.current?.focus(), 100);
  };

  const handleBundleAdd = (result: BundleResult) => {
    const newItem: QuoteItem = {
      productId: null,
      productName: result.descripcion,
      quantity: 1,
      unitPrice: result.precioUnitario,
      unit: 'UN',
      isBundle: true,
      costBreakdown: result.costBreakdown,
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleSubmit = async () => {
    if (!selectedClient) {
      toast.error('Selecciona un cliente');
      return;
    }

    if (items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/ventas/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          description: `Cotización para ${selectedClient.legalName || selectedClient.name}`,
          items: items.map(item => ({
            productId: item.productId,
            descripcion: item.productName,
            cantidad: item.quantity,
            precioUnitario: item.unitPrice,
            descuento: 0,
            ...(item.costBreakdown?.length ? { costBreakdown: item.costBreakdown } : {}),
          })),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paymentTerms: 0,
        })
      });

      if (res.ok) {
        toast.success('Cotización creada exitosamente');
        onQuoteCreated?.();
        onOpenChange(false);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al crear cotización');
      }
    } catch (error) {
      console.error('Error creating quote:', error);
      toast.error('Error al crear cotización');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nueva Cotización Rápida</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Selección de Cliente */}
          <div>
            <Label>Cliente</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedClient ? selectedClient.legalName || selectedClient.name : "Seleccionar cliente..."}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>No se encontraron clientes</CommandEmpty>
                    <CommandGroup>
                      {clients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.legalName || client.name}
                          onSelect={() => {
                            setSelectedClient(client);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedClient?.id === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {client.legalName || client.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Input Rápido de Productos */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="grid grid-cols-12 gap-3 mb-3">
              <div className="col-span-7">
                <Label>Producto (Código o Nombre)</Label>
                <Popover open={showProductSearch} onOpenChange={setShowProductSearch}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Input
                        ref={productInputRef}
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setShowProductSearch(true);
                        }}
                        onFocus={() => setShowProductSearch(true)}
                        placeholder="Escribe código o nombre..."
                        className="pr-8"
                      />
                      {productSearch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => {
                            setProductSearch('');
                            setSelectedProduct(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandList>
                        <CommandEmpty>No se encontraron productos</CommandEmpty>
                        <CommandGroup>
                          {filteredProducts.slice(0, 10).map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name}
                              onSelect={() => handleProductSelect(product)}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {product.sku} | ${product.salePrice != null ? formatNumber(product.salePrice, 2) : '0.00'}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="col-span-3">
                <Label>Cantidad</Label>
                <Input
                  ref={quantityInputRef}
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyDown={handleQuantityKeyDown}
                  min="0.01"
                  step="0.01"
                />
              </div>

              <div className="col-span-2 flex items-end">
                <Button onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                💡 Tip: Escribe el código o nombre, selecciona el producto, ingresa cantidad y presiona Enter
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setBundleDialogOpen(true)}
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                Combinar productos
              </Button>
            </div>
          </div>

          {/* Lista de Items */}
          {items.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 text-sm font-medium">Producto</th>
                    <th className="text-right p-2 text-sm font-medium">Cantidad</th>
                    <th className="text-right p-2 text-sm font-medium">Precio Unit.</th>
                    <th className="text-right p-2 text-sm font-medium">Subtotal</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm flex items-center gap-1.5">
                            {item.isBundle && (
                              <Layers className="w-3 h-3 text-primary shrink-0" />
                            )}
                            {item.productName}
                          </span>
                          {item.sku && (
                            <span className="text-xs text-muted-foreground">{item.sku}</span>
                          )}
                          {item.isBundle && item.costBreakdown && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.costBreakdown.map((cb, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                                >
                                  {cb.concepto}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="text-right p-2">{item.quantity} {item.unit}</td>
                      <td className="text-right p-2">${formatNumber(item.unitPrice, 2)}</td>
                      <td className="text-right p-2 font-medium">
                        ${formatNumber(item.quantity * item.unitPrice, 2)}
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted font-bold">
                  <tr>
                    <td colSpan={3} className="text-right p-2">TOTAL:</td>
                    <td className="text-right p-2">${formatNumber(calculateTotal(), 2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !selectedClient || items.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Cotización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <BundleBuilderDialog
      open={bundleDialogOpen}
      onOpenChange={setBundleDialogOpen}
      products={products}
      onAdd={handleBundleAdd}
    />
    </>
  );
}
