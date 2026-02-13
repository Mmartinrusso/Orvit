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
  Lightbulb,
  Plus,
  Search,
  RefreshCw,
  BookOpen,
  AlertTriangle,
  Shield,
  Wrench,
  CheckCircle,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Share2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LessonLearned {
  id: number;
  title: string;
  description: string;
  rootCause?: string;
  whatWorked?: string;
  whatDidnt?: string;
  recommendation: string;
  category: string;
  status: string;
  workOrderTitle?: string;
  failureDescription?: string;
  machineName?: string;
  createdByName: string;
  createdAt: string;
  tags?: string[];
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  TECHNICAL: { label: 'Técnico', color: 'bg-blue-100 text-blue-800', icon: Wrench },
  PROCESS: { label: 'Proceso', color: 'bg-purple-100 text-purple-800', icon: BookOpen },
  SAFETY: { label: 'Seguridad', color: 'bg-red-100 text-red-800', icon: Shield },
  QUALITY: { label: 'Calidad', color: 'bg-green-100 text-green-800', icon: CheckCircle },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-800' },
  APPROVED: { label: 'Aprobada', color: 'bg-blue-100 text-blue-800' },
  PUBLISHED: { label: 'Publicada', color: 'bg-green-100 text-green-800' },
};

export default function LeccionesPage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lessons-learned', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/lessons-learned?companyId=${currentCompany?.id}`);
      if (!res.ok) throw new Error('Error fetching lessons');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const lessons: LessonLearned[] = data?.lessons || [];
  const summary = data?.summary || {};

  const filteredLessons = lessons.filter(l => {
    const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || l.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6" />
            Lecciones Aprendidas
          </h1>
          <p className="text-muted-foreground">
            Registro y consulta de conocimiento adquirido
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Lección
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{summary.total || 0}</p>
              </div>
              <Lightbulb className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Técnico</p>
                <p className="text-2xl font-bold text-blue-600">{summary.byCategory?.technical || 0}</p>
              </div>
              <Wrench className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Proceso</p>
                <p className="text-2xl font-bold text-purple-600">{summary.byCategory?.process || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Seguridad</p>
                <p className="text-2xl font-bold text-red-600">{summary.byCategory?.safety || 0}</p>
              </div>
              <Shield className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Calidad</p>
                <p className="text-2xl font-bold text-green-600">{summary.byCategory?.quality || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lecciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="TECHNICAL">Técnico</SelectItem>
            <SelectItem value="PROCESS">Proceso</SelectItem>
            <SelectItem value="SAFETY">Seguridad</SelectItem>
            <SelectItem value="QUALITY">Calidad</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="APPROVED">Aprobada</SelectItem>
            <SelectItem value="PUBLISHED">Publicada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lessons Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-40 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : filteredLessons.length === 0 ? (
          <div className="col-span-2 text-center py-12">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron lecciones aprendidas</p>
            <Button variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Registrar primera lección
            </Button>
          </div>
        ) : (
          filteredLessons.map((lesson) => {
            const categoryConfig = CATEGORY_CONFIG[lesson.category] || CATEGORY_CONFIG.TECHNICAL;
            const statusConfig = STATUS_CONFIG[lesson.status] || STATUS_CONFIG.DRAFT;
            const CategoryIcon = categoryConfig.icon;

            return (
              <Card key={lesson.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <CategoryIcon className={`h-5 w-5 mt-0.5 ${categoryConfig.color.replace('bg-', 'text-').replace('-100', '-600')}`} />
                      <div>
                        <CardTitle className="text-base">{lesson.title}</CardTitle>
                        {lesson.machineName && (
                          <CardDescription>{lesson.machineName}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Badge className={categoryConfig.color}>{categoryConfig.label}</Badge>
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {lesson.description}
                    </p>

                    {lesson.recommendation && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Recomendación:</p>
                        <p className="text-sm">{lesson.recommendation}</p>
                      </div>
                    )}

                    {lesson.tags && lesson.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {lesson.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                      <span>Por {lesson.createdByName}</span>
                      <span>{format(new Date(lesson.createdAt), 'dd MMM yyyy', { locale: es })}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <FileText className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button variant="ghost" size="sm">
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share2 className="h-4 w-4" />
                      </Button>
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
