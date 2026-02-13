'use client';

export type InstructionScope = 'EQUIPMENT' | 'MACHINES' | 'COMPONENTS';

export interface AttachmentDraft {
  id: string;
  file?: File;
  name: string;
  size?: number;
  mime?: string;
  url?: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface InstructionPayload {
  workstationId: string;
  title: string;
  contentHtml: string;
  scope: InstructionScope;
  machineIds: string[];
  componentIds: string[];
  attachments: AttachmentDraft[];
}

export interface Machine {
  id: number;
  name: string;
  type?: string;
}

export interface ComponentNode {
  id: number;
  name: string;
  type: 'COMPONENT' | 'SUBCOMPONENT';
  children?: ComponentNode[];
}

export interface Instruction {
  id: number;
  title: string;
  contentHtml?: string;
  scope: InstructionScope;
  machineIds: string[];
  componentIds: string[];
  attachments: AttachmentDraft[];
}

