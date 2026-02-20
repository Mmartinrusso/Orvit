'use client';

import React, { useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, X } from 'lucide-react';
import { MaintenanceReportDocument } from './MaintenanceReportDocument';
import type { ReportModalData } from './types';

interface MaintenanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReportModalData;
}

export function MaintenanceReportModal({ isOpen, onClose, data }: MaintenanceReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    // Add print class to body to hide everything else
    document.body.classList.add('printing-report');
    
    // Trigger print
    window.print();
    
    // Remove class after print dialog closes
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-report');
      window.removeEventListener('afterprint', handleAfterPrint);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    
    // Fallback timeout in case afterprint doesn't fire
    setTimeout(() => {
      document.body.classList.remove('printing-report');
    }, 1000);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl" className="p-0 gap-0 print:max-w-none print:max-h-none print:w-full print:h-auto print:overflow-visible print:p-0 print:border-none print:shadow-none">
        {/* Screen-only Header */}
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0 screen-only">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {data.company}
              </DialogTitle>
              <p className="text-base text-muted-foreground mt-0.5">{data.reportTitle}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{data.generatedAtLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrint}
                className="flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content for Screen / Full content for Print */}
        <div className="flex-1 overflow-hidden screen-only">
          <ScrollArea className="h-full">
            <div className="p-6">
              <div ref={printRef}>
                <MaintenanceReportDocument data={data} />
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Print-only full document (rendered outside scroll for proper printing) */}
        <div className="print-only-root hidden print:block print:p-0">
          <MaintenanceReportDocument data={data} />
        </div>

        {/* Screen-only Footer */}
        <div className="border-t bg-muted px-6 py-2.5 flex-shrink-0 screen-only">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Listado generado automáticamente por el sistema de mantenimiento</span>
            <span>{data.generatedAtLabel}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MaintenanceReportModal;

