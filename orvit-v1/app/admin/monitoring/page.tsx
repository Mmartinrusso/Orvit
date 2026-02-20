'use client';

/**
 * Monitoring Dashboard
 * Real-time system metrics and performance monitoring
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertCircle, CheckCircle2, Clock, DollarSign, Zap } from 'lucide-react';

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    // TODO: Fetch real metrics from /api/admin/metrics
    setMetrics({
      uptime: 99.98,
      avgLatency: 234,
      errorRate: 0.08,
      requestsPerMin: 1250,
      aiCost: 45.20,
      cacheHitRate: 85.5,
    });
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Monitoring</h1>
        <p className="text-muted-foreground">Real-time performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.uptime}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Zap className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgLatency}ms</div>
            <p className="text-xs text-muted-foreground">p95 latency</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.errorRate}%</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Operations Cost</CardTitle>
          <CardDescription>OpenAI API usage this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">${metrics?.aiCost}</div>
              <p className="text-sm text-muted-foreground">Estimated cost</p>
            </div>
            <DollarSign className="h-12 w-12 text-success" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
