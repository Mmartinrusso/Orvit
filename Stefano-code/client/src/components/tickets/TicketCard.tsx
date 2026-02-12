import { Clock, User, Tag } from 'lucide-react';
import { Card } from '@/components/common';
import { TicketStatusBadge } from './TicketStatusBadge';
import { formatDate } from '@/utils';
import type { Ticket } from '@/api';
import { cn } from '@/utils';

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const typeColors: Record<string, string> = {
  fix: 'bg-red-50 border-red-200',
  feature: 'bg-blue-50 border-blue-200',
  refactor: 'bg-purple-50 border-purple-200',
  enhancement: 'bg-green-50 border-green-200',
  docs: 'bg-yellow-50 border-yellow-200',
  test: 'bg-indigo-50 border-indigo-200',
  chore: 'bg-gray-50 border-gray-200',
};

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-shadow',
        typeColors[ticket.ticket_type] || 'bg-white'
      )}
      onClick={onClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2 flex-1">{ticket.title}</h3>
          <TicketStatusBadge status={ticket.status} />
        </div>

        <p className="text-xs text-gray-600 line-clamp-2">{ticket.requirement}</p>

        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              priorityColors[ticket.priority] || 'bg-gray-100'
            )}
          >
            {ticket.priority}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {ticket.ticket_type}
          </span>
        </div>

        {ticket.tags && ticket.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ticket.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
            {ticket.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{ticket.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(ticket.created_at)}
          </div>
          {ticket.created_by && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {ticket.created_by}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
