'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CobranzasList } from '@/components/ventas/cobranzas-list';
import { CollectionsDashboard } from '@/components/ventas/collections-dashboard';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { BarChart3, List } from 'lucide-react';

export default function CobranzasPage() {
  const [activeTab, setActiveTab] = useState('list');

  return (
    <PermissionGuard permission="ventas.cobranzas.view">
      <div className="container mx-auto py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Listado
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            <CobranzasList />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <CollectionsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}
