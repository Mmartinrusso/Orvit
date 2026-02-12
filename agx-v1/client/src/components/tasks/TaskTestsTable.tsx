import { CheckCircle, XCircle } from 'lucide-react';
import type { TestRecord } from '@/api';

interface TaskTestsTableProps {
  tests: TestRecord[];
}

export function TaskTestsTable({ tests }: TaskTestsTableProps) {
  if (tests.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-dark-text-secondary">No hay tests registrados</p>;
  }

  const passedCount = tests.filter((t) => t.passed).length;
  const failedCount = tests.length - passedCount;

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          {passedCount} pasaron
        </span>
        {failedCount > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <XCircle className="h-4 w-4" />
            {failedCount} fallaron
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
          <thead className="bg-gray-50 dark:bg-dark-hover">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">
                Estado
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">
                Archivo
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">
                Test
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-dark-text-secondary uppercase">
                Error
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
            {tests.map((test, index) => (
              <tr key={index}>
                <td className="px-4 py-3">
                  {test.passed ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <code className="text-xs bg-gray-100 dark:bg-dark-hover dark:text-dark-text px-1 py-0.5 rounded">
                    {test.test_file}
                  </code>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">{test.test_name}</td>
                <td className="px-4 py-3 text-sm text-red-600">
                  {test.error_message || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
