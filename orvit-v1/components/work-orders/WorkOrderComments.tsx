'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Send,
  AlertTriangle,
  Info,
  Settings,
  User,
  Clock,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface WorkOrderCommentsProps {
  workOrderId: number;
  isOpen?: boolean;
}

export default function WorkOrderComments({ workOrderId, isOpen = true }: WorkOrderCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'comment' | 'update' | 'issue'>('comment');
  const [submitting, setSubmitting] = useState(false);

  const queryKey = ['work-order-comments', workOrderId];
  const { data: comments = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/work-orders/${workOrderId}/comments`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.map((comment: any) => ({
        ...comment,
        createdAt: new Date(comment.createdAt)
      })) as Comment[];
    },
    enabled: isOpen,
    staleTime: 60 * 1000,
  });

  const invalidateComments = () => queryClient.invalidateQueries({ queryKey });

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
        setNewComment('');
        setCommentType('comment');
        invalidateComments();

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

  const getCommentIcon = (type: string) => {
    switch (type) {
      case 'system':
        return <Settings className="h-4 w-4 text-info-muted-foreground" />;
      case 'update':
        return <Info className="h-4 w-4 text-success" />;
      case 'issue':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getCommentTypeLabel = (type: string) => {
    switch (type) {
      case 'system':
        return 'Sistema';
      case 'update':
        return 'Actualización';
      case 'issue':
        return 'Problema';
      default:
        return 'Comentario';
    }
  };

  const getCommentTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'system':
        return 'bg-info-muted text-info-muted-foreground';
      case 'update':
        return 'bg-success-muted text-success';
      case 'issue':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
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
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!isOpen) return null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentarios y Actividad
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {comments.length} comentario{comments.length !== 1 ? 's' : ''}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={invalidateComments}
              disabled={loading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Formulario para nuevo comentario */}
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {user ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Select value={commentType} onValueChange={(value: any) => setCommentType(value)}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comment">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3" />
                      Comentario
                    </div>
                  </SelectItem>
                  <SelectItem value="update">
                    <div className="flex items-center gap-2">
                      <Info className="h-3 w-3" />
                      Actualización
                    </div>
                  </SelectItem>
                  <SelectItem value="issue">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" />
                      Problema
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Textarea
            placeholder="Escribe un comentario..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
            disabled={submitting}
          />
          
          <div className="flex justify-end">
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              size="sm"
            >
              {submitting ? (
                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <Send className="h-3 w-3 mr-2" />
              )}
              {submitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Lista de comentarios */}
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay comentarios aún</p>
              <p className="text-xs text-muted-foreground">Sé el primero en agregar un comentario</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {comment.type === 'system' ? 'S' : getInitials(comment.author.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {comment.author.name}
                      </span>
                      <Badge className={cn('text-xs', getCommentTypeBadgeColor(comment.type))}>
                        {getCommentIcon(comment.type)}
                        <span className="ml-1">{getCommentTypeLabel(comment.type)}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(comment.createdAt)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 