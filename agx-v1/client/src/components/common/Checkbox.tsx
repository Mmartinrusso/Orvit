import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            'h-4 w-4 text-blue-600 border-gray-300 rounded dark:border-dark-border dark:bg-dark-bg dark:checked:bg-blue-600',
            'focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 dark:focus:ring-offset-dark-bg',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {label && (
          <label htmlFor={inputId} className="ml-2 text-sm text-gray-700 cursor-pointer dark:text-dark-text">
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
