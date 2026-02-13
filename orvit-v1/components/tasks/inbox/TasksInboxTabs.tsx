"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMemo } from "react";
import { Task } from "@/hooks/use-task-store";

type InboxTab = "recibidas" | "enviadas" | "todas";

interface TasksInboxTabsProps {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  tasks: Task[];
  currentUserId?: string;
  canViewAll?: boolean;
}

export function TasksInboxTabs({
  activeTab,
  onTabChange,
  tasks,
  currentUserId,
  canViewAll = false,
}: TasksInboxTabsProps) {
  const counts = useMemo(() => {
    const recibidas = tasks.filter(
      (t) => t.assignedTo?.id?.toString() === currentUserId
    ).length;
    const enviadas = tasks.filter(
      (t) => t.createdBy?.id?.toString() === currentUserId
    ).length;
    const todas = canViewAll ? tasks.length : recibidas + enviadas;

    return { recibidas, enviadas, todas };
  }, [tasks, currentUserId, canViewAll]);

  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as InboxTab)}>
      <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-9">
        <TabsTrigger
          value="recibidas"
          className="text-xs font-normal h-7 px-3 shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Recibidas ({counts.recibidas})
        </TabsTrigger>
        <TabsTrigger
          value="enviadas"
          className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
        >
          Enviadas ({counts.enviadas})
        </TabsTrigger>
        {canViewAll && (
          <TabsTrigger
            value="todas"
            className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Todas ({counts.todas})
          </TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  );
}

