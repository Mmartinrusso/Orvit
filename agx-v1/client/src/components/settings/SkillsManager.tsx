import { useState } from 'react';
import { Zap, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import { useSkills, useCreateSkill, useUpdateSkill, useDeleteSkill } from '@/hooks';
import { useToast } from '@/context';
import { Button, Card, Spinner, Badge, Input } from '@/components/common';
import type { Skill } from '@/api/types';
import { cn } from '@/utils';
import { skillsApi } from '@/api';

const CATEGORIES = [
  { value: 'development', label: 'Desarrollo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'testing', label: 'Testing', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'security', label: 'Seguridad', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'performance', label: 'Rendimiento', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'frontend', label: 'Frontend', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300' },
];

function getCategoryInfo(category: string) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1];
}

interface SkillEditorProps {
  skill?: Skill & { content?: string };
  onSave: (data: { id: string; name: string; description: string; triggers: string[]; category: string; autoActivate: boolean; content: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function SkillEditor({ skill, onSave, onCancel, isLoading }: SkillEditorProps) {
  const [id, setId] = useState(skill?.id || '');
  const [name, setName] = useState(skill?.name || '');
  const [description, setDescription] = useState(skill?.description || '');
  const [triggersText, setTriggersText] = useState(skill?.triggers.join(', ') || '');
  const [category, setCategory] = useState(skill?.category || 'general');
  const [autoActivate, setAutoActivate] = useState(skill?.autoActivate ?? true);
  const [content, setContent] = useState(skill?.content || '');

  const isNew = !skill;

  const handleSubmit = () => {
    const triggers = triggersText.split(',').map(t => t.trim()).filter(Boolean);
    onSave({ id, name, description, triggers, category, autoActivate, content });
  };

  return (
    <div className="space-y-4">
      {isNew && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">ID (unico, sin espacios)</label>
          <Input
            value={id}
            onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="mi-nueva-skill"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">Nombre</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre descriptivo de la skill" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">Descripcion</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Que hace esta skill" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg text-sm"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 pb-1">
          <button
            type="button"
            onClick={() => setAutoActivate(!autoActivate)}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-text-secondary"
          >
            {autoActivate ? (
              <ToggleRight className="h-6 w-6 text-green-500" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-gray-400" />
            )}
            Auto-activar por triggers
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
          Triggers (separados por coma)
        </label>
        <Input
          value={triggersText}
          onChange={(e) => setTriggersText(e.target.value)}
          placeholder="bug, error, fix, corregir"
        />
        <p className="text-xs text-gray-400 mt-1">Palabras clave que activan esta skill automaticamente</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
          Instrucciones (Markdown)
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg font-mono text-sm resize-y"
          placeholder="Escribe las instrucciones que el agente debe seguir cuando esta skill se active..."
        />
      </div>

      <div className="flex items-center gap-2 justify-end pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={isLoading}
          disabled={!name || !content || (isNew && !id)}
        >
          {isNew ? 'Crear Skill' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
}

export function SkillsManager() {
  const { addToast } = useToast();
  const { data, isLoading } = useSkills();
  const createMutation = useCreateSkill();
  const updateMutation = useUpdateSkill();
  const deleteMutation = useDeleteSkill();

  const [showEditor, setShowEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState<(Skill & { content?: string }) | undefined>(undefined);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const skills = data?.skills || [];

  const handleCreate = async (data: { id: string; name: string; description: string; triggers: string[]; category: string; autoActivate: boolean; content: string }) => {
    try {
      await createMutation.mutateAsync(data);
      addToast(`Skill "${data.name}" creada`, 'success');
      setShowEditor(false);
    } catch {
      addToast('Error al crear la skill', 'error');
    }
  };

  const handleUpdate = async (data: { id: string; name: string; description: string; triggers: string[]; category: string; autoActivate: boolean; content: string }) => {
    try {
      await updateMutation.mutateAsync({
        skillId: data.id,
        data: { name: data.name, description: data.description, triggers: data.triggers, category: data.category, autoActivate: data.autoActivate, content: data.content },
      });
      addToast(`Skill "${data.name}" actualizada`, 'success');
      setShowEditor(false);
      setEditingSkill(undefined);
    } catch {
      addToast('Error al actualizar la skill', 'error');
    }
  };

  const handleDelete = async (skillId: string, skillName: string) => {
    if (!confirm(`¿Eliminar la skill "${skillName}"? Esta accion no se puede deshacer.`)) return;

    try {
      await deleteMutation.mutateAsync(skillId);
      addToast(`Skill "${skillName}" eliminada`, 'success');
    } catch {
      addToast('Error al eliminar la skill', 'error');
    }
  };

  const handleEdit = async (skill: Skill) => {
    // Fetch full content
    try {
      const detail = await skillsApi.get(skill.id);
      setEditingSkill(detail.skill);
      setShowEditor(true);
    } catch {
      addToast('Error al cargar la skill', 'error');
    }
  };

  if (isLoading) {
    return (
      <Card title="Skills del Sistema" icon={<Zap className="h-5 w-5 text-amber-500" />}>
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Skills del Sistema"
      icon={<Zap className="h-5 w-5 text-amber-500" />}
      actions={
        !showEditor ? (
          <Button variant="primary" size="sm" onClick={() => { setEditingSkill(undefined); setShowEditor(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva Skill
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Info */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          <p className="font-medium mb-1">Skills automaticas</p>
          <p className="text-xs">
            Las skills son instrucciones especializadas que se activan automaticamente cuando el prompt de una tarea
            contiene palabras clave (triggers). Cada skill agrega contexto especifico al agente para mejorar la calidad del resultado.
          </p>
        </div>

        {/* Editor */}
        {showEditor && (
          <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4 bg-gray-50 dark:bg-dark-hover">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-3">
              {editingSkill ? `Editar: ${editingSkill.name}` : 'Nueva Skill'}
            </h4>
            <SkillEditor
              skill={editingSkill}
              onSave={editingSkill ? handleUpdate : handleCreate}
              onCancel={() => { setShowEditor(false); setEditingSkill(undefined); }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </div>
        )}

        {/* Skills List */}
        {!showEditor && skills.length === 0 && (
          <div className="text-center py-6 text-gray-400 dark:text-dark-text-secondary">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay skills configuradas</p>
            <p className="text-xs mt-1">Crea una skill para que los agentes tengan instrucciones especializadas</p>
          </div>
        )}

        {!showEditor && skills.map(skill => {
          const cat = getCategoryInfo(skill.category);
          const isExpanded = expandedSkill === skill.id;

          return (
            <div
              key={skill.id}
              className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-text">{skill.name}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', cat.color)}>{cat.label}</span>
                    {skill.autoActivate ? (
                      <Badge variant="success" className="text-xs">Auto</Badge>
                    ) : (
                      <Badge variant="neutral" className="text-xs">Manual</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-dark-text-secondary truncate mt-0.5">{skill.description}</p>
                </div>

                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-dark-hover text-gray-400 hover:text-blue-500 transition-colors"
                    onClick={() => handleEdit(skill)}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-dark-hover text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => handleDelete(skill.id, skill.name)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 py-3 bg-gray-50 dark:bg-dark-hover/50 border-t border-gray-200 dark:border-dark-border">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Tag className="h-3 w-3 text-gray-400" />
                    {skill.triggers.map(trigger => (
                      <span key={trigger} className="text-xs bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text-secondary px-2 py-0.5 rounded">
                        {trigger}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-dark-text-secondary">
                    ID: <code className="bg-gray-200 dark:bg-dark-border px-1 rounded">{skill.id}</code>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
