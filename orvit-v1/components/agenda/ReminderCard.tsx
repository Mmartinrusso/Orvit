'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Clock,
  CheckCircle2,
  Circle,
  User,
  MoreVertical,
  Edit,
  Trash2,
} from 'lucide-react';
import { isToday, isTomorrow, isPast, differenceInDays } from 'date-fns';
import { formatDate, formatTime } from '@/lib/date-utils';
import { Reminder } from '@/types/agenda';

interface ReminderCardProps {
  reminder: Reminder;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminderId: string) => void;
  onToggleComplete: (reminderId: string, isCompleted: boolean) => void;
}

const PRIORITY_COLORS = {
  baja: 'border-l-blue-500',
  media: 'border-l-orange-500', 
  alta: 'border-l-red-500',
};

const TYPE_LABELS: Record<string, string> = {
  'GENERAL': 'General',
  'CALL': 'Llamar',
  'EMAIL': 'Email',
  'MEETING': 'Reunión',
  'FOLLOW_UP': 'Seguimiento',
  'TASK': 'Tarea',
};

export function ReminderCard({
  reminder,
  onEdit,
  onDelete,
  onToggleComplete,
}: ReminderCardProps) {
  const [isToggling, setIsToggling] = useState(false);

  const dueDate = new Date(reminder.dueDate);
  const isOverdue = isPast(dueDate) && !reminder.isCompleted;
  const isDue = isToday(dueDate);
  const isDueTomorrow = isTomorrow(dueDate);
  const daysUntilDue = differenceInDays(dueDate, new Date());

  const handleToggleComplete = async () => {
    setIsToggling(true);
    try {
      await onToggleComplete(reminder.id, !reminder.isCompleted);
    } finally {
      setIsToggling(false);
    }
  };

  const getDateText = () => {
    if (isOverdue) return `Vencido ${Math.abs(daysUntilDue)}d`;
    if (isDue) return 'Hoy';
    if (isDueTomorrow) return 'Mañana';
    if (daysUntilDue > 0 && daysUntilDue <= 7) return `${daysUntilDue}d`;
    return formatDate(dueDate);
  };

  const getDateColor = () => {
    if (isOverdue) return 'text-red-600 dark:text-red-400';
    if (isDue) return 'text-orange-600 dark:text-orange-400';
    if (isDueTomorrow) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <Card className={`
      transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
      border-l-4 ${PRIORITY_COLORS[reminder.priority]}
      ${reminder.isCompleted ? 'opacity-60' : ''}
    `}>
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto hover:bg-transparent"
            onClick={handleToggleComplete}
            disabled={isToggling}
          >
            {reminder.isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <Circle className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-50 hover:opacity-100">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => onEdit(reminder)} className="cursor-pointer text-xs">
                <Edit className="h-3 w-3 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleToggleComplete}
                disabled={isToggling}
                className="cursor-pointer text-xs"
              >
                {reminder.isCompleted ? (
                  <>
                    <Circle className="h-3 w-3 mr-2" />
                    Pendiente
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-2" />
                    Completar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(reminder.id)}
                className="text-red-600 dark:text-red-400 cursor-pointer text-xs"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Título */}
        <h3 className={`font-medium text-sm leading-tight mb-2 line-clamp-2 ${
          reminder.isCompleted ? 'line-through text-gray-500' : ''
        }`}>
          {reminder.title}
        </h3>

        {/* Descripción */}
        {reminder.description && (
          <p className={`text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2 ${
            reminder.isCompleted ? 'line-through opacity-70' : ''
          }`}>
            {reminder.description}
          </p>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-1 mb-2">
          <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
            {TYPE_LABELS[reminder.type] || reminder.type}
          </Badge>
          {reminder.contactName && (
            <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 text-blue-600 dark:text-blue-400">
              <User className="h-2.5 w-2.5 mr-1" />
              {reminder.contactName.split(' ')[0]}
            </Badge>
          )}
        </div>

        {/* Fecha y hora */}
        <div className="flex items-center justify-between text-xs">
          <span className={`font-medium ${getDateColor()}`}>
            {getDateText()}
          </span>
          <span className="text-gray-500">
            <Clock className="h-3 w-3 inline mr-1" />
            {formatTime(dueDate)}
          </span>
        </div>

        {/* Estado completado */}
        {reminder.isCompleted && reminder.completedAt && (
          <div className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
            ✓ {formatDate(reminder.completedAt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 