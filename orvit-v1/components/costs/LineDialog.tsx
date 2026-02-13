'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateLineSchema, type CreateLineInput } from '@/lib/validations/costs';
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
import { toast } from 'sonner';
import { Plus, Factory, Loader2 } from 'lucide-react';

interface LineDialogProps {
  children?: React.ReactNode;
  onLineCreated?: () => void;
}

export function LineDialog({ children, onLineCreated }: LineDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateLineInput>({
    resolver: zodResolver(CreateLineSchema),
    defaultValues: {
      code: '',
      name: '',
    },
  });

  const onSubmit = async (data: CreateLineInput) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/costs/lines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const newLine = await response.json();
        toast.success('Línea de producción creada exitosamente');
        setOpen(false);
        form.reset();
        onLineCreated?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al crear línea de producción');
      }
    } catch (error) {
      console.error('Error creating line:', error);
      toast.error('Error al crear línea de producción');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Línea
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Factory className="h-5 w-5" />
            Crear Nueva Línea de Producción
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure una nueva línea de producción para organizar sus productos
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <DialogBody>
            <div className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Código de Línea</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: BLQ, VIG, ADQ" 
                      className="bg-background border-input" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    Código único para identificar la línea (máximo 20 caracteres)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Nombre de la Línea</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Bloques, Viguetas, Adoquines" 
                      className="bg-background border-input" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    Nombre descriptivo de la línea de producción
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Línea
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
