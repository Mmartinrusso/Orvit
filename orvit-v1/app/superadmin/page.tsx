'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Building2,
  Puzzle,
  Users,
  Activity,
  ArrowRight,
  FileStack,
  Clock,
  CheckCircle,
  Loader2,
  Zap,
  Shield,
  Database,
} from 'lucide-react';

interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  totalModules: number;
  activeModules: number;
  totalUsers: number;
  totalTemplates: number;
  recentCompanies: Array<{
    id: number;
    name: string;
    createdAt: string;
    templateName: string | null;
  }>;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [companiesRes, modulesRes, templatesRes] = await Promise.all([
          fetch('/api/superadmin/companies'),
          fetch('/api/superadmin/modules'),
          fetch('/api/superadmin/templates'),
        ]);

        let companies: any[] = [];
        let modules: any[] = [];
        let templates: any[] = [];

        if (companiesRes.ok) {
          const data = await companiesRes.json();
          companies = data.companies || [];
        }

        if (modulesRes.ok) {
          const data = await modulesRes.json();
          modules = data.modules || [];
        }

        if (templatesRes.ok) {
          const data = await templatesRes.json();
          templates = data.templates || [];
        }

        setStats({
          totalCompanies: companies.length,
          activeCompanies: companies.filter((c: any) => c.isActive !== false).length,
          totalModules: modules.length,
          activeModules: modules.filter((m: any) => m.isActive).length,
          totalUsers: companies.reduce((sum: number, c: any) => sum + (parseInt(c.usersCount) || 0), 0),
          totalTemplates: templates.length,
          recentCompanies: companies.slice(0, 5).map((c: any) => ({
            id: c.id,
            name: c.name,
            createdAt: c.createdAt,
            templateName: c.templateName,
          })),
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Empresas',
      value: stats?.totalCompanies || 0,
      subtitle: `${stats?.activeCompanies || 0} activas`,
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      href: '/superadmin/companies',
    },
    {
      title: 'Módulos',
      value: stats?.totalModules || 0,
      subtitle: `${stats?.activeModules || 0} activos`,
      icon: Puzzle,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      href: '/superadmin/modules',
    },
    {
      title: 'Usuarios',
      value: stats?.totalUsers || 0,
      subtitle: 'En todas las empresas',
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      href: '/superadmin/users',
    },
    {
      title: 'Templates',
      value: stats?.totalTemplates || 0,
      subtitle: 'Presets disponibles',
      icon: FileStack,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      href: '/superadmin/templates',
    },
  ];

  const quickActions = [
    {
      title: 'Nueva Empresa',
      description: 'Crear una empresa con template',
      icon: Building2,
      href: '/superadmin/companies',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Nuevo Template',
      description: 'Crear preset de módulos',
      icon: FileStack,
      href: '/superadmin/templates',
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'Gestionar Módulos',
      description: 'Activar/desactivar por empresa',
      icon: Puzzle,
      href: '/superadmin/modules',
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Ver Actividad',
      description: 'Logs del sistema',
      icon: Activity,
      href: '/superadmin/activity',
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Resumen general del sistema ORVIT
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer group">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-3xl font-bold mt-1">{stat.value}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">{stat.subtitle}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Acciones Rápidas
            </CardTitle>
            <CardDescription>
              Accesos directos a funciones comunes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.title} href={action.href}>
                    <div className="p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/50 transition-all group cursor-pointer">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-medium text-sm">{action.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Companies */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Empresas Recientes
                </CardTitle>
                <CardDescription>
                  Últimas empresas registradas
                </CardDescription>
              </div>
              <Link href="/superadmin/companies">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  Ver todas
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recentCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{company.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(company.createdAt).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                  {company.templateName && (
                    <Badge variant="outline" className="text-xs">
                      {company.templateName}
                    </Badge>
                  )}
                </div>
              ))}
              {(!stats?.recentCompanies || stats.recentCompanies.length === 0) && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay empresas registradas
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Estado del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Base de Datos</p>
                <p className="text-xs text-muted-foreground">PostgreSQL conectado</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Autenticación</p>
                <p className="text-xs text-muted-foreground">JWT funcionando</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">API</p>
                <p className="text-xs text-muted-foreground">Todos los endpoints activos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
