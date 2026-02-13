"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Task } from "@/hooks/use-task-store";
import { ChartTooltip } from "@/components/administracion/dashboard/charts/chart-utils";

interface TasksChartsProps {
  tasks: Task[];
  currentUserId?: string;
  isLoading?: boolean;
}

const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  muted: "hsl(var(--muted))",
  destructive: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
};

const STATUS_COLORS: Record<string, string> = {
  pendiente: COLORS.muted,
  "en-curso": COLORS.primary,
  realizada: "#22c55e",
  cancelada: COLORS.destructive,
};

const PRIORITY_COLORS: Record<string, string> = {
  baja: "#22c55e",
  media: "#eab308",
  alta: COLORS.destructive,
  urgente: COLORS.destructive,
};

export function TasksCharts({
  tasks,
  currentUserId,
  isLoading = false,
}: TasksChartsProps) {
  const chartData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Filtrar tareas del usuario
    const userTasks = tasks.filter(
      (t) =>
        t.assignedTo?.id?.toString() === currentUserId ||
        t.createdBy?.id?.toString() === currentUserId
    );

    // 1. Creadas vs Completadas (últimos 30 días)
    const createdVsCompleted: Array<{
      fecha: string;
      creadas: number;
      completadas: number;
    }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const creadas = userTasks.filter((t) => {
        const created = new Date(t.createdAt).toISOString().split("T")[0];
        return created === dateStr;
      }).length;
      const completadas = userTasks.filter((t) => {
        if (t.status !== "realizada") return false;
        const updated = new Date(t.updatedAt).toISOString().split("T")[0];
        return updated === dateStr;
      }).length;
      createdVsCompleted.push({
        fecha: date.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
        creadas,
        completadas,
      });
    }

    // 2. Distribución por estado
    const statusDistribution = [
      {
        name: "Pendiente",
        value: userTasks.filter((t) => t.status === "pendiente").length,
        color: STATUS_COLORS.pendiente,
      },
      {
        name: "En curso",
        value: userTasks.filter((t) => t.status === "en-curso").length,
        color: STATUS_COLORS["en-curso"],
      },
      {
        name: "Realizada",
        value: userTasks.filter((t) => t.status === "realizada").length,
        color: STATUS_COLORS.realizada,
      },
      {
        name: "Cancelada",
        value: userTasks.filter((t) => t.status === "cancelada").length,
        color: STATUS_COLORS.cancelada,
      },
    ].filter((item) => item.value > 0);

    // 3. Distribución por prioridad
    const priorityDistribution = [
      {
        name: "Alta",
        value: userTasks.filter((t) => t.priority === "alta" || t.priority === "urgente").length,
        color: PRIORITY_COLORS.alta,
      },
      {
        name: "Media",
        value: userTasks.filter((t) => t.priority === "media").length,
        color: PRIORITY_COLORS.media,
      },
      {
        name: "Baja",
        value: userTasks.filter((t) => t.priority === "baja").length,
        color: PRIORITY_COLORS.baja,
      },
    ].filter((item) => item.value > 0);

    return {
      createdVsCompleted,
      statusDistribution,
      priorityDistribution,
    };
  }, [tasks, currentUserId]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Creadas vs Completadas */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Creadas vs Completadas (30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData.createdVsCompleted}>
              <defs>
                <linearGradient id="colorCreadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompletadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="creadas"
                stroke={COLORS.primary}
                strokeWidth={2}
                fill="url(#colorCreadas)"
                name="Creadas"
              />
              <Area
                type="monotone"
                dataKey="completadas"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorCompletadas)"
                name="Completadas"
              />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribución por Estado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Por Estado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData.statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribución por Prioridad */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Por Prioridad</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData.priorityDistribution} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                width={60}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.priorityDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

