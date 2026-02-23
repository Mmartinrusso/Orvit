'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Product, QuoteItem } from '@/lib/types/sales';
import { toast } from 'sonner';

interface QuickProductInputProps {
  onAddItem: (item: QuoteItem) => void;
  products?: Product[];
}

export function QuickProductInput({ onAddItem, products = [] }: QuickProductInputProps) {
  const [code, setCode] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [marginPercentage, setMarginPercentage] = useState<number>(25);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const codeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const marginInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (code.length >= 2) {
      findProduct(code);
    } else {
      setFoundProduct(null);
    }
  }, [code]);

  const findProduct = async (searchCode: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/products/search?code=${encodeURIComponent(searchCode)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setFoundProduct(null);
          return;
        }
        throw new Error('Error al buscar producto');
      }

      const product = await response.json();
      setFoundProduct(product);
    } catch (error) {
      console.error('Error searching product:', error);
      setFoundProduct(null);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePrice = (costPrice: number, margin: number) => {
    // Aplicar margen y luego el 10.5% siempre incluido
    const priceWithMargin = costPrice * (1 + margin / 100);
    return priceWithMargin * 1.105; // Siempre incluir 10.5%
  };

  const addProduct = () => {
    if (!foundProduct) {
      toast.error('Producto no encontrado');
      return;
    }

    if (quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    if (quantity > foundProduct.currentStock) {
      toast.error(`Stock insuficiente. Disponible: ${foundProduct.currentStock}`);
      return;
    }

    const unitPrice = calculatePrice(foundProduct.costPrice, marginPercentage);
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substr(2, 9),
      product: foundProduct,
      quantity,
      unitPrice,
      discount: 0,
      subtotal: unitPrice * quantity
    };

    onAddItem(newItem);
    
    // Reset form
    setCode('');
    setQuantity(1);
    setFoundProduct(null);
    
    // Focus back to code input
    setTimeout(() => codeInputRef.current?.focus(), 100);
    
    toast.success('Producto agregado correctamente');
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: 'code' | 'quantity' | 'margin') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (e.ctrlKey && foundProduct) {
        // Ctrl+Enter: agregar producto rápidamente
        addProduct();
      } else {
        // Enter: navegar al siguiente campo
        switch (field) {
          case 'code':
            quantityInputRef.current?.focus();
            quantityInputRef.current?.select();
            break;
          case 'quantity':
            marginInputRef.current?.focus();
            marginInputRef.current?.select();
            break;
          case 'margin':
            if (foundProduct) {
              addProduct();
            } else {
              codeInputRef.current?.focus();
            }
            break;
        }
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Campo Código */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Código de Producto
              </label>
              <Input
                ref={codeInputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'code')}
                placeholder="Ingresa código..."
                className="font-mono"
              />
            </div>

            {/* Campo Cantidad */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Cantidad
              </label>
              <Input
                ref={quantityInputRef}
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                onKeyDown={(e) => handleKeyDown(e, 'quantity')}
                placeholder="1"
              />
            </div>

            {/* Campo Margen */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Margen (%)
              </label>
              <Input
                ref={marginInputRef}
                type="number"
                min="0"
                step="0.1"
                value={marginPercentage}
                onChange={(e) => setMarginPercentage(parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => handleKeyDown(e, 'margin')}
                placeholder="25"
              />
            </div>

            {/* Botón Agregar */}
            <div className="flex items-end">
              <Button 
                onClick={addProduct}
                disabled={!foundProduct || quantity <= 0 || isLoading}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Buscando producto...</span>
              </div>
            </div>
          )}

          {/* Product found preview */}
          {foundProduct && !isLoading && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{foundProduct.name}</h4>
                    <Badge variant="outline">{foundProduct.code}</Badge>
                    {quantity > foundProduct.currentStock && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Sin stock
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Stock: {foundProduct.currentStock} {foundProduct.unit}
                    {foundProduct.blocksPerM2 && (
                      <span className="text-info-muted-foreground ml-2">
                        • {foundProduct.blocksPerM2} bloques/m²
                      </span>
                    )}
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Costo:</span>
                      <p className="font-medium">{formatCurrency(foundProduct.costPrice)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Precio c/margen:</span>
                      <p className="font-medium text-success">
                        {formatCurrency(calculatePrice(foundProduct.costPrice, marginPercentage))}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cantidad:</span>
                      <p className="font-medium">{quantity} {foundProduct.unit}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Subtotal:</span>
                      <p className="font-medium text-primary">
                        {formatCurrency(calculatePrice(foundProduct.costPrice, marginPercentage) * quantity)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No product found */}
          {code.length >= 2 && !foundProduct && !isLoading && (
            <div className="border rounded-lg p-3 bg-destructive/5 border-destructive/20">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">Producto no encontrado: &quot;{code}&quot;</span>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            💡 Tip: Usa Enter para navegar entre campos o Ctrl+Enter para agregar rápidamente
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 