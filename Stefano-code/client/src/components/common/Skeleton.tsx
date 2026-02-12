import { cn } from '../../utils/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'circle' | 'rectangular';
  width?: string | number;
  height?: string | number;
  count?: number;
}

function SkeletonItem({ className, variant = 'text', width, height }: Omit<SkeletonProps, 'count'>) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-dark-hover';

  const variantClasses = {
    text: 'h-4 rounded',
    card: 'h-32 rounded-lg',
    circle: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={style}
    />
  );
}

export function Skeleton({ count = 1, ...props }: SkeletonProps) {
  if (count === 1) return <SkeletonItem {...props} />;

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} {...props} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4 space-y-3', className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" />
          <Skeleton width="40%" className="h-3" />
        </div>
      </div>
      <Skeleton count={2} />
      <div className="flex gap-2 pt-2">
        <Skeleton width={80} height={28} variant="rectangular" />
        <Skeleton width={80} height={28} variant="rectangular" />
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4 space-y-2">
          <Skeleton width="40%" className="h-3" />
          <Skeleton width="60%" height={28} variant="rectangular" />
        </div>
      ))}
    </div>
  );
}
