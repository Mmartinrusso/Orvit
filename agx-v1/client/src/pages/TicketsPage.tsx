import { useState } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useTickets, useApproveTicket, useRejectTicket, useCreateTicket } from '@/hooks';
import { useToast } from '@/context';
import { Button, Card, Spinner, EmptyState, Modal, Input, Textarea, Select } from '@/components/common';
import { TicketCard } from '@/components/tickets';
import type { Ticket, CreateTicketRequest, ModelType, PipelineMode, TicketType, TicketPriority } from '@/api';

const TICKET_TYPES: { value: TicketType; label: string }[] = [
  { value: 'fix', label: 'Bug Fix' },
  { value: 'feature', label: 'Nueva Feature' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'enhancement', label: 'Mejora' },
  { value: 'docs', label: 'Documentación' },
  { value: 'test', label: 'Tests' },
  { value: 'chore', label: 'Mantenimiento' },
];

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const MODELS: { value: ModelType; label: string }[] = [
  { value: 'sonnet', label: 'Sonnet 4.5 (Recomendado)' },
  { value: 'opus', label: 'Opus 4.5' },
  { value: 'haiku', label: 'Haiku' },
];

const PIPELINE_MODES: { value: PipelineMode; label: string }[] = [
  { value: 'auto', label: 'Auto (Recomendado)' },
  { value: 'simple', label: 'Simple' },
  { value: 'fast', label: 'Fast' },
  { value: 'full', label: 'Full' },
];

export function TicketsPage() {
  const { addToast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Queries
  const { data, isLoading, refetch } = useTickets();
  const tickets = data?.tickets || [];

  // Mutations
  const createMutation = useCreateTicket();
  const approveMutation = useApproveTicket();
  const rejectMutation = useRejectTicket();

  // Group tickets by status for Kanban board
  const ticketsByStatus = {
    new: tickets.filter(t => t.status === 'new'),
    approved: tickets.filter(t => t.status === 'approved'),
    in_progress: tickets.filter(t => t.status === 'in_progress'),
    completed: tickets.filter(t => t.status === 'completed' || t.status === 'failed'),
    rejected: tickets.filter(t => t.status === 'rejected'),
  };

  // Create ticket form state
  const [createForm, setCreateForm] = useState<{
    title: string;
    requirement: string;
    ticket_type: TicketType;
    priority: TicketPriority;
    tags: string[];
  }>({
    title: '',
    requirement: '',
    ticket_type: 'feature',
    priority: 'medium',
    tags: [],
  });

  // Approval modal state
  const [approvalForm, setApprovalForm] = useState<{
    model?: ModelType;
    pipeline_mode?: PipelineMode;
  }>({});

  // Reject modal state
  const [rejectForm, setRejectForm] = useState({ reason: '' });

  const handleCreateTicket = async () => {
    try {
      const request: CreateTicketRequest = {
        title: createForm.title,
        requirement: createForm.requirement,
        ticket_type: createForm.ticket_type,
        priority: createForm.priority,
        tags: createForm.tags,
      };

      const response = await createMutation.mutateAsync(request);
      if (response.success) {
        addToast('Ticket creado exitosamente', 'success');
        setShowCreateModal(false);
        setCreateForm({
          title: '',
          requirement: '',
          ticket_type: 'feature',
          priority: 'medium',
          tags: [],
        });
      } else {
        addToast(response.error || 'Error al crear ticket', 'error');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al crear ticket', 'error');
    }
  };

  const handleApprove = async () => {
    if (!selectedTicket) return;

    try {
      const response = await approveMutation.mutateAsync({
        ticketId: selectedTicket.ticket_id,
        data: approvalForm,
      });

      if (response.success) {
        addToast('Ticket aprobado, task iniciada', 'success');
        setShowApprovalModal(false);
        setSelectedTicket(null);
        setApprovalForm({});
      } else {
        addToast(response.error || 'Error al aprobar ticket', 'error');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al aprobar ticket', 'error');
    }
  };

  const handleReject = async () => {
    if (!selectedTicket) return;

    try {
      const response = await rejectMutation.mutateAsync({
        ticketId: selectedTicket.ticket_id,
        data: {
          rejection_reason: rejectForm.reason,
        },
      });

      if (response.success) {
        addToast('Ticket rechazado', 'success');
        setShowRejectModal(false);
        setSelectedTicket(null);
        setRejectForm({ reason: '' });
      } else {
        addToast(response.error || 'Error al rechazar ticket', 'error');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al rechazar ticket', 'error');
    }
  };

  const openApprovalModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowApprovalModal(true);
  };

  const openRejectModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowRejectModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Tickets</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Gestión de tickets de desarrollo</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()} loading={isLoading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Ticket
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Plus className="h-8 w-8" />}
            title="No hay tickets"
            description="Crea tu primer ticket para empezar"
            action={
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Crear Ticket
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Column: Nuevo */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 dark:text-dark-text-secondary flex items-center gap-2">
              Nuevos
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs">
                {ticketsByStatus.new.length}
              </span>
            </h2>
            <div className="space-y-2">
              {ticketsByStatus.new.map(ticket => (
                <div key={ticket.ticket_id} className="relative group">
                  <TicketCard ticket={ticket} onClick={() => {}} />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openApprovalModal(ticket);
                      }}
                      className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                      title="Aprobar"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRejectModal(ticket);
                      }}
                      className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                      title="Rechazar"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column: Aprobados */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 dark:text-dark-text-secondary flex items-center gap-2">
              Aprobados
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs">
                {ticketsByStatus.approved.length}
              </span>
            </h2>
            <div className="space-y-2">
              {ticketsByStatus.approved.map(ticket => (
                <TicketCard key={ticket.ticket_id} ticket={ticket} onClick={() => {}} />
              ))}
            </div>
          </div>

          {/* Column: En Progreso */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 dark:text-dark-text-secondary flex items-center gap-2">
              En Progreso
              <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs">
                {ticketsByStatus.in_progress.length}
              </span>
            </h2>
            <div className="space-y-2">
              {ticketsByStatus.in_progress.map(ticket => (
                <TicketCard key={ticket.ticket_id} ticket={ticket} onClick={() => {}} />
              ))}
            </div>
          </div>

          {/* Column: Completados */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 dark:text-dark-text-secondary flex items-center gap-2">
              Completados
              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs">
                {ticketsByStatus.completed.length}
              </span>
            </h2>
            <div className="space-y-2">
              {ticketsByStatus.completed.map(ticket => (
                <TicketCard key={ticket.ticket_id} ticket={ticket} onClick={() => {}} />
              ))}
            </div>
          </div>

          {/* Column: Rechazados */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 dark:text-dark-text-secondary flex items-center gap-2">
              Rechazados
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs">
                {ticketsByStatus.rejected.length}
              </span>
            </h2>
            <div className="space-y-2">
              {ticketsByStatus.rejected.map(ticket => (
                <TicketCard key={ticket.ticket_id} ticket={ticket} onClick={() => {}} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Ticket"
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            placeholder="Título breve del ticket"
          />

          <Textarea
            label="Requerimiento"
            value={createForm.requirement}
            onChange={(e) => setCreateForm({ ...createForm, requirement: e.target.value })}
            placeholder="Descripción detallada del requerimiento"
            rows={4}
          />

          <Select
            label="Tipo"
            value={createForm.ticket_type}
            onChange={(e) => setCreateForm({ ...createForm, ticket_type: e.target.value as TicketType })}
            options={TICKET_TYPES}
          />

          <Select
            label="Prioridad"
            value={createForm.priority || 'medium'}
            onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TicketPriority })}
            options={PRIORITIES}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateTicket}
              loading={createMutation.isPending}
              disabled={!createForm.title || !createForm.requirement}
            >
              Crear Ticket
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title={`Aprobar Ticket: ${selectedTicket?.title}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
            Configura las opciones de ejecución para este ticket (opcional)
          </p>

          <Select
            label="Modelo (Opcional)"
            value={approvalForm.model || ''}
            onChange={(e) => setApprovalForm({ ...approvalForm, model: e.target.value as ModelType || undefined })}
            options={[{ value: '', label: 'Auto' }, ...MODELS]}
          />

          <Select
            label="Modo de Pipeline (Opcional)"
            value={approvalForm.pipeline_mode || ''}
            onChange={(e) =>
              setApprovalForm({ ...approvalForm, pipeline_mode: e.target.value as PipelineMode || undefined })
            }
            options={[{ value: '', label: 'Auto' }, ...PIPELINE_MODES]}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowApprovalModal(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleApprove} loading={approveMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprobar y Ejecutar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={`Rechazar Ticket: ${selectedTicket?.title}`}
      >
        <div className="space-y-4">
          <Textarea
            label="Motivo del Rechazo"
            value={rejectForm.reason}
            onChange={(e) => setRejectForm({ reason: e.target.value })}
            placeholder="Explica por qué se rechaza este ticket"
            rows={4}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleReject}
              loading={rejectMutation.isPending}
              disabled={!rejectForm.reason}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Rechazar Ticket
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
