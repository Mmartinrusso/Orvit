import { useState, useEffect } from 'react';
import { Settings, BookOpen, Save, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useKnowledgeBase, useUpdateKnowledgeBase, useDeleteKnowledgeBase, useProject } from '@/hooks';
import { useToast } from '@/context';
import { Button, Card, Spinner, Checkbox } from '@/components/common';
import { SkillsManager } from '@/components/settings/SkillsManager';

export function SettingsPage() {
  const { addToast } = useToast();
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: projectData } = useProject();
  const project = projectData?.project;
  const { data, isLoading, refetch } = useKnowledgeBase();
  const updateMutation = useUpdateKnowledgeBase();
  const deleteMutation = useDeleteKnowledgeBase();

  const knowledgeBase = data?.knowledge_base;

  // Load initial data
  useEffect(() => {
    if (knowledgeBase) {
      setContent(knowledgeBase.content || '');
      setIsActive(knowledgeBase.is_active);
      setHasChanges(false);
    } else if (data && !knowledgeBase) {
      // No knowledge base exists yet
      setContent('');
      setIsActive(true);
      setHasChanges(false);
    }
  }, [knowledgeBase, data]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  const handleActiveChange = (checked: boolean) => {
    setIsActive(checked);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      const result = await updateMutation.mutateAsync({
        content: content.trim(),
        is_active: isActive,
      });
      if (result.success) {
        addToast('Base de conocimiento guardada correctamente', 'success');
        setHasChanges(false);
        refetch();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      addToast(message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estas seguro de eliminar la base de conocimiento? Los agentes dejaran de recibir estas instrucciones.')) {
      return;
    }

    try {
      const result = await deleteMutation.mutateAsync();
      if (result.success) {
        addToast('Base de conocimiento eliminada', 'success');
        setContent('');
        setIsActive(true);
        setHasChanges(false);
        refetch();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      addToast(message, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-gray-500 dark:text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Configuracion</h1>
          <p className="text-sm text-gray-500 dark:text-dark-text-secondary">
            Configura el comportamiento de los agentes
          </p>
        </div>
      </div>

      {/* Project Section */}
      <Card title="Proyecto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-dark-text-secondary mb-1">Nombre</p>
            <p className="text-sm font-medium text-slate-900 dark:text-dark-text">{project?.name || 'Cargando...'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-dark-text-secondary mb-1">Version</p>
            <p className="text-sm font-medium text-slate-900 dark:text-dark-text">{project?.version || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-dark-text-secondary mb-1">Ruta</p>
            <p className="text-sm font-medium text-slate-900 dark:text-dark-text truncate" title={project?.path}>{project?.path || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-dark-text-secondary mb-1">Branch</p>
            <p className="text-sm font-medium text-slate-900 dark:text-dark-text">{project?.gitBranch || '-'}</p>
          </div>
          {project?.techStack && project.techStack.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-slate-500 dark:text-dark-text-secondary mb-1">Stack</p>
              <div className="flex flex-wrap gap-1">
                {project.techStack.map(tech => (
                  <span key={tech} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">{tech}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card title="Atajos de Teclado">
        <div className="space-y-2">
          {[
            { keys: 'Ctrl + K', desc: 'Abrir Command Palette' },
            { keys: 'Ctrl + Enter', desc: 'Mejorar prompt con IA' },
            { keys: 'Shift + Enter', desc: 'Ejecutar tarea directamente' },
            { keys: 'Ctrl + 1-5', desc: 'Navegar entre paginas' },
          ].map(({ keys, desc }) => (
            <div key={keys} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-600 dark:text-dark-text-secondary">{desc}</span>
              <kbd className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded font-mono">{keys}</kbd>
            </div>
          ))}
        </div>
      </Card>

      {/* Skills System */}
      <SkillsManager />

      {/* Knowledge Base Section */}
      <Card
        title="Base de Conocimiento del Sistema"
        icon={<BookOpen className="h-5 w-5 text-blue-500" />}
        actions={
          <div className="flex items-center gap-2">
            {knowledgeBase && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={updateMutation.isPending}
              disabled={!hasChanges}
            >
              <Save className="h-4 w-4 mr-1" />
              Guardar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Info Alert */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">¿Que es la Base de Conocimiento?</p>
              <p>
                Son instrucciones personalizadas que TODOS los agentes recibiran al ejecutar tareas.
                Utiles para especificar convenciones de tu proyecto, reglas de negocio, o cualquier
                informacion que los agentes deben conocer.
              </p>
            </div>
          </div>

          {/* Status Indicator */}
          {knowledgeBase && (
            <div className={`flex items-center gap-2 text-sm ${knowledgeBase.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-dark-text-secondary'}`}>
              {knowledgeBase.is_active ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Base de conocimiento activa - los agentes reciben estas instrucciones
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  Base de conocimiento desactivada - los agentes NO reciben estas instrucciones
                </>
              )}
            </div>
          )}

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="kb-active"
              checked={isActive}
              onChange={(e) => handleActiveChange(e.target.checked)}
            />
            <label htmlFor="kb-active" className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary">
              Activar base de conocimiento
            </label>
          </div>

          {/* Content Editor */}
          <div>
            <label htmlFor="kb-content" className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
              Instrucciones para los Agentes
            </label>
            <textarea
              id="kb-content"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={`Escribe las instrucciones que todos los agentes deben seguir...

Ejemplos:
- "Siempre usa TypeScript estricto con tipos explicitos"
- "Cuando modifiques la base de datos, actualiza tambien el archivo de migraciones en /db/migrations"
- "Usa el patron Repository para acceso a datos"
- "Los componentes React deben usar functional components con hooks"
- "Nombra los archivos en kebab-case"`}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y dark:placeholder-gray-500"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-dark-text-secondary">
              {content.length} caracteres
              {hasChanges && <span className="ml-2 text-yellow-600 dark:text-yellow-400">• Cambios sin guardar</span>}
            </p>
          </div>

          {/* Examples */}
          <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
            <h4 className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">Ejemplos de instrucciones utiles:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                'Usa Zod para validacion de schemas',
                'Los errores deben ser manejados con try-catch',
                'Documenta las funciones publicas con JSDoc',
                'Usa pnpm como gestor de paquetes',
                'El formato de fechas es ISO 8601',
                'Los tests deben usar Vitest',
                'Las APIs deben retornar errores en formato JSON',
                'Usa Tailwind CSS para estilos',
              ].map((example, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleContentChange(content + (content ? '\n' : '') + `- ${example}`)}
                  className="text-left text-xs text-gray-600 dark:text-dark-text-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded transition-colors"
                >
                  + {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
