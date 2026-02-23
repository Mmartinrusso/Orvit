'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, User, Award } from 'lucide-react';
import { SkillLevelBadge } from './SkillLevelBadge';
import { toast } from 'sonner';
import type { Skill } from '@/lib/types';

interface UserSkillAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  userName: string;
  companyId: number;
  existingSkillIds?: number[];
}

const SKILL_LEVELS = [
  { level: 1, label: 'Básico', description: 'Conocimientos fundamentales' },
  { level: 2, label: 'Intermedio', description: 'Puede trabajar con supervisión' },
  { level: 3, label: 'Avanzado', description: 'Trabaja de forma independiente' },
  { level: 4, label: 'Experto', description: 'Puede resolver problemas complejos' },
  { level: 5, label: 'Instructor', description: 'Puede capacitar a otros' },
];

export function UserSkillAssignDialog({
  open,
  onOpenChange,
  userId,
  userName,
  companyId,
  existingSkillIds = [],
}: UserSkillAssignDialogProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [level, setLevel] = useState(1);
  const [notes, setNotes] = useState('');
  const [acquiredAt, setAcquiredAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  // Fetch available skills
  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ['skills', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/skills?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error fetching skills');
      return res.json();
    },
    enabled: open,
  });

  const availableSkills = (skillsData?.skills || []).filter(
    (skill: Skill) => !existingSkillIds.includes(skill.id)
  );

  const selectedSkill = availableSkills.find(
    (s: Skill) => s.id === Number(selectedSkillId)
  );

  // Mutation to assign skill
  const assignMutation = useMutation({
    mutationFn: async (data: {
      skillId: number;
      level: number;
      notes?: string;
      acquiredAt?: string;
      expiresAt?: string;
    }) => {
      const res = await fetch(`/api/users/${userId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al asignar habilidad');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Habilidad asignada correctamente');
      queryClient.invalidateQueries({ queryKey: ['user-skills', userId] });
      queryClient.invalidateQueries({ queryKey: ['skill-matrix'] });
      handleClose();
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  const handleClose = () => {
    setSelectedSkillId('');
    setLevel(1);
    setNotes('');
    setAcquiredAt('');
    setExpiresAt('');
    setError('');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedSkillId) {
      setError('Seleccione una habilidad');
      return;
    }

    await assignMutation.mutateAsync({
      skillId: Number(selectedSkillId),
      level,
      notes: notes || undefined,
      acquiredAt: acquiredAt || undefined,
      expiresAt: expiresAt || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Asignar Habilidad
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {userName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Habilidad *</Label>
            {skillsLoading ? (
              <div className="flex items-center gap-2 p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando habilidades...</span>
              </div>
            ) : availableSkills.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No hay habilidades disponibles para asignar. El usuario ya tiene todas las habilidades o no hay habilidades definidas.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar habilidad" />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill: Skill) => (
                    <SelectItem key={skill.id} value={String(skill.id)}>
                      <div className="flex items-center gap-2">
                        <span>{skill.name}</span>
                        {skill.category && (
                          <span className="text-xs text-muted-foreground">
                            ({skill.category})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedSkill && (
            <>
              {selectedSkill.description && (
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  {selectedSkill.description}
                </p>
              )}

              {selectedSkill.isCertificationRequired && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Esta habilidad requiere certificación. El usuario deberá presentar documentación.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Nivel de Competencia *</Label>
                <SkillLevelBadge level={level} />
              </div>
              <Slider
                value={[level]}
                onValueChange={(vals) => setLevel(vals[0])}
                min={1}
                max={5}
                step={1}
                className="py-4"
              />
              <p className="text-sm text-muted-foreground">
                {SKILL_LEVELS[level - 1].description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acquiredAt">Fecha de Adquisición</Label>
              <Input
                id="acquiredAt"
                type="date"
                value={acquiredAt}
                onChange={(e) => setAcquiredAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Fecha de Vencimiento</Label>
              <Input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>

          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={assignMutation.isPending || !selectedSkillId}
            >
              {assignMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Asignar Habilidad
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default UserSkillAssignDialog;
