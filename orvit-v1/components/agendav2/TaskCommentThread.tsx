'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Matches the shape returned by the API (author field, not user)
interface CommentAuthor {
  id: number;
  name: string;
  avatar?: string | null;
}

export interface ThreadComment {
  id: number;
  content: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  authorId: number;
  author: CommentAuthor | null;
}

interface TaskCommentThreadProps {
  comments: ThreadComment[];
  onEditComment: (commentId: number, content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}

export function TaskCommentThread({
  comments,
  onEditComment,
  onDeleteComment,
}: TaskCommentThreadProps) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleStartEdit = (comment: ThreadComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!editContent.trim()) return;
    try {
      await onEditComment(commentId, editContent.trim());
      setEditingId(null);
      setEditContent('');
    } catch {
      toast.error('Error al editar el comentario');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleConfirmDelete = async (commentId: number) => {
    try {
      await onDeleteComment(commentId);
      setDeletingId(null);
    } catch {
      toast.error('Error al eliminar el comentario');
    }
  };

  if (!comments || comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No hay comentarios aún.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const isOwn = user?.id != null && comment.authorId != null
          ? String(comment.authorId) === String(user.id)
          : false;
        const isEditing = editingId === comment.id;
        const isDeleting = deletingId === comment.id;
        const authorName = comment.author?.name ?? 'Usuario';
        const authorInitials = authorName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        return (
          <div key={comment.id} className="flex gap-3 group">
            <Avatar className="h-7 w-7 shrink-0 mt-0.5">
              <AvatarImage src={comment.author?.avatar ?? undefined} />
              <AvatarFallback className="text-[10px] font-bold">
                {authorInitials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold">{authorName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
                {comment.updatedAt &&
                  new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000 && (
                    <span className="text-xs text-muted-foreground italic">(editado)</span>
                  )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit(comment.id);
                      }
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="text-sm min-h-[60px] resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 px-2 gap-1"
                      onClick={() => handleSaveEdit(comment.id)}
                    >
                      <Check className="h-3 w-3" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 gap-1"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3 w-3" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : isDeleting ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    ¿Eliminar este comentario?
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleConfirmDelete(comment.id)}
                  >
                    Sí
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setDeletingId(null)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              )}
            </div>

            {isOwn && !isEditing && !isDeleting && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleStartEdit(comment)}
                  title="Editar comentario"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDeletingId(comment.id)}
                  title="Eliminar comentario"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
