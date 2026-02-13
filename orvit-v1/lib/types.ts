// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

// Company and Sector types
export interface Company {
  id: string;
  name: string;
  logo?: string;
}

export interface Area {
  id: number;
  name: string;
  icon: string;
  companyId: number;
}

export interface Sector {
  id: string;
  name: string;
  description?: string;
  companyId: string;
  areaId: string;
  createdAt?: string;
  updatedAt?: string;
  enabledForProduction?: boolean;
}

export interface CompanyState {
  currentCompany: Company | null;
  currentArea: Area | null;
  currentSector: Sector | null;
  areas: Area[];
  sectors: Sector[];
}

// Machine types
export enum MachineStatus {
  ACTIVE = 'ACTIVE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
  DECOMMISSIONED = 'DECOMMISSIONED',
  MAINTENANCE = 'MAINTENANCE',
}

export enum MachineType {
  PRODUCTION = 'production',
  MAINTENANCE = 'maintenance',
  UTILITY = 'utility',
  PACKAGING = 'packaging',
  TRANSPORTATION = 'transportation',
  OTHER = 'other',
}

export interface Attachment {
  id: string;
  name: string;
  type: 'manual' | 'blueprint' | 'photo' | 'document';
  url: string;
  uploadDate: string;
}

export interface Machine {
  id: number;
  name: string;
  nickname?: string;
  aliases?: string[] | null;
  type: MachineType;
  brand: string;
  model?: string;
  serialNumber?: string;
  status: MachineStatus;
  acquisitionDate: Date;
  companyId: number;
  sectorId: number;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  attachments: Attachment[];
  logo?: string;
  // Campos adicionales de identificación
  assetCode?: string;
  sapCode?: string;
  productionLine?: string;
  position?: string;
  // Especificaciones técnicas
  manufacturingYear?: number;
  installationDate?: Date;
  technicalNotes?: string;
  power?: string;
  voltage?: string;
  weight?: string;
  dimensions?: string;
  // Proveedor e información adicional
  supplier?: string;
  description?: string;
  // Garantía
  warrantyExpiration?: Date;
  warrantySupplier?: string;
  warrantyCoverage?: string;
  // Métricas CMMS
  healthScore?: number;
  healthScoreUpdatedAt?: Date;
  criticalityScore?: number;
  lastMaintenanceDate?: Date;
  nextScheduledMaintenance?: Date;
  // Zona de planta
  plantZoneId?: number;
  plantZone?: {
    id: number;
    name: string;
    color?: string;
    breadcrumb?: string[];
  };
  // Contadores virtuales
  _count?: {
    components?: number;
    workOrders?: number;
    failures?: number;
  };
  // Contadores directos (desde API optimizada)
  pendingWorkOrders?: number;
  openFailures?: number;
}

// Component hierarchy types
export interface MachineComponent {
  id: string;
  name: string;
  type: 'part' | 'piece' | 'subpiece' | string; // Ahora acepta cualquier tipo para componentes genéricos
  system?: string;
  description?: string;
  parentId?: string;
  machineId: string;
  attachments: Attachment[];
  children?: MachineComponent[];
  technicalInfo?: string | object;
  logo?: string;
  machineName?: string;
  tools?: ComponentTool[]; // Repuestos/herramientas asociados a este componente
  // Campos de jerarquía
  depth?: number; // Nivel de profundidad en la jerarquía (0 = raíz)
  breadcrumb?: string[]; // Ruta completa de nombres desde la raíz
  // Campos de criticidad (CMMS)
  criticality?: number; // 1-10 score de criticidad
  isSafetyCritical?: boolean; // Si es crítico para la seguridad
  // Campos de métricas
  failureCount?: number; // Cantidad de fallas registradas
  workOrderCount?: number; // Cantidad de OTs asociadas
  // Modelo 3D
  model3dUrl?: string; // URL del modelo 3D (GLB/GLTF)
}

// Event history types
export interface HistoryEvent {
  id: string;
  date: string;
  type: 'maintenance' | 'repair' | 'inspection' | 'modification' | 'incident';
  description: string;
  technicianName: string;
  itemId: string; // can be machine id or component id
  itemType: 'machine' | 'component';
  attachments: Attachment[];
}

// Work Order types
export enum WorkOrderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  PREDICTIVE = 'PREDICTIVE',
  EMERGENCY = 'EMERGENCY',
}

export interface WorkOrderUser {
  id: number;
  name: string;
  email: string;
}

// Nuevos tipos para el sistema mejorado de mantenimientos
export enum ExecutionWindow {
  NONE = 'NONE',
  BEFORE_START = 'BEFORE_START',
  MID_SHIFT = 'MID_SHIFT',
  END_SHIFT = 'END_SHIFT',
  ANY_TIME = 'ANY_TIME',
  SCHEDULED = 'SCHEDULED',
  WEEKEND = 'WEEKEND'
}

export enum TimeUnit {
  HOURS = 'HOURS',
  DAYS = 'DAYS',
  CYCLES = 'CYCLES',
  KILOMETERS = 'KILOMETERS',
  SHIFTS = 'SHIFTS',
  UNITS_PRODUCED = 'UNITS_PRODUCED'
}

export enum ChecklistFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUAL = 'SEMIANNUAL',
  ANNUAL = 'ANNUAL'
}

export interface MaintenanceHistory {
  id: number;
  workOrderId: number;
  machineId?: number;
  componentId?: number;
  executedAt: Date;
  executedById?: number;
  duration?: number;
  cost?: number;
  notes?: string;
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  spareParts?: any;
  nextMaintenanceDate?: Date;
  mttr?: number; // Mean Time To Repair
  mtbf?: number; // Mean Time Between Failures
  completionRate?: number;
  qualityScore?: number;
  workOrder?: any;
  machine?: any;
  component?: any;
  executedBy?: WorkOrderUser;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceChecklist {
  id: number;
  workOrderId?: number;
  machineId?: number;
  componentId?: number;
  title: string;
  description?: string;
  frequency: ChecklistFrequency;
  isTemplate: boolean;
  isActive: boolean;
  companyId: number;
  sectorId?: number;
  items: ChecklistItem[];
  phases?: ChecklistPhase[];
  estimatedTotalTime?: number;
  category?: string;
  workOrder?: any;
  machine?: any;
  component?: any;
  company?: any;
  sector?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  estimatedTime: number;
  items: ChecklistItem[];
  isCompleted?: boolean;
  completedAt?: Date;
}

export interface ChecklistItem {
  id: number;
  checklistId: number;
  title: string;
  description?: string;
  isRequired: boolean;
  expectedValue?: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  order: number;
  checklist?: MaintenanceChecklist;
  executions: ChecklistExecution[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistExecution {
  id: number;
  checklistItemId: number;
  workOrderId?: number;
  executedById?: number;
  isCompleted: boolean;
  actualValue?: string;
  notes?: string;
  hasIssue: boolean;
  issueDescription?: string;
  checklistItem?: ChecklistItem;
  executedBy?: WorkOrderUser;
  executedAt: Date;
}

export interface MaintenanceConfig {
  id: number;
  companyId: number;
  sectorId?: number;
  defaultTimeUnit: TimeUnit;
  defaultExecutionWindow: ExecutionWindow;
  autoScheduling: boolean;
  reminderDays: number;
  allowOverdue: boolean;
  requirePhotos: boolean;
  requireSignoff: boolean;
  company?: any;
  sector?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnhancedWorkOrder {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  type: string;
  machineId?: number;
  componentId?: number;
  workStationId?: number;
  assignedToId?: number;
  assignedWorkerId?: number;
  createdById: number;
  scheduledDate?: Date;
  startedDate?: Date;
  completedDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  cost?: number;
  notes?: string;
  companyId: number;
  sectorId?: number;
  
  // Nuevos campos
  rootCause?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  spareParts?: any;
  failureDescription?: string;
  solution?: string;
  executionWindow?: ExecutionWindow;
  timeUnit?: TimeUnit;
  timeValue?: number;
  tags: string[];
  isCompleted: boolean;
  completionRate?: number;
  
  // Relaciones
  attachments?: any[];
  comments?: any[];
  failureOccurrences?: any[];
  checklist?: MaintenanceChecklist[];
  history?: MaintenanceHistory[];
  assignedTo?: WorkOrderUser;
  assignedWorker?: any;
  company?: any;
  component?: any;
  createdBy?: WorkOrderUser;
  machine?: any;
  sector?: any;
  
  createdAt: Date;
  updatedAt: Date;
}

// KPIs de mantenimiento
export interface MaintenanceKPIs {
  totalMaintenances: number;
  completedOnTime: number;
  overdueMaintenance: number;
  avgCompletionTime: number;
  avgMTTR: number; // Mean Time To Repair
  avgMTBF: number; // Mean Time Between Failures
  completionRate: number;
  costEfficiency: number;
  qualityScore: number;
  uptime: number;
  downtime: number;
  preventiveVsCorrective: {
    preventive: number;
    corrective: number;
  };
}

export interface Worker {
  id: number;
  name: string;
  phone?: string;
  specialty?: string;
  isActive: boolean;
  companyId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tool {
  id: number;
  name: string;
  description?: string;
  itemType: 'TOOL' | 'SUPPLY';
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  stockQuantity: number;
  minStockLevel: number;
  location?: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'DAMAGED' | 'RETIRED';
  acquisitionDate?: Date;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  cost?: number;
  supplier?: string;
  notes?: string;
  companyId: number;
  sectorId?: number;
  createdAt: Date;
  updatedAt: Date;
  // Modelo 3D
  model3dUrl?: string; // URL del modelo 3D (GLB/GLTF)
}

export interface ComponentTool {
  id: number;
  componentId: number;
  toolId: number;
  quantityNeeded: number;
  minStockLevel?: number;
  notes?: string;
  isOptional: boolean;
  createdAt: Date;
  updatedAt: Date;
  component?: MachineComponent;
  tool?: Tool;
}

export interface WorkOrderAttachment {
  id: number;
  workOrderId: number;
  url: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
  uploadedById?: number;
  uploadedBy?: WorkOrderUser;
}

export interface WorkOrder {
  id: number;
  title: string;
  description?: string;
  status: WorkOrderStatus;
  priority: Priority;
  type: MaintenanceType;
  machineId?: number;
  machine?: Machine;
  componentId?: number;
  component?: MachineComponent;
  assignedToId?: number;
  assignedTo?: WorkOrderUser;
  assignedWorkerId?: number;
  assignedWorker?: Worker;
  createdById: number;
  createdBy: WorkOrderUser;
  scheduledDate?: Date;
  startedDate?: Date;
  completedDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  cost?: number;
  notes?: string;
  companyId: number;
  company?: Company;
  sectorId?: number;
  sector?: Sector;
  attachments: WorkOrderAttachment[];
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    attachments: number;
  };
}

// PTW/LOTO Types
export enum PTWType {
  HOT_WORK = 'HOT_WORK',
  CONFINED_SPACE = 'CONFINED_SPACE',
  HEIGHT_WORK = 'HEIGHT_WORK',
  ELECTRICAL = 'ELECTRICAL',
  EXCAVATION = 'EXCAVATION',
  CHEMICAL = 'CHEMICAL',
  RADIATION = 'RADIATION',
  PRESSURE_SYSTEMS = 'PRESSURE_SYSTEMS',
  OTHER = 'OTHER',
}

export enum PTWStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum LOTOStatus {
  LOCKED = 'LOCKED',
  UNLOCKED = 'UNLOCKED',
  PARTIAL = 'PARTIAL',
}

export interface PermitToWork {
  id: number;
  number: string;
  type: PTWType;
  status: PTWStatus;
  companyId: number;
  workOrderId?: number;
  workOrder?: Partial<WorkOrder>;
  machineId?: number;
  machine?: Partial<Machine>;
  sectorId?: number;
  sector?: Partial<Sector>;
  title: string;
  description: string;
  workLocation?: string;
  hazardsIdentified: string[];
  controlMeasures: string[];
  requiredPPE: string[];
  emergencyProcedures?: string;
  emergencyContacts: any[];
  validFrom: Date;
  validTo: Date;
  requestedById: number;
  requestedBy?: Partial<User>;
  approvedById?: number;
  approvedBy?: Partial<User>;
  approvedAt?: Date;
  approvalNotes?: string;
  rejectedById?: number;
  rejectedBy?: Partial<User>;
  rejectedAt?: Date;
  rejectionReason?: string;
  activatedById?: number;
  activatedBy?: Partial<User>;
  activatedAt?: Date;
  suspendedById?: number;
  suspendedBy?: Partial<User>;
  suspendedAt?: Date;
  suspensionReason?: string;
  resumedById?: number;
  resumedBy?: Partial<User>;
  resumedAt?: Date;
  closedById?: number;
  closedBy?: Partial<User>;
  closedAt?: Date;
  closeNotes?: string;
  workCompletedSuccessfully?: boolean;
  finalVerificationChecklist?: any[];
  finalVerifiedById?: number;
  finalVerifiedBy?: Partial<User>;
  finalVerifiedAt?: Date;
  ppeVerifiedById?: number;
  ppeVerifiedBy?: Partial<User>;
  ppeVerifiedAt?: Date;
  lotoExecutions?: LOTOExecution[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LOTOProcedure {
  id: number;
  companyId: number;
  machineId: number;
  machine?: Partial<Machine>;
  name: string;
  description?: string;
  version: number;
  energySources: any[];
  lockoutSteps: any[];
  verificationSteps: any[];
  restorationSteps: any[];
  verificationMethod?: string;
  requiredPPE: string[];
  estimatedMinutes?: number;
  warnings?: string;
  specialConsiderations?: string;
  isActive: boolean;
  isApproved: boolean;
  createdById: number;
  createdBy?: Partial<User>;
  approvedById?: number;
  approvedBy?: Partial<User>;
  approvedAt?: Date;
  executions?: LOTOExecution[];
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    executions: number;
  };
}

export interface LOTOExecution {
  id: number;
  companyId: number;
  procedureId: number;
  procedure?: Partial<LOTOProcedure>;
  workOrderId: number;
  workOrder?: Partial<WorkOrder>;
  ptwId?: number;
  ptw?: Partial<PermitToWork>;
  status: LOTOStatus;
  lockedById: number;
  lockedBy?: Partial<User>;
  lockedAt: Date;
  lockDetails: any[];
  zeroEnergyVerified: boolean;
  zeroEnergyVerifiedById?: number;
  zeroEnergyVerifiedBy?: Partial<User>;
  zeroEnergyVerifiedAt?: Date;
  verificationNotes?: string;
  unlockedById?: number;
  unlockedBy?: Partial<User>;
  unlockedAt?: Date;
  unlockDetails: any[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// FMEA Types
export interface ComponentFailureMode {
  id: number;
  componentId: number;
  companyId: number;
  name: string;
  code?: string;
  description?: string;
  category?: string;
  symptoms: any[];
  causes: any[];
  effects: any[];
  detectability?: number;
  severity?: number;
  occurrence?: number;
  rpn?: number;
  recommendedActions: any[];
  preventiveMeasures?: string;
  predictiveIndicators?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Skills & Certifications Types
export enum CertificationStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
  REVOKED = 'REVOKED',
}

export interface Skill {
  id: number;
  companyId: number;
  name: string;
  code?: string;
  category: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userSkills?: UserSkill[];
  taskRequirements?: TaskSkillRequirement[];
}

export interface UserSkill {
  id: number;
  userId: number;
  user?: Partial<User>;
  skillId: number;
  skill?: Partial<Skill>;
  level: number; // 1-5
  certifiedAt?: Date;
  expiresAt?: Date;
  certificationDoc?: string;
  verifiedById?: number;
  verifiedBy?: Partial<User>;
  verifiedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCertification {
  id: number;
  userId: number;
  user?: Partial<User>;
  companyId: number;
  name: string;
  code?: string;
  issuedBy: string;
  issuedAt: Date;
  expiresAt?: Date;
  documentUrl?: string;
  status: CertificationStatus;
  category?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskSkillRequirement {
  id: number;
  skillId: number;
  skill?: Partial<Skill>;
  minLevel: number;
  companyId: number;
  isActive: boolean;
  checklistId?: number;
  machineId?: number;
  maintenanceType?: string;
  ptwType?: string;
  createdAt: Date;
  updatedAt: Date;
}