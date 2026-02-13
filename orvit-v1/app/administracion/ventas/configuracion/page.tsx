'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  Settings,
  Users,
  Package,
  FileText,
  Truck,
  Receipt,
  CreditCard,
  ChevronRight,
  Sidebar,
} from 'lucide-react';
import { ClientFormConfig } from '@/components/ventas/configuracion/client-form-config';
import { ProductConfig } from '@/components/ventas/configuracion/product-config';
import { QuoteConfig } from '@/components/ventas/configuracion/quote-config';
import { WorkflowConfig } from '@/components/ventas/configuracion/workflow-config';
import { ModulesConfig } from '@/components/ventas/configuracion/modules-config';
import { NotificationsConfig } from '@/components/ventas/configuracion/notifications-config';
import { DeliveryConfig } from '@/components/ventas/configuracion/delivery-config';
import { SidebarPreferencesConfig } from '@/components/ventas/configuracion/sidebar-preferences-config';
import { TaxConfig } from '@/components/ventas/configuracion/tax-config';
import { CreditConfig } from '@/components/ventas/configuracion/credit-config';
import { CurrencyConfig } from '@/components/ventas/configuracion/currency-config';
import { DiscountConfig } from '@/components/ventas/configuracion/discount-config';
import { LogisticsConfig } from '@/components/ventas/configuracion/logistics-config';
import { Zap, Bell, Layout, DollarSign, AlertTriangle, Percent, MapPin } from 'lucide-react';

// Secciones de configuración
const CONFIG_SECTIONS = [
  {
    id: 'clientes',
    name: 'Clientes',
    description: 'Campos del formulario y datos de clientes',
    icon: Users,
  },
  {
    id: 'productos',
    name: 'Productos',
    description: 'Tipos de costo, precios y alertas',
    icon: Package,
  },
  {
    id: 'cotizaciones',
    name: 'Cotizaciones',
    description: 'Método de pricing y visibilidad',
    icon: FileText,
  },
  {
    id: 'workflows',
    name: 'Flujos de Trabajo',
    description: 'Aprobaciones y validaciones',
    icon: Zap,
  },
  {
    id: 'modulos',
    name: 'Módulos Activos',
    description: 'Habilitar/deshabilitar funcionalidades',
    icon: Layout,
  },
  {
    id: 'sidebar',
    name: 'Navegación',
    description: 'Personalizar menú lateral',
    icon: Sidebar,
  },
  {
    id: 'entregas',
    name: 'Entregas',
    description: 'Requisitos de logística',
    icon: Truck,
  },
  {
    id: 'notificaciones',
    name: 'Notificaciones',
    description: 'Alertas por email',
    icon: Bell,
  },
  {
    id: 'impuestos',
    name: 'Impuestos',
    description: 'IVA, alícuotas y percepciones',
    icon: Receipt,
  },
  {
    id: 'credito',
    name: 'Crédito',
    description: 'Validaciones y límites de crédito',
    icon: AlertTriangle,
  },
  {
    id: 'monedas',
    name: 'Monedas',
    description: 'Monedas habilitadas y conversión',
    icon: DollarSign,
  },
  {
    id: 'descuentos',
    name: 'Descuentos',
    description: 'Límites y aprobaciones de descuentos',
    icon: Percent,
  },
  {
    id: 'logistica',
    name: 'Logística',
    description: 'Turnos y rutas de entrega',
    icon: MapPin,
  },
  {
    id: 'facturacion',
    name: 'AFIP',
    description: 'Integración con AFIP (próximamente)',
    icon: FileText,
    disabled: true,
  },
] as const;

type SectionId = typeof CONFIG_SECTIONS[number]['id'];

export default function ConfiguracionVentasPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>('clientes');

  const currentSection = CONFIG_SECTIONS.find(s => s.id === activeSection);
  const companyId = user?.companyId || 1;

  return (
    <PermissionGuard permission="ventas.dashboard.view">
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar de navegación */}
      <aside className="w-64 border-r bg-muted/30 p-4 flex-shrink-0">
        <div className="mb-6">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Módulo de Ventas
          </p>
        </div>

        <nav className="space-y-1">
          {CONFIG_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const isDisabled = 'disabled' in section && section.disabled;

            return (
              <button
                key={section.id}
                onClick={() => !isDisabled && setActiveSection(section.id)}
                disabled={isDisabled}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  !isActive && !isDisabled && 'hover:bg-muted',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', !isActive && 'text-foreground')}>
                    {section.name}
                  </p>
                  <p className={cn(
                    'text-xs truncate',
                    isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}>
                    {section.description}
                  </p>
                </div>
                {!isDisabled && (
                  <ChevronRight className={cn(
                    'w-4 h-4 transition-transform',
                    isActive && 'rotate-90',
                    !isActive && 'text-muted-foreground'
                  )} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Nota sobre secciones próximamente */}
        <div className="mt-6 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            Las secciones deshabilitadas estarán disponibles próximamente.
          </p>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto p-6">
        {/* Breadcrumb / Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Configuración</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{currentSection?.name}</span>
          </div>
          <h2 className="text-xl font-bold">{currentSection?.name}</h2>
          <p className="text-sm text-muted-foreground">{currentSection?.description}</p>
        </div>

        {/* Contenido de la sección */}
        {activeSection === 'clientes' && <ClientFormConfig />}
        {activeSection === 'productos' && <ProductConfig />}
        {activeSection === 'cotizaciones' && <QuoteConfig />}
        {activeSection === 'workflows' && <WorkflowConfig />}
        {activeSection === 'modulos' && <ModulesConfig />}
        {activeSection === 'sidebar' && <SidebarPreferencesConfig />}
        {activeSection === 'entregas' && <DeliveryConfig />}
        {activeSection === 'notificaciones' && <NotificationsConfig />}
        {activeSection === 'impuestos' && <TaxConfig companyId={companyId} />}
        {activeSection === 'credito' && <CreditConfig companyId={companyId} />}
        {activeSection === 'monedas' && <CurrencyConfig companyId={companyId} />}
        {activeSection === 'descuentos' && <DiscountConfig companyId={companyId} />}
        {activeSection === 'logistica' && <LogisticsConfig companyId={companyId} />}

        {/* Placeholder para secciones futuras */}
        {['facturacion'].includes(activeSection) && (
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Esta sección estará disponible próximamente</p>
          </div>
        )}
      </main>
    </div>
    </PermissionGuard>
  );
}
