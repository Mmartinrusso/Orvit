'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Send,
  Bot,
  User,
  Loader2,
  Wrench,
  AlertTriangle,
  History,
  Package,
  BarChart3,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  entities?: Array<{ type: string; id: number; name: string }>;
  suggestions?: string[];
}

interface CopilotChatProps {
  companyId: number;
  context?: {
    machineId?: number;
    workOrderId?: number;
    failureId?: number;
  };
  onEntityClick?: (type: string, id: number) => void;
  className?: string;
}

const intentIcons: Record<string, React.ReactNode> = {
  DIAGNOSIS: <Wrench className="h-4 w-4" />,
  HISTORY: <History className="h-4 w-4" />,
  PRIORITY: <AlertTriangle className="h-4 w-4" />,
  INVENTORY: <Package className="h-4 w-4" />,
  KPI: <BarChart3 className="h-4 w-4" />,
  PROCEDURE: <FileText className="h-4 w-4" />,
};

const intentLabels: Record<string, string> = {
  DIAGNOSIS: 'Diagnóstico',
  HISTORY: 'Historial',
  PRIORITY: 'Prioridad',
  INVENTORY: 'Inventario',
  KPI: 'KPIs',
  PROCEDURE: 'Procedimiento',
};

export function CopilotChat({ companyId, context, onEntityClick, className }: CopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          companyId,
          context,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        intent: data.intent,
        entities: data.entities,
        suggestions: data.suggestions,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          Copiloto de Mantenimiento
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 px-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">
                Hola! Soy tu asistente de mantenimiento.
              </p>
              <p className="text-xs mt-2">
                Pregúntame sobre diagnósticos, historial de máquinas,
                priorización de OTs, inventario y más.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick('¿Cuáles son las OTs más urgentes?')}
                >
                  OTs urgentes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick('¿Qué máquinas tienen más fallas?')}
                >
                  Fallas recurrentes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick('¿Hay repuestos con bajo stock?')}
                >
                  Stock bajo
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'flex flex-col max-w-[80%] rounded-lg p-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.intent && message.role === 'assistant' && (
                      <Badge variant="secondary" className="self-start mb-2 text-xs">
                        {intentIcons[message.intent]}
                        <span className="ml-1">{intentLabels[message.intent] || message.intent}</span>
                      </Badge>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    {message.entities && message.entities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {message.entities.map((entity, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10"
                            onClick={() => onEntityClick?.(entity.type, entity.id)}
                          >
                            {entity.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-border/50">
                        {message.suggestions.map((suggestion, idx) => (
                          <Button
                            key={idx}
                            variant="ghost"
                            size="sm"
                            className="h-auto py-1 px-2 text-xs"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    )}

                    <span className="text-xs opacity-50 mt-1">
                      {message.timestamp.toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CopilotChat;
