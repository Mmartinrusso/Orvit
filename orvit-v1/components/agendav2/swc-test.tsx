'use client';
import { useState } from 'react';

type AssigneeOption = { id?: number; name: string; initials: string; bg: string; color: string };

export function SwcTest() {
  const [open, setOpen] = useState(false);

  const AVATAR_COLORS = [
    { bg: '#F3F4F6', color: '#111827' },
    { bg: '#ECFDF5', color: '#059669' },
  ];

  async function submitComment(content: string): Promise<void> {
    if (!content.trim()) return;
  }

  async function handleEditComment(commentId: number, newContent: string): Promise<void> {
    // stub
  }

  async function handleDeleteComment(commentId: number): Promise<void> {
    // stub
  }

  const taskAssigneesArr: AssigneeOption[] = (() => {
    return [{ name: 'Test', id: 1 }].map((u, i) => ({
      id: u.id,
      name: u.name,
      initials: u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      ...AVATAR_COLORS[i % AVATAR_COLORS.length],
    }));
  })();

  const assigneeName = 'Juan Pedro';
  const assigneeInitials = assigneeName && assigneeName !== 'Sin asignar'
    ? assigneeName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : null;

  const subtasks = [1, 2, 3];
  const completedCount = 1;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <>
      <div>{subtaskProgress}</div>
      <div>{assigneeInitials}</div>
    </>
  );
}
