"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Sparkline } from "@/components/administracion/dashboard/charts/Sparkline";
import { Task } from "@/hooks/use-task-store";
import { cn } from "@/lib/utils";

interface TasksKPIsProps {
  tasks: Task[];
  currentUserId?: string;
  isLoading?: boolean;
}

function formatPct(p: number | null) {
  if (p === null) return "—";
  const v = Math.round(p * 100);
  return `${v >= 0 ? "+" : ""}${v}%`;
}

function KpiCard({
  title,
  value,
  deltaPct,
  series,
  subtitle,
  isLoading,
}: {
  title: string;
  value: number;
  deltaPct: number | null;
  series: Array<{ x: string; y: number }>;
  subtitle: string;
  isLoading?: boolean;
}) {
  const up = (deltaPct ?? 0) >= 0;
  const Icon = up ? TrendingUp : TrendingDown;

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full rounded-lg border shadow-sm bg-gradient-to-t from-muted/30 via-background to-background">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
        <div className="text-xs font-normal text-muted-foreground">{title}</div>
        <div
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            up
              ? "border-success-muted bg-success-muted text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          <Icon className="h-3 w-3 mr-1" />
          {formatPct(deltaPct)}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="text-3xl font-normal leading-none tabular-nums mb-1">
          {value}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 leading-tight">
          <Icon className="h-3 w-3" />
          <span className="font-medium">{subtitle}</span>
        </div>
        <div className="mt-2">
          <Sparkline data={series} height={36} />
        </div>
      </CardContent>
    </Card>
  );
}

export function TasksKPIs({
  tasks,
  currentUserId,
  isLoading = false,
}: TasksKPIsProps) {
  const analytics = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 30);

    // Filtrar tareas del usuario
    const userTasks = tasks.filter(
      (t) =>
        t.assignedTo?.id?.toString() === currentUserId ||
        t.createdBy?.id?.toString() === currentUserId
    );

    // Pendientes
    const pendientes = userTasks.filter(
      (t) => t.status === "pendiente" || t.status === "en-curso"
    ).length;
    const pendientesAnterior = userTasks.filter(
      (t) =>
        (t.status === "pendiente" || t.status === "en-curso") &&
        new Date(t.createdAt) < twoWeeksAgo
    ).length;
    const deltaPendientes =
      pendientesAnterior > 0
        ? (pendientes - pendientesAnterior) / pendientesAnterior
        : null;

    // Sparkline pendientes (últimos 14 días)
    const pendientesSeries: Array<{ x: string; y: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const count = userTasks.filter((t) => {
        const created = new Date(t.createdAt).toISOString().split("T")[0];
        return (
          created <= dateStr &&
          (t.status === "pendiente" || t.status === "en-curso")
        );
      }).length;
      pendientesSeries.push({ x: dateStr, y: count });
    }

    // Vencen hoy
    const vencenHoy = userTasks.filter((t) => {
      if (!t.dueDate || t.status === "realizada") return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    }).length;
    const vencenHoyAyer = userTasks.filter((t) => {
      if (!t.dueDate || t.status === "realizada") return false;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === yesterday.getTime();
    }).length;
    const deltaVencenHoy =
      vencenHoyAyer > 0 ? (vencenHoy - vencenHoyAyer) / vencenHoyAyer : null;

    const vencenHoySeries: Array<{ x: string; y: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const count = userTasks.filter((t) => {
        if (!t.dueDate || t.status === "realizada") return false;
        const due = new Date(t.dueDate).toISOString().split("T")[0];
        return due === dateStr;
      }).length;
      vencenHoySeries.push({ x: dateStr, y: count });
    }

    // Atrasadas
    const atrasadas = userTasks.filter((t) => {
      if (!t.dueDate || t.status === "realizada") return false;
      const due = new Date(t.dueDate);
      return due < today && t.status !== "realizada";
    }).length;
    const atrasadasAnterior = userTasks.filter((t) => {
      if (!t.dueDate || t.status === "realizada") return false;
      const due = new Date(t.dueDate);
      const dueWeekAgo = new Date(today);
      dueWeekAgo.setDate(dueWeekAgo.getDate() - 7);
      return due < dueWeekAgo && t.status !== "realizada";
    }).length;
    const deltaAtrasadas =
      atrasadasAnterior > 0
        ? (atrasadas - atrasadasAnterior) / atrasadasAnterior
        : null;

    const atrasadasSeries: Array<{ x: string; y: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const count = userTasks.filter((t) => {
        if (!t.dueDate || t.status === "realizada") return false;
        const due = new Date(t.dueDate).toISOString().split("T")[0];
        return due < dateStr && t.status !== "realizada";
      }).length;
      atrasadasSeries.push({ x: dateStr, y: count });
    }

    // Completadas 7d
    const completadas7d = userTasks.filter((t) => {
      if (t.status !== "realizada") return false;
      const completed = new Date(t.updatedAt);
      return completed >= weekAgo;
    }).length;
    const completadas7dAnterior = userTasks.filter((t) => {
      if (t.status !== "realizada") return false;
      const completed = new Date(t.updatedAt);
      const twoWeeksAgoStart = new Date(twoWeeksAgo);
      const weekAgoStart = new Date(weekAgo);
      return completed >= twoWeeksAgoStart && completed < weekAgoStart;
    }).length;
    const deltaCompletadas7d =
      completadas7dAnterior > 0
        ? (completadas7d - completadas7dAnterior) / completadas7dAnterior
        : null;

    const completadas7dSeries: Array<{ x: string; y: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const count = userTasks.filter((t) => {
        if (t.status !== "realizada") return false;
        const completed = new Date(t.updatedAt).toISOString().split("T")[0];
        return completed === dateStr;
      }).length;
      completadas7dSeries.push({ x: dateStr, y: count });
    }

    return {
      pendientes: {
        value: pendientes,
        delta: deltaPendientes,
        series: pendientesSeries,
      },
      vencenHoy: {
        value: vencenHoy,
        delta: deltaVencenHoy,
        series: vencenHoySeries,
      },
      atrasadas: {
        value: atrasadas,
        delta: deltaAtrasadas,
        series: atrasadasSeries,
      },
      completadas7d: {
        value: completadas7d,
        delta: deltaCompletadas7d,
        series: completadas7dSeries,
      },
    };
  }, [tasks, currentUserId]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Pendientes"
        value={analytics.pendientes.value}
        deltaPct={analytics.pendientes.delta}
        series={analytics.pendientes.series}
        subtitle="Últimos 14 días"
        isLoading={isLoading}
      />
      <KpiCard
        title="Vencen hoy"
        value={analytics.vencenHoy.value}
        deltaPct={analytics.vencenHoy.delta}
        series={analytics.vencenHoy.series}
        subtitle="Últimos 14 días"
        isLoading={isLoading}
      />
      <KpiCard
        title="Atrasadas"
        value={analytics.atrasadas.value}
        deltaPct={analytics.atrasadas.delta}
        series={analytics.atrasadas.series}
        subtitle="Últimos 14 días"
        isLoading={isLoading}
      />
      <KpiCard
        title="Completadas (7d)"
        value={analytics.completadas7d.value}
        deltaPct={analytics.completadas7d.delta}
        series={analytics.completadas7d.series}
        subtitle="Últimos 7 días"
        isLoading={isLoading}
      />
    </div>
  );
}

