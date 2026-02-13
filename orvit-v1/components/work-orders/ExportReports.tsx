'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Download, FileText, Loader2 } from 'lucide-react';
import { WorkOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface ExportReportsProps {
  workOrders: WorkOrder[];
  filters?: any;
}

export default function ExportReports({ workOrders, filters }: ExportReportsProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async () => {
    setIsExporting(true);
    
    try {
      // Simular procesamiento de exportación
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Exportación completada",
        description: `Se han exportado ${workOrders.length} órdenes de trabajo.`,
      });
      
    } catch (error) {
      console.error('Error exporting:', error);
      toast({
        title: "Error en la exportación",
        description: "No se pudo generar el reporte. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={exportData} disabled={isExporting}>
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Exportando...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </>
      )}
    </Button>
  );
} 