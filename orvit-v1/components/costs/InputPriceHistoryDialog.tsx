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
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { History, TrendingUp, Plus, Loader2, Calendar, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const UpdatePriceSchema = z.object({
  effectiveFrom: z.string().min(1, 'Fecha requerida'),
  price: z.number().positive('Precio debe ser positivo'),
});

type UpdatePriceInput = z.infer<typeof UpdatePriceSchema>;

interface PriceHistory {
  id: string;
  effectiveFrom: string;
  price: number;
  isCurrent: boolean;
  createdAt: string;
}

interface InputPriceHistoryDialogProps {
  inputId: string;
  inputName: string;
  currentPrice: number;
  unitLabel: string;
  children?: React.ReactNode;
  onPriceUpdated?: () => void;
}

export function InputPriceHistoryDialog({
  inputId,
  inputName,
  currentPrice,
  unitLabel,
  children,
  onPriceUpdated
}: InputPriceHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [showAddPrice, setShowAddPrice] = useState(false);

  const form = useForm<UpdatePriceInput>({
    resolver: zodResolver(UpdatePriceSchema),
    defaultValues: {
      effectiveFrom: new Date().toISOString().split('T')[0],
      price: currentPrice,
    },
  });

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const response = await fetch(`/api/inputs/${inputId}/history`);
      
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        toast.error('Error al cargar historial de precios');
      }
    } catch (error) {
      console.error('Error fetching price history:', error);
      toast.error('Error al cargar historial de precios');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, inputId]);

  const onSubmit = async (data: UpdatePriceInput) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/inputs/${inputId}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          effectiveFrom: new Date(data.effectiveFrom).toISOString(),
          price: data.price,
        }),
      });

      if (response.ok) {
        toast.success('Precio actualizado exitosamente');
        setShowAddPrice(false);
        form.reset({
          effectiveFrom: new Date().toISOString().split('T')[0],
          price: data.price,
        });
        await fetchHistory();
        onPriceUpdated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al actualizar precio');
      }
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error('Error al actualizar precio');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  };

  const calculateChange = (currentPrice: number, previousPrice: number) => {
    const change = ((currentPrice - previousPrice) / previousPrice) * 100;
    return change;
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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Historial de Precios - {inputName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Gestione el historial de precios del insumo y agregue nuevos valores con fecha efectiva.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Current Price Summary */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-foreground mb-1">Precio Actual</h4>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(currentPrice)} / {unitLabel}
                </div>
              </div>
              <Button
                onClick={() => setShowAddPrice(!showAddPrice)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Actualizar Precio
              </Button>
            </div>
          </div>

          {/* Add New Price Form */}
          {showAddPrice && (
            <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
              <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Nuevo Precio
              </h4>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="effectiveFrom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Fecha Efectiva</FormLabel>
                          <FormControl>
                            <DatePicker
                              value={field.value}
                              onChange={(date) => field.onChange(date)}
                              placeholder="Seleccionar fecha"
                              className="bg-background border-input"
                            />
                          </FormControl>
                          <FormDescription className="text-muted-foreground">
                            Fecha desde la cual aplica el nuevo precio
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground">Nuevo Precio</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className="bg-background border-input" 
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription className="text-muted-foreground">
                            Precio por {unitLabel}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Price change preview */}
                  {form.watch('price') !== currentPrice && form.watch('price') > 0 && (
                    <div className="p-3 bg-muted/5 rounded border border-border/20">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Cambio:</span>
                        <span className={`font-medium ${
                          form.watch('price') > currentPrice ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {form.watch('price') > currentPrice ? '+' : ''}
                          {calculateChange(form.watch('price'), currentPrice).toFixed(2)}%
                        </span>
                        <span className="text-muted-foreground">
                          ({formatCurrency(form.watch('price') - currentPrice)})
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowAddPrice(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Actualizar Precio
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          <Separator />

          {/* Price History */}
          <div>
            <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Historial de Cambios
            </h4>

            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Cargando historial...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay historial de precios disponible</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((record, index) => {
                  const previousPrice = index < history.length - 1 ? history[index + 1].price : null;
                  const change = previousPrice ? calculateChange(record.price, previousPrice) : null;

                  return (
                    <div
                      key={record.id}
                      className={`p-4 rounded-lg border ${
                        record.isCurrent
                          ? 'bg-primary/5 border-primary/20'
                          : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-foreground">
                                {formatCurrency(record.price)} / {unitLabel}
                              </span>
                              {record.isCurrent && (
                                <Badge variant="default" className="text-xs">
                                  Actual
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Efectivo desde: {formatDate(record.effectiveFrom)}
                            </div>
                          </div>
                        </div>
                        
                        {change !== null && (
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              change >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              vs anterior
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
