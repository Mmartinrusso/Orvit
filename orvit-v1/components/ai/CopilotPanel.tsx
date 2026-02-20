'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  MessageSquare,
  Bell,
  AlertTriangle,
  TrendingDown,
  Clock,
  Package,
  Activity,
  Loader2
} from 'lucide-react';
import { CopilotChat } from './CopilotChat';
import { ContextualSuggestions } from './ContextualSuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ProactiveAlert {
  type: 'RISK' | 'OPPORTUNITY' | 'ANOMALY' | 'REMINDER';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  relatedEntities: { type: string; id: number; name: string }[];
  suggestedAction: string;
  actionUrl?: string;
  confidence: number;
}

interface CopilotPanelProps {
  context?: {
    machineId?: number;
    workOrderId?: number;
    failureId?: number;
    page?: string;
  };
  onEntityClick?: (type: string, id: number) => void;
}

const alertTypeConfig = {
  RISK: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
  },
  OPPORTUNITY: {
    icon: TrendingDown,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
  },
  ANOMALY: {
    icon: Activity,
    color: 'text-warning-muted-foreground',
    bgColor: 'bg-warning-muted',
    borderColor: 'border-warning/20',
  },
  REMINDER: {
    icon: Clock,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
};

const priorityColors = {
  HIGH: 'bg-destructive',
  MEDIUM: 'bg-warning',
  LOW: 'bg-success',
};

export function CopilotPanel({ context, onEntityClick }: CopilotPanelProps) {
  const { user, companyId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');

  useEffect(() => {
    if (isOpen && companyId) {
      fetchAlerts();
    }
  }, [isOpen, companyId]);

  const fetchAlerts = async () => {
    if (!companyId) return;

    setIsLoadingAlerts(true);
    try {
      const response = await fetch('/api/ai/suggestions');
      const data = await response.json();

      if (data.alerts) {
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  const highPriorityCount = alerts.filter(a => a.priority === 'HIGH').length;

  const handleAlertAction = (alert: ProactiveAlert) => {
    if (alert.actionUrl) {
      window.location.href = alert.actionUrl;
      setIsOpen(false);
    }
  };

  if (!user || !companyId) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-50"
        >
          <Bot className="h-6 w-6" />
          {highPriorityCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {highPriorityCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" size="md" className="p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Copiloto IA
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-1">
              <Bell className="h-4 w-4" />
              Alertas
              {alerts.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                  {alerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="context" className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              Contexto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 m-0 mt-2">
            <CopilotChat
              companyId={companyId}
              context={context}
              onEntityClick={onEntityClick}
              className="h-full border-0 shadow-none rounded-none"
            />
          </TabsContent>

          <TabsContent value="alerts" className="flex-1 m-0 overflow-auto p-4">
            {isLoadingAlerts ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No hay alertas activas</p>
                <p className="text-xs mt-1">El sistema monitoreará tu operación</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, index) => {
                  const config = alertTypeConfig[alert.type];
                  const Icon = config.icon;

                  return (
                    <div
                      key={index}
                      className={cn(
                        'rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow',
                        config.bgColor,
                        config.borderColor
                      )}
                      onClick={() => handleAlertAction(alert)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('mt-0.5', config.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">
                              {alert.title}
                            </h4>
                            <div
                              className={cn(
                                'h-2 w-2 rounded-full shrink-0',
                                priorityColors[alert.priority]
                              )}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {alert.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-primary">
                              {alert.suggestedAction}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {alert.confidence}% confianza
                            </Badge>
                          </div>
                          {alert.relatedEntities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {alert.relatedEntities.slice(0, 3).map((entity, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEntityClick?.(entity.type, entity.id);
                                  }}
                                >
                                  {entity.name}
                                </Badge>
                              ))}
                              {alert.relatedEntities.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{alert.relatedEntities.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAlerts}
              className="w-full mt-4"
              disabled={isLoadingAlerts}
            >
              Actualizar alertas
            </Button>
          </TabsContent>

          <TabsContent value="context" className="flex-1 m-0 overflow-auto p-4">
            <ContextualSuggestions
              companyId={companyId}
              context={context}
              onEntityClick={onEntityClick}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export default CopilotPanel;
