import { FileIcon, FilePlus, FileEdit, FileX } from 'lucide-react';
import type { ChangeRecord, FileAction } from '@/api';
import { Badge } from '@/components/common';

const actionIcons: Record<FileAction, typeof FileIcon> = {
  created: FilePlus,
  modified: FileEdit,
  deleted: FileX,
};

const actionLabels: Record<FileAction, string> = {
  created: 'Creado',
  modified: 'Modificado',
  deleted: 'Eliminado',
};

const actionVariants: Record<FileAction, 'success' | 'info' | 'error'> = {
  created: 'success',
  modified: 'info',
  deleted: 'error',
};

interface TaskChangesTableProps {
  changes: ChangeRecord[];
}

export function TaskChangesTable({ changes }: TaskChangesTableProps) {
  if (changes.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-dark-text-secondary">No hay cambios registrados</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
        <thead className="bg-gray-50 dark:bg-dark-hover">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">
              Archivo
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">
              Accion
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">
              Resumen
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
          {changes.map((change, index) => {
            // Ensure action is valid, default to 'modified' if not
            const action = (change.action && actionIcons[change.action]) ? change.action : 'modified';
            const Icon = actionIcons[action];
            return (
              <tr key={index}>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-400 dark:text-dark-text-secondary" />
                    <code className="text-xs bg-gray-100 dark:bg-dark-hover dark:text-dark-text px-1 py-0.5 rounded">
                      {change.file_path}
                    </code>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={actionVariants[action]}>
                    {actionLabels[action]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-dark-text-secondary">
                  {change.summary || '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
