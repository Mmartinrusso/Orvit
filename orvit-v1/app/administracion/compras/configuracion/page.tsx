'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoriasManager } from '@/components/compras/categorias-manager';
import { ServiciosManager } from '@/components/compras/servicios-manager';
import { SoDRulesAdmin } from '@/components/compras/sod-rules-admin';
import { Settings, FolderTree, Shield, UserX, AlertTriangle, Bell } from 'lucide-react';

export default function ComprasConfiguracionPage() {
  const [activeTab, setActiveTab] = useState('categorias');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Configuración de Compras</h1>
          <p className="text-muted-foreground">
            Gestiona categorías, servicios, reglas de segregación y alertas
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap w-full max-w-[900px] h-auto gap-1 p-1">
          <TabsTrigger value="categorias" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Categorías
          </TabsTrigger>
          <TabsTrigger value="servicios" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Servicios
          </TabsTrigger>
          <TabsTrigger value="sod" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Reglas SoD
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Categorías de Insumos
              </CardTitle>
              <CardDescription>
                Organiza tus insumos en categorías jerárquicas (ej: Rodamientos, Electricidad, Lubricantes)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoriasManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="servicios" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Contratos de Servicios y Seguros
              </CardTitle>
              <CardDescription>
                Gestiona contratos de servicios externos, seguros de maquinaria, alquileres y licencias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServiciosManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sod" className="mt-6">
          <SoDRulesAdmin />
        </TabsContent>

        <TabsContent value="alertas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Configuración de Alertas
              </CardTitle>
              <CardDescription>
                Configura umbrales y notificaciones para GRNI, Match SLA y otras alertas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Configuración de alertas</p>
                <p className="text-sm">Próximamente: umbrales GRNI, SLA de match, notificaciones automáticas</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
