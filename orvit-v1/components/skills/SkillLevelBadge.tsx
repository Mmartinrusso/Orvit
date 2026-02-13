'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SkillLevelBadgeProps {
  level: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SKILL_LEVELS = [
  { level: 1, label: 'Básico', color: 'bg-gray-500' },
  { level: 2, label: 'Intermedio', color: 'bg-blue-500' },
  { level: 3, label: 'Avanzado', color: 'bg-green-500' },
  { level: 4, label: 'Experto', color: 'bg-purple-500' },
  { level: 5, label: 'Instructor', color: 'bg-amber-500' },
];

export function SkillLevelBadge({ level, showLabel = true, size = 'md' }: SkillLevelBadgeProps) {
  const skillLevel = SKILL_LEVELS.find(s => s.level === level) || SKILL_LEVELS[0];

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  return (
    <Badge
      className={cn(
        'text-white font-medium',
        skillLevel.color,
        sizeClasses[size]
      )}
    >
      {showLabel ? `${skillLevel.label} (${level})` : level}
    </Badge>
  );
}

export function SkillLevelIndicator({ level, maxLevel = 5 }: { level: number; maxLevel?: number }) {
  return (
    <div className="flex gap-1 items-center">
      {Array.from({ length: maxLevel }, (_, i) => (
        <div
          key={i}
          className={cn(
            'w-2 h-2 rounded-full',
            i < level ? SKILL_LEVELS[Math.min(level - 1, 4)].color : 'bg-gray-200'
          )}
        />
      ))}
    </div>
  );
}

export default SkillLevelBadge;
