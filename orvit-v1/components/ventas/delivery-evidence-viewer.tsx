'use client';

import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Image as ImageIcon,
  FileText,
  Download,
  Eye,
  Camera,
  PenTool,
} from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Evidence {
  id: number;
  tipo: 'foto' | 'firma' | 'documento';
  url: string;
  descripcion?: string | null;
  createdAt: string;
}

interface DeliveryEvidenceViewerProps {
  delivery: any;
  evidences?: Evidence[];
}

export function DeliveryEvidenceViewer({ delivery, evidences = [] }: DeliveryEvidenceViewerProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const getEvidenceIcon = (tipo: string) => {
    switch (tipo) {
      case 'foto':
        return Camera;
      case 'firma':
        return PenTool;
      case 'documento':
        return FileText;
      default:
        return FileText;
    }
  };

  const getEvidenceLabel = (tipo: string) => {
    switch (tipo) {
      case 'foto':
        return 'Foto';
      case 'firma':
        return 'Firma';
      case 'documento':
        return 'Documento';
      default:
        return 'Evidencia';
    }
  };

  const photoEvidences = evidences.filter((e) => e.tipo === 'foto');
  const signatureEvidences = evidences.filter((e) => e.tipo === 'firma');
  const documentEvidences = evidences.filter((e) => e.tipo === 'documento');

  // Check for signature in delivery.firmaRecepcion field
  const hasSignature = delivery.firmaRecepcion || signatureEvidences.length > 0;

  return (
    <div className="space-y-4">
      {/* Signature Card (from delivery.firmaRecepcion) */}
      {delivery.firmaRecepcion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PenTool className="w-5 h-5" />
              Firma de Recepción
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center bg-muted/30 rounded-lg p-4">
              <img
                src={delivery.firmaRecepcion}
                alt="Firma de recepción"
                className="max-h-[200px] cursor-pointer"
                onClick={() => setSelectedImage(delivery.firmaRecepcion)}
              />
            </div>
            {delivery.recibeNombre && (
              <p className="text-sm text-muted-foreground mt-3 text-center">
                Firmado por: <strong>{delivery.recibeNombre}</strong>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Photo Gallery */}
      {photoEvidences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="w-5 h-5" />
              Fotografías ({photoEvidences.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {photoEvidences.map((evidence) => (
                <div
                  key={evidence.id}
                  className="relative group cursor-pointer rounded-lg overflow-hidden border hover:border-primary transition-colors"
                  onClick={() => setSelectedImage(evidence.url)}
                >
                  <img
                    src={evidence.url}
                    alt={evidence.descripcion || 'Foto de entrega'}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {evidence.descripcion && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-xs">
                      {evidence.descripcion}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {documentEvidences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              Documentos ({documentEvidences.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documentEvidences.map((evidence) => (
                <div
                  key={evidence.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {evidence.descripcion || 'Documento sin descripción'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(evidence.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(evidence.url, '_blank')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signatures from evidences table */}
      {signatureEvidences.length > 0 && !delivery.firmaRecepcion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PenTool className="w-5 h-5" />
              Firmas ({signatureEvidences.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {signatureEvidences.map((evidence) => (
                <div
                  key={evidence.id}
                  className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedImage(evidence.url)}
                >
                  <img
                    src={evidence.url}
                    alt={evidence.descripcion || 'Firma'}
                    className="w-full h-32 object-contain"
                  />
                  {evidence.descripcion && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      {evidence.descripcion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Evidence State */}
      {!hasSignature && photoEvidences.length === 0 && documentEvidences.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="w-5 h-5" />
              Evidencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No hay evidencias cargadas para esta entrega
              </p>
              {delivery.estado === 'ENTREGADA' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Las evidencias pueden cargarse al momento de confirmar la entrega
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Lightbox Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Vista Ampliada</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Vista ampliada"
                className="max-w-full max-h-[70vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
