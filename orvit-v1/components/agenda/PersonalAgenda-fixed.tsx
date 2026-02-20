'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Clock,
  Calendar,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Bell,
  UserPlus,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { ContactCard } from './ContactCard';
import { ContactDialog } from './ContactDialog';
import { ReminderCard } from './ReminderCard';
import { ReminderDialog } from './ReminderDialog';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  avatar?: string;
  category: string;
  tags: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  pendingReminders: number;
  totalInteractions: number;
}

interface Reminder {
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

export function PersonalAgenda() {
  const queryClient = useQueryClient();

  // Datos con TanStack Query
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['personal-contacts'],
    queryFn: async () => {
      const response = await fetch('/api/contacts');
      if (!response.ok) throw new Error('Error al cargar contactos');
      const data = await response.json();
      return (data.contacts || []).map((contact: any) => ({
        ...contact,
        pendingReminders: contact.pendingReminders || 0,
        totalInteractions: contact.totalInteractions || 0,
      })) as Contact[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: reminders = [], isLoading: remindersLoading } = useQuery({
    queryKey: ['personal-reminders'],
    queryFn: async () => {
      const response = await fetch('/api/reminders');
      if (!response.ok) throw new Error('Error al cargar recordatorios');
      const data = await response.json();
      return (data.reminders || []) as Reminder[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const invalidateContacts = () => queryClient.invalidateQueries({ queryKey: ['personal-contacts'] });
  const invalidateReminders = () => queryClient.invalidateQueries({ queryKey: ['personal-reminders'] });

  // Estados UI para contactos
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // Estados UI para recordatorios
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [selectedContactForReminder, setSelectedContactForReminder] = useState<Contact | null>(null);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reminderStatusFilter, setReminderStatusFilter] = useState('all');
  const [reminderPriorityFilter, setReminderPriorityFilter] = useState('all');

  // ====== FUNCIONES PARA CONTACTOS ======
  const handleContactSubmit = async (contactData: Partial<Contact>) => {
    try {
      setContactSubmitting(true);

      const url = editingContact
        ? `/api/contacts/${editingContact.id}`
        : '/api/contacts';

      const method = editingContact ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        throw new Error('Error al guardar contacto');
      }

      toast.success(editingContact ? 'Contacto actualizado exitosamente' : 'Contacto creado exitosamente');
      setContactDialogOpen(false);
      setEditingContact(null);
      invalidateContacts();
    } catch (error) {
      console.error('Error guardando contacto:', error);
      toast.error('Error al guardar contacto');
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleContactDelete = async (contactId: string) => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar contacto');
      }

      toast.success('Contacto eliminado exitosamente');
      invalidateContacts();
    } catch (error) {
      console.error('Error eliminando contacto:', error);
      toast.error('Error al eliminar contacto');
    }
  };

  const handleCreateReminder = (contact: Contact) => {
    setSelectedContactForReminder(contact);
    setEditingReminder(null);
    setReminderDialogOpen(true);
  };

  const handleViewInteractions = (contact: Contact) => {
    toast.info(`Ver interacciones de ${contact.name} - Próximamente disponible`);
  };

  // ====== FUNCIONES PARA RECORDATORIOS ======
  const handleReminderSubmit = async (reminderData: Partial<Reminder>) => {
    try {
      setReminderSubmitting(true);

      const url = editingReminder
        ? `/api/reminders/${editingReminder.id}`
        : '/api/reminders';

      const method = editingReminder ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reminderData),
      });

      if (!response.ok) {
        throw new Error('Error al guardar recordatorio');
      }

      toast.success(editingReminder ? 'Recordatorio actualizado exitosamente' : 'Recordatorio creado exitosamente');
      setReminderDialogOpen(false);
      setEditingReminder(null);
      setSelectedContactForReminder(null);
      invalidateReminders();
    } catch (error) {
      console.error('Error guardando recordatorio:', error);
      toast.error('Error al guardar recordatorio');
    } finally {
      setReminderSubmitting(false);
    }
  };

  const handleReminderToggleComplete = async (reminderId: string, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/reminders/${reminderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isCompleted }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar recordatorio');
      }

      toast.success(isCompleted ? 'Recordatorio completado' : 'Recordatorio marcado como pendiente');
      invalidateReminders();
    } catch (error) {
      console.error('Error actualizando recordatorio:', error);
      toast.error('Error al actualizar recordatorio');
    }
  };

  const handleReminderDelete = async (reminderId: string) => {
    try {
      const response = await fetch(`/api/reminders/${reminderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al eliminar recordatorio');
      }

      toast.success('Recordatorio eliminado exitosamente');
      invalidateReminders();
    } catch (error) {
      console.error('Error eliminando recordatorio:', error);
      toast.error('Error al eliminar recordatorio');
    }
  };

  // ====== FILTROS Y BÚSQUEDA ======
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || contact.category === categoryFilter;
    
    return matchesSearch && matchesCategory && contact.isActive;
  });

  const filteredReminders = reminders.filter(reminder => {
    const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reminder.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reminder.contactName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = reminderStatusFilter === 'all' || 
                         (reminderStatusFilter === 'pending' && !reminder.isCompleted) ||
                         (reminderStatusFilter === 'completed' && reminder.isCompleted);
    
    const matchesPriority = reminderPriorityFilter === 'all' || reminder.priority === reminderPriorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // ====== ESTADÍSTICAS ======
  const totalContacts = contacts.filter(c => c.isActive).length;
  const totalReminders = reminders.length;
  const pendingReminders = reminders.filter(r => !r.isCompleted).length;
  const overdueReminders = reminders.filter(r => 
    !r.isCompleted && new Date(r.dueDate) < new Date()
  ).length;

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contactos</p>
                <p className="text-2xl font-bold">{totalContacts}</p>
              </div>
              <Users className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recordatorios</p>
                <p className="text-2xl font-bold">{totalReminders}</p>
              </div>
              <Clock className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold">{pendingReminders}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-destructive">{overdueReminders}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pestañas principales */}
      <Tabs defaultValue="contacts" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="contacts">
            <Users className="h-4 w-4 mr-2" />
            Contactos
          </TabsTrigger>
          <TabsTrigger value="reminders">
            <Bell className="h-4 w-4 mr-2" />
            Recordatorios
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Calendario
          </TabsTrigger>
        </TabsList>

        {/* Tab de Contactos */}
        <TabsContent value="contacts" className="space-y-4">
          {/* Controles de contactos */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contactos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  <SelectItem value="Cliente">Clientes</SelectItem>
                  <SelectItem value="Proveedor">Proveedores</SelectItem>
                  <SelectItem value="Interno">Internos</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Colaborador">Colaboradores</SelectItem>
                  <SelectItem value="Socio">Socios</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => {
                setEditingContact(null);
                setContactDialogOpen(true);
              }}
              className="bg-info hover:bg-info/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Contacto
            </Button>
          </div>

          {/* Lista de contactos */}
          {contactsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No hay contactos
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || categoryFilter !== 'all' 
                    ? 'No se encontraron contactos con los filtros aplicados.'
                    : 'Comienza agregando tu primer contacto.'}
                </p>
                {(!searchTerm && categoryFilter === 'all') && (
                  <Button 
                    onClick={() => {
                      setEditingContact(null);
                      setContactDialogOpen(true);
                    }}
                    className="bg-info hover:bg-info/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Contacto
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEdit={(contact) => {
                    setEditingContact(contact);
                    setContactDialogOpen(true);
                  }}
                  onDelete={handleContactDelete}
                  onCreateReminder={handleCreateReminder}
                  onViewInteractions={handleViewInteractions}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab de Recordatorios */}
        <TabsContent value="reminders" className="space-y-4">
          {/* Controles de recordatorios */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar recordatorios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={reminderStatusFilter} onValueChange={setReminderStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="completed">Completados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={reminderPriorityFilter} onValueChange={setReminderPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => {
                setEditingReminder(null);
                setSelectedContactForReminder(null);
                setReminderDialogOpen(true);
              }}
              className="bg-success hover:bg-success/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Recordatorio
            </Button>
          </div>

          {/* Lista de recordatorios */}
          {remindersLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredReminders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No hay recordatorios
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || reminderStatusFilter !== 'all' || reminderPriorityFilter !== 'all'
                    ? 'No se encontraron recordatorios con los filtros aplicados.'
                    : 'Comienza creando tu primer recordatorio.'}
                </p>
                {(!searchTerm && reminderStatusFilter === 'all' && reminderPriorityFilter === 'all') && (
                  <Button 
                    onClick={() => {
                      setEditingReminder(null);
                      setSelectedContactForReminder(null);
                      setReminderDialogOpen(true);
                    }}
                    className="bg-success hover:bg-success/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Recordatorio
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredReminders.map((reminder) => (
                <ReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  onEdit={(reminder) => {
                    setEditingReminder(reminder);
                    setSelectedContactForReminder(null);
                    setReminderDialogOpen(true);
                  }}
                  onDelete={handleReminderDelete}
                  onToggleComplete={handleReminderToggleComplete}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab de Calendario */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Vista de Calendario
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Vista de Calendario
              </h3>
              <p className="text-muted-foreground">
                La vista de calendario estará disponible próximamente.
                <br />
                Aquí podrás ver tus recordatorios y eventos organizados por fechas.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogos */}
      <ContactDialog
        isOpen={contactDialogOpen}
        onClose={() => {
          setContactDialogOpen(false);
          setEditingContact(null);
        }}
        onSubmit={handleContactSubmit}
        contact={editingContact}
      />

      <ReminderDialog
        isOpen={reminderDialogOpen}
        onClose={() => {
          setReminderDialogOpen(false);
          setEditingReminder(null);
          setSelectedContactForReminder(null);
        }}
        onSubmit={handleReminderSubmit}
        reminder={editingReminder}
        contacts={contacts}
        isLoading={reminderSubmitting}
        preSelectedContact={selectedContactForReminder}
      />
    </div>
  );
} 