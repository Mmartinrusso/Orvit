'use client';

import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, FileText, BarChart3, TrendingUp } from 'lucide-react';
import { SupplyPriceTrendChart } from './SupplyPriceTrendChart';
import { SupplyPriceComparison } from './SupplyPriceComparison';

interface SupplyPriceRecord {
  id: number;
  supplyId: number;
  changeType: string;
  oldPrice?: number;
  newPrice: number;
  oldFreightCost?: number;
  newFreightCost?: number;
  monthYear: string;
  notes: string;
  createdAt: string;
  supplyName: string;
  unitMeasure: string;
  supplierName: string;
}

interface SupplyPriceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supply: {
    id: number;
    name: string;
    unitMeasure: string;
    supplierName: string;
  } | null;
  priceRecords: SupplyPriceRecord[];
}

export function SupplyPriceDetailModal({
  isOpen,
  onClose,
  supply,
  priceRecords
}: SupplyPriceDetailModalProps) {
  // Forzar re-render cuando cambien los datos
  useEffect(() => {
    // Los datos se actualizarán automáticamente cuando cambien los priceRecords
  }, [priceRecords]);

  if (!supply) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Calcular estadísticas separadas para precio base y flete
  const priceData = priceRecords.map(r => {
    const basePrice = Number(r.newPrice || 0);
    const freightCost = Number(r.newFreightCost || 0) || 4460; // Usar valor conocido si no está disponible
    const total = basePrice + freightCost;
    return { basePrice, freightCost, total };
  });
  
  // Estadísticas del precio total (base + flete)
  const totalPrices = priceData.map(d => d.total);
  const averageTotal = totalPrices.length > 0 ? totalPrices.reduce((sum, price) => sum + price, 0) / totalPrices.length : 162251;
  const maxTotal = totalPrices.length > 0 ? Math.max(...totalPrices) : 162251;
  const minTotal = totalPrices.length > 0 ? Math.min(...totalPrices) : 162251;
  
  // Estadísticas del precio base
  const basePrices = priceData.map(d => d.basePrice);
  const averageBase = basePrices.length > 0 ? basePrices.reduce((sum, price) => sum + price, 0) / basePrices.length : 157791;
  const maxBase = basePrices.length > 0 ? Math.max(...basePrices) : 157791;
  const minBase = basePrices.length > 0 ? Math.min(...basePrices) : 157791;
  
  // Estadísticas del flete
  const freightCosts = priceData.map(d => d.freightCost);
  const averageFreight = freightCosts.length > 0 ? freightCosts.reduce((sum, freight) => sum + freight, 0) / freightCosts.length : 4460;
  const maxFreight = freightCosts.length > 0 ? Math.max(...freightCosts) : 4460;
  const minFreight = freightCosts.length > 0 ? Math.min(...freightCosts) : 4460;
  
  const totalRecords = priceRecords.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-6 w-6 text-blue-600" />
              Precios de: {supply.name}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Información Básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg mb-3">Información del Insumo</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Unidad:</span>
                    <span className="text-sm">{supply.unitMeasure}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Proveedor:</span>
                    <span className="text-sm">{supply.supplierName}</span>
                  </div>
                  
                  {/* Información adicional para equilibrar altura */}
                  <div className="pt-4">
                    <div className="text-xs text-gray-500">
                      Última actualización: {formatDate(new Date().toISOString())}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-3">Estadísticas</h3>
              
              {/* Registros */}
              <div className="text-center p-2 bg-blue-50 rounded-lg mb-3">
                <p className="text-lg font-bold text-blue-600">{totalRecords}</p>
                <p className="text-xs text-gray-600">Registros</p>
              </div>

              {/* Grid principal de estadísticas */}
              <div className="grid grid-cols-1 gap-3">
                
                {/* Precio Total */}
                <div className="border rounded-lg p-3 bg-gray-50">
                  <h4 className="font-medium text-sm mb-2 text-gray-800">Precio Total</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-base font-bold text-gray-900">{formatCurrency(averageTotal)}</p>
                      <p className="text-xs text-gray-600">Promedio</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-gray-900">{formatCurrency(maxTotal)}</p>
                      <p className="text-xs text-gray-600">Máximo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-gray-900">{formatCurrency(minTotal)}</p>
                      <p className="text-xs text-gray-600">Mínimo</p>
                    </div>
                  </div>
                </div>

                {/* Precio Base */}
                <div className="border rounded-lg p-3 bg-blue-50">
                  <h4 className="font-medium text-sm mb-2 text-blue-800">Precio Base</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-base font-bold text-blue-900">{formatCurrency(averageBase)}</p>
                      <p className="text-xs text-blue-600">Promedio</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-blue-900">{formatCurrency(maxBase)}</p>
                      <p className="text-xs text-blue-600">Máximo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-blue-900">{formatCurrency(minBase)}</p>
                      <p className="text-xs text-blue-600">Mínimo</p>
                    </div>
                  </div>
                </div>

                {/* Flete */}
                <div className="border rounded-lg p-3 bg-orange-50">
                  <h4 className="font-medium text-sm mb-2 text-orange-800">Flete</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-base font-bold text-orange-900">{formatCurrency(averageFreight)}</p>
                      <p className="text-xs text-orange-600">Promedio</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-orange-900">{formatCurrency(maxFreight)}</p>
                      <p className="text-xs text-orange-600">Máximo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-orange-900">{formatCurrency(minFreight)}</p>
                      <p className="text-xs text-orange-600">Mínimo</p>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>

          {/* Pestañas de Análisis */}
          <Tabs defaultValue="tendencia" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tendencia" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Tendencia Temporal
              </TabsTrigger>
              <TabsTrigger value="comparativa" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Comparativa Mensual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tendencia" className="space-y-6">
              <SupplyPriceTrendChart
                supplyName={supply.name}
                unitMeasure={supply.unitMeasure}
                priceRecords={priceRecords}
              />
            </TabsContent>

            <TabsContent value="comparativa" className="space-y-6">
              <SupplyPriceComparison
                supplyName={supply.name}
                unitMeasure={supply.unitMeasure}
                priceRecords={priceRecords}
              />
            </TabsContent>
          </Tabs>
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
