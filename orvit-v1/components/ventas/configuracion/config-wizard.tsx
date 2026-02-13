'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft,
  Settings,
  FileText,
  Calculator,
  Bell,
  Users,
  Truck,
  CreditCard,
  Sparkles,
  PartyPopper,
  ArrowRight,
} from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: 'essential' | 'recommended' | 'optional';
  component: string; // Component name to render
  isComplete?: boolean;
}

interface ConfigWizardProps {
  currentConfig: Record<string, any>;
  onStepComplete: (stepId: string) => void;
  onWizardComplete: () => void;
  onNavigateToConfig: (configSection: string) => void;
}

// =====================================================
// WIZARD STEPS
// =====================================================

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'company-info',
    title: 'Información de la Empresa',
    description: 'Configura los datos básicos que aparecerán en documentos',
    icon: Settings,
    category: 'essential',
    component: 'general',
  },
  {
    id: 'documents',
    title: 'Formato de Documentos',
    description: 'Define cómo se numeran cotizaciones, facturas y remitos',
    icon: FileText,
    category: 'essential',
    component: 'number-format',
  },
  {
    id: 'taxes',
    title: 'Impuestos y Moneda',
    description: 'Configura IVA, retenciones y moneda predeterminada',
    icon: Calculator,
    category: 'essential',
    component: 'taxes',
  },
  {
    id: 'notifications',
    title: 'Plantillas de Notificación',
    description: 'Personaliza mensajes de WhatsApp y email',
    icon: Bell,
    category: 'recommended',
    component: 'notifications',
  },
  {
    id: 'discounts',
    title: 'Descuentos por Volumen',
    description: 'Configura descuentos automáticos por cantidad',
    icon: CreditCard,
    category: 'recommended',
    component: 'discounts',
  },
  {
    id: 'segments',
    title: 'Segmentos de Clientes',
    description: 'Define políticas de precios por tipo de cliente',
    icon: Users,
    category: 'optional',
    component: 'segments',
  },
  {
    id: 'delivery',
    title: 'Entregas y Logística',
    description: 'Configura zonas, vehículos y costos de envío',
    icon: Truck,
    category: 'optional',
    component: 'delivery',
  },
  {
    id: 'commissions',
    title: 'Comisiones de Vendedores',
    description: 'Define cómo se calculan las comisiones',
    icon: Calculator,
    category: 'optional',
    component: 'commissions',
  },
];

// =====================================================
// COMPONENT
// =====================================================

export function ConfigWizard({
  currentConfig,
  onStepComplete,
  onWizardComplete,
  onNavigateToConfig,
}: ConfigWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [wizardMode, setWizardMode] = useState<'overview' | 'step'>('overview');

  const essentialSteps = WIZARD_STEPS.filter((s) => s.category === 'essential');
  const recommendedSteps = WIZARD_STEPS.filter((s) => s.category === 'recommended');
  const optionalSteps = WIZARD_STEPS.filter((s) => s.category === 'optional');

  const totalEssential = essentialSteps.length;
  const completedEssential = essentialSteps.filter((s) => completedSteps.has(s.id)).length;
  const progress = (completedEssential / totalEssential) * 100;

  const allEssentialComplete = completedEssential === totalEssential;

  const handleMarkComplete = (stepId: string) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepId);
    setCompletedSteps(newCompleted);
    onStepComplete(stepId);
  };

  const handleGoToStep = (step: WizardStep) => {
    onNavigateToConfig(step.component);
  };

  const StepCard = ({ step, showAction = true }: { step: WizardStep; showAction?: boolean }) => {
    const isComplete = completedSteps.has(step.id);
    const Icon = step.icon;

    return (
      <div
        className={`p-4 border rounded-lg transition-colors ${
          isComplete
            ? 'bg-green-50 border-green-200'
            : 'bg-background hover:border-primary/50 cursor-pointer'
        }`}
        onClick={() => !isComplete && handleGoToStep(step)}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isComplete ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
            }`}
          >
            {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{step.title}</h4>
              {isComplete && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                  Completado
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
          </div>
          {showAction && !isComplete && (
            <Button variant="ghost" size="sm" onClick={() => handleGoToStep(step)}>
              Configurar
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // If all essential steps are complete, show celebration
  if (allEssentialComplete && wizardMode === 'overview') {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <PartyPopper className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">¡Configuración Básica Completa!</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Has completado todos los pasos esenciales. Tu módulo de ventas está listo para usar.
            Puedes continuar configurando opciones avanzadas cuando lo desees.
          </p>

          <div className="flex items-center justify-center gap-4 mb-8">
            <Button onClick={onWizardComplete}>
              Comenzar a Vender
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => setWizardMode('step')}>
              Ver Opciones Avanzadas
            </Button>
          </div>

          {(recommendedSteps.length > 0 || optionalSteps.length > 0) && (
            <div className="text-left max-w-2xl mx-auto">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Configuraciones Adicionales
              </h3>
              <div className="grid gap-3">
                {[...recommendedSteps, ...optionalSteps].map((step) => (
                  <StepCard key={step.id} step={step} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Asistente de Configuración
              </CardTitle>
              <CardDescription>
                Configura tu módulo de ventas paso a paso. Completa los pasos esenciales para
                comenzar.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{Math.round(progress)}%</div>
              <div className="text-sm text-muted-foreground">
                {completedEssential} de {totalEssential} esenciales
              </div>
            </div>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
      </Card>

      {/* Essential Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Pasos Esenciales
          </CardTitle>
          <CardDescription>
            Completa estos pasos para habilitar las funciones básicas de ventas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {essentialSteps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommended Steps */}
      {recommendedSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Recomendados
            </CardTitle>
            <CardDescription>
              Estas configuraciones mejoran la experiencia pero no son obligatorias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendedSteps.map((step) => (
                <StepCard key={step.id} step={step} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optional Steps */}
      {optionalSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Circle className="w-5 h-5 text-muted-foreground" />
              Opcionales
            </CardTitle>
            <CardDescription>
              Configuraciones avanzadas para casos de uso específicos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {optionalSteps.map((step) => (
                <StepCard key={step.id} step={step} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skip Button */}
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onWizardComplete}>
          Saltar Asistente
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// =====================================================
// QUICK SETUP CHECKLIST
// =====================================================

interface QuickSetupChecklistProps {
  config: Record<string, any>;
  onNavigate: (section: string) => void;
}

export function QuickSetupChecklist({ config, onNavigate }: QuickSetupChecklistProps) {
  const checks = [
    {
      id: 'company-name',
      label: 'Nombre de empresa configurado',
      check: () => !!config?.companyName,
      section: 'general',
    },
    {
      id: 'currency',
      label: 'Moneda seleccionada',
      check: () => !!config?.currency,
      section: 'currency',
    },
    {
      id: 'tax-rate',
      label: 'Tasa de IVA definida',
      check: () => config?.defaultTaxRate !== undefined,
      section: 'taxes',
    },
    {
      id: 'quote-prefix',
      label: 'Prefijo de cotizaciones',
      check: () => !!config?.quotePrefix,
      section: 'number-format',
    },
    {
      id: 'invoice-prefix',
      label: 'Prefijo de facturas',
      check: () => !!config?.invoicePrefix,
      section: 'number-format',
    },
  ];

  const completedCount = checks.filter((c) => c.check()).length;
  const progress = (completedCount / checks.length) * 100;

  if (progress === 100) {
    return null; // Hide when complete
  }

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuración Inicial
          </CardTitle>
          <Badge variant="secondary">
            {completedCount}/{checks.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={progress} className="mb-4 h-2" />
        <div className="space-y-2">
          {checks.map((check) => {
            const isComplete = check.check();
            return (
              <div
                key={check.id}
                className={`flex items-center justify-between p-2 rounded transition-colors ${
                  isComplete ? 'text-muted-foreground' : 'hover:bg-background cursor-pointer'
                }`}
                onClick={() => !isComplete && onNavigate(check.section)}
              >
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                  <span className={isComplete ? 'line-through' : ''}>{check.label}</span>
                </div>
                {!isComplete && (
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    Configurar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
