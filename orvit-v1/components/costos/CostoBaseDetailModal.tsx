'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, FileText, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { CostoBaseTrendChart } from './CostoBaseTrendChart';

interface CostoBase {
  id: string;
  name: string;
  description: string;
  categoryName: string;
  categoryType: string;
  createdAt: string;
}

interface MonthlyRecord {
  id: string;
  month: string;
  amount: number;
  status: 'paid' | 'pending';
  notes?: string;
  createdAt: string;
}

interface CostoBaseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  costo: CostoBase | null;
  monthlyRecords: MonthlyRecord[];
}

export function CostoBaseDetailModal({ 
  isOpen, 
  onClose, 
  costo, 
  monthlyRecords 
}: CostoBaseDetailModalProps) {
  if (!costo) return null;

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

  // Para estadísticas: usar TODOS los registros, no solo uno por mes
  const paidRecords = monthlyRecords.filter(r => r.status === 'paid').length;
  const pendingRecords = monthlyRecords.filter(r => r.status === 'pending').length;
  
  // Contar meses únicos para mostrar en estadísticas
  const uniqueMonths = new Set(monthlyRecords.map(r => r.month)).size;
  
  // Convertir amounts a números para cálculos correctos
  const numericAmounts = monthlyRecords.map(r => Number(r.amount));
  const maxAmount = numericAmounts.length > 0 ? Math.max(...numericAmounts) : 0;
  const minAmount = numericAmounts.length > 0 ? Math.min(...numericAmounts) : 0;
  
  // Calcular el promedio mensual correctamente - promedio de los montos de los últimos registros
  const averageAmount = numericAmounts.length > 0 
    ? numericAmounts.reduce((sum, amount) => sum + amount, 0) / numericAmounts.length 
    : 0;
    

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-6 w-6 text-info-muted-foreground" />
              Detalles de {costo.name}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Información General</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Descripción:</span>
                    <span className="text-sm">{costo.description || 'Sin descripción'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Categoría:</span>
                    <Badge variant="secondary">{costo.categoryName}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Tipo:</span>
                    <Badge variant="outline">{costo.categoryType}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Creado:</span>
                    <span className="text-sm">{formatDate(costo.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-2">Estadísticas</h3>
              <div className="grid grid-cols-4 gap-3">
                            <div className="text-center p-3 bg-info-muted rounded-lg">
                              <p className="text-xl font-bold text-info-muted-foreground">{uniqueMonths}</p>
                              <p className="text-xs text-muted-foreground">Meses</p>
                            </div>
                <div className="text-center p-3 bg-info-muted rounded-lg">
                  <p className="text-xl font-bold text-info-muted-foreground">{formatCurrency(averageAmount)}</p>
                  <p className="text-xs text-muted-foreground">Promedio</p>
                </div>
                <div className="text-center p-3 bg-success-muted rounded-lg">
                  <p className="text-xl font-bold text-success">{formatCurrency(maxAmount)}</p>
                  <p className="text-xs text-muted-foreground">Máximo</p>
                </div>
                <div className="text-center p-3 bg-warning-muted rounded-lg">
                  <p className="text-xl font-bold text-warning-muted-foreground">{formatCurrency(minAmount)}</p>
                  <p className="text-xs text-muted-foreground">Mínimo</p>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos de Tendencia */}
          <CostoBaseTrendChart
            costoName={costo.name}
            monthlyRecords={monthlyRecords}
          />
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
