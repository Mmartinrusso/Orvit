import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 dark:bg-black/60" onClick={onClose} />
      <div
        className={cn(
          'relative bg-white rounded-lg shadow-xl w-full max-h-[90vh] flex flex-col dark:bg-dark-surface dark:border dark:border-dark-border dark:text-dark-text',
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:text-dark-text-secondary dark:hover:text-dark-text dark:hover:bg-dark-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-2 flex-shrink-0 dark:border-dark-border dark:bg-dark-hover">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
