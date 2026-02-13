'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  MessageSquare,
  Send,
  AlertTriangle,
  Info,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Comment {
  id: number;
  content: string;
  type: 'comment' | 'update' | 'issue' | 'system';
  author: {
    id: number;
    name: string;
    email: string;
  };
  createdAt: Date;
  workOrderId: number;
}

interface WorkOrderCommentsPanelProps {
  workOrderId: number;
  isOpen?: boolean;
  className?: string;
}

const commentTypeConfig = {
  comment: {
    label: 'Comentario',
    icon: MessageSquare,
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  update: {
    label: 'Actualización',
    icon: Info,
    badgeClass: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  },
  issue: {
    label: 'Problema',
    icon: AlertTriangle,
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  system: {
    label: 'Sistema',
    icon: Settings,
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
};

export function WorkOrderCommentsPanel({
  workOrderId,
  isOpen = true,
  className,
}: WorkOrderCommentsPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'comment' | 'update' | 'issue'>('comment');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [workOrderId, isOpen]);

  useEffect(() => {
    // Auto-scroll al final cuando se agregan comentarios
    if (scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [comments]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/work-orders/${workOrderId}/comments`);

      if (response.ok) {
        const data = await response.json();
        setComments(
          data.map((comment: any) => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los comentarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/work-orders/${workOrderId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newComment.trim(),
          type: commentType,
          authorId: user.id,
        }),
      });

      if (response.ok) {
        const newCommentData = await response.json();
        setComments((prev) => [
          {
            ...newCommentData,
            createdAt: new Date(newCommentData.createdAt),
          },
          ...prev,
        ]);
        setNewComment('');
        setCommentType('comment');

        toast({
          title: 'Comentario agregado',
          description: 'El comentario se ha agregado exitosamente',
        });
      } else {
        throw new Error('Error al agregar comentario');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: 'Error',
        description: 'No se pudo agregar el comentario',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `hace ${days} día${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else {
      return 'ahora mismo';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!isOpen) return null;

  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      {/* Composer sticky */}
      <div className="flex-shrink-0 border-b border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {user ? getInitials(user.name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <ToggleGroup
              type="single"
              value={commentType}
              onValueChange={(value) => value && setCommentType(value as typeof commentType)}
              className="border border-border rounded-md"
            >
              <ToggleGroupItem value="comment" aria-label="Comentario" className="h-8 px-3 text-xs">
                <MessageSquare className="h-3 w-3 mr-1.5" />
                Comentario
              </ToggleGroupItem>
              <ToggleGroupItem value="update" aria-label="Actualización" className="h-8 px-3 text-xs">
                <Info className="h-3 w-3 mr-1.5" />
                Actualización
              </ToggleGroupItem>
              <ToggleGroupItem value="issue" aria-label="Problema" className="h-8 px-3 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1.5" />
                Problema
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <Textarea
            placeholder="Escribe un mensaje... (Enter para enviar)"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (newComment.trim() && !submitting) {
                  handleSubmitComment();
                }
              }
            }}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            disabled={submitting}
            rows={1}
          />
          <Button
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            {submitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <Separator className="flex-shrink-0" />

      {/* Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No hay comentarios aún</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sé el primero en agregar un comentario
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const config = commentTypeConfig[comment.type];
                const Icon = config.icon;

                return (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {comment.type === 'system' ? 'S' : getInitials(comment.author.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {comment.author.name}
                        </span>
                        <Badge variant="outline" className={cn('text-xs border', config.badgeClass)}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatTimestamp(comment.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

