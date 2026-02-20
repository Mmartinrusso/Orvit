'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Award,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CertificationTrackerProps {
  userId?: number;
  companyId: number;
  showExpiringSoon?: boolean;
}

interface Certification {
  id: number;
  certificationName: string;
  certificationNumber?: string;
  issuingOrganization?: string;
  issuedAt?: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING' | 'REVOKED';
  documentUrl?: string;
  skill: {
    id: number;
    name: string;
    category?: string;
  };
  issuedBy?: {
    id: number;
    name: string;
  };
  user?: {
    id: number;
    name: string;
  };
}

const statusConfig = {
  ACTIVE: {
    label: 'Activa',
    color: 'bg-success-muted text-success',
    icon: CheckCircle,
  },
  EXPIRED: {
    label: 'Expirada',
    color: 'bg-destructive/10 text-destructive',
    icon: XCircle,
  },
  PENDING: {
    label: 'Pendiente',
    color: 'bg-warning-muted text-warning-muted-foreground',
    icon: Clock,
  },
  REVOKED: {
    label: 'Revocada',
    color: 'bg-muted text-muted-foreground',
    icon: XCircle,
  },
};

export function CertificationTracker({
  userId,
  companyId,
  showExpiringSoon = false,
}: CertificationTrackerProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch certifications - either for a specific user or company-wide
  const { data, isLoading } = useQuery({
    queryKey: ['certifications', userId, companyId, showExpiringSoon],
    queryFn: async () => {
      let url = userId
        ? `/api/users/${userId}/certifications`
        : `/api/certifications?companyId=${companyId}`;

      if (showExpiringSoon) {
        url += `${userId ? '?' : '&'}expiringSoon=true`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Error fetching certifications');
      return res.json();
    },
  });

  const certifications: Certification[] = data?.certifications || [];
  const summary = data?.summary;

  const filteredCertifications = certifications.filter((cert) =>
    statusFilter === 'all' || cert.status === statusFilter
  );

  const getDaysUntilExpiry = (expiresAt: string | undefined) => {
    if (!expiresAt) return null;
    return differenceInDays(new Date(expiresAt), new Date());
  };

  const getExpiryBadge = (expiresAt: string | undefined) => {
    if (!expiresAt) return null;

    const days = getDaysUntilExpiry(expiresAt);
    if (days === null) return null;

    if (days < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Expirada hace {Math.abs(days)} días
        </Badge>
      );
    }

    if (days <= 30) {
      return (
        <Badge variant="warning" className="text-xs bg-warning-muted text-warning-muted-foreground">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expira en {days} días
        </Badge>
      );
    }

    if (days <= 90) {
      return (
        <Badge variant="outline" className="text-xs">
          Expira en {days} días
        </Badge>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {showExpiringSoon ? 'Certificaciones por Vencer' : 'Certificaciones'}
            </CardTitle>
            <CardDescription>
              {userId
                ? 'Certificaciones del usuario'
                : 'Control de certificaciones de la empresa'}
            </CardDescription>
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-lg bg-success-muted">
              <p className="text-2xl font-bold text-success">{summary.active}</p>
              <p className="text-xs text-muted-foreground">Activas</p>
            </div>
            <div className="p-3 rounded-lg bg-warning-muted">
              <p className="text-2xl font-bold text-warning-muted-foreground">{summary.expiringSoon}</p>
              <p className="text-xs text-muted-foreground">Por vencer</p>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10">
              <p className="text-2xl font-bold text-destructive">{summary.expired}</p>
              <p className="text-xs text-muted-foreground">Expiradas</p>
            </div>
            <div className="p-3 rounded-lg bg-warning-muted">
              <p className="text-2xl font-bold text-warning-muted-foreground">{summary.pending}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
          </div>
        )}

        {/* Filter buttons */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Todas
          </Button>
          {Object.entries(statusConfig).map(([status, config]) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              <config.icon className="h-3 w-3 mr-1" />
              {config.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {filteredCertifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay certificaciones para mostrar</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificación</TableHead>
                <TableHead>Habilidad</TableHead>
                {!userId && <TableHead>Usuario</TableHead>}
                <TableHead>Número</TableHead>
                <TableHead>Emisión</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCertifications.map((cert) => {
                const StatusIcon = statusConfig[cert.status].icon;
                return (
                  <TableRow key={cert.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{cert.certificationName}</p>
                        {cert.issuingOrganization && (
                          <p className="text-xs text-muted-foreground">
                            {cert.issuingOrganization}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{cert.skill.name}</Badge>
                    </TableCell>
                    {!userId && cert.user && (
                      <TableCell>{cert.user.name}</TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      {cert.certificationNumber || '-'}
                    </TableCell>
                    <TableCell>
                      {cert.issuedAt
                        ? format(new Date(cert.issuedAt), 'dd/MM/yyyy', { locale: es })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {cert.expiresAt ? (
                          <>
                            <span>{format(new Date(cert.expiresAt), 'dd/MM/yyyy', { locale: es })}</span>
                            {getExpiryBadge(cert.expiresAt)}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Sin vencimiento</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(statusConfig[cert.status].color)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[cert.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cert.documentUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a
                            href={cert.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver documento"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default CertificationTracker;
