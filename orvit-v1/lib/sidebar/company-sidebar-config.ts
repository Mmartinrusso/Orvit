/**
 * Tipos y utilidades para la configuración de sidebar por empresa.
 *
 * Arquitectura de 3 capas:
 * 1. REGISTRY (xxx-modules.ts)        → todos los items posibles + permisos
 * 2. COMPANY CONFIG (este archivo)    → admin organiza items en grupos
 * 3. PERMISSION FILTER (Sidebar.tsx)  → cada usuario ve solo lo que tiene permiso
 */

import { VENTAS_MODULES, type SidebarModule } from './ventas-modules';
import { VENTAS_DEFAULT_CONFIG } from './ventas-default-config';
import { MANTENIMIENTO_MODULES } from './mantenimiento-modules';
import { MANTENIMIENTO_DEFAULT_CONFIG } from './mantenimiento-default-config';
import { PRODUCCION_MODULES } from './produccion-modules';
import { PRODUCCION_DEFAULT_CONFIG } from './produccion-default-config';
import { COMPRAS_MODULES } from './compras-modules';
import { COMPRAS_DEFAULT_CONFIG } from './compras-default-config';
import { TESORERIA_MODULES } from './tesoreria-modules';
import { TESORERIA_DEFAULT_CONFIG } from './tesoreria-default-config';
import { NOMINAS_MODULES } from './nominas-modules';
import { NOMINAS_DEFAULT_CONFIG } from './nominas-default-config';
import { ALMACEN_MODULES } from './almacen-modules';
import { ALMACEN_DEFAULT_CONFIG } from './almacen-default-config';

// ─── Tipos del árbol de configuración ────────────────────────────────────────

export interface SidebarItemNode {
  type: 'item';
  moduleId: string;
}

export interface SidebarGroupNode {
  type: 'group';
  id: string;
  name: string;
  icon: string;
  children: SidebarNode[];
}

export type SidebarNode = SidebarItemNode | SidebarGroupNode;

export interface ModuleSidebarConfig {
  version: 1;
  groups: SidebarGroupNode[];
}

export type SidebarModuleKey =
  | 'ventas'
  | 'mantenimiento'
  | 'produccion'
  | 'compras'
  | 'tesoreria'
  | 'nominas'
  | 'almacen';

/** Grupo top-level custom creado por el admin (no mapeado a un módulo existente). */
export interface CustomAdminGroup {
  name: string;
  icon: string;
  items: string[]; // moduleIds de cualquier registry (ej: 'ventas.cotizaciones', 'mant.ordenes')
}

export interface CompanySidebarConfig {
  ventas?: ModuleSidebarConfig;
  mantenimiento?: ModuleSidebarConfig;
  produccion?: ModuleSidebarConfig;
  compras?: ModuleSidebarConfig;
  tesoreria?: ModuleSidebarConfig;
  nominas?: ModuleSidebarConfig;
  almacen?: ModuleSidebarConfig;
  adminOrder?: string[];     // Orden de las secciones top-level
  sectionLabels?: Record<string, string>; // Overrides de nombre para secciones estándar
  customGroups?: Record<string, CustomAdminGroup>; // Grupos custom creados por el admin
}

// ─── Admin module order ───────────────────────────────────────────────────────

export const ADMIN_ORDERABLE_MODULES: Array<{ key: string; label: string }> = [
  { key: 'personal', label: 'Personal' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'costos', label: 'Costos' },
  { key: 'compras', label: 'Compras' },
  { key: 'tesoreria', label: 'Tesorería' },
  { key: 'nominas', label: 'Nóminas' },
  { key: 'almacen', label: 'Almacén' },
  { key: 'automatizaciones', label: 'Automatizaciones' },
  { key: 'controles', label: 'Controles' },
  { key: 'cargas', label: 'Cargas' },
];

export const DEFAULT_ADMIN_MODULE_ORDER: string[] = ADMIN_ORDERABLE_MODULES.map(m => m.key);

/**
 * Retorna el orden de las secciones top-level en el sidebar de Administración.
 * Si no hay config guardada, retorna el orden default.
 * Si hay config guardada, agrega al final cualquier key nuevo que no estuviera
 * en el orden guardado (backwards compatibility cuando se agregan nuevas secciones).
 */
export function getAdminModuleOrder(saved: CompanySidebarConfig | null | undefined): string[] {
  if (!saved?.adminOrder) return [...DEFAULT_ADMIN_MODULE_ORDER];
  const savedOrder = saved.adminOrder;
  const missing = DEFAULT_ADMIN_MODULE_ORDER.filter(k => !savedOrder.includes(k));
  return missing.length > 0 ? [...savedOrder, ...missing] : savedOrder;
}

// ─── Registries ───────────────────────────────────────────────────────────────

const MODULE_REGISTRIES: Record<SidebarModuleKey, SidebarModule[]> = {
  ventas: VENTAS_MODULES,
  mantenimiento: MANTENIMIENTO_MODULES,
  produccion: PRODUCCION_MODULES,
  compras: COMPRAS_MODULES,
  tesoreria: TESORERIA_MODULES,
  nominas: NOMINAS_MODULES,
  almacen: ALMACEN_MODULES,
};

const MODULE_DEFAULT_CONFIGS: Record<SidebarModuleKey, ModuleSidebarConfig> = {
  ventas: VENTAS_DEFAULT_CONFIG,
  mantenimiento: MANTENIMIENTO_DEFAULT_CONFIG,
  produccion: PRODUCCION_DEFAULT_CONFIG,
  compras: COMPRAS_DEFAULT_CONFIG,
  tesoreria: TESORERIA_DEFAULT_CONFIG,
  nominas: NOMINAS_DEFAULT_CONFIG,
  almacen: ALMACEN_DEFAULT_CONFIG,
};

export const ALL_MODULE_KEYS: SidebarModuleKey[] = [
  'ventas',
  'mantenimiento',
  'produccion',
  'compras',
  'tesoreria',
  'nominas',
  'almacen',
];

// ─── Helpers genéricos ────────────────────────────────────────────────────────

/**
 * Retorna la config efectiva para un módulo dado.
 * Si la empresa no tiene config guardada para ese módulo, usa el default de Orvit.
 */
export function getEffectiveConfig(
  key: SidebarModuleKey,
  saved: CompanySidebarConfig | null | undefined
): ModuleSidebarConfig {
  return saved?.[key] ?? MODULE_DEFAULT_CONFIGS[key];
}

/** Backwards compat — ventas específico */
export function getEffectiveVentasConfig(
  saved: CompanySidebarConfig | null | undefined
): ModuleSidebarConfig {
  return getEffectiveConfig('ventas', saved);
}

/**
 * Retorna el módulo por ID dentro del registry del key dado.
 */
export function getModuleByKey(key: SidebarModuleKey, id: string): SidebarModule | undefined {
  return MODULE_REGISTRIES[key].find(m => m.id === id);
}

/**
 * Retorna el registry completo de un módulo.
 */
export function getRegistry(key: SidebarModuleKey): SidebarModule[] {
  return MODULE_REGISTRIES[key];
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function collectModuleIds(nodes: SidebarNode[]): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (node.type === 'item') {
      ids.add(node.moduleId);
    } else {
      for (const id of collectModuleIds(node.children)) {
        ids.add(id);
      }
    }
  }
  return ids;
}

// ─── Orphaned modules ─────────────────────────────────────────────────────────

/**
 * Retorna los módulos del registry que NO están asignados en la config.
 * Excluye módulos 'future'.
 */
export function getOrphanedModulesForKey(
  key: SidebarModuleKey,
  config: ModuleSidebarConfig
): SidebarModule[] {
  const assignedIds = collectModuleIds(config.groups.flatMap(g => g.children));
  for (const group of config.groups) {
    for (const id of collectModuleIds([group])) {
      assignedIds.add(id);
    }
  }
  return MODULE_REGISTRIES[key].filter(
    m => m.category !== 'future' && !assignedIds.has(m.id)
  );
}

/** Backwards compat — ventas específico */
export function getOrphanedModules(config: ModuleSidebarConfig): SidebarModule[] {
  return getOrphanedModulesForKey('ventas', config);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateModuleConfig(
  key: SidebarModuleKey,
  config: ModuleSidebarConfig
): { valid: boolean; orphaned: string[] } {
  const orphaned = getOrphanedModulesForKey(key, config).map(m => m.id);
  return { valid: orphaned.length === 0, orphaned };
}

/** Backwards compat */
export function validateVentasConfig(config: ModuleSidebarConfig): {
  valid: boolean;
  orphaned: string[];
} {
  return validateModuleConfig('ventas', config);
}

// ─── Custom groups & section labels helpers ───────────────────────────────────

/** Busca un item por su moduleId en todos los registries. */
export function getModuleItemById(moduleId: string): SidebarModule | undefined {
  for (const key of ALL_MODULE_KEYS) {
    const found = MODULE_REGISTRIES[key].find(m => m.id === moduleId);
    if (found) return found;
  }
  return undefined;
}

const MODULE_DISPLAY_LABELS: Record<SidebarModuleKey, string> = {
  ventas: 'Ventas',
  mantenimiento: 'Mantenimiento',
  produccion: 'Producción',
  compras: 'Compras',
  tesoreria: 'Tesorería',
  nominas: 'Nóminas',
  almacen: 'Almacén',
};

/** Retorna todos los items (leaf nodes con path) de todos los módulos, listos para el item picker. */
export function getAllLeafItems(): Array<{
  moduleId: string;
  name: string;
  path: string;
  icon: string;
  moduleKey: SidebarModuleKey;
  moduleLabel: string;
}> {
  return ALL_MODULE_KEYS.flatMap(key =>
    MODULE_REGISTRIES[key]
      .filter(m => m.category !== 'future' && m.path)
      .map(m => ({
        moduleId: m.id,
        name: m.name,
        path: m.path,
        icon: m.icon,
        moduleKey: key,
        moduleLabel: MODULE_DISPLAY_LABELS[key],
      }))
  );
}
