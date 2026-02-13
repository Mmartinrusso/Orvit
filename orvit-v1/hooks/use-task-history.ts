import { useState, useEffect } from 'react';

interface TaskHistoryItem {
  id: number;
  task: {
    id: number;
    title: string;
    description?: string;
    status: string;
    priority: string;
    dueDate?: string;
    assignedTo?: {
      id: number;
      name: string;
      email: string;
    };
    createdBy: {
      id: number;
      name: string;
      email: string;
    };
    company: {
      id: number;
      name: string;
    };
    companyId: number;
    tags?: string[];
    progress: number;
    createdAt: string;
    updatedAt: string;
    deletedBy: {
      id: number;
      name: string;
      email: string;
    };
    deletedAt: string;
    files?: {
      id: string;
      name: string;
      url: string;
      size?: number;
      type?: string;
      uploadedAt: string;
      uploadedBy?: {
        id: number;
        name: string;
        email: string;
      };
    }[];
    comments?: {
      id: string;
      content: string;
      userId: string;
      userName: string;
      userEmail: string;
      createdAt: string;
    }[];
  };
  deletedAt: Date;
  deletedBy: {
    id: number;
    name: string;
    email: string;
  };
}

export function useTaskHistory() {
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/tasks/history', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setHistory(data.history || []);
      } else {
        throw new Error(data.error || 'Error al obtener historial');
      }
    } catch (err) {
      console.error('Error fetching task history:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return {
    history,
    loading,
    error,
    refetch: fetchHistory
  };
} 