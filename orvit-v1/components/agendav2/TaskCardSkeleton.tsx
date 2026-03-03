import { Skeleton } from '@/components/ui/skeleton';

export function TaskCardSkeleton() {
  return (
    <div className="p-3 border rounded-lg space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-5 rounded-full shrink-0" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
    </div>
  );
}

export function TaskColumnSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function BoardViewSkeleton() {
  return (
    <div className="space-y-4">
      {/* Calendar strip skeleton */}
      <Skeleton className="h-32 w-full rounded-xl" />
      {/* Board columns skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[5, 3, 4, 2].map((count, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-8 w-full rounded-lg" />
            <TaskColumnSkeleton count={count} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardViewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-[100px] rounded-xl" />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-[260px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function ReportingViewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-[100px] rounded-xl" />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-[260px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function PortfolioViewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-[220px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function FixedTasksViewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-[72px] rounded-2xl" style={{ flex: '1 1 140px' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ width: '300px', flexShrink: 0 }}>
            <Skeleton className="h-11 rounded-xl mb-2.5" />
            {[1, 2].map(j => (
              <Skeleton key={j} className="h-[140px] rounded-xl mb-2" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SidebarGroupsSkeleton() {
  return (
    <div className="px-3 py-2 space-y-1">
      {[1, 2].map(i => (
        <Skeleton key={i} className="h-7 rounded-xl" />
      ))}
    </div>
  );
}

export function SidebarProjectSkeleton() {
  return (
    <div className="px-3 py-2">
      <Skeleton className="h-7 rounded-xl" />
    </div>
  );
}

export function AgendaPageSkeleton() {
  return (
    <div className="flex h-full gap-4 p-4 overflow-hidden">
      {/* Simulate 3 board columns */}
      {[5, 4, 3].map((count, i) => (
        <div key={i} className="flex-1 min-w-[260px] space-y-3">
          <div className="flex items-center gap-2 pb-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <TaskColumnSkeleton count={count} />
        </div>
      ))}
    </div>
  );
}
