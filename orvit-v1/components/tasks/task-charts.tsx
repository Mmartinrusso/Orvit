"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CircularProgress({ percentage, size = 120, strokeWidth = 8, color = "#6366f1" }: {
  percentage: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className="text-muted" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{percentage}%</span>
      </div>
    </div>
  );
}

export function MetricCard({ title, value, trendValue, icon: Icon, color }: {
  title: string; value: string | number; trend?: 'up' | 'down' | 'stable'; trendValue?: string; icon: any; color?: string;
}) {
  const iconColor = color || '#6366f1';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {trendValue && <p className="text-xs text-muted-foreground mt-1">{trendValue}</p>}
          </div>
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${iconColor}15` }}
          >
            <Icon className="h-4 w-4" style={{ color: iconColor }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SimpleLineChart({ data, title, color = "#6366f1" }: { data: any[]; title: string; color?: string }) {
  const validData = data.filter(d => typeof d.value === 'number' && !isNaN(d.value));
  const maxValue = validData.length > 0 ? Math.max(...validData.map(d => d.value)) : 1;
  if (validData.length === 0) {
    return (
      <div className="space-y-4">
        <h4 className="text-lg font-semibold">{title}</h4>
        <div className="relative">
          <svg width="300" height="100" className="w-full h-24">
            <text x="150" y="50" textAnchor="middle" className="text-sm fill-muted-foreground">Sin datos disponibles</text>
          </svg>
        </div>
      </div>
    );
  }
  const points = validData.map((item, index) => {
    const x = validData.length > 1 ? (index / (validData.length - 1)) * 300 : 150;
    const y = maxValue > 0 ? 100 - (item.value / maxValue) * 80 : 50;
    return `${Math.max(0, Math.min(300, isNaN(x) ? 150 : x))},${Math.max(0, Math.min(100, isNaN(y) ? 50 : y))}`;
  }).join(' ');
  const gradientId = `gradient-${title.replace(/\s/g, '-')}`;
  return (
    <div className="space-y-4">
      {title && <h4 className="text-lg font-semibold">{title}</h4>}
      <div className="relative">
        <svg width="300" height="100" className="w-full h-24">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points={`0,100 ${points} 300,100`} fill={`url(#${gradientId})`} />
        </svg>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          {validData.map((item, index) => (<span key={index}>{item.label}</span>))}
        </div>
      </div>
    </div>
  );
}

export function HeatmapCalendar({ tasks, color }: { tasks: any[]; color?: string }) {
  const activeColor = color || '#6366f1';
  const days = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const weeks = 13;
  const heatmapData = useMemo(() => {
    const data: { date: Date; count: number }[] = [];
    const today = new Date();
    for (let w = weeks - 1; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (w * 7 + (today.getDay() - d)));
        const dateStr = date.toDateString();
        const tasksArray = Array.isArray(tasks) ? tasks : [];
        const count = tasksArray.filter(t => {
          const taskDate = new Date(t.createdAt);
          return taskDate.toDateString() === dateStr;
        }).length;
        data.push({ date, count });
      }
    }
    return data;
  }, [tasks]);
  const maxCount = Math.max(...heatmapData.map(d => d.count), 1);
  const getStyle = (count: number) => {
    if (count === 0) return {};
    const opacity = Math.ceil((count / maxCount) * 4) * 0.2;
    return { backgroundColor: `${activeColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` };
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <div className="w-4" />
        {days.map(day => (<div key={day} className="w-3 text-xs text-muted-foreground text-center">{day}</div>))}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: weeks }, (_, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, dayIndex) => {
              const dataIndex = weekIndex * 7 + dayIndex;
              const item = heatmapData[dataIndex];
              if (!item) return <div key={dayIndex} className="w-3 h-3" />;
              return (
                <div
                  key={dayIndex}
                  className={cn("w-3 h-3 rounded-[2px] transition-colors", item.count === 0 ? 'bg-muted' : '')}
                  style={item.count > 0 ? getStyle(item.count) : undefined}
                  title={`${item.date.toLocaleDateString('es-ES')}: ${item.count} tareas`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Menos</span>
        <div className="w-3 h-3 rounded-[2px] bg-muted" />
        {[0.2, 0.4, 0.6, 0.8].map((op, i) => (
          <div key={i} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: `${activeColor}${Math.round(op * 255).toString(16).padStart(2, '0')}` }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

export function UserRanking({ users, color }: { users: any[]; color?: string }) {
  const activeColor = color || '#6366f1';
  if (!users || users.length === 0) {
    return <div className="text-center py-4 text-sm text-muted-foreground">Sin datos de usuarios</div>;
  }
  return (
    <div className="space-y-3">
      {users.slice(0, 5).map((user, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground w-5">{index + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <span className="text-xs text-muted-foreground ml-2 shrink-0">{user.completed}/{user.value}</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ backgroundColor: activeColor, width: `${user.percentage}%` }}
              />
            </div>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0" style={{ color: activeColor }}>{user.percentage}%</Badge>
        </div>
      ))}
    </div>
  );
}
