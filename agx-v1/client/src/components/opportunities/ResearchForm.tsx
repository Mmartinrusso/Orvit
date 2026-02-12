import { useState } from 'react';
import { Search, Globe, Lightbulb } from 'lucide-react';
import { Button, Card, Select } from '@/components/common';
import type { ResearchOpportunityRequest, OpportunityLanguage } from '@/api/types';

interface ResearchFormProps {
  onSubmit: (request: ResearchOpportunityRequest) => void;
  isSubmitting: boolean;
}

export function ResearchForm({ onSubmit, isSubmitting }: ResearchFormProps) {
  const [idea, setIdea] = useState('');
  const [language, setLanguage] = useState<OpportunityLanguage>('es');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const request: ResearchOpportunityRequest = {
      idea: idea.trim(),
      language,
    };

    onSubmit(request);
  };

  const isValid = idea.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card title="Investigar Nueva Idea" className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
        <div className="space-y-4">
          {/* Idea Input */}
          <div>
            <label htmlFor="idea" className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
              <Lightbulb className="h-4 w-4 inline mr-1 text-yellow-500" />
              Describe tu idea o funcionalidad
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Ej: Agregar una ventana CRM con ML para predecir leads calificados basado en el historial de interacciones..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary">
              El agente investigara en internet y analizara el codigo local para crear un plan de implementacion detallado
            </p>
          </div>

          {/* Language Selection */}
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
              Idioma del Resultado
            </label>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as OpportunityLanguage)}
              options={[
                { value: 'es', label: 'Espanol' },
                { value: 'en', label: 'English' },
              ]}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <div className="flex items-center text-sm text-gray-500 dark:text-dark-text-secondary">
          <Globe className="h-4 w-4 mr-1" />
          El agente investiga en internet y analiza el codigo para crear un plan detallado
        </div>
        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          loading={isSubmitting}
          className="bg-yellow-500 hover:bg-yellow-600"
        >
          <Search className="h-4 w-4 mr-2" />
          Investigar Idea
        </Button>
      </div>
    </form>
  );
}
