'use client';

import { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Package, Loader2 } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import TrucksManager from '@/components/cargas/TrucksManager';
import LoadsManager from '@/components/cargas/LoadsManager';

export default function CargasPage() {
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState('trucks');

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <PermissionGuard permission="cargas.view">
      <div className="w-full p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
          {/* Header con tabs */}
          <div className="px-4 md:px-6 pt-4 pb-3">
            <TabsList className="h-8 p-0.5 bg-muted/50">
              <TabsTrigger
                value="trucks"
                className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2"
              >
                <Truck className="h-3.5 w-3.5" />
                Camiones
              </TabsTrigger>
              <TabsTrigger
                value="loads"
                className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-2"
              >
                <Package className="h-3.5 w-3.5" />
                Cargas
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="trucks" className="mt-0 px-4 md:px-6 pb-6">
            <TrucksManager companyId={currentCompany.id} />
          </TabsContent>

          <TabsContent value="loads" className="mt-0 px-4 md:px-6 pb-6">
            <LoadsManager companyId={currentCompany.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}

