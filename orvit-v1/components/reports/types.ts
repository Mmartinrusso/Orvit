// Types for Maintenance Report

export type Maintenance = {
  id: number;
  title: string;
  description: string;
  frequencyLabel: string;
  durationMinutes: number;
  nextDate: string;
  kind: "Preventivo" | "Correctivo";
  priority: "Baja" | "Media" | "Alta";
  mandatory: boolean;
};

export type Machine = {
  id: string;
  name: string;
  subtitle?: string;
  metaRightTop?: string;
  metaRightBottom?: string;
  preventives: Maintenance[];
  correctives?: Maintenance[];
};

export type ReportSummary = {
  category: string;
  frequency: string;
  totalItems: number;
  estimatedTime: string;
};

export type ReportModalData = {
  company: string;
  reportTitle: string;
  generatedAtLabel: string;
  category: string;
  frequency: string;
  totalItems: number;
  estimatedTime: string;
  filters: string[];
  machines: Machine[];
};

