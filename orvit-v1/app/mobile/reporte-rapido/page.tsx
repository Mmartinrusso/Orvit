'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Camera,
  Mic,
  Send,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  MapPin,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Machine {
  id: number;
  name: string;
  location?: string;
}

const priorities = [
  { value: 'P1', label: 'P1 - Crítico', description: 'Producción detenida', color: 'bg-destructive' },
  { value: 'P2', label: 'P2 - Alto', description: 'Producción afectada', color: 'bg-orange-500' },
  { value: 'P3', label: 'P3 - Medio', description: 'Sin impacto inmediato', color: 'bg-warning' },
  { value: 'P4', label: 'P4 - Bajo', description: 'Planificable', color: 'bg-primary' },
];

export default function ReporteRapidoPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [description, setDescription] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [priority, setPriority] = useState('P3');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch machines
  useEffect(() => {
    if (!currentCompany?.id) return;

    const fetchMachines = async () => {
      try {
        const response = await fetch(`/api/machines?companyId=${currentCompany.id}&limit=100`);
        if (response.ok) {
          const data = await response.json();
          setMachines(data.machines || data || []);
        }
      } catch (error) {
        console.error('Error fetching machines:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMachines();
  }, [currentCompany?.id]);

  // Get geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Geolocation not available:', error);
        }
      );
    }
  }, []);

  const filteredMachines = machines.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMachine) {
      toast.error('Selecciona una máquina');
      return;
    }

    if (!description.trim()) {
      toast.error('Describe el problema');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/mobile/quick-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany?.id,
          machineId: selectedMachine.id,
          reportedById: user?.id,
          description: description.trim(),
          symptoms: symptoms.trim() ? symptoms.split(',').map((s) => s.trim()) : [],
          priority,
          location: location ? `${location.lat},${location.lng}` : undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(true);
        toast.success(`Reporte creado - OT #${result.workOrderId}`);

        // Reset form after 2 seconds
        setTimeout(() => {
          router.push('/mobile/mi-dia');
        }, 2000);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al crear reporte');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <PermissionGuard permission="ingresar_mantenimiento">
        <div className="min-h-screen bg-muted flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle2 className="h-16 w-16 mx-auto text-success mb-4" />
              <h2 className="text-xl font-bold mb-2">Reporte Enviado</h2>
              <p className="text-muted-foreground mb-4">
                Se ha creado una orden de trabajo automáticamente
              </p>
              <Button onClick={() => router.push('/mobile/mi-dia')} className="w-full">
                Ver Mi Día
              </Button>
            </CardContent>
          </Card>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="ingresar_mantenimiento">
    <div className="min-h-screen bg-muted pb-8">
      {/* Header */}
      <div className="bg-destructive text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/mobile/mi-dia">
            <Button variant="ghost" size="icon" className="text-white hover:bg-background/20">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Reporte Rápido de Falla
            </h1>
            <p className="text-xs text-white/80">
              Reportar problema en máquina
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Machine Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">1. Selecciona la Máquina</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar máquina..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {filteredMachines.slice(0, 10).map((machine) => (
                  <div
                    key={machine.id}
                    onClick={() => setSelectedMachine(machine)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMachine?.id === machine.id
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <p className="font-medium">{machine.name}</p>
                    {machine.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {machine.location}
                      </p>
                    )}
                  </div>
                ))}
                {filteredMachines.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No se encontraron máquinas
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">2. Describe el Problema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="description">¿Qué está pasando?</Label>
              <Textarea
                id="description"
                placeholder="Describe brevemente el problema..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="symptoms">Síntomas (opcional)</Label>
              <Input
                id="symptoms"
                placeholder="Ruido, vibración, humo... (separar con comas)"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Priority */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">3. Prioridad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {priorities.map((p) => (
                <div
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    priority === p.value
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-3 h-3 rounded-full ${p.color}`} />
                    <span className="font-medium text-sm">{p.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Location Badge */}
        {location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-success" />
            <span>Ubicación capturada</span>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full bg-destructive hover:bg-destructive/90"
          disabled={submitting || !selectedMachine || !description.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" />
              Enviar Reporte
            </>
          )}
        </Button>
      </form>
    </div>
    </PermissionGuard>
  );
}
