'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SkillLevelIndicator } from './SkillLevelBadge';
import { Search, Users, Award, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkillMatrixProps {
  companyId: number;
}

interface UserSkillData {
  userId: number;
  userName: string;
  skills: Record<number, {
    level: number;
    isVerified: boolean;
    expiresAt: string | null;
  }>;
}

export function SkillMatrix({ companyId }: SkillMatrixProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch skills
  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ['skills', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/skills?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error fetching skills');
      return res.json();
    },
  });

  // Fetch skill matrix data (users with their skills)
  const { data: matrixData, isLoading: matrixLoading } = useQuery({
    queryKey: ['skill-matrix', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/skills/matrix?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error fetching matrix');
      return res.json() as Promise<{ users: UserSkillData[] }>;
    },
    enabled: !!skillsData,
  });

  const skills = skillsData?.skills || [];
  const categories = skillsData?.categories || [];
  const users = matrixData?.users || [];

  // Filter skills by category
  const filteredSkills = useMemo(() => {
    return skills.filter((skill: { category?: string }) =>
      categoryFilter === 'all' || skill.category === categoryFilter
    );
  }, [skills, categoryFilter]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const lowerSearch = search.toLowerCase();
    return users.filter((user: UserSkillData) =>
      user.userName.toLowerCase().includes(lowerSearch)
    );
  }, [users, search]);

  if (skillsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Matriz de Habilidades
            </CardTitle>
            <CardDescription>
              Visualización de habilidades por usuario
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Verificado
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Por vencer
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuario..."
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
              {categories.map((cat: string) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {matrixLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay habilidades definidas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[200px]">
                    Usuario
                  </TableHead>
                  {filteredSkills.map((skill: { id: number; name: string; code?: string }) => (
                    <TableHead
                      key={skill.id}
                      className="text-center min-w-[100px]"
                      title={skill.name}
                    >
                      <div className="truncate max-w-[100px]">
                        {skill.code || skill.name}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={filteredSkills.length + 1}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay usuarios que mostrar
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: UserSkillData) => (
                    <TableRow key={user.userId}>
                      <TableCell className="sticky left-0 bg-white z-10 font-medium">
                        {user.userName}
                      </TableCell>
                      {filteredSkills.map((skill: { id: number }) => {
                        const userSkill = user.skills[skill.id];
                        const isExpiringSoon = userSkill?.expiresAt &&
                          new Date(userSkill.expiresAt) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                        return (
                          <TableCell key={skill.id} className="text-center">
                            {userSkill ? (
                              <div className="flex flex-col items-center gap-1">
                                <SkillLevelIndicator level={userSkill.level} />
                                <div className="flex gap-0.5">
                                  {userSkill.isVerified && (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  )}
                                  {isExpiringSoon && (
                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium mb-2">Niveles:</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <SkillLevelIndicator level={1} />
              <span className="text-muted-foreground">Básico</span>
            </div>
            <div className="flex items-center gap-2">
              <SkillLevelIndicator level={2} />
              <span className="text-muted-foreground">Intermedio</span>
            </div>
            <div className="flex items-center gap-2">
              <SkillLevelIndicator level={3} />
              <span className="text-muted-foreground">Avanzado</span>
            </div>
            <div className="flex items-center gap-2">
              <SkillLevelIndicator level={4} />
              <span className="text-muted-foreground">Experto</span>
            </div>
            <div className="flex items-center gap-2">
              <SkillLevelIndicator level={5} />
              <span className="text-muted-foreground">Instructor</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SkillMatrix;
