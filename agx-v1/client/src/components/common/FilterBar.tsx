import { useState } from 'react';
import { Search, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'text' | 'multi-select';
  options?: FilterOption[];
  placeholder?: string;
}

export interface FilterValues {
  [key: string]: string | string[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onClear: () => void;
  className?: string;
  collapsible?: boolean;
}

export function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  className,
  collapsible = true,
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const activeFiltersCount = Object.values(values).filter(
    (v) => v && (Array.isArray(v) ? v.length > 0 : v !== '')
  ).length;

  const handleChange = (filterId: string, value: string | string[]) => {
    onChange({ ...values, [filterId]: value });
  };

  const handleClearFilter = (filterId: string) => {
    const newValues = { ...values };
    delete newValues[filterId];
    onChange(newValues);
  };

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm dark:bg-dark-surface dark:border-dark-border', className)}>
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between',
          collapsible && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover',
          isExpanded && 'border-b border-gray-200 dark:border-dark-border'
        )}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="font-medium text-gray-700 dark:text-dark-text">Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-blue-900/50 dark:text-blue-300">
              {activeFiltersCount} activo{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 dark:text-gray-400 dark:hover:text-dark-text"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
          {collapsible && (
            isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            )
          )}
        </div>
      </div>

      {/* Filters */}
      {isExpanded && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filters.map((filter) => (
            <div key={filter.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-dark-text-secondary">
                {filter.label}
              </label>
              {filter.type === 'text' ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={(values[filter.id] as string) || ''}
                    onChange={(e) => handleChange(filter.id, e.target.value)}
                    placeholder={filter.placeholder || `Buscar...`}
                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-bg dark:border-dark-border dark:text-dark-text dark:placeholder-gray-500"
                  />
                  {values[filter.id] && (
                    <button
                      onClick={() => handleClearFilter(filter.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-dark-text"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : filter.type === 'select' ? (
                <select
                  value={(values[filter.id] as string) || ''}
                  onChange={(e) => handleChange(filter.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-dark-bg dark:border-dark-border dark:text-dark-text"
                >
                  <option value="">Todos</option>
                  {filter.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                      {option.count !== undefined && ` (${option.count})`}
                    </option>
                  ))}
                </select>
              ) : filter.type === 'multi-select' ? (
                <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2 dark:border-dark-border dark:bg-dark-bg">
                  {filter.options?.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={((values[filter.id] as string[]) || []).includes(option.value)}
                        onChange={(e) => {
                          const currentValues = (values[filter.id] as string[]) || [];
                          if (e.target.checked) {
                            handleChange(filter.id, [...currentValues, option.value]);
                          } else {
                            handleChange(filter.id, currentValues.filter((v) => v !== option.value));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-dark-border dark:bg-dark-bg"
                      />
                      <span className="text-gray-700 dark:text-dark-text">{option.label}</span>
                      {option.count !== undefined && (
                        <span className="text-gray-400 text-xs dark:text-gray-500">({option.count})</span>
                      )}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
