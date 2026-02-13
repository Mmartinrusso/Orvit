'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function WorkOrdersLoadingState() {
  return (
    <div className="space-y-4">
      {/* KPIs Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Bar Skeleton */}
      <Card className="border-border bg-card">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 flex-1 min-w-[200px]" />
            <Skeleton className="h-10 w-[140px]" />
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-10 w-[160px]" />
            <Skeleton className="h-10 w-[140px]" />
            <Skeleton className="h-10 w-[80px]" />
          </div>
        </CardContent>
      </Card>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border-border bg-card rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-7 w-7 rounded" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mb-3" />
              <div className="space-y-2 mb-3">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
