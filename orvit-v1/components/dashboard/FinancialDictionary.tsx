'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, X, TrendingUp, Calendar, Target, BarChart3, DollarSign, ArrowUp } from 'lucide-react';

interface DictionaryTerm {
  term: string;
  acronym: string;
  definition: string;
  example: string;
  category: 'metric' | 'calculation' | 'forecast' | 'progress';
  icon: React.ComponentType<{ className?: string }>;
}

const financialTerms: DictionaryTerm[] = [
  {
    term: 'Month To Date',
    acronym: 'MTD',
    definition: 'Período desde el inicio del mes actual hasta la fecha actual. Representa el rendimiento acumulado del mes en curso.',
    example: 'Si estamos el día 15 de enero, MTD incluye todos los datos del 1 al 15 de enero.',
    category: 'metric',
    icon: Calendar
  },
  {
    term: 'Run Rate',
    acronym: 'RUN-RATE',
    definition: 'Promedio diario de rendimiento basado en el período transcurrido. Se calcula dividiendo el total MTD entre los días hábiles transcurridos.',
    example: 'Si en 10 días hábiles hemos generado $1.000.000, el run-rate es $100.000/día.',
    category: 'calculation',
    icon: TrendingUp
  },
  {
    term: 'Forecast End of Month',
    acronym: 'FORECAST EOM',
    definition: 'Proyección del valor total al final del mes basada en el run-rate actual y los días hábiles restantes.',
    example: 'Si el run-rate es $100.000/día y quedan 12 días hábiles, el forecast EOM es $1.200.000.',
    category: 'forecast',
    icon: Target
  },
  {
    term: 'Delta Día',
    acronym: 'Δ DÍA',
    definition: 'Cambio absoluto en el valor de un día respecto al día anterior. Puede ser positivo o negativo.',
    example: 'Si ayer vendimos $50.000 y hoy $60.000, el delta día es +$10.000.',
    category: 'calculation',
    icon: BarChart3
  },
  {
    term: 'Burn Rate',
    acronym: 'BURN RATE',
    definition: 'Velocidad a la que se consumen los costos por día. Indica el ritmo de gasto diario.',
    example: 'Si hemos gastado $800.000 en 10 días, el burn rate es $80.000/día.',
    category: 'calculation',
    icon: TrendingUp
  },
  {
    term: 'Working Days Gauge',
    acronym: 'GAUGE',
    definition: 'Porcentaje de días hábiles transcurridos del mes. Ayuda a evaluar el progreso temporal.',
    example: 'Si han pasado 15 de 22 días hábiles, el gauge es 68%.',
    category: 'progress',
    icon: Target
  },
  {
    term: 'Year Over Year',
    acronym: 'YoY',
    definition: 'Comparación del mismo período del año anterior. Mide el crecimiento interanual.',
    example: 'Si este enero vendimos $2.500.000 y el año pasado $2.350.000, el crecimiento YoY es +6.4%.',
    category: 'metric',
    icon: Calendar
  },
  {
    term: 'Month Over Month',
    acronym: 'MoM',
    definition: 'Comparación con el mes anterior. Mide el crecimiento mensual consecutivo.',
    example: 'Si este mes vendimos $2.500.000 y el mes pasado $2.400.000, el crecimiento MoM es +4.2%.',
    category: 'metric',
    icon: BarChart3
  },
  {
    term: 'Compound Annual Growth Rate',
    acronym: 'CAGR',
    definition: 'Tasa de crecimiento anual compuesta. Mide el crecimiento promedio anual durante un período.',
    example: 'Si una inversión crece de $100 a $200 en 5 años, el CAGR es 14.87%.',
    category: 'calculation',
    icon: TrendingUp
  },
  {
    term: 'Volatility',
    acronym: 'VOL',
    definition: 'Medida de la variabilidad de los valores diarios. Indica qué tan estables son los resultados.',
    example: 'Una volatilidad del 15% significa que los valores diarios varían en promedio ±15% del promedio.',
    category: 'calculation',
    icon: BarChart3
  }
];

const categoryColors = {
  metric: 'bg-blue-50 text-blue-700 border-blue-200',
  calculation: 'bg-green-50 text-green-700 border-green-200',
  forecast: 'bg-purple-50 text-purple-700 border-purple-200',
  progress: 'bg-orange-50 text-orange-700 border-orange-200'
};

const categoryLabels = {
  metric: 'Métrica',
  calculation: 'Cálculo',
  forecast: 'Pronóstico',
  progress: 'Progreso'
};

export function FinancialDictionary() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const filteredTerms = selectedCategory === 'all' 
    ? financialTerms 
    : financialTerms.filter(term => term.category === selectedCategory);

  const categories = [
    { value: 'all', label: 'Todos', count: financialTerms.length },
    { value: 'metric', label: 'Métricas', count: financialTerms.filter(t => t.category === 'metric').length },
    { value: 'calculation', label: 'Cálculos', count: financialTerms.filter(t => t.category === 'calculation').length },
    { value: 'forecast', label: 'Pronósticos', count: financialTerms.filter(t => t.category === 'forecast').length },
    { value: 'progress', label: 'Progreso', count: financialTerms.filter(t => t.category === 'progress').length }
  ];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    setShowScrollTop(scrollTop > 100);
  };

  const scrollToTop = () => {
    const scrollContainer = document.querySelector('.dictionary-scroll-container');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Diccionario
        </Button>
      </DialogTrigger>
      <DialogContent size="lg" className="max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Diccionario de Términos Financieros
            </div>
            <Badge variant="secondary" className="text-sm">
              {filteredTerms.length} términos
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full min-h-0">
          {/* Filtros de categoría */}
          <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-gray-200 flex-shrink-0">
            {categories.map((category) => (
              <Button
                key={category.value}
                variant={selectedCategory === category.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.value)}
                className={selectedCategory === category.value 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              >
                {category.label} ({category.count})
              </Button>
            ))}
          </div>

          {/* Lista de términos */}
          <div 
            className="dictionary-scroll-container flex-1 overflow-y-auto space-y-4 pr-2 relative"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#D1D5DB #F3F4F6'
            }}
            onScroll={handleScroll}
          >
            {/* Indicador de scroll */}
            <div className="absolute top-0 right-0 w-1 h-full bg-gray-100 rounded-full">
              <div className="w-full bg-blue-200 rounded-full transition-all duration-200" 
                   style={{ height: '20%' }}></div>
            </div>
            {filteredTerms.map((term, index) => {
              const Icon = term.icon;
              return (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg border border-gray-200">
                        <Icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {term.term}
                        </h3>
                        <p className="text-sm font-mono text-gray-600">
                          {term.acronym}
                        </p>
                      </div>
                    </div>
                    <Badge className={categoryColors[term.category]}>
                      {categoryLabels[term.category]}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Definición:</h4>
                      <p className="text-sm text-gray-600">{term.definition}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Ejemplo:</h4>
                      <p className="text-sm text-gray-600 italic bg-white p-2 rounded border-l-4 border-blue-200">
                        {term.example}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Botón de volver arriba */}
            {showScrollTop && (
              <div className="sticky bottom-4 flex justify-end">
                <Button
                  onClick={scrollToTop}
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
                >
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Volver arriba
                </Button>
              </div>
            )}
          </div>

          {/* Footer con información adicional */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex-shrink-0">
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                💡 Consejo de Uso
              </h4>
              <p className="text-sm text-blue-700">
                Estos términos te ayudan a interpretar correctamente las métricas del dashboard. 
                Usa el run-rate para proyectar el cierre del mes y el burn rate para controlar los costos diarios.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
