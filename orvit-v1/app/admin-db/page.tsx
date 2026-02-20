'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDBPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testDatabase = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-db');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Error desconocido' });
    } finally {
      setLoading(false);
    }
  };

  const seedVentas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/seed-ventas', { method: 'POST' });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Error desconocido' });
    } finally {
      setLoading(false);
    }
  };

  const createTable = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/create-checklist-table', {
        method: 'POST'
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Error desconocido' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Administración de Base de Datos</h1>
      
      <div className="grid gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuración del Sistema de Mantenimiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={testDatabase}
              disabled={loading}
              variant="outline"
            >
              {loading ? 'Probando...' : 'Probar Conexión DB'}
            </Button>

            <Button
              onClick={createTable}
              disabled={loading}
              className="ml-2"
            >
              {loading ? 'Configurando...' : 'Configurar Sistema'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos de Prueba — Ventas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Crea 7 facturas con ítems para el mes actual (estado EMITIDA / COBRADA / PARCIALMENTE_COBRADA).
              Aparecen en Costos → Ventas del mes corriente.
            </p>
            <Button
              onClick={seedVentas}
              disabled={loading}
              variant="outline"
            >
              {loading ? 'Cargando...' : 'Cargar facturas de ejemplo'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}