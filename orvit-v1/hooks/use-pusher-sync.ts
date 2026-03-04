"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPusherClient } from "@/lib/pusher/client";

/**
 * Subscribe to Pusher company channels and auto-invalidate TanStack Query caches.
 * Mount once in the app layout — all pages benefit automatically.
 */
export function usePusherSync(companyId: number | undefined) {
  const queryClient = useQueryClient();
  const subscribedRef = useRef<string[]>([]);

  useEffect(() => {
    if (!companyId) return;

    const pusher = getPusherClient();
    const channels: string[] = [];

    // ── Tasks channel ──────────────────────────────────────────
    const tasksCh = pusher.subscribe(`private-company-${companyId}-tasks`);
    channels.push(`private-company-${companyId}-tasks`);

    const invalidateTasks = () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-stats"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    };
    tasksCh.bind("task:created", invalidateTasks);
    tasksCh.bind("task:updated", invalidateTasks);
    tasksCh.bind("task:deleted", invalidateTasks);

    // ── Failures channel ───────────────────────────────────────
    const failuresCh = pusher.subscribe(`private-company-${companyId}-failures`);
    channels.push(`private-company-${companyId}-failures`);

    const invalidateFailures = () => {
      queryClient.invalidateQueries({ queryKey: ["failure"] });
      queryClient.invalidateQueries({ queryKey: ["failures"] });
      queryClient.invalidateQueries({ queryKey: ["failure-occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["failure-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-alerts"] });
    };
    failuresCh.bind("failure:created", invalidateFailures);
    failuresCh.bind("failure:updated", invalidateFailures);
    failuresCh.bind("failure:closed", invalidateFailures);

    // ── Work Orders channel ────────────────────────────────────
    const woCh = pusher.subscribe(`private-company-${companyId}-work-orders`);
    channels.push(`private-company-${companyId}-work-orders`);

    const invalidateWO = () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      queryClient.invalidateQueries({ queryKey: ["work-order-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    };
    woCh.bind("work-order:created", invalidateWO);
    woCh.bind("work-order:updated", invalidateWO);
    woCh.bind("work-order:closed", invalidateWO);

    // ── Maintenance channel ──────────────────────────────────────
    const maintCh = pusher.subscribe(`private-company-${companyId}-maintenance`);
    channels.push(`private-company-${companyId}-maintenance`);

    const invalidateMaint = () => {
      queryClient.invalidateQueries({ queryKey: ["checklists"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-detail"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["preventive-maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-history"] });
      queryClient.invalidateQueries({ queryKey: ["sup-dash-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["sup-dash-controls"] });
    };
    maintCh.bind("maintenance:created", invalidateMaint);
    maintCh.bind("maintenance:updated", invalidateMaint);

    // ── Machines channel ──────────────────────────────────────────
    const machCh = pusher.subscribe(`private-company-${companyId}-machines`);
    channels.push(`private-company-${companyId}-machines`);

    const invalidateMachines = () => {
      queryClient.invalidateQueries({ queryKey: ["machines-initial"] });
      queryClient.invalidateQueries({ queryKey: ["machine-detail"] });
      queryClient.invalidateQueries({ queryKey: ["machine-failures"] });
      queryClient.invalidateQueries({ queryKey: ["machine-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sup-dash-health"] });
    };
    machCh.bind("machine:created", invalidateMachines);
    machCh.bind("machine:updated", invalidateMachines);

    // ── Production channel ────────────────────────────────────────
    const prodCh = pusher.subscribe(`private-company-${companyId}-production`);
    channels.push(`private-company-${companyId}-production`);

    const invalidateProd = () => {
      queryClient.invalidateQueries({ queryKey: ["my-routines"] });
      queryClient.invalidateQueries({ queryKey: ["routine-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["routine-templates"] });
      queryClient.invalidateQueries({ queryKey: ["routine-executions"] });
      queryClient.invalidateQueries({ queryKey: ["production-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["production-resources"] });
    };
    prodCh.bind("production:updated", invalidateProd);

    // ── Tools / Pañol channel ─────────────────────────────────────
    const toolsCh = pusher.subscribe(`private-company-${companyId}-tools`);
    channels.push(`private-company-${companyId}-tools`);

    const invalidateTools = () => {
      queryClient.invalidateQueries({ queryKey: ["tools-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["tool-loans"] });
      queryClient.invalidateQueries({ queryKey: ["tool-requests"] });
    };
    toolsCh.bind("tool:created", invalidateTools);
    toolsCh.bind("tool:updated", invalidateTools);

    subscribedRef.current = channels;

    return () => {
      channels.forEach((ch) => pusher.unsubscribe(ch));
      subscribedRef.current = [];
    };
  }, [companyId, queryClient]);
}
