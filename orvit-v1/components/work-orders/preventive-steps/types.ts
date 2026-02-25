import { Priority, ExecutionWindow, TimeUnit } from '@/lib/types';

export interface PreventiveFormData {
  title: string;
  description: string;
  priority: Priority;
  frequencyDays: number;
  machineId: string;
  componentIds: string[];
  subcomponentIds: string[];
  assignedToId: string;
  startDate: string;
  notes: string;
  alertDaysBefore: number[];
  isActive: boolean;
  executionWindow: ExecutionWindow;
  timeUnit: TimeUnit;
  timeValue: number;
}

export interface ToolRequest {
  id: string;
  name: string;
  quantity: number;
  category?: string;
  location?: string;
}

export interface ValidationErrors {
  title?: string;
  machineId?: string;
  frequencyDays?: string;
  startDate?: string;
  alertDaysBefore?: string;
}
