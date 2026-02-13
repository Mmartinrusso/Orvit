'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Award,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  FileCheck,
} from 'lucide-react';
import { SkillForm } from './SkillForm';
import { toast } from 'sonner';
import type { Skill } from '@/lib/types';

interface SkillListProps {
  companyId: number;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function SkillList({
  companyId,
  canCreate = false,
  canEdit = false,
  canDelete = false,
}: SkillListProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<Skill | null>(null);

  const queryClient = useQueryClient();

  // Fetch skills
  const { data, isLoading, error } = useQuery({
    queryKey: ['skills', companyId, search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: String(companyId),
      });
      if (search) params.append('search', search);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const res = await fetch(`/api/skills?${params}`);
      if (!res.ok) throw new Error('Error fetching skills');
      return res.json();
    },
  });

  const skills: Skill[] = data?.skills || [];
  const categories: string[] = data?.categories || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (skillData: Partial<Skill>) => {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...skillData, companyId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear habilidad');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Habilidad creada correctamente');
      queryClient.invalidateQueries({ queryKey: ['skills', companyId] });
      setIsFormOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (skillData: Partial<Skill>) => {
      const res = await fetch(`/api/skills/${editingSkill?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skillData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar habilidad');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Habilidad actualizada correctamente');
      queryClient.invalidateQueries({ queryKey: ['skills', companyId] });
      setEditingSkill(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (skillId: number) => {
      const res = await fetch(`/api/skills/${skillId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar habilidad');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Habilidad eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: ['skills', companyId] });
      setDeletingSkill(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = async (data: Partial<Skill>) => {
    await createMutation.mutateAsync(data);
  };

  const handleUpdate = async (data: Partial<Skill>) => {
    await updateMutation.mutateAsync(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Catálogo de Habilidades
              </CardTitle>
              <CardDescription>
                Define las habilidades requeridas en tu organización
              </CardDescription>
            </div>
            {canCreate && (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Habilidad
              </Button>
            )}
          </div>

          <div className="flex gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar habilidad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {skills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay habilidades definidas</p>
              {canCreate && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsFormOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primera habilidad
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Certificación</TableHead>
                  <TableHead className="text-center">Usuarios</TableHead>
                  <TableHead className="text-center">Requisitos</TableHead>
                  {(canEdit || canDelete) && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map((skill) => (
                  <TableRow key={skill.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{skill.name}</p>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {skill.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {skill.code || '-'}
                    </TableCell>
                    <TableCell>
                      {skill.category ? (
                        <Badge variant="outline">{skill.category}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {skill.isCertificationRequired ? (
                        <Badge className="bg-blue-100 text-blue-800">
                          <FileCheck className="h-3 w-3 mr-1" />
                          Requerida
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{skill._count?.userSkills || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {skill._count?.taskRequirements || 0}
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={() => setEditingSkill(skill)}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => setDeletingSkill(skill)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isFormOpen || !!editingSkill}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingSkill(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingSkill ? 'Editar Habilidad' : 'Nueva Habilidad'}
            </DialogTitle>
          </DialogHeader>
          <SkillForm
            skill={editingSkill}
            categories={categories}
            onSubmit={editingSkill ? handleUpdate : handleCreate}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingSkill(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingSkill}
        onOpenChange={(open) => !open && setDeletingSkill(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Habilidad</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar la habilidad &quot;{deletingSkill?.name}&quot;?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSkill && deleteMutation.mutate(deletingSkill.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SkillList;
