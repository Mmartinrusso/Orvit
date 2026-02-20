'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { MOCForm } from '@/components/moc';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditarMOCPage({ params }: Props) {
  const { id } = use(params);
  const mocId = parseInt(id);
  const router = useRouter();
  const { currentCompany, isLoading: companyLoading } = useCompany();

  const { data, isLoading, error } = useQuery({
    queryKey: ['moc', mocId],
    queryFn: async () => {
      const res = await fetch(`/api/moc/${mocId}`);
      if (!res.ok) throw new Error('Error fetching MOC');
      return res.json();
    },
    enabled: !isNaN(mocId),
  });

  if (isNaN(mocId)) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-muted-foreground">
          ID de MOC inválido
        </div>
      </div>
    );
  }

  if (companyLoading || isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data?.moc) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-warning-muted-foreground mb-2" />
            <p className="text-muted-foreground">Error al cargar el MOC</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.moc.status !== 'DRAFT') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-warning-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              Solo se pueden editar MOCs en estado Borrador
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/mantenimiento/moc/${mocId}`)}
            >
              Ver detalles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Seleccione una empresa
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <MOCForm
        companyId={currentCompany.id}
        mocId={mocId}
        initialData={data.moc}
      />
    </div>
  );
}
