"use client";

import { useState, useEffect } from "react";
import { cn } from '@/lib/utils';
import { Plus, Search, Users, Calendar, Bell, UserPlus, CalendarPlus, CheckCircle, Clock, AlertTriangle, Filter, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ContactCard } from "./ContactCard";
import { ContactDialog } from "./ContactDialog";
import { ReminderCard } from "./ReminderCard";
import { ReminderDialog } from "./ReminderDialog";
import { Contact, Reminder } from "@/types/agenda";

export function PersonalAgenda() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  
  // Estados para recordatorios
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [selectedContactForReminder, setSelectedContactForReminder] = useState<Contact | null>(null);

  // Estados para filtros de recordatorios
  const [reminderSearchTerm, setReminderSearchTerm] = useState('');
  const [reminderDateFilter, setReminderDateFilter] = useState('all');
  const [reminderContactFilter, setReminderContactFilter] = useState('all-contacts');

  // Estados para ordenamiento
  const [contactSortBy, setContactSortBy] = useState<'name' | 'category' | 'recent'>('name');

  // Estados para calendario
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(new Date());

  // Estado para filtro de KPI activo
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'pending' | 'today' | 'overdue'>('all');
  const [activeTab, setActiveTab] = useState('contacts');

  useEffect(() => {
    loadContacts();
    loadReminders();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm, categoryFilter, contactSortBy]);

  const loadContacts = async () => {
    try {
      const response = await fetch('/api/contacts');
      if (response.ok) {
        const data = await response.json();
        // Validar que la respuesta tenga la estructura esperada
        if (data && data.contacts && Array.isArray(data.contacts)) {
          // Validar que cada contacto tenga los campos requeridos
          const validContacts = data.contacts.filter((contact: any) => 
            contact && contact.id && contact.name
          );
          setContacts(validContacts);
        } else {
          console.error('Respuesta inválida de la API:', data);
          setContacts([]);
        }
      } else {
        console.error('Error en la respuesta de la API:', response.status);
        setContacts([]);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error("No se pudieron cargar los contactos");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReminders = async () => {
    try {
      const response = await fetch('/api/reminders');
      if (response.ok) {
        const data = await response.json();
        setReminders(data.reminders || []);
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
      toast.error("No se pudieron cargar los recordatorios");
    }
  };

  const filterContacts = () => {
    let filtered = contacts;
    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(contact => contact.category === categoryFilter);
    }

    // Ordenar contactos
    filtered = [...filtered].sort((a, b) => {
      switch (contactSortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'es');
        case 'category':
          return (a.category || '').localeCompare(b.category || '', 'es');
        case 'recent':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

    setFilteredContacts(filtered);
  };

  const handleCreateContact = () => {
    setEditingContact(null);
    setIsContactDialogOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setIsContactDialogOpen(true);
  };

  const handleSaveContact = async (contactData: Partial<Contact>) => {
    try {
      setContactSubmitting(true);
      
      const method = editingContact ? 'PUT' : 'POST';
      const url = editingContact ? `/api/contacts/${editingContact.id}` : '/api/contacts';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData),
      });

      if (response.ok) {
        const savedContact = await response.json();
        
        // Validar que el contacto tenga todos los campos requeridos
        if (!savedContact || !savedContact.name) {
          throw new Error('Respuesta inválida del servidor');
        }
        
        if (editingContact) {
          // Actualizar contacto existente en el estado local
          setContacts(prevContacts => 
            prevContacts.map(contact => 
              contact.id === editingContact.id 
                ? { ...contact, ...savedContact }
                : contact
            )
          );
          toast.success('Contacto actualizado exitosamente');
        } else {
          // Agregar nuevo contacto al estado local
          setContacts(prevContacts => [...prevContacts, savedContact]);
          toast.success('Contacto creado exitosamente');
        }
        
        setIsContactDialogOpen(false);
        setEditingContact(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar el contacto');
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error("No se pudo guardar el contacto");
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      const response = await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success("Contacto eliminado exitosamente");
        loadContacts();
      }
    } catch (error) {
      toast.error("No se pudo eliminar el contacto");
    }
  };

  const handleCreateReminder = (contact: Contact) => {
    setSelectedContactForReminder(contact);
    setEditingReminder(null);
    setReminderDialogOpen(true);
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

      const data = await response.json();
      
      if (editingReminder) {
        setReminders(prev => prev.map(r => 
          r.id === editingReminder.id ? data.reminder : r
        ));
        toast.success('Recordatorio actualizado exitosamente');
      } else {
        setReminders(prev => [data.reminder, ...prev]);
        toast.success('Recordatorio creado exitosamente');
      }

      setReminderDialogOpen(false);
      setEditingReminder(null);
      setSelectedContactForReminder(null);
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

      const data = await response.json();
      setReminders(prev => prev.map(r => 
        r.id === reminderId ? data.reminder : r
      ));
      
      toast.success(isCompleted ? 'Recordatorio completado' : 'Recordatorio marcado como pendiente');
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

      setReminders(prev => prev.filter(r => r.id !== reminderId));
      toast.success('Recordatorio eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando recordatorio:', error);
      toast.error('Error al eliminar recordatorio');
    }
  };

  const filterReminders = (reminderList: Reminder[]) => {
    let filtered = reminderList;

    // Filtro por búsqueda
    if (reminderSearchTerm) {
      filtered = filtered.filter(reminder =>
        reminder.title.toLowerCase().includes(reminderSearchTerm.toLowerCase()) ||
        reminder.description.toLowerCase().includes(reminderSearchTerm.toLowerCase()) ||
        reminder.contactName?.toLowerCase().includes(reminderSearchTerm.toLowerCase())
      );
    }

    // Filtro por contacto
    if (reminderContactFilter !== 'all-contacts') {
      if (reminderContactFilter === 'no-contact') {
        filtered = filtered.filter(reminder => !reminder.contactId);
      } else {
        filtered = filtered.filter(reminder => reminder.contactId === reminderContactFilter);
      }
    }

    // Filtro por fecha
    if (reminderDateFilter !== 'all') {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      filtered = filtered.filter(reminder => {
        const reminderDate = new Date(reminder.dueDate);
        
        switch (reminderDateFilter) {
          case 'overdue':
            return reminderDate < today && !reminder.isCompleted;
          case 'today':
            return reminderDate.toDateString() === today.toDateString();
          case 'tomorrow':
            return reminderDate.toDateString() === tomorrow.toDateString();
          case 'week':
            return reminderDate >= today && reminderDate <= weekEnd;
          case 'month':
            return reminderDate >= today && reminderDate <= monthEnd;
          default:
            return true;
        }
      });
    }

    return filtered;
  };

  const stats = {
    totalContacts: contacts.length,
    pendingReminders: reminders.filter(r => !r.isCompleted).length,
    todayReminders: reminders.filter(r => new Date(r.dueDate).toDateString() === new Date().toDateString() && !r.isCompleted).length,
    overdueReminders: reminders.filter(r => new Date(r.dueDate) < new Date() && !r.isCompleted).length
  };

  // Función para manejar click en KPIs
  const handleKpiClick = (kpiType: 'pending' | 'today' | 'overdue') => {
    setActiveKpiFilter(kpiType);
    setActiveTab('reminders');

    // Mapear el tipo de KPI al filtro de fecha correspondiente
    const dateFilterMap: Record<string, string> = {
      'pending': 'all',
      'today': 'today',
      'overdue': 'overdue'
    };

    setReminderDateFilter(dateFilterMap[kpiType]);
  };

  // Función para limpiar filtro de KPI
  const clearKpiFilter = () => {
    setActiveKpiFilter('all');
    setReminderDateFilter('all');
  };

  // Funciones del calendario
  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentCalendarDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentCalendarDate(newDate);
  };

  const selectDay = (day: number) => {
    const newSelectedDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day);
    setSelectedCalendarDay(newSelectedDay);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentCalendarDate(today);
    setSelectedCalendarDay(today);
  };

  const getSelectedDayReminders = () => {
    return reminders.filter(r => {
      const reminderDate = new Date(r.dueDate);
      return reminderDate.toDateString() === selectedCalendarDay.toDateString();
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Cargando agenda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mejorado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Mi Agenda Personal</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestiona tus contactos, recordatorios e interacciones</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            setSelectedContactForReminder(null);
            setEditingReminder(null);
            setReminderDialogOpen(true);
          }}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Recordatorio
          </Button>
          <Button size="sm" onClick={handleCreateContact}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Contacto
          </Button>
        </div>
      </div>

      {/* KPI Cards neutros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contactos */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Contactos</p>
                <p className="text-2xl font-bold mt-1">{stats.totalContacts}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recordatorios Pendientes */}
        <Card
          className={cn('cursor-pointer transition-all hover:bg-accent/50',
            activeKpiFilter === 'pending' && 'ring-2 ring-primary bg-accent/30'
          )}
          onClick={() => handleKpiClick('pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold mt-1">{stats.pendingReminders}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Para Hoy */}
        <Card
          className={cn('cursor-pointer transition-all hover:bg-accent/50',
            activeKpiFilter === 'today' && 'ring-2 ring-primary bg-accent/30'
          )}
          onClick={() => handleKpiClick('today')}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Para Hoy</p>
                <p className="text-2xl font-bold mt-1">{stats.todayReminders}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vencidos */}
        <Card
          className={cn('cursor-pointer transition-all hover:bg-accent/50',
            activeKpiFilter === 'overdue' && 'ring-2 ring-destructive bg-destructive/5'
          )}
          onClick={() => handleKpiClick('overdue')}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Vencidos</p>
                <p className={cn('text-2xl font-bold mt-1', stats.overdueReminders > 0 && 'text-destructive')}>{stats.overdueReminders}</p>
              </div>
              <div className={cn('p-2 rounded-lg', stats.overdueReminders > 0 ? 'bg-destructive/10' : 'bg-muted')}>
                <AlertTriangle className={cn('h-4 w-4', stats.overdueReminders > 0 ? 'text-destructive' : 'text-muted-foreground')} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); if (value !== 'reminders') clearKpiFilter(); }} className="space-y-4">
        <TabsList>
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

        <TabsContent value="contacts" className="space-y-4">
          {/* Barra de filtros compacta */}
          <div className="flex flex-col sm:flex-row gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contactos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40 h-9 bg-background">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Cliente">Cliente</SelectItem>
                  <SelectItem value="Proveedor">Proveedor</SelectItem>
                  <SelectItem value="Interno">Interno</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={contactSortBy} onValueChange={(value: 'name' | 'category' | 'recent') => setContactSortBy(value)}>
                <SelectTrigger className="w-36 h-9 bg-background">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre (A-Z)</SelectItem>
                  <SelectItem value="category">Categoría</SelectItem>
                  <SelectItem value="recent">Recientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredContacts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
                  {contacts.length === 0 ? (
                    <UserPlus className="h-10 w-10 text-muted-foreground/50" />
                  ) : (
                    <Search className="h-10 w-10 text-muted-foreground/50" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {contacts.length === 0 ? 'Tu agenda está vacía' : 'Sin resultados'}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  {contacts.length === 0
                    ? 'Comienza agregando contactos para gestionar tus relaciones y crear recordatorios personalizados'
                    : 'No se encontraron contactos con los filtros aplicados. Intenta ajustar los criterios de búsqueda.'
                  }
                </p>
                {contacts.length === 0 && (
                  <Button onClick={handleCreateContact} size="lg">
                    <UserPlus className="h-5 w-5 mr-2" />
                    Agregar primer contacto
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map(contact => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEdit={handleEditContact}
                  onDelete={handleDeleteContact}
                  onCreateReminder={handleCreateReminder}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          {/* Indicador de filtro KPI activo */}
          {activeKpiFilter !== 'all' && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Filtrando por: {activeKpiFilter === 'pending' ? 'Pendientes' : activeKpiFilter === 'today' ? 'Para Hoy' : 'Vencidos'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearKpiFilter} className="h-7">
                Limpiar filtro
              </Button>
            </div>
          )}

          {/* Barra de filtros compacta para recordatorios */}
          <div className="flex flex-col sm:flex-row gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar recordatorios..."
                value={reminderSearchTerm}
                onChange={(e) => setReminderSearchTerm(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>
            <div className="flex gap-2">
              <Select value={reminderDateFilter} onValueChange={setReminderDateFilter}>
                <SelectTrigger className="w-36 h-9 bg-background">
                  <SelectValue placeholder="Fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="tomorrow">Mañana</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reminderContactFilter} onValueChange={setReminderContactFilter}>
                <SelectTrigger className="w-40 h-9 bg-background">
                  <SelectValue placeholder="Contacto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-contacts">Todos</SelectItem>
                  <SelectItem value="no-contact">Sin contacto</SelectItem>
                  {contacts.slice(0, 10).map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid de Recordatorios Pendientes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Recordatorios Pendientes</h3>
              <span className="text-xs text-muted-foreground">{reminders.filter(r => !r.isCompleted).length} pendientes</span>
            </div>

            {reminders.filter(r => !r.isCompleted).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-muted flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Todo al día</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                    No tienes recordatorios pendientes. Crea uno nuevo para mantenerte organizado.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedContactForReminder(null);
                      setEditingReminder(null);
                      setReminderDialogOpen(true);
                    }}
                  >
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Crear recordatorio
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filterReminders(reminders.filter(r => !r.isCompleted)).map(reminder => (
                    <ReminderCard
                      key={reminder.id}
                      reminder={reminder}
                      onEdit={(reminder) => {
                        setEditingReminder(reminder);
                        setReminderDialogOpen(true);
                      }}
                      onDelete={handleReminderDelete}
                      onToggleComplete={handleReminderToggleComplete}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Recordatorios Completados */}
          {reminders.filter(r => r.isCompleted).length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <h3 className="text-sm font-medium text-foreground">Completados Recientes</h3>
                </div>
                <span className="text-xs text-muted-foreground">{reminders.filter(r => r.isCompleted).length} completados</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filterReminders(reminders.filter(r => r.isCompleted)).slice(0, 8).map(reminder => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onEdit={(reminder) => {
                      setEditingReminder(reminder);
                      setReminderDialogOpen(true);
                    }}
                    onDelete={handleReminderDelete}
                    onToggleComplete={handleReminderToggleComplete}
                  />
                ))}
              </div>
              {filterReminders(reminders.filter(r => r.isCompleted)).length > 8 && (
                <div className="text-center pt-2">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    Ver todos los completados ({filterReminders(reminders.filter(r => r.isCompleted)).length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Vista de Calendario</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateCalendar('prev')}
                    className="h-8 w-8 p-0"
                    aria-label="Anterior"
                  >
                    ←
                  </Button>
                  <div className="text-sm font-medium px-3">
                    {currentCalendarDate.toLocaleDateString('es-ES', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateCalendar('next')}
                    className="h-8 w-8 p-0"
                    aria-label="Siguiente"
                  >
                    →
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToToday}
                    className="h-8 px-3 text-xs"
                  >
                    Hoy
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendario navegable */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-sm font-medium p-2 text-muted-foreground">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 42 }, (_, i) => {
                  const startOfMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
                  const startDay = startOfMonth.getDay();
                  const dayNumber = i - startDay + 1;
                  const daysInMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 0).getDate();
                  const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                  const dayDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), dayNumber);
                  const isToday = isCurrentMonth && dayDate.toDateString() === new Date().toDateString();
                  const isSelected = isCurrentMonth && dayDate.toDateString() === selectedCalendarDay.toDateString();
                  
                  // Contar recordatorios para este día
                  const dayReminders = reminders.filter(r => {
                    const reminderDate = new Date(r.dueDate);
                    return reminderDate.toDateString() === dayDate.toDateString() && !r.isCompleted;
                  });

                  const dayCompletedReminders = reminders.filter(r => {
                    const reminderDate = new Date(r.dueDate);
                    return reminderDate.toDateString() === dayDate.toDateString() && r.isCompleted;
                  });

                  return (
                    <div 
                      key={i} 
                      onClick={() => isCurrentMonth && selectDay(dayNumber)}
                      className={cn(
                        'text-center text-sm p-2 rounded cursor-pointer transition-all duration-200',
                        isCurrentMonth ? 'text-foreground hover:bg-accent' : 'text-muted-foreground/50 cursor-default',
                        isToday && 'bg-primary text-primary-foreground hover:bg-primary/90',
                        isSelected && !isToday && 'bg-muted ring-2 ring-primary',
                        dayReminders.length > 0 && 'ring-2 ring-orange-400'
                      )}
                    >
                      {isCurrentMonth ? (
                        <div>
                          <div className="font-medium">{dayNumber}</div>
                          <div className="flex justify-center gap-1 mt-1">
                            {dayReminders.length > 0 && (
                              <div className="w-1.5 h-1.5 bg-warning rounded-full"></div>
                            )}
                            {dayCompletedReminders.length > 0 && (
                              <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                            )}
                          </div>
                        </div>
                      ) : ''}
                    </div>
                  );
                })}
              </div>

              {/* Recordatorios del día seleccionado */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Recordatorios del {selectedCalendarDay.toLocaleDateString('es-ES', { 
                    weekday: 'long',
                    day: 'numeric', 
                    month: 'long',
                    year: 'numeric' 
                  })}
                </h4>
                
                {getSelectedDayReminders().length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No hay recordatorios para este día
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Pendientes */}
                    {getSelectedDayReminders().filter(r => !r.isCompleted).length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-warning-muted-foreground mb-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pendientes ({getSelectedDayReminders().filter(r => !r.isCompleted).length})
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {getSelectedDayReminders().filter(r => !r.isCompleted).map(reminder => (
                            <ReminderCard
                              key={reminder.id}
                              reminder={reminder}
                              onEdit={(reminder) => {
                                setEditingReminder(reminder);
                                setReminderDialogOpen(true);
                              }}
                              onDelete={handleReminderDelete}
                              onToggleComplete={handleReminderToggleComplete}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completados */}
                    {getSelectedDayReminders().filter(r => r.isCompleted).length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-success mb-2 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Completados ({getSelectedDayReminders().filter(r => r.isCompleted).length})
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {getSelectedDayReminders().filter(r => r.isCompleted).map(reminder => (
                            <ReminderCard
                              key={reminder.id}
                              reminder={reminder}
                              onEdit={(reminder) => {
                                setEditingReminder(reminder);
                                setReminderDialogOpen(true);
                              }}
                              onDelete={handleReminderDelete}
                              onToggleComplete={handleReminderToggleComplete}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ContactDialog
        isOpen={isContactDialogOpen}
        onClose={() => {
          setIsContactDialogOpen(false);
          setEditingContact(null);
        }}
        onSave={handleSaveContact}
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