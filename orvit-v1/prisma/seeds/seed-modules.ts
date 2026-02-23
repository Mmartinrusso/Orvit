import { PrismaClient, ModuleCategory } from '@prisma/client';

const prisma = new PrismaClient();

interface ModuleSeed {
  key: string;
  name: string;
  description: string;
  category: ModuleCategory;
  icon: string;
  sortOrder: number;
  dependencies: string[];
}

const modules: ModuleSeed[] = [
  // ========== VENTAS ==========
  {
    key: 'sales_core',
    name: 'Ventas Core',
    description: 'Funcionalidades base de ventas: clientes, productos, dashboard',
    category: 'VENTAS',
    icon: 'ShoppingCart',
    sortOrder: 1,
    dependencies: [],
  },
  // Módulos granulares de Ventas
  {
    key: 'sales_quotes',
    name: 'Cotizaciones',
    description: 'Crear y gestionar cotizaciones de venta',
    category: 'VENTAS',
    icon: 'FileText',
    sortOrder: 2,
    dependencies: ['sales_core'],
  },
  {
    key: 'sales_orders',
    name: 'Órdenes de Venta',
    description: 'Crear y gestionar órdenes de venta',
    category: 'VENTAS',
    icon: 'ClipboardList',
    sortOrder: 3,
    dependencies: ['sales_core'],
  },
  {
    key: 'sales_deliveries',
    name: 'Entregas',
    description: 'Gestión de remitos y entregas',
    category: 'VENTAS',
    icon: 'Truck',
    sortOrder: 4,
    dependencies: ['sales_core', 'sales_orders'],
  },
  {
    key: 'sales_invoices',
    name: 'Facturación',
    description: 'Emisión de facturas de venta',
    category: 'VENTAS',
    icon: 'Receipt',
    sortOrder: 5,
    dependencies: ['sales_core', 'sales_orders'],
  },
  {
    key: 'sales_payments',
    name: 'Cobranzas',
    description: 'Registro y gestión de cobros',
    category: 'VENTAS',
    icon: 'Banknote',
    sortOrder: 6,
    dependencies: ['sales_core', 'sales_invoices'],
  },
  {
    key: 'sales_ledger',
    name: 'Cuenta Corriente Clientes',
    description: 'Sistema de cuenta corriente tipo ledger inmutable para clientes',
    category: 'VENTAS',
    icon: 'BookOpen',
    sortOrder: 7,
    dependencies: ['sales_core', 'sales_invoices', 'sales_payments'],
  },
  // Extras de ventas
  {
    key: 'acopios',
    name: 'Sistema de Acopios',
    description: 'Gestión de mercadería pagada pendiente de retiro con control de límites',
    category: 'VENTAS',
    icon: 'Package',
    sortOrder: 8,
    dependencies: ['sales_core', 'sales_orders'],
  },
  {
    key: 'mixed_sales_conditions',
    name: 'Condiciones Mixtas de Venta',
    description: 'Permite configurar condiciones de venta mixtas (formal/informal) por cliente',
    category: 'VENTAS',
    icon: 'SplitSquareHorizontal',
    sortOrder: 9,
    dependencies: ['sales_core'],
  },
  {
    key: 'multi_price_lists',
    name: 'Listas de Precio Múltiples',
    description: 'Soporte para múltiples listas de precio por cliente',
    category: 'VENTAS',
    icon: 'ListOrdered',
    sortOrder: 10,
    dependencies: ['sales_core'],
  },
  {
    key: 'seller_commissions',
    name: 'Comisiones de Vendedores',
    description: 'Sistema completo de comisiones con tracking y reportes (sobre cobrado)',
    category: 'VENTAS',
    icon: 'Percent',
    sortOrder: 11,
    dependencies: ['sales_core', 'sales_orders', 'sales_payments'],
  },
  {
    key: 'client_portal',
    name: 'Portal de Clientes',
    description: 'Acceso de clientes para ver cotizaciones, documentos y cuenta corriente',
    category: 'VENTAS',
    icon: 'Globe',
    sortOrder: 12,
    dependencies: ['sales_core'],
  },
  {
    key: 'fiscal_invoicing',
    name: 'Facturación Fiscal (AFIP)',
    description: 'Integración con AFIP para facturación electrónica (preparado)',
    category: 'VENTAS',
    icon: 'FileCheck',
    sortOrder: 13,
    dependencies: ['sales_core', 'sales_invoices'],
  },
  {
    key: 'client_credit_limits',
    name: 'Límites de Crédito',
    description: 'Control de límites de crédito con bloqueo automático',
    category: 'VENTAS',
    icon: 'AlertTriangle',
    sortOrder: 14,
    dependencies: ['sales_core'],
  },

  // ========== COMPRAS ==========
  {
    key: 'purchases_core',
    name: 'Compras Core',
    description: 'Funcionalidades base de compras: solicitudes, órdenes, recepciones',
    category: 'COMPRAS',
    icon: 'ShoppingBag',
    sortOrder: 10,
    dependencies: [],
  },
  {
    key: 'purchase_orders',
    name: 'Órdenes de Compra',
    description: 'Gestión completa de órdenes de compra con workflow de aprobación',
    category: 'COMPRAS',
    icon: 'FileText',
    sortOrder: 11,
    dependencies: ['purchases_core'],
  },
  {
    key: 'supplier_ledger',
    name: 'Cuentas Corrientes Proveedores',
    description: 'Sistema de cuenta corriente para proveedores',
    category: 'COMPRAS',
    icon: 'BookOpen',
    sortOrder: 12,
    dependencies: ['purchases_core'],
  },
  {
    key: 'stock_management',
    name: 'Gestión de Stock',
    description: 'Control de inventario, ubicaciones y transferencias',
    category: 'COMPRAS',
    icon: 'Warehouse',
    sortOrder: 13,
    dependencies: ['purchases_core'],
  },
  {
    key: 'stock_replenishment',
    name: 'Reposición de Stock',
    description: 'Sistema automático de sugerencias de reposición',
    category: 'COMPRAS',
    icon: 'RefreshCw',
    sortOrder: 14,
    dependencies: ['stock_management'],
  },
  {
    key: 'cost_centers',
    name: 'Centros de Costo',
    description: 'Asignación de compras a centros de costo',
    category: 'COMPRAS',
    icon: 'PieChart',
    sortOrder: 15,
    dependencies: ['purchases_core'],
  },
  {
    key: 'projects',
    name: 'Proyectos',
    description: 'Vinculación de compras a proyectos específicos',
    category: 'COMPRAS',
    icon: 'FolderKanban',
    sortOrder: 16,
    dependencies: ['purchases_core'],
  },

  // ========== MANTENIMIENTO ==========
  {
    key: 'maintenance_core',
    name: 'Mantenimiento Core',
    description: 'Funcionalidades base de mantenimiento: órdenes de trabajo, equipos',
    category: 'MANTENIMIENTO',
    icon: 'Wrench',
    sortOrder: 20,
    dependencies: [],
  },
  {
    key: 'preventive_maintenance',
    name: 'Mantenimiento Preventivo',
    description: 'Programación y gestión de mantenimiento preventivo con checklists',
    category: 'MANTENIMIENTO',
    icon: 'Calendar',
    sortOrder: 21,
    dependencies: ['maintenance_core'],
  },
  {
    key: 'corrective_maintenance',
    name: 'Mantenimiento Correctivo',
    description: 'Gestión de fallas, RCA y soluciones',
    category: 'MANTENIMIENTO',
    icon: 'AlertCircle',
    sortOrder: 22,
    dependencies: ['maintenance_core'],
  },
  {
    key: 'panol',
    name: 'Pañol / Herramientas',
    description: 'Gestión de herramientas y préstamos',
    category: 'MANTENIMIENTO',
    icon: 'Hammer',
    sortOrder: 23,
    dependencies: ['maintenance_core'],
  },
  {
    key: 'mobile_units',
    name: 'Unidades Móviles',
    description: 'Gestión de vehículos y unidades móviles',
    category: 'MANTENIMIENTO',
    icon: 'Truck',
    sortOrder: 24,
    dependencies: ['maintenance_core'],
  },
  {
    key: 'downtime_tracking',
    name: 'Tracking de Paradas',
    description: 'Registro y análisis de tiempos de parada de equipos',
    category: 'MANTENIMIENTO',
    icon: 'Clock',
    sortOrder: 25,
    dependencies: ['maintenance_core'],
  },

  // ========== COSTOS ==========
  {
    key: 'costs_core',
    name: 'Costos Core',
    description: 'Cálculo de costos de productos y recetas',
    category: 'COSTOS',
    icon: 'Calculator',
    sortOrder: 30,
    dependencies: [],
  },
  {
    key: 'costs_dashboard',
    name: 'Dashboard de Costos',
    description: 'Visualización y análisis de costos',
    category: 'COSTOS',
    icon: 'BarChart3',
    sortOrder: 31,
    dependencies: ['costs_core'],
  },
  {
    key: 'labor_costs',
    name: 'Costos Laborales',
    description: 'Gestión de costos laborales y categorías',
    category: 'COSTOS',
    icon: 'Users',
    sortOrder: 32,
    dependencies: ['costs_core'],
  },
  {
    key: 'indirect_costs',
    name: 'Costos Indirectos',
    description: 'Asignación y distribución de costos indirectos',
    category: 'COSTOS',
    icon: 'Layers',
    sortOrder: 33,
    dependencies: ['costs_core'],
  },

  // ========== ADMINISTRACION ==========
  {
    key: 'cargas',
    name: 'Sistema de Cargas',
    description: 'Gestión de cargas y entregas',
    category: 'ADMINISTRACION',
    icon: 'Truck',
    sortOrder: 40,
    dependencies: [],
  },
  {
    key: 'controls',
    name: 'Controles Fiscales',
    description: 'Gestión de impuestos y obligaciones fiscales',
    category: 'ADMINISTRACION',
    icon: 'FileCheck2',
    sortOrder: 41,
    dependencies: [],
  },
  {
    key: 'agenda',
    name: 'Agenda',
    description: 'Calendario y agenda de eventos',
    category: 'ADMINISTRACION',
    icon: 'CalendarDays',
    sortOrder: 42,
    dependencies: [],
  },
  {
    key: 'notifications',
    name: 'Notificaciones',
    description: 'Sistema de notificaciones y alertas',
    category: 'ADMINISTRACION',
    icon: 'Bell',
    sortOrder: 43,
    dependencies: [],
  },

  // ========== GENERAL ==========
  {
    key: 'tasks',
    name: 'Tareas',
    description: 'Sistema de tareas y asignaciones',
    category: 'GENERAL',
    icon: 'CheckSquare',
    sortOrder: 50,
    dependencies: [],
  },
  {
    key: 'fixed_tasks',
    name: 'Tareas Fijas',
    description: 'Tareas recurrentes con programación automática',
    category: 'GENERAL',
    icon: 'RefreshCcw',
    sortOrder: 51,
    dependencies: ['tasks'],
  },
  {
    key: 'documents',
    name: 'Documentos',
    description: 'Gestión de documentos y archivos',
    category: 'GENERAL',
    icon: 'Files',
    sortOrder: 52,
    dependencies: [],
  },
  {
    key: 'advanced_reports',
    name: 'Reportes Avanzados',
    description: 'Reportes personalizados y exportación',
    category: 'GENERAL',
    icon: 'FileSpreadsheet',
    sortOrder: 53,
    dependencies: [],
  },
  {
    key: 'ai_assistant',
    name: 'Asistente IA',
    description: 'Asistente virtual con inteligencia artificial',
    category: 'GENERAL',
    icon: 'Bot',
    sortOrder: 54,
    dependencies: [],
  },
  {
    key: 'whatsapp_integration',
    name: 'Integración WhatsApp',
    description: 'Notificaciones y comunicación por WhatsApp',
    category: 'GENERAL',
    icon: 'MessageCircle',
    sortOrder: 55,
    dependencies: ['notifications'],
  },
];

async function seedModules() {
  console.log('🌱 Seeding modules...');

  for (const module of modules) {
    const existing = await prisma.module.findUnique({
      where: { key: module.key },
    });

    if (existing) {
      console.log(`  ✓ Module ${module.key} already exists, updating...`);
      await prisma.module.update({
        where: { key: module.key },
        data: {
          name: module.name,
          description: module.description,
          category: module.category,
          icon: module.icon,
          sortOrder: module.sortOrder,
          dependencies: module.dependencies,
        },
      });
    } else {
      console.log(`  + Creating module: ${module.key}`);
      await prisma.module.create({
        data: {
          key: module.key,
          name: module.name,
          description: module.description,
          category: module.category,
          icon: module.icon,
          sortOrder: module.sortOrder,
          dependencies: module.dependencies,
        },
      });
    }
  }

  console.log(`\n✅ Seeded ${modules.length} modules successfully!`);
}

async function enableModulesForAllCompanies() {
  console.log('\n🏢 Enabling all modules for existing companies...');

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const allModules = await prisma.module.findMany({ select: { id: true, key: true } });

  for (const company of companies) {
    console.log(`  📋 Processing company: ${company.name}`);

    for (const module of allModules) {
      const existing = await prisma.companyModule.findUnique({
        where: {
          companyId_moduleId: {
            companyId: company.id,
            moduleId: module.id,
          },
        },
      });

      if (!existing) {
        await prisma.companyModule.create({
          data: {
            companyId: company.id,
            moduleId: module.id,
            isEnabled: true,
          },
        });
        console.log(`    + Enabled: ${module.key}`);
      }
    }
  }

  console.log('\n✅ All modules enabled for all companies!');
}

async function main() {
  try {
    await seedModules();
    await enableModulesForAllCompanies();
  } catch (error) {
    console.error('Error seeding modules:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
