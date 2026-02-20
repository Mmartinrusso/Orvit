'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  FileText,
  Wrench,
  Shield,
  Lightbulb,
  Book,
  Eye,
  ThumbsUp,
  Calendar,
  User,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface KnowledgeArticle {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  machine_name: string | null;
  status: string;
  viewCount: number;
  helpfulCount: number;
  author_name: string;
  reviewed_by_name: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachment_count: number;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PROCEDURE: { label: 'Procedimiento', icon: <FileText className="h-4 w-4" />, color: 'bg-info-muted text-info-muted-foreground' },
  TROUBLESHOOTING: { label: 'Solución de Problemas', icon: <Wrench className="h-4 w-4" />, color: 'bg-warning-muted text-warning-muted-foreground' },
  SAFETY: { label: 'Seguridad', icon: <Shield className="h-4 w-4" />, color: 'bg-destructive/10 text-destructive' },
  MANUAL: { label: 'Manual', icon: <Book className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800' },
  BEST_PRACTICE: { label: 'Buenas Prácticas', icon: <Lightbulb className="h-4 w-4" />, color: 'bg-success-muted text-success' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'bg-muted text-foreground' },
  PUBLISHED: { label: 'Publicado', color: 'bg-success-muted text-success' },
  ARCHIVED: { label: 'Archivado', color: 'bg-warning-muted text-warning-muted-foreground' },
};

export default function KnowledgeBasePage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['knowledge-articles', currentCompany?.id, categoryFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: String(currentCompany?.id),
        status: 'all',
      });
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (search) params.append('search', search);

      const res = await fetch(`/api/knowledge?${params}`);
      if (!res.ok) throw new Error('Error al cargar artículos');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const articles: KnowledgeArticle[] = data?.articles || [];
  const categories = data?.categories || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Base de Conocimiento
          </h1>
          <p className="text-muted-foreground">
            Documentación, procedimientos y mejores prácticas de mantenimiento
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Artículo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Artículo de Conocimiento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input placeholder="Ej: Procedimiento de cambio de rodamientos" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select defaultValue="PROCEDURE">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROCEDURE">Procedimiento</SelectItem>
                        <SelectItem value="TROUBLESHOOTING">Solución de Problemas</SelectItem>
                        <SelectItem value="SAFETY">Seguridad</SelectItem>
                        <SelectItem value="MANUAL">Manual</SelectItem>
                        <SelectItem value="BEST_PRACTICE">Buenas Prácticas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select defaultValue="DRAFT">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DRAFT">Borrador</SelectItem>
                        <SelectItem value="PUBLISHED">Publicado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Resumen</Label>
                  <Textarea placeholder="Breve descripción del artículo..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Contenido *</Label>
                  <Textarea placeholder="Contenido completo del artículo..." rows={8} />
                </div>
                <div className="space-y-2">
                  <Label>Tags (separados por coma)</Label>
                  <Input placeholder="Ej: rodamientos, preventivo, motor" />
                </div>
                <Button className="w-full" onClick={() => setIsDialogOpen(false)}>
                  Crear Artículo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const count = categories.find((c: any) => c.category === key)?.count || 0;
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-colors ${categoryFilter === key ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${config.color}`}>
                    {config.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{config.label}</p>
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar artículos por título o contenido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : articles.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron artículos</p>
            <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primer artículo
            </Button>
          </div>
        ) : (
          articles.map((article) => {
            const categoryConfig = CATEGORY_CONFIG[article.category] || { label: article.category, icon: <FileText className="h-4 w-4" />, color: 'bg-muted' };
            const statusConfig = STATUS_CONFIG[article.status] || STATUS_CONFIG.DRAFT;

            return (
              <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Badge className={categoryConfig.color}>
                      <span className="flex items-center gap-1">
                        {categoryConfig.icon}
                        {categoryConfig.label}
                      </span>
                    </Badge>
                    <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                  </div>
                  <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                  {article.summary && (
                    <CardDescription className="line-clamp-2">{article.summary}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {article.machine_name && (
                      <p className="text-sm text-muted-foreground">
                        Máquina: {article.machine_name}
                      </p>
                    )}

                    {article.tags && article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {article.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {article.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{article.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {article.helpfulCount}
                        </span>
                      </div>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: es })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {article.author_name}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
