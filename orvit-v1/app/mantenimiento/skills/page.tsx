'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SkillList,
  SkillMatrix,
  CertificationTracker,
} from '@/components/skills';
import {
  Award,
  Users,
  FileCheck,
  AlertTriangle,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

export default function SkillsPage() {
  const { user, hasPermission, loading: authLoading } = useAuth();
  const { currentCompany, loading: companyLoading } = useCompany();
  const [activeTab, setActiveTab] = useState('catalog');

  const isLoading = authLoading || companyLoading;

  // Permission checks
  const canView = hasPermission('skills.view');
  const canCreate = hasPermission('skills.create');
  const canEdit = hasPermission('skills.edit');
  const canDelete = hasPermission('skills.delete');
  const canManageRequirements = hasPermission('skills.requirements.manage');
  const canViewCertifications = hasPermission('certifications.view');

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No tiene permisos para ver esta página
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Alert>
          <AlertDescription>
            Seleccione una empresa para ver las habilidades
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/mantenimiento">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Award className="h-6 w-6" />
              Gestión de Skills y Certificaciones
            </h1>
            <p className="text-muted-foreground">
              Administra las competencias y certificaciones del personal
            </p>
          </div>
        </div>

        {canManageRequirements && (
          <Link href="/mantenimiento/skills/requirements">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Requisitos por Tarea
            </Button>
          </Link>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Habilidades Definidas
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              En el catálogo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Personal Capacitado
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Con skills asignadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Certificaciones Activas
            </CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Vigentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Por Vencer
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-muted-foreground">-</div>
            <p className="text-xs text-muted-foreground">
              Próximos 30 días
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Catálogo de Skills
          </TabsTrigger>
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Matriz de Skills
          </TabsTrigger>
          {canViewCertifications && (
            <TabsTrigger value="certifications" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Certificaciones
            </TabsTrigger>
          )}
          <TabsTrigger value="expiring" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Por Vencer
            <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">
              0
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <SkillList
            companyId={currentCompany.id}
            canCreate={canCreate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <SkillMatrix companyId={currentCompany.id} />
        </TabsContent>

        {canViewCertifications && (
          <TabsContent value="certifications" className="space-y-4">
            <CertificationTracker companyId={currentCompany.id} />
          </TabsContent>
        )}

        <TabsContent value="expiring" className="space-y-4">
          <CertificationTracker
            companyId={currentCompany.id}
            showExpiringSoon
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
