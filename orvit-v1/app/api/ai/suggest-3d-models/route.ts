import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ComponentInfo {
  name: string;
  type?: string;
  brand?: string;
  model?: string;
  code?: string;
  description?: string;
  system?: string;
}

interface Model3DSuggestion {
  source: string;
  sourceName: string;
  sourceIcon: string;
  url: string;
  searchQuery: string;
  confidence: 'high' | 'medium' | 'low';
  description: string;
  isPaid: boolean;
}

// Fuentes conocidas de modelos 3D industriales
const MODEL_SOURCES = {
  traceparts: {
    name: 'TraceParts',
    icon: '🔧',
    baseUrl: 'https://www.traceparts.com/en/search/traceparts?q=',
    isPaid: false,
    description: 'Catálogo CAD gratuito con millones de modelos'
  },
  grabcad: {
    name: 'GrabCAD',
    icon: '📐',
    baseUrl: 'https://grabcad.com/library?query=',
    isPaid: false,
    description: 'Comunidad de ingenieros con modelos gratuitos'
  },
  '3dcontentcentral': {
    name: '3D ContentCentral',
    icon: '🏭',
    baseUrl: 'https://www.3dcontentcentral.com/Search.aspx?arg=',
    isPaid: false,
    description: 'Modelos CAD de SolidWorks'
  },
  skf: {
    name: 'SKF',
    icon: '⚙️',
    baseUrl: 'https://www.skf.com/group/products/rolling-bearings?q=',
    isPaid: false,
    description: 'Rodamientos y componentes SKF oficiales'
  },
  festo: {
    name: 'FESTO',
    icon: '💨',
    baseUrl: 'https://www.festo.com/cat/en-gb_gb/search?query=',
    isPaid: false,
    description: 'Componentes neumáticos FESTO'
  },
  smc: {
    name: 'SMC',
    icon: '🔵',
    baseUrl: 'https://www.smcworld.com/webcatalog/en-jp/searchProduct.do?mode=product&keywords=',
    isPaid: false,
    description: 'Componentes neumáticos SMC'
  },
  misumi: {
    name: 'MISUMI',
    icon: '🔩',
    baseUrl: 'https://us.misumi-ec.com/vona2/result/?Keyword=',
    isPaid: false,
    description: 'Componentes mecánicos estándar'
  },
  mcmaster: {
    name: 'McMaster-Carr',
    icon: '📦',
    baseUrl: 'https://www.mcmaster.com/search/',
    isPaid: false,
    description: 'Ferretería industrial con CAD'
  }
};

// Patrones para detectar tipos de componentes
const COMPONENT_PATTERNS = {
  bearing: {
    keywords: ['rodamiento', 'bearing', 'cojinete', 'balero', 'skf', 'fag', 'nsk', 'ntn', 'timken'],
    sources: ['skf', 'traceparts', 'grabcad'],
    extractPattern: /(\d+[a-z]*[-/]?\d*[a-z]*)/i
  },
  gear: {
    keywords: ['engranaje', 'gear', 'piñón', 'pinion', 'corona', 'cremallera', 'rack'],
    sources: ['traceparts', 'grabcad', 'misumi'],
    extractPattern: /m[=:]?(\d+\.?\d*)|z[=:]?(\d+)|módulo[=:]?(\d+\.?\d*)/i
  },
  motor: {
    keywords: ['motor', 'servomotor', 'stepper', 'motorreductor', 'reductor'],
    sources: ['traceparts', 'grabcad', '3dcontentcentral'],
    extractPattern: /(\d+\s*kw|\d+\s*hp|\d+\s*rpm)/i
  },
  cylinder: {
    keywords: ['cilindro', 'cylinder', 'pistón', 'piston', 'actuador', 'actuator'],
    sources: ['festo', 'smc', 'traceparts'],
    extractPattern: /(\d+x\d+|\d+mm)/i
  },
  valve: {
    keywords: ['válvula', 'valve', 'electroválvula', 'solenoid'],
    sources: ['festo', 'smc', 'traceparts'],
    extractPattern: /(\d+\/\d+|\d+mm)/i
  },
  screw: {
    keywords: ['tornillo', 'screw', 'bolt', 'perno', 'din', 'iso'],
    sources: ['misumi', 'mcmaster', 'traceparts'],
    extractPattern: /(m\d+x\d+|din\s*\d+|iso\s*\d+)/i
  },
  linear: {
    keywords: ['guía', 'guide', 'carril', 'rail', 'lineal', 'linear', 'husillo', 'ballscrew'],
    sources: ['misumi', 'traceparts', 'grabcad'],
    extractPattern: /(\d+mm|\d+x\d+)/i
  },
  pump: {
    keywords: ['bomba', 'pump', 'hidráulica', 'hydraulic'],
    sources: ['traceparts', 'grabcad', '3dcontentcentral'],
    extractPattern: /(\d+\s*l\/min|\d+\s*bar|\d+\s*gpm)/i
  }
};

function detectComponentType(name: string, description?: string): { type: string; confidence: 'high' | 'medium' | 'low' } {
  const searchText = `${name} ${description || ''}`.toLowerCase();

  for (const [type, config] of Object.entries(COMPONENT_PATTERNS)) {
    const matchCount = config.keywords.filter(kw => searchText.includes(kw)).length;
    if (matchCount >= 2) {
      return { type, confidence: 'high' };
    } else if (matchCount === 1) {
      return { type, confidence: 'medium' };
    }
  }

  return { type: 'generic', confidence: 'low' };
}

function generateSearchQueries(component: ComponentInfo): string[] {
  const queries: string[] = [];
  const name = component.name.toLowerCase();

  // Query principal con nombre completo
  queries.push(component.name);

  // Si hay marca y modelo
  if (component.brand) {
    queries.push(`${component.brand} ${component.model || ''} ${component.name}`.trim());
  }

  // Si hay código
  if (component.code) {
    queries.push(component.code);
  }

  // Extraer números de parte del nombre
  const partNumbers = name.match(/[a-z]*\d+[a-z]*[-/]?\d*[a-z]*/gi);
  if (partNumbers) {
    partNumbers.forEach(pn => {
      if (pn.length > 3) queries.push(pn);
    });
  }

  // Limpiar y deduplicar
  return [...new Set(queries.map(q => q.trim()).filter(q => q.length > 2))];
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const component: ComponentInfo = body.component;

    if (!component?.name) {
      return NextResponse.json({ error: 'Component name is required' }, { status: 400 });
    }

    // Detectar tipo de componente
    const { type: detectedType, confidence: typeConfidence } = detectComponentType(
      component.name,
      component.description
    );

    // Generar queries de búsqueda
    const searchQueries = generateSearchQueries(component);

    // Determinar fuentes relevantes
    const patternConfig = COMPONENT_PATTERNS[detectedType as keyof typeof COMPONENT_PATTERNS];
    const relevantSources = patternConfig?.sources || ['traceparts', 'grabcad', '3dcontentcentral'];

    // Usar IA para analizar el componente y mejorar las sugerencias
    let aiAnalysis = null;
    if (process.env.OPENAI_API_KEY) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Eres un experto en componentes industriales y mecánicos. Analiza el nombre del componente y extrae información útil para buscar su modelo 3D CAD.

Responde SOLO en JSON con este formato:
{
  "componentType": "tipo de componente en inglés (bearing, gear, motor, cylinder, valve, screw, pump, etc.)",
  "standardPart": true/false si es una pieza estándar,
  "possibleManufacturers": ["lista de fabricantes probables"],
  "searchTerms": ["términos de búsqueda optimizados en inglés"],
  "specifications": {"key": "value de especificaciones extraídas"},
  "suggestedSources": ["traceparts", "grabcad", "skf", etc.],
  "confidence": "high/medium/low"
}`
            },
            {
              role: 'user',
              content: `Componente: "${component.name}"
Tipo: ${component.type || 'No especificado'}
Marca: ${component.brand || 'No especificada'}
Modelo: ${component.model || 'No especificado'}
Código: ${component.code || 'No especificado'}
Sistema: ${component.system || 'No especificado'}
Descripción: ${component.description || 'No especificada'}`
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          // Extraer JSON de la respuesta
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiAnalysis = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
        // Continuar sin análisis de IA
      }
    }

    // Combinar queries de IA con las generadas
    const allQueries = [...searchQueries];
    if (aiAnalysis?.searchTerms) {
      allQueries.push(...aiAnalysis.searchTerms);
    }
    const uniqueQueries = [...new Set(allQueries)].slice(0, 5);

    // Determinar fuentes finales
    let finalSources = relevantSources;
    if (aiAnalysis?.suggestedSources) {
      finalSources = [...new Set([...aiAnalysis.suggestedSources, ...relevantSources])].slice(0, 5);
    }

    // Generar sugerencias
    const suggestions: Model3DSuggestion[] = [];

    for (const sourceKey of finalSources) {
      const source = MODEL_SOURCES[sourceKey as keyof typeof MODEL_SOURCES];
      if (!source) continue;

      const mainQuery = uniqueQueries[0] || component.name;
      const encodedQuery = encodeURIComponent(mainQuery);

      suggestions.push({
        source: sourceKey,
        sourceName: source.name,
        sourceIcon: source.icon,
        url: `${source.baseUrl}${encodedQuery}`,
        searchQuery: mainQuery,
        confidence: aiAnalysis?.confidence || typeConfidence,
        description: source.description,
        isPaid: source.isPaid
      });
    }

    // Agregar búsquedas alternativas si hay múltiples queries
    if (uniqueQueries.length > 1) {
      const altQuery = uniqueQueries[1];
      suggestions.push({
        source: 'traceparts',
        sourceName: 'TraceParts (alternativo)',
        sourceIcon: '🔍',
        url: `${MODEL_SOURCES.traceparts.baseUrl}${encodeURIComponent(altQuery)}`,
        searchQuery: altQuery,
        confidence: 'medium',
        description: `Búsqueda alternativa: "${altQuery}"`,
        isPaid: false
      });
    }

    return NextResponse.json({
      success: true,
      component: {
        name: component.name,
        detectedType,
        typeConfidence
      },
      aiAnalysis,
      searchQueries: uniqueQueries,
      suggestions,
      tips: [
        'Los modelos GLB/GLTF funcionan mejor para visualización web',
        'Puedes convertir STEP/IGES a GLB usando herramientas online como CAD Exchanger',
        'Muchos fabricantes ofrecen modelos 3D gratuitos en sus catálogos oficiales'
      ]
    });

  } catch (error) {
    console.error('[AI_SUGGEST_3D_ERROR]', error);
    return NextResponse.json(
      { error: 'Error al generar sugerencias', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
