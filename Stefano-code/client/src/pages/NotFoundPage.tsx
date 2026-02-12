import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button, EmptyState } from '@/components/common';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-bg flex items-center justify-center">
      <EmptyState
        title="Pagina no encontrada"
        description="La pagina que buscas no existe"
        action={
          <Button onClick={() => navigate('/')}>
            <Home className="h-4 w-4 mr-2" />
            Ir al inicio
          </Button>
        }
      />
    </div>
  );
}
