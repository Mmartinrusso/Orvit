'use client';

import React from 'react';
import {
  Settings,
  Building2,
  Clock,
  Tags,
  ListChecks,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

const configItems = [
  {
    title: 'Centros de Trabajo',
    description: 'Gestiona líneas, máquinas, estaciones y celdas de producción',
    href: '/produccion/configuracion/centros-trabajo',
    icon: Building2,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    title: 'Turnos',
    description: 'Configura los turnos de trabajo y horarios',
    href: '/produccion/configuracion/turnos',
    icon: Clock,
    color: 'bg-green-100 text-green-600',
  },
  {
    title: 'Códigos de Motivo',
    description: 'Define motivos de parada, scrap, retrabajo y calidad',
    href: '/produccion/configuracion/codigos-motivo',
    icon: Tags,
    color: 'bg-yellow-100 text-yellow-600',
  },
  {
    title: 'Plantillas de Rutinas',
    description: 'Crea checklists operativos para inicio/fin de turno',
    href: '/produccion/configuracion/rutinas',
    icon: ListChecks,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    title: 'Recursos de Producción',
    description: 'Gestiona bancos, silos, estaciones y otros recursos',
    href: '/produccion/configuracion/recursos',
    icon: Boxes,
    color: 'bg-orange-100 text-orange-600',
  },
];

export default function ProductionConfigPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-gray-600" />
          Configuración de Producción
        </h1>
        <p className="text-muted-foreground text-sm">
          Administra los maestros y configuraciones del módulo
        </p>
      </div>

      {/* Config Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {configItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className={`p-3 rounded-lg ${item.color}`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
