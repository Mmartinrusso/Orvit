export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  notes?: string;
  avatar?: string;
  category?: string;
  tags: string[];
  isActive: boolean;
  pendingReminders: number;
  totalInteractions: number;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'baja' | 'media' | 'alta';
  type: string;
  contactId?: string;
  contactName?: string;
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
