'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, FlaskConical, Building2 } from 'lucide-react';
import { FichaTecnicaForm } from './FichaTecnicaForm';
import { ProveedorDocsSection } from './ProveedorDocsSection';

interface SupplyDetail {
  id: number;
  code?: string;
  name: string;
  unitMeasure: string;
  supplierName?: string;
  categoryName?: string;
  categoryColor?: string;
  isActive: boolean;
}

interface MaterialDetailSheetProps {
  supplyId: number | null;
  onClose: () => void;
  onFichaSaved?: () => void;
}

export function MaterialDetailSheet({ supplyId, onClose, onFichaSaved }: MaterialDetailSheetProps) {
  const [supply, setSupply] = useState<SupplyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!supplyId) {
      setSupply(null);
      return;
    }
    setIsLoading(true);
    fetch(`/api/insumos/insumos/${supplyId}`)
      .then((r) => r.json())
      .then((data) => setSupply(data))
      .catch(() => setSupply(null))
      .finally(() => setIsLoading(false));
  }, [supplyId]);

  return (
    <Sheet open={!!supplyId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          {isLoading || !supply ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando...</span>
            </div>
          ) : (
            <>
              <SheetHeader className="space-y-1">
                <SheetTitle className="text-lg leading-tight">{supply.name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  {supply.code && (
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                      {supply.code}
                    </span>
                  )}
                  <span>{supply.unitMeasure}</span>
                  {supply.categoryName && (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={
                        supply.categoryColor
                          ? {
                              color: supply.categoryColor,
                              borderColor: `${supply.categoryColor}50`,
                              backgroundColor: `${supply.categoryColor}10`,
                            }
                          : undefined
                      }
                    >
                      {supply.categoryName}
                    </Badge>
                  )}
                  {supply.supplierName && (
                    <span className="text-xs text-muted-foreground">· {supply.supplierName}</span>
                  )}
                  {!supply.isActive && (
                    <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                  )}
                </SheetDescription>
              </SheetHeader>
            </>
          )}
        </div>

        {/* Tabs */}
        {supply && (
          <Tabs defaultValue="ficha" className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-6 mt-4 flex-shrink-0 w-auto self-start">
              <TabsTrigger value="general" className="gap-1.5">
                <Package className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger value="ficha" className="gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Ficha Técnica
              </TabsTrigger>
              <TabsTrigger value="proveedores" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Proveedores
              </TabsTrigger>
            </TabsList>

            {/* General */}
            <TabsContent value="general" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
              <div className="space-y-3 text-sm">
                <Row label="Nombre" value={supply.name} />
                {supply.code && <Row label="Código interno" value={supply.code} mono />}
                <Row label="Unidad de medida" value={supply.unitMeasure} />
                {supply.categoryName && <Row label="Categoría" value={supply.categoryName} />}
                {supply.supplierName && <Row label="Proveedor principal" value={supply.supplierName} />}
                <Row label="Estado" value={supply.isActive ? 'Activo' : 'Inactivo'} />
              </div>
            </TabsContent>

            {/* Ficha Técnica */}
            <TabsContent value="ficha" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
              <FichaTecnicaForm supplyId={supply.id} onSaved={onFichaSaved} />
            </TabsContent>

            {/* Proveedores — documentos por proveedor */}
            <TabsContent value="proveedores" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
              <ProveedorDocsSection supplyId={supply.id} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`font-medium text-xs text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
