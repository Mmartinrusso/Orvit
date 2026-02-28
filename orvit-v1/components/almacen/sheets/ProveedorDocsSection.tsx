'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InstructiveFileUpload } from '@/components/ui/InstructiveFileUpload';
import { Loader2, Save, Building2, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface SupplierItemWithDocs {
  id: number;
  nombre: string;
  codigoProveedor?: string;
  unidad: string;
  supplierDocuments: FileAttachment[];
  supplier: { id: number; name: string };
}

interface ProveedorDocsSectionProps {
  supplyId: number;
}

export function ProveedorDocsSection({ supplyId }: ProveedorDocsSectionProps) {
  const [items, setItems] = useState<SupplierItemWithDocs[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [localDocs, setLocalDocs] = useState<Map<number, FileAttachment[]>>(new Map());
  const [saving, setSaving] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!supplyId) return;
    setIsLoading(true);
    fetch(`/api/insumos/insumos/${supplyId}/proveedor-docs`)
      .then((r) => r.json())
      .then(({ items: data }: { items: SupplierItemWithDocs[] }) => {
        setItems(data ?? []);
        const map = new Map<number, FileAttachment[]>();
        (data ?? []).forEach((item) => {
          map.set(item.id, item.supplierDocuments ?? []);
        });
        setLocalDocs(map);
        // Auto-expand if has docs
        const autoExpand = new Set<number>();
        (data ?? []).forEach((item) => {
          if ((item.supplierDocuments ?? []).length > 0) autoExpand.add(item.id);
        });
        setExpanded(autoExpand);
      })
      .catch(() => toast.error('Error al cargar proveedores'))
      .finally(() => setIsLoading(false));
  }, [supplyId]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDocsChange = (itemId: number, docs: FileAttachment[]) => {
    setLocalDocs((prev) => new Map(prev).set(itemId, docs));
  };

  const handleSave = async (itemId: number) => {
    setSaving((prev) => new Set(prev).add(itemId));
    try {
      const res = await fetch(`/api/insumos/insumos/${supplyId}/proveedor-docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierItemId: itemId,
          documents: localDocs.get(itemId) ?? [],
        }),
      });
      if (!res.ok) throw new Error();
      // Update the items state to reflect saved docs
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, supplierDocuments: localDocs.get(itemId) ?? [] }
            : item
        )
      );
      toast.success('Documentos guardados');
    } catch {
      toast.error('Error al guardar los documentos');
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Cargando proveedores...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Building2 className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-sm">Este insumo no tiene proveedores asignados</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      <p className="text-xs text-muted-foreground">
        Adjuntá la hoja de seguridad (SDS), certificados de calidad o fichas técnicas de cada proveedor.
      </p>

      {items.map((item) => {
        const isOpen = expanded.has(item.id);
        const docs = localDocs.get(item.id) ?? [];
        const savedDocs = item.supplierDocuments ?? [];
        const isSaving = saving.has(item.id);
        const hasChanges = JSON.stringify(docs) !== JSON.stringify(savedDocs);

        return (
          <Card key={item.id} className="overflow-hidden">
            {/* Header del proveedor */}
            <button
              type="button"
              className="w-full text-left"
              onClick={() => toggleExpand(item.id)}
            >
              <CardHeader className="pb-3 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.supplier.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {item.codigoProveedor && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {item.codigoProveedor}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{item.nombre}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {savedDocs.length > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Paperclip className="h-3 w-3" />
                        {savedDocs.length}
                      </Badge>
                    )}
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
            </button>

            {/* Contenido expandible */}
            {isOpen && (
              <CardContent className={cn('pt-0 px-4 pb-4 border-t')}>
                <div className="pt-3 space-y-3">
                  <InstructiveFileUpload
                    entityType="supplier-item"
                    entityId={String(item.id)}
                    attachments={docs}
                    onAttachmentsChange={(newDocs) => handleDocsChange(item.id, newDocs)}
                    title=""
                    description="SDS, certificados de calidad, ficha técnica del proveedor"
                    maxFiles={5}
                  />

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      variant={hasChanges ? 'default' : 'outline'}
                      disabled={isSaving || !hasChanges}
                      onClick={() => handleSave(item.id)}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {hasChanges ? 'Guardar' : 'Guardado'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
