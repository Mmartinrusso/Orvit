"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface TaskTabsProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  tabs: {
    id: string;
    label: string;
    count?: number;
  }[];
}

export function TaskTabs({ activeTab, onChangeTab, tabs }: TaskTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Detectar tab activo basado en query param o URL
  const getCurrentTab = () => {
    // Primero intentar leer del query param
    const tabFromQuery = searchParams.get('tab');
    if (tabFromQuery) return tabFromQuery;
    
    // Si no hay query param, intentar leer de la URL
    if (pathname === "/administracion/agenda" || pathname === "/administracion/tareas") return "tareas";
    const segments = pathname.split("/");
    const lastSegment = segments[segments.length - 1];
    return lastSegment || "tareas";
  };

  const currentActiveTab = getCurrentTab();

  const handleTabClick = (tabId: string) => {
    router.push(`/administracion/agenda?tab=${tabId}`);
    onChangeTab(tabId);
  };

  return (
    <div className="border-b border-border/50">
      <nav className="flex space-x-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "relative px-6 py-3 text-base font-medium transition-all duration-200 ease-in-out",
              "hover:bg-accent/50 hover:text-accent-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2",
              currentActiveTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium rounded-full",
                  currentActiveTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </div>
            {currentActiveTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
} 