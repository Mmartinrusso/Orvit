'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  X,
  ExternalLink,
  Package,
  Filter,
  Search,
  Maximize2,
  FileText,
  Landmark,
  Receipt,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotificationPanel({ triggerClassName = '' }: { triggerClassName?: string }) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
    isLoading
  } = useNotifications();
  
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Permite abrir el modal de notificaciones desde cualquier parte (ej: Sidebar)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = async () => {
      setIsOpen(false);
      setIsModalOpen(true);
      try {
        await fetchNotifications();
      } catch {
        // noop
      }
    };

    window.addEventListener('orvit:notifications:open', handler as EventListener);
    return () => {
      window.removeEventListener('orvit:notifications:open', handler as EventListener);
    };
  }, [fetchNotifications]);

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Cerrar ambos paneles antes de navegar
    setIsOpen(false);
    setIsModalOpen(false);
    
    // Navegar según el tipo de notificación
    if (notification.workOrderId) {
      router.push(`/mantenimiento/ordenes?id=${notification.workOrderId}`);
    } else if (notification.toolId && (notification.type === 'stock_low' || notification.type === 'stock_out')) {
      router.push(`/panol?toolId=${notification.toolId}`);
    } else if (notification.type === 'stock_low' && notification.relatedData?.isGeneralStockAlert) {
      // Para notificaciones generales de stock bajo, ir al pañol sin toolId específico
      router.push(`/panol`);
    } else if (notification.taskId && (notification.type.startsWith('task_') || notification.type === 'system_alert')) {
      // Determinar si es una tarea fija o normal basado en el tipo de notificación
      const isFixedTask = notification.type === 'task_auto_reset' || 
                         (notification.relatedData && notification.relatedData.isFixedTask);
      
      const tab = isFixedTask ? 'fijas' : 'tareas';
      const type = isFixedTask ? 'fixed' : 'normal';
      
      router.push(`/administracion/agenda?tab=${tab}&openTask=${notification.taskId}&type=${type}`);
    } else if (notification.reminderId) {
      router.push(`/agenda?reminderId=${notification.reminderId}`);
    } else if (notification.relatedData?.link) {
      router.push(notification.relatedData.link);
    } else if (notification.type === 'invoice_due_soon' || notification.type === 'invoice_overdue') {
      const invoiceId = notification.relatedData?.invoiceId;
      router.push(invoiceId ? `/ventas/facturas?id=${invoiceId}` : '/ventas/facturas');
    } else if (notification.type === 'cheque_due_soon' || notification.type === 'cheque_overdue') {
      const chequeId = notification.relatedData?.chequeId;
      router.push(chequeId ? `/ventas/cheques?id=${chequeId}` : '/ventas/cheques');
    } else if (notification.type === 'quote_expiring') {
      const quoteId = notification.relatedData?.quoteId;
      router.push(quoteId ? `/ventas/cotizaciones?id=${quoteId}` : '/ventas/cotizaciones');
    } else if (notification.type === 'payment_received') {
      router.push('/ventas/cobros');
    }
  };

  const handleRefresh = async () => {
    await fetchNotifications();
  };

  const getPriorityIcon = (notification: Notification) => {
    // Iconos específicos para notificaciones de stock
    if (notification.type === 'stock_out') {
      return <Package className="h-5 w-5" />;
    } else if (notification.type === 'stock_low') {
      return <Package className="h-5 w-5" />;
    }
    
    // Iconos específicos para notificaciones de tareas
    if (notification.type === 'task_assigned') {
      return <Bell className="h-5 w-5" />;
    } else if (notification.type === 'task_completed') {
      return <CheckCheck className="h-5 w-5" />;
    } else if (notification.type === 'task_overdue') {
      return <AlertTriangle className="h-5 w-5" />;
    } else if (notification.type === 'task_due_soon') {
      return <Clock className="h-5 w-5" />;
    } else if (notification.type === 'task_updated') {
      return <Bell className="h-5 w-5" />;
    } else if (notification.type === 'task_deleted') {
      return <X className="h-5 w-5" />;
    } else if (notification.type === 'task_auto_reset') {
      return <Clock className="h-5 w-5" />;
    } else if (notification.type === 'task_commented') {
      return <Bell className="h-5 w-5" />;
    }
    
    // Iconos específicos para notificaciones de ventas
    if (notification.type === 'invoice_due_soon' || notification.type === 'invoice_overdue') {
      return <FileText className="h-5 w-5" />;
    } else if (notification.type === 'cheque_due_soon' || notification.type === 'cheque_overdue') {
      return <Landmark className="h-5 w-5" />;
    } else if (notification.type === 'quote_expiring') {
      return <Receipt className="h-5 w-5" />;
    } else if (notification.type === 'payment_received') {
      return <CheckCheck className="h-5 w-5" />;
    }

    // Iconos específicos para notificaciones de recordatorios
    if (notification.type === 'reminder_overdue') {
      return <AlertTriangle className="h-5 w-5" />;
    } else if (notification.type === 'reminder_due_today') {
      return <Clock className="h-5 w-5" />;
    } else if (notification.type === 'reminder_due_soon') {
      return <Clock className="h-5 w-5" />;
    }
    
    // Iconos por prioridad para otras notificaciones
    switch (notification.priority) {
      case 'urgent':
        return <AlertTriangle className="h-5 w-5" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5" />;
      case 'medium':
        return <Clock className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-destructive bg-gradient-to-r from-destructive/10 to-card shadow-md hover:from-destructive/15';
      case 'high':
        return 'border-l-warning-muted-foreground bg-gradient-to-r from-warning-muted/80 to-card shadow-md hover:from-warning-muted';
      case 'medium':
        return 'border-l-warning-muted-foreground/70 bg-gradient-to-r from-warning-muted/60 to-card shadow-sm hover:from-warning-muted/80';
      default:
        return 'border-l-muted-foreground bg-gradient-to-r from-muted/60 to-card shadow-sm hover:from-muted/80';
    }
  };

  const formatTimestamp = (timestamp: Date | string) => {
    const now = new Date();
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return 'ahora mismo';
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'stock_out':
        return 'Sin Stock';
      case 'stock_low':
        return 'Stock Bajo';
      case 'work_order_overdue':
        return 'Orden Vencida';
      case 'work_order_due_soon':
        return 'Orden Próxima';
      case 'tool_request_new':
        return 'Solicitud Nueva';
      case 'tool_request_approved':
        return 'Solicitud Aprobada';
      case 'tool_request_rejected':
        return 'Solicitud Rechazada';
      case 'task_assigned':
        return 'Tarea Asignada';
      case 'task_completed':
        return 'Tarea Completada';
      case 'task_overdue':
        return 'Tarea Vencida';
      case 'task_due_soon':
        return 'Tarea Próxima';
      case 'task_updated':
        return 'Tarea Actualizada';
      case 'task_deleted':
        return 'Tarea Eliminada';
      case 'task_auto_reset':
        return 'Reinicio Automático';
      case 'task_commented':
        return 'Comentario en Tarea';
      case 'reminder_overdue':
        return 'Recordatorio Vencido';
      case 'reminder_due_today':
        return 'Recordatorio Hoy';
      case 'reminder_due_soon':
        return 'Recordatorio Próximo';
      case 'invoice_due_soon':
        return 'Factura por Vencer';
      case 'invoice_overdue':
        return 'Factura Vencida';
      case 'cheque_due_soon':
        return 'Cheque por Vencer';
      case 'cheque_overdue':
        return 'Cheque Vencido';
      case 'quote_expiring':
        return 'Cotización por Vencer';
      case 'payment_received':
        return 'Pago Recibido';
      default:
        return type.replace('_', ' ');
    }
  };

  const isDateInRange = (date: Date | string, filter: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateObj = date instanceof Date ? date : new Date(date);
    const notificationDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    switch (filter) {
      case 'today':
        return notificationDate.getTime() === today.getTime();
      case 'yesterday':
        return notificationDate.getTime() === yesterday.getTime();
      case 'this_week':
        return dateObj >= weekAgo && dateObj <= now;
      case 'this_month':
        return dateObj >= monthAgo && dateObj <= now;
      case 'older':
        return dateObj < monthAgo;
      default:
        return true;
    }
  };

  // Asegurar que notifications sea un array
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  const filteredNotifications = safeNotifications.filter(notification => {
    const matchesSearch = searchTerm === '' ||
                         notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = priorityFilter === 'all' || notification.priority === priorityFilter;
    const matchesType = typeFilter === 'all' || notification.type === typeFilter;
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'read' && notification.read) ||
                         (statusFilter === 'unread' && !notification.read);
    const matchesDate = dateFilter === 'all' || isDateInRange(notification.timestamp, dateFilter);

    return matchesSearch && matchesPriority && matchesType && matchesStatus && matchesDate;
  });

  const handleOpenModal = () => {
    setIsOpen(false);
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPriorityFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setDateFilter('all');
  };

  const getDateFilterLabel = (filter: string) => {
    switch (filter) {
      case 'today': return 'hoy';
      case 'yesterday': return 'ayer';
      case 'this_week': return 'esta semana';
      case 'this_month': return 'este mes';
      case 'older': return 'más antiguas';
      default: return '';
    }
  };

  return (
    <>
    <DropdownMenu open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      // Si se cierra el dropdown, también cerrar el modal si está abierto
      if (!open && isModalOpen) {
        setIsModalOpen(false);
      }
    }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('relative', triggerClassName)} aria-label="Notificaciones">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 max-h-[420px] bg-background/95 backdrop-blur-md border border-border shadow-2xl p-0"
        onInteractOutside={(e) => {
          // Permitir que el dropdown se cierre al hacer clic fuera
          setIsOpen(false);
        }}
      >
        <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-muted/50 to-muted/30">
          <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-primary/10 rounded-lg">
                <Bell className="h-4 w-4 text-primary" />
              </div>
            <div>
                              <DropdownMenuLabel className="p-0 text-base font-bold text-foreground">
                  Notificaciones
                </DropdownMenuLabel>
              {unreadCount > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium text-foreground">
                  {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                    </span>
                  </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenModal}
              className="h-7 w-7 p-0 hover:bg-muted rounded-lg"
              title="Ver todas las notificaciones"
              aria-label="Ver detalle"
            >
              <Maximize2 className="h-4 w-4 text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-7 w-7 p-0 hover:bg-muted rounded-lg"
              title="Actualizar"
              aria-label="Actualizar"
            >
              {isLoading ? <Loader2 className="h-4 w-4 text-foreground animate-spin" /> : <Clock className="h-4 w-4 text-foreground" />}
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl mb-3">
              <Bell className="h-10 w-10 text-primary/70" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Todo despejado</h3>
            <p className="text-xs text-muted-foreground mb-1">No hay notificaciones pendientes</p>
            <p className="text-xs text-muted-foreground/70 mb-4">Te avisaremos cuando llegue algo importante</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenModal}
              className="text-xs border-primary/30 hover:bg-primary/10 hover:border-primary/50"
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              Ver historial completo
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[320px] min-h-[120px] overflow-y-auto">
            <div className="space-y-2 p-2">
              {notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'group relative p-2 rounded-lg border-l-4 cursor-pointer transition-all duration-300',
                    'hover:scale-[1.01] hover:shadow-lg hover:border-l-6',
                    getPriorityColor(notification.priority),
                    !notification.read ? 'opacity-100 ring-1 ring-primary/20' : 'opacity-80'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                  title={notification.taskId || notification.workOrderId || notification.toolId || notification.reminderId || notification.relatedData?.link || notification.type?.startsWith('invoice_') || notification.type?.startsWith('cheque_') || notification.type === 'quote_expiring' || notification.type === 'payment_received' ?
                    "Haz clic para ver detalles" : notification.title}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={cn('p-1 rounded-md transition-colors duration-200',
                        !notification.read
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}>
                      {getPriorityIcon(notification)}
                      </div>
                    </div>
                      <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-foreground truncate">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground"
                              title="Marcar como leída"
                              aria-label="Completar"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                                            <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2 leading-snug">
                        {notification.message}
                      </p>
                        <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded border border-border/50">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                            notification.priority === 'urgent' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                            notification.priority === 'high' ? 'bg-warning-muted text-warning-muted-foreground border border-warning-muted-foreground/20' :
                            notification.priority === 'medium' ? 'bg-warning-muted/60 text-warning-muted-foreground border border-warning-muted-foreground/20' :
                            'bg-muted text-muted-foreground border border-border'
                          )}>
                            {notification.priority === 'urgent' ? 'Urgente' :
                             notification.priority === 'high' ? 'Alta' :
                             notification.priority === 'medium' ? 'Media' : 'Baja'}
                          </span>
                        </div>
                        {(notification.workOrderId || notification.taskId || notification.toolId || notification.reminderId || notification.relatedData?.link || notification.type?.startsWith('invoice_') || notification.type?.startsWith('cheque_') || notification.type === 'quote_expiring' || notification.type === 'payment_received') && (
                          <div className="flex items-center gap-1 text-primary opacity-70 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-3 w-3" />
                            <span className="text-[10px] font-medium">Ver detalles</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length > 10 && (
                <div className="text-center py-2 border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs font-medium hover:bg-primary/10 hover:text-primary px-3 py-1.5 rounded-lg" 
                    onClick={handleOpenModal}
                  >
                    Ver todas las notificaciones ({notifications.length})
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Modal de todas las notificaciones */}
    <Dialog open={isModalOpen} onOpenChange={(open) => {
      setIsModalOpen(open);
      // Si se cierra el modal, también cerrar el dropdown si está abierto
      if (!open && isOpen) {
        setIsOpen(false);
      }
    }}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Historial de Notificaciones
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} sin leer
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Revisa y gestiona todas tus notificaciones. Filtra por fecha, tipo y prioridad.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Filtros y búsqueda */}
          <div className="space-y-3">
            {/* Barra de búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar notificaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="unread">Sin leer</SelectItem>
                  <SelectItem value="read">Leídas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="stock_out">Sin Stock</SelectItem>
                  <SelectItem value="stock_low">Stock Bajo</SelectItem>
                  <SelectItem value="work_order_overdue">Orden Vencida</SelectItem>
                  <SelectItem value="work_order_due_soon">Orden Próxima</SelectItem>
                  <SelectItem value="tool_request_new">Solicitud Nueva</SelectItem>
                  <SelectItem value="task_assigned">Tarea Asignada</SelectItem>
                  <SelectItem value="task_completed">Tarea Completada</SelectItem>
                  <SelectItem value="task_overdue">Tarea Vencida</SelectItem>
                  <SelectItem value="task_due_soon">Tarea Próxima</SelectItem>
                  <SelectItem value="task_updated">Tarea Actualizada</SelectItem>
                  <SelectItem value="task_deleted">Tarea Eliminada</SelectItem>
                  <SelectItem value="task_auto_reset">Reinicio Automático</SelectItem>
                  <SelectItem value="task_commented">Comentario en Tarea</SelectItem>
                  <SelectItem value="reminder_overdue">Recordatorio Vencido</SelectItem>
                  <SelectItem value="reminder_due_today">Recordatorio Hoy</SelectItem>
                  <SelectItem value="reminder_due_soon">Recordatorio Próximo</SelectItem>
                  <SelectItem value="invoice_due_soon">Factura por Vencer</SelectItem>
                  <SelectItem value="invoice_overdue">Factura Vencida</SelectItem>
                  <SelectItem value="cheque_due_soon">Cheque por Vencer</SelectItem>
                  <SelectItem value="cheque_overdue">Cheque Vencido</SelectItem>
                  <SelectItem value="quote_expiring">Cotización por Vencer</SelectItem>
                  <SelectItem value="payment_received">Pago Recibido</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Fecha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="yesterday">Ayer</SelectItem>
                  <SelectItem value="this_week">Esta semana</SelectItem>
                  <SelectItem value="this_month">Este mes</SelectItem>
                  <SelectItem value="older">Más antiguas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Información y acciones */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filteredNotifications.length} de {notifications.length} notificaciones
              </span>
              {dateFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {getDateFilterLabel(dateFilter)}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(searchTerm || priorityFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all') && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Limpiar filtros
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Clock className="h-3.5 w-3.5 mr-1.5" />}
                Actualizar
              </Button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <ScrollArea className="flex-1 -mx-6 px-6">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              {searchTerm || priorityFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all' ? (
                <>
                  <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No se encontraron notificaciones</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {dateFilter !== 'all' ? 
                      `No hay notificaciones ${getDateFilterLabel(dateFilter)}` : 
                      'Prueba ajustando los filtros de búsqueda'
                    }
                  </p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Limpiar filtros
                  </Button>
                </>
              ) : (
                <>
                  <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl mb-6">
                    <Bell className="h-16 w-16 text-primary/60 mx-auto" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-3">¡Todo despejado!</h2>
                  <p className="text-lg font-medium text-muted-foreground mb-2">No hay notificaciones pendientes</p>
                  <p className="text-sm text-muted-foreground/70">Cuando llegue algo importante, lo verás aquí primero</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'group relative p-2 rounded-lg border-l-4 border-r-4 cursor-pointer transition-all duration-300',
                    'hover:scale-[1.005] hover:shadow-xl hover:border-l-6 hover:border-r-6 backdrop-blur-sm',
                    getPriorityColor(notification.priority),
                    !notification.read ? 'opacity-100 ring-2 ring-primary/30' : 'opacity-85'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                  title={notification.taskId || notification.workOrderId || notification.toolId || notification.reminderId || notification.relatedData?.link || notification.type?.startsWith('invoice_') || notification.type?.startsWith('cheque_') || notification.type === 'quote_expiring' || notification.type === 'payment_received' ?
                    "Haz clic para ver detalles" : notification.title}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={cn('p-1 rounded-md transition-all duration-200',
                        !notification.read
                          ? 'bg-primary/15 text-primary shadow-md'
                          : 'bg-muted text-muted-foreground'
                      )}>
                      {getPriorityIcon(notification)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <h4 className="text-xs font-semibold text-foreground leading-tight truncate">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                              <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 animate-pulse shadow-lg" />
                          )}
                        </div>
                          <div className="flex items-center gap-1 mb-1">
                            <Badge 
                              variant="outline" 
                              className="text-[10px] font-medium px-2 py-0.5 bg-card border-border/50"
                            >
                              {getNotificationTypeLabel(notification.type)}
                            </Badge>
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold',
                              notification.priority === 'urgent' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                              notification.priority === 'high' ? 'bg-warning-muted text-warning-muted-foreground border border-warning-muted-foreground/20' :
                              notification.priority === 'medium' ? 'bg-warning-muted/60 text-warning-muted-foreground border border-warning-muted-foreground/20' :
                              'bg-muted text-muted-foreground border border-border'
                            )}>
                              {notification.priority === 'urgent' ? '🔴 Urgente' :
                               notification.priority === 'high' ? '🟠 Alta' :
                               notification.priority === 'medium' ? '🟡 Media' : '⚪ Baja'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                              size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                              className="h-6 w-6 p-0 hover:bg-primary hover:text-primary-foreground rounded-lg"
                              title="Marcar como leída"
                              aria-label="Completar"
                        >
                              <Check className="h-3 w-3" />
                        </Button>
                      )}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug mb-2 font-medium">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted/80 border border-border/50 px-2 py-1 rounded">
                          📅 {formatTimestamp(notification.timestamp)}
                        </span>
                        {(notification.workOrderId || notification.taskId || notification.toolId || notification.reminderId || notification.relatedData?.link || notification.type?.startsWith('invoice_') || notification.type?.startsWith('cheque_') || notification.type === 'quote_expiring' || notification.type === 'payment_received') && (
                          <div className="flex items-center gap-1 text-primary font-medium opacity-70 group-hover:opacity-100 transition-all duration-200">
                            <ExternalLink className="h-3 w-3" />
                            <span className="text-[10px]">Ver detalles</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </ScrollArea>
        </DialogBody>
      </DialogContent>
    </Dialog>
  </>
  );
} 