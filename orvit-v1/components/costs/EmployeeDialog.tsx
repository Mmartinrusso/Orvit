'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateEmployeeSchema, type CreateEmployeeInput } from '@/lib/validations/costs';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Users, Loader2 } from 'lucide-react';

interface EmployeeDialogProps {
  children?: React.ReactNode;
  onEmployeeCreated?: () => void;
}

export function EmployeeDialog({ children, onEmployeeCreated }: EmployeeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateEmployeeInput>({
    resolver: zodResolver(CreateEmployeeSchema),
    defaultValues: {
      name: '',
      role: '',
      grossSalary: 0,
      payrollTaxes: 0,
      active: true,
    },
  });

  const onSubmit = async (data: CreateEmployeeInput) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/costs/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const newEmployee = await response.json();
        toast.success('Empleado registrado exitosamente');
        setOpen(false);
        form.reset();
        onEmployeeCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al registrar empleado');
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error('Error al registrar empleado');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    const numValue = parseFloat(value.replace(/[^\d.-]/g, ''));
    if (isNaN(numValue)) return '';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(numValue);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Empleado
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5" />
            Registrar Nuevo Empleado
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Registre un nuevo empleado para el cálculo de costos laborales
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Nombre Completo</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Juan Pérez" 
                        className="bg-background border-input" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-foreground">Rol/Puesto</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: PLANTA, ADMIN, SUPERVISOR, OPERARIO" 
                        className="bg-background border-input" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Categoría o puesto del empleado (libre)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grossSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Salario Bruto Mensual</FormLabel>
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
                      Salario base sin cargas sociales
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payrollTaxes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Cargas Sociales</FormLabel>
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
                      Aportes patronales, ART, beneficios, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 col-span-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-foreground">Empleado Activo</FormLabel>
                      <FormDescription className="text-muted-foreground">
                        El empleado se incluirá en los cálculos de costos laborales
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
              <h4 className="font-medium text-foreground mb-2">Resumen de Costos</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Salario Bruto:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {form.watch('grossSalary') ? formatCurrency(form.watch('grossSalary').toString()) : '$0'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargas Sociales:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {form.watch('payrollTaxes') ? formatCurrency(form.watch('payrollTaxes').toString()) : '$0'}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-border/30">
                  <span className="text-muted-foreground">Costo Total Mensual:</span>
                  <span className="ml-2 font-bold text-primary">
                    {formatCurrency(((form.watch('grossSalary') || 0) + (form.watch('payrollTaxes') || 0)).toString())}
                  </span>
                </div>
              </div>
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
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Empleado
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
