'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  History, 
  DollarSign, 
  Loader2, 
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  Tag
} from 'lucide-react';

// Schema para agregar precio
const AddPriceSchema = z.object({
  price: z.number().positive('El precio debe ser mayor a 0'),
  effectiveFrom: z.string().optional(),
});

type AddPriceInput = z.infer<typeof AddPriceSchema>;

interface IndirectItem {
  id: string;
  code: string;
  label: string;
  category: string;
  currentPrice?: number;
  _count?: {
    priceHistory?: number;
    monthlyIndirects?: number;
  };
}

interface PriceHistoryEntry {
  id: string;
  price: number;
  effectiveFrom: string;
  changePct?: number;
  createdAt: string;
}

interface IndirectPriceHistoryDialogProps {
  children?: React.ReactNode;
  indirectItem: IndirectItem;
  onPriceUpdated?: () => void;
}

const categoryLabels: Record<string, string> = {
  IMP_SERV: 'Impuestos y Servicios',
  SOCIAL: 'Cargas Sociales',
  VEHICLES: 'Vehículos',
  MKT: 'Marketing',
  UTILITIES: 'Servicios Básicos',
  OTHER: 'Otros',
};

export function IndirectPriceHistoryDialog({ 
  children, 
  indirectItem, 
  onPriceUpdated 
}: IndirectPriceHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);

  const form = useForm<AddPriceInput>({
    resolver: zodResolver(AddPriceSchema),
    defaultValues: {
      price: undefined,
      effectiveFrom: '',
    },
  });

  // Cargar historial cuando se abre el modal
  useEffect(() => {
    if (open) {
      loadPriceHistory();
    }
  }, [open, indirectItem.id]);

  const loadPriceHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await fetch(`/api/indirect-items/${indirectItem.id}/price-history`);
      
      if (response.ok) {
        const data = await response.json();
        setPriceHistory(data.priceHistory || []);
      } else {
        console.error('Error loading price history');
      }
    } catch (error) {
      console.error('Error loading price history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const onSubmit = async (data: AddPriceInput) => {
    try {
      setIsLoading(true);

      const requestData = {
        price: data.price,
        effectiveFrom: data.effectiveFrom || new Date().toISOString(),
      };

      const response = await fetch(`/api/indirect-items/${indirectItem.id}/price-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        toast.success('Precio agregado al historial exitosamente');
        form.reset();
        await loadPriceHistory(); // Recargar historial
        onPriceUpdated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al agregar precio');
      }
    } catch (error) {
      console.error('Error adding price:', error);
      toast.error('Error al agregar precio');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <History className="h-4 w-4 mr-2" />
            Historial de Precios
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <DollarSign className="h-5 w-5" />
            Gestión de Precios - {indirectItem.code}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {indirectItem.label} | {categoryLabels[indirectItem.category] || indirectItem.category}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario para agregar precio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Agregar Nuevo Precio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Precio</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="Ej: 15000.50" 
                            className="bg-background border-input" 
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Precio del servicio en pesos argentinos
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="effectiveFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Fecha Efectiva (Opcional)</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={(date) => field.onChange(date)}
                            placeholder="Seleccionar fecha"
                            className="bg-background border-input"
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Si no se especifica, se usa la fecha actual
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Agregando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Precio
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Historial de precios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Historial de Precios
                {indirectItem.currentPrice && (
                  <Badge variant="outline" className="ml-auto">
                    Actual: {formatCurrency(indirectItem.currentPrice)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Cargando historial...</span>
                </div>
              ) : priceHistory.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {priceHistory.map((entry, index) => (
                    <div 
                      key={entry.id}
                      className={`p-3 rounded-lg border ${
                        index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={index === 0 ? "default" : "secondary"}>
                            {formatCurrency(entry.price)}
                          </Badge>
                          {entry.changePct !== null && entry.changePct !== undefined && (
                            <div className="flex items-center gap-1">
                              {entry.changePct > 0 ? (
                                <TrendingUp className="h-3 w-3 text-green-600" />
                              ) : entry.changePct < 0 ? (
                                <TrendingDown className="h-3 w-3 text-red-600" />
                              ) : null}
                              <span className={`text-xs ${
                                entry.changePct > 0 ? 'text-green-600' : 
                                entry.changePct < 0 ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {entry.changePct > 0 ? '+' : ''}{entry.changePct.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(entry.effectiveFrom)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay historial de precios</p>
                  <p className="text-sm">Agrega el primer precio para comenzar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
