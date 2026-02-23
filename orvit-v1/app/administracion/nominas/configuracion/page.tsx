'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Save,
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  RefreshCcw,
  Settings,
  AlertTriangle,
  CalendarDays,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  usePayrollConfig,
  usePayrollHolidays,
  useSaveConfig,
  useCreateHoliday,
  useDeleteHoliday,
  useGeneratePeriods,
  usePayrollPeriods,
  PayrollConfig,
} from '@/hooks/use-payroll-dashboard';

export default function ConfiguracionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  const { data: configData, isLoading: configLoading, error: configError, refetch: refetchConfig } = usePayrollConfig();
  const { data: holidaysData, isLoading: holidaysLoading, refetch: refetchHolidays } = usePayrollHolidays(year);
  const { data: periodsData, refetch: refetchPeriods } = usePayrollPeriods(year);

  const saveConfigMutation = useSaveConfig();
  const createHolidayMutation = useCreateHoliday();
  const deleteHolidayMutation = useDeleteHoliday();
  const generatePeriodsMutation = useGeneratePeriods();

  const [localConfig, setLocalConfig] = useState<PayrollConfig>({
    paymentFrequency: 'BIWEEKLY',
    firstPaymentDay: 15,
    secondPaymentDay: 30,
    quincenaPercentage: 50,
    paymentDayRule: 'PREVIOUS_BUSINESS_DAY',
    maxAdvancePercent: 30,
    maxActiveAdvances: 1,
  });

  // Sync local config when data loads
  const config = configData?.config || localConfig;

  const handleSaveConfig = async () => {
    try {
      await saveConfigMutation.mutateAsync(localConfig);
      toast({ title: 'Configuracion guardada' });
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) {
      toast({ title: 'Complete fecha y nombre', variant: 'destructive' });
      return;
    }
    try {
      await createHolidayMutation.mutateAsync(newHoliday);
      toast({ title: 'Feriado agregado' });
      setNewHoliday({ date: '', name: '' });
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    try {
      await deleteHolidayMutation.mutateAsync(id);
      toast({ title: 'Feriado eliminado' });
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleGeneratePeriods = async () => {
    try {
      await generatePeriodsMutation.mutateAsync({ year, month });
      toast({ title: 'Periodos generados' });
      refetchPeriods();
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const holidays = holidaysData?.holidays || [];
  const periods = periodsData?.periods || [];

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Loading
  if (configLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6">
            <Skeleton className="h-96" />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (configError) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Configuracion de Nominas</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card>
            <CardContent className="py-10 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Error al cargar la configuracion</p>
              <Button onClick={() => refetchConfig()} variant="outline">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/administracion/nominas')}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Configuracion de Nominas</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Frecuencia de pago, feriados y periodos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4 md:gap-6">
        {/* Configuracion General */}
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configuracion General
              </CardTitle>
              <CardDescription className="text-xs">Frecuencia y dias de pago</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Frecuencia de Pago</Label>
                <Select
                  value={localConfig.paymentFrequency}
                  onValueChange={(v) => setLocalConfig({ ...localConfig, paymentFrequency: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">
                    {localConfig.paymentFrequency === 'BIWEEKLY' ? 'Dia 1ra Quincena' : 'Dia de Pago'}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    className="h-9"
                    value={localConfig.firstPaymentDay}
                    onChange={(e) => setLocalConfig({ ...localConfig, firstPaymentDay: parseInt(e.target.value) || 15 })}
                  />
                </div>
                {localConfig.paymentFrequency === 'BIWEEKLY' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Dia 2da Quincena</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      className="h-9"
                      value={localConfig.secondPaymentDay}
                      onChange={(e) => setLocalConfig({ ...localConfig, secondPaymentDay: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                )}
              </div>

              {localConfig.paymentFrequency === 'BIWEEKLY' && (
                <div className="space-y-2">
                  <Label className="text-xs">% del sueldo en 1ra Quincena</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-9"
                    value={localConfig.quincenaPercentage}
                    onChange={(e) => setLocalConfig({ ...localConfig, quincenaPercentage: parseInt(e.target.value) || 50 })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Regla de Dia de Pago</Label>
                <Select
                  value={localConfig.paymentDayRule}
                  onValueChange={(v) => setLocalConfig({ ...localConfig, paymentDayRule: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PREVIOUS_BUSINESS_DAY">Dia habil anterior</SelectItem>
                    <SelectItem value="NEXT_BUSINESS_DAY">Dia habil siguiente</SelectItem>
                    <SelectItem value="EXACT">Dia exacto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs font-medium mb-3">Limites de Adelantos</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Max % del sueldo</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="h-9"
                      value={localConfig.maxAdvancePercent}
                      onChange={(e) => setLocalConfig({ ...localConfig, maxAdvancePercent: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Max adelantos activos</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      className="h-9"
                      value={localConfig.maxActiveAdvances}
                      onChange={(e) => setLocalConfig({ ...localConfig, maxActiveAdvances: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSaveConfig}
                disabled={saveConfigMutation.isPending}
                className="w-full h-9"
              >
                {saveConfigMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar Configuracion
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Feriados */}
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Feriados
                  </CardTitle>
                  <CardDescription className="text-xs">Dias no laborables</CardDescription>
                </div>
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className="w-36 h-9"
                />
                <Input
                  placeholder="Nombre del feriado"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="flex-1 h-9"
                />
                <Button
                  onClick={handleAddHoliday}
                  size="icon"
                  className="h-9 w-9"
                  disabled={createHolidayMutation.isPending}
                >
                  {createHolidayMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {holidaysLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                ) : holidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay feriados configurados para {year}
                  </p>
                ) : (
                  holidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex justify-between items-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-20">
                          {new Date(h.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-sm">{h.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDeleteHoliday(h.id)}
                        disabled={deleteHolidayMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generar Periodos */}
        <div className="col-span-12">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Generar Periodos
              </CardTitle>
              <CardDescription className="text-xs">
                Genere los periodos de pago para un mes especifico
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Ano</Label>
                  <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger className="w-24 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Mes</Label>
                  <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames.map((name, idx) => (
                        <SelectItem key={idx} value={(idx + 1).toString()}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleGeneratePeriods}
                  disabled={generatePeriodsMutation.isPending}
                  className="h-9"
                >
                  {generatePeriodsMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Generar Periodos
                </Button>
              </div>

              {/* Lista de periodos */}
              {periods.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium mb-2">Periodos de {year}:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {periods.map((p) => (
                      <div
                        key={p.id}
                        className={cn(
                          'p-2 rounded-lg text-xs',
                          p.isClosed ? 'bg-muted/30 text-muted-foreground' : 'bg-primary/10'
                        )}
                      >
                        <div className="font-medium">
                          {p.periodType === 'QUINCENA_1' ? '1Q' : p.periodType === 'QUINCENA_2' ? '2Q' : 'M'} - {monthNames[p.month - 1]?.slice(0, 3)}
                        </div>
                        <div className="text-muted-foreground">
                          Pago: {new Date(p.paymentDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        {p.isClosed && <div className="text-xs">Cerrado</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
