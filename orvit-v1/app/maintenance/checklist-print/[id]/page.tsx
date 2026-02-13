'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ChecklistPrintPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [executionData, setExecutionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceMap, setMaintenanceMap] = useState<Record<number, { title: string; description: string }>>({});
  const [checklistTitle, setChecklistTitle] = useState<string | null>(null);

  // Efecto para extraer el título del checklist cuando executionData cambie
  useEffect(() => {
    if (executionData?.checklist && !checklistTitle) {
      const extractTitle = (checklist: any): string | null => {
        if (!checklist) return null;
        
        if (typeof checklist === 'string') {
          try {
            const parsed = JSON.parse(checklist);
            return parsed.title || parsed.name || null;
          } catch {
            return checklist.trim() || null;
          }
        }
        
        if (typeof checklist === 'object' && checklist !== null) {
          if (checklist.title && typeof checklist.title === 'string') {
            const trimmed = checklist.title.trim();
            if (trimmed) return trimmed;
          }
          if (checklist.name && typeof checklist.name === 'string') {
            const trimmed = checklist.name.trim();
            if (trimmed) return trimmed;
          }
        }
        
        return null;
      };
      
      const title = extractTitle(executionData.checklist);
      if (title) {
        console.log('✅ [USE EFFECT] Título extraído del checklist:', title);
        setChecklistTitle(title);
      }
    }
  }, [executionData, checklistTitle]);

  useEffect(() => {
    if (executionId) {
      fetchExecutionData();
    }
    
    // Ocultar elementos globales al cargar esta página
    const hideGlobalElements = () => {
      // Ocultar MobileBottomBar
      const bottomBars = document.querySelectorAll('[class*="MobileBottomBar"], [class*="bottom-bar"], [class*="fixed"][class*="bottom-0"]');
      bottomBars.forEach((el: any) => {
        if (el) el.style.display = 'none';
      });
      
      // Ocultar headers con ORVIT
      const headers = document.querySelectorAll('header, [class*="header"]');
      headers.forEach((el: any) => {
        const text = el.textContent || '';
        if (text.includes('ORVIT') && !el.classList.contains('print-header')) {
          el.style.display = 'none';
        }
      });
    };
    
    hideGlobalElements();
    
    // También ocultar antes de imprimir
    const handleBeforePrint = () => {
      hideGlobalElements();
    };
    
    window.addEventListener('beforeprint', handleBeforePrint);
    
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [executionId]);

  // Auto-print cuando los datos estén cargados y la página esté lista
  // Simplificado: imprimir después de un delay fijo una vez que los datos estén cargados
  useEffect(() => {
    if (!loading && executionData && !error) {
      console.log('🖨️ [AUTO PRINT] Datos cargados, preparando impresión automática:', {
        hasExecutionData: !!executionData,
        checklistTitle,
        'checklist?.title': executionData?.checklist?.title,
        checklistId: executionData?.checklistId
      });
      
      // Esperar un tiempo razonable para que el DOM se renderice completamente
      // Luego intentar imprimir
      const printTimer = setTimeout(() => {
        try {
          console.log('🖨️ [AUTO PRINT] Iniciando impresión automática...');
          window.print();
        } catch (err) {
          console.error('❌ Error al iniciar la impresión automática:', err);
        }
      }, 2000); // 2 segundos de delay para asegurar que todo esté renderizado
      
      return () => clearTimeout(printTimer);
    }
  }, [loading, executionData, error, checklistTitle]);

  // Obtener el título final (prioridad: checklistTitle > checklist?.title > fallback)
  // Usar useMemo para recalcular cuando cambien las dependencias
  // IMPORTANTE: Este hook debe estar ANTES de los early returns para mantener el orden de hooks consistente
  const finalTitle = useMemo(() => {
    const execution = executionData;
    const checklist = executionData?.checklist || null;
    const title = checklistTitle || checklist?.title || (execution?.checklistId ? `Checklist ID ${execution.checklistId}` : 'Checklist de Mantenimiento');
    
    // Debug: ver qué valores tenemos para el título
    if (typeof window !== 'undefined' && executionData) {
      console.log('🔍 [CHECKLIST PRINT] Valores para el título:', {
        checklistTitle,
        'checklist?.title': checklist?.title,
        'checklist completo': checklist,
        'execution.checklistId': execution?.checklistId,
        'finalTitle calculado': title
      });
    }
    
    return title;
  }, [checklistTitle, executionData?.checklist?.title, executionData?.checklistId, executionData]);

  const fetchExecutionData = async () => {
    try {
      const response = await fetch(`/api/maintenance/checklist-execution?executionId=${executionId}`);
      const data = await response.json();

      if (response.ok && data.success) {
        const exec = data.execution;
        
        // Debug: ver qué estructura tiene el checklist
        console.log('🔍 [DEBUG] Checklist recibido en ejecución:', {
          hasChecklist: !!exec.checklist,
          checklistType: typeof exec.checklist,
          checklistKeys: exec.checklist ? Object.keys(exec.checklist) : null,
          checklistPreview: exec.checklist ? JSON.stringify(exec.checklist).substring(0, 200) : null,
          checklistId: exec.checklistId
        });

        // Función helper para extraer el título del checklist desde diferentes estructuras
        const extractChecklistTitle = (checklist: any): string | null => {
          if (!checklist) {
            console.log('⚠️ [EXTRACT TITLE] Checklist es null o undefined');
            return null;
          }
          
          console.log('🔍 [EXTRACT TITLE] Procesando checklist:', {
            type: typeof checklist,
            isString: typeof checklist === 'string',
            isObject: typeof checklist === 'object',
            keys: typeof checklist === 'object' ? Object.keys(checklist) : null
          });
          
          // Si es un string, intentar parsearlo como JSON
          if (typeof checklist === 'string') {
            try {
              const parsed = JSON.parse(checklist);
              console.log('✅ [EXTRACT TITLE] Parseado desde string:', parsed.title || parsed.name);
              return parsed.title || parsed.name || null;
            } catch {
              // Si no es JSON válido, podría ser el título directamente
              const trimmed = checklist.trim();
              if (trimmed) {
                console.log('✅ [EXTRACT TITLE] Usando string directamente:', trimmed);
                return trimmed;
              }
            }
          }
          
          // Si es un objeto, buscar el título en diferentes campos
          if (typeof checklist === 'object' && checklist !== null) {
            // Intentar diferentes campos posibles
            if (checklist.title && typeof checklist.title === 'string') {
              const trimmed = checklist.title.trim();
              if (trimmed) {
                console.log('✅ [EXTRACT TITLE] Encontrado en checklist.title:', trimmed);
                return trimmed;
              }
            }
            if (checklist.name && typeof checklist.name === 'string') {
              const trimmed = checklist.name.trim();
              if (trimmed) {
                console.log('✅ [EXTRACT TITLE] Encontrado en checklist.name:', trimmed);
                return trimmed;
              }
            }
            // Algunos checklists podrían tener el título en otros campos
            if (checklist.checklistTitle && typeof checklist.checklistTitle === 'string') {
              const trimmed = checklist.checklistTitle.trim();
              if (trimmed) {
                console.log('✅ [EXTRACT TITLE] Encontrado en checklist.checklistTitle:', trimmed);
                return trimmed;
              }
            }
            if (checklist.checklistName && typeof checklist.checklistName === 'string') {
              const trimmed = checklist.checklistName.trim();
              if (trimmed) {
                console.log('✅ [EXTRACT TITLE] Encontrado en checklist.checklistName:', trimmed);
                return trimmed;
              }
            }
            
            console.log('⚠️ [EXTRACT TITLE] No se encontró título en ningún campo conocido');
          }
          
          return null;
        };

        // Intentar obtener el título desde el checklist que viene en la ejecución
        let foundTitle = extractChecklistTitle(exec.checklist);
        let finalChecklist = exec.checklist;

        if (foundTitle) {
          setChecklistTitle(foundTitle);
          console.log('✅ Título del checklist encontrado en ejecución:', foundTitle);
        } else {
          console.warn('⚠️ No se encontró título en el checklist de la ejecución, intentando alternativas...');
          
          // Si el checklist viene null, intentar obtenerlo desde múltiples fuentes
          if (!exec.checklist && exec.checklistId) {
            console.log('🔍 Checklist es null, intentando obtener desde API de checklists directamente...');
            
            // Intentar primero desde la API de checklists
            try {
              const checklistResponse = await fetch(`/api/maintenance/checklists?checklistId=${exec.checklistId}`, {
                credentials: 'include'
              });
              
              if (checklistResponse.ok) {
                const checklistResult = await checklistResponse.json();
                console.log('📋 Respuesta de API checklists:', checklistResult);
                
                if (checklistResult.success && checklistResult.checklists && checklistResult.checklists.length > 0) {
                  const checklistFromAPI = checklistResult.checklists[0];
                  console.log('✅ Checklist obtenido desde API de checklists:', checklistFromAPI);
                  
                  finalChecklist = checklistFromAPI;
                  exec.checklist = checklistFromAPI;
                  
                  foundTitle = extractChecklistTitle(checklistFromAPI);
                  if (foundTitle) {
                    setChecklistTitle(foundTitle);
                    console.log('✅ Título obtenido desde API de checklists:', foundTitle);
                    // Actualizar executionData inmediatamente con el checklist
                    setExecutionData(prev => ({
                      ...prev,
                      checklist: checklistFromAPI
                    }));
                  }
                }
              }
            } catch (apiErr) {
              console.error('❌ Error obteniendo checklist desde API de checklists:', apiErr);
            }
            
            // Si aún no tenemos el título, intentar desde la API de documentos
            if (!foundTitle && exec.checklistId) {
              try {
                const docResponse = await fetch(`/api/documents/${exec.checklistId}`, {
                  credentials: 'include'
                });
                
                if (docResponse.ok) {
                  const docData = await docResponse.json();
                  console.log('📄 Respuesta de API documentos:', docData);
                  
                  // El documento puede venir en diferentes formatos
                  let docContent = docData;
                  if (docData.document) {
                    docContent = docData.document;
                  }
                  
                  // Intentar parsear el contenido del documento
                  if (docContent.url) {
                    try {
                      const parsedChecklist = typeof docContent.url === 'string' 
                        ? JSON.parse(docContent.url) 
                        : docContent.url;
                      
                      finalChecklist = parsedChecklist;
                      exec.checklist = parsedChecklist;
                      
                      foundTitle = extractChecklistTitle(parsedChecklist);
                      if (foundTitle) {
                        setChecklistTitle(foundTitle);
                        console.log('✅ Título obtenido desde API de documentos:', foundTitle);
                        // Actualizar executionData inmediatamente con el checklist
                        setExecutionData(prev => ({
                          ...prev,
                          checklist: parsedChecklist
                        }));
                      }
                    } catch (parseErr) {
                      console.error('❌ Error parseando checklist desde documento:', parseErr);
                    }
                  }
                }
              } catch (docErr) {
                console.error('❌ Error obteniendo checklist desde API de documentos:', docErr);
              }
            }
          }
          
          if (!foundTitle) {
            console.warn('⚠️ No se pudo obtener el título del checklist, usando fallback');
          }
        }

        // Establecer los datos de ejecución con el checklist actualizado (si se obtuvo)
        setExecutionData({
          ...exec,
          checklist: finalChecklist
        });

        // Intentar cargar información de mantenimientos (nombre/descripcion) usando companyId
        try {
          if (exec?.companyId) {
            const maintResponse = await fetch(`/api/maintenance/all?companyId=${exec.companyId}`);
            if (maintResponse.ok) {
              const maintData = await maintResponse.json();
              const maints = maintData.maintenances || [];

              const map: Record<number, { title: string; description: string }> = {};
              maints.forEach((m: any) => {
                if (!m?.id) return;
                map[m.id] = {
                  title: m.title || `Mantenimiento ID ${m.id}`,
                  description: m.description || '',
                };
              });

              setMaintenanceMap(map);
            }
          }
        } catch (maintErr) {
          console.error('Error cargando datos de mantenimientos para impresión:', maintErr);
        }
      } else {
        setError(data.error || 'Error al cargar los datos');
      }
    } catch (err) {
      setError('Error al cargar los datos de la ejecución');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !executionData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-red-600 mb-4">{error || 'No se encontraron datos'}</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  const execution = executionData;
  const checklist = executionData?.checklist || null;
  const details = execution?.executionDetails || {};
  const signatures = details.signatures || {};
  const responsibles = details.responsibles || {};

  // Soporte para ejecuciones antiguas:
  // - Formato nuevo: details.maintenanceItems (usado por el flujo actual)
  // - Formato viejo: details.completed / details.incomplete (usado en el historial)
  let maintenanceItems: any[] = Array.isArray(details.maintenanceItems)
    ? details.maintenanceItems
    : [];

  // Debug: ver exactamente qué datos llegan para esta ejecución
  if (typeof window !== 'undefined') {
    // Este log solo se ejecuta en el cliente
    // y nos ayuda a ver en la consola del navegador la estructura real
    console.log('📄 [CHECKLIST PRINT] executionData recibido:', {
      execution,
      checklist,
      details,
    });
  }

  if (
    maintenanceItems.length === 0 &&
    (Array.isArray((details as any).completed) ||
      Array.isArray((details as any).incomplete))
  ) {
    const legacyCompleted = Array.isArray((details as any).completed)
      ? (details as any).completed
      : [];
    const legacyIncomplete = Array.isArray((details as any).incomplete)
      ? (details as any).incomplete
      : [];

    maintenanceItems = [
      // Items completados
      ...legacyCompleted.map((item: any) => ({
        maintenanceId: item.maintenanceId ?? item.id,
        completedDate: item.completedAt
          ? format(new Date(item.completedAt), 'dd/MM/yyyy HH:mm', { locale: es })
          : '',
        rescheduleDate: '',
        notes: item.justification || '',
        issues: '',
        currentKilometers: null,
        currentHours: null,
        executors: [],
        supervisors: [],
      })),
      // Items no completados
      ...legacyIncomplete.map((item: any) => ({
        maintenanceId: item.maintenanceId ?? item.id,
        completedDate: '',
        rescheduleDate: '',
        notes: item.justification || '',
        issues: '',
        currentKilometers: null,
        currentHours: null,
        executors: [],
        supervisors: [],
      })),
    ];
  }

  const hasAnyDetails =
    details && typeof details === 'object' && Object.keys(details).length > 0;

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 print:p-0 print:bg-white print:shadow-none">
      {/* Botones de acción - ocultos en impresión */}
      <div className="mb-6 flex gap-4 print:hidden">
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Contenido imprimible */}
      <div className="max-w-4xl mx-auto bg-white print:max-w-full print:mx-0 print:bg-white print:shadow-none">
        {/* Encabezado */}
        <div className="border-b-2 border-gray-800 pb-4 mb-8 print-header">
          <h1 className="text-3xl font-bold mb-6 text-center mt-4" key={`title-${finalTitle}`}>
            {finalTitle}
          </h1>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>ID del Checklist:</strong> {execution.checklistId}
            </div>
            <div>
              <strong>ID de Ejecución:</strong> {execution.id}
            </div>
            <div>
              <strong>Fecha de Ejecución:</strong>{' '}
              {format(new Date(execution.executedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
            </div>
            <div>
              <strong>Ejecutado por:</strong> {execution.executedBy}
            </div>
            <div>
              <strong>Estado:</strong> {execution.status === 'COMPLETED' ? 'Completado' : execution.status}
            </div>
            <div>
              <strong>Items completados:</strong> {execution.completedItems} / {execution.totalItems}
            </div>
          </div>
        </div>

        {/* Responsables */}
        {responsibles && (responsibles.ejecutores?.length > 0 || responsibles.supervisores?.length > 0) && (
          <div className="mb-6 border-b pb-4">
            <h2 className="text-xl font-semibold mb-3">Responsables</h2>
            <div className="grid grid-cols-2 gap-4">
              {responsibles.ejecutores?.length > 0 && (
                <div>
                  <strong>Ejecutores:</strong>
                  <ul className="list-disc list-inside ml-2">
                    {responsibles.ejecutores.map((e: string, idx: number) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {responsibles.supervisores?.length > 0 && (
                <div>
                  <strong>Supervisores:</strong>
                  <ul className="list-disc list-inside ml-2">
                    {responsibles.supervisores.map((s: string, idx: number) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {responsibles.fechaEjecucion && (
              <div className="mt-2">
                <strong>Fecha de Ejecución:</strong> {responsibles.fechaEjecucion}
              </div>
            )}
            {responsibles.horaFinalizacion && (
              <div>
                <strong>Hora de Finalización:</strong> {responsibles.horaFinalizacion}
              </div>
            )}
          </div>
        )}

        {/* Mantenimientos */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Mantenimientos Ejecutados</h2>

          {/* Caso ideal: tenemos una lista clara de items */}
          {maintenanceItems.length > 0 && (
          <div className="space-y-4">
            {maintenanceItems.map((item: any, index: number) => {
              // Función para obtener el título y descripción del mantenimiento desde el checklist
              const getMaintenanceInfo = (maintenanceId: number): { title: string; description: string } => {
                // 1) Intentar obtener desde el checklist (si vino)
                if (checklist?.phases) {
                  for (const phase of checklist.phases) {
                    if (phase.items) {
                      const checklistItem = phase.items.find((i: any) => i.maintenanceId === maintenanceId);
                      if (checklistItem) {
                        return {
                          title: checklistItem.title || `Mantenimiento ID ${maintenanceId}`,
                          description: checklistItem.description || ''
                        };
                      }
                    }
                  }
                }
                
                if (checklist?.items) {
                  const checklistItem = checklist.items.find((i: any) => i.maintenanceId === maintenanceId);
                  if (checklistItem) {
                    return {
                      title: checklistItem.title || `Mantenimiento ID ${maintenanceId}`,
                      description: checklistItem.description || ''
                    };
                  }
                }
                
                // 2) Intentar obtener desde el mapa de mantenimientos cargado por companyId
                const maintenanceFromMap = maintenanceMap[maintenanceId];
                if (maintenanceFromMap) {
                  return maintenanceFromMap;
                }
                
                // 3) Fallback: solo ID
                return {
                  title: `Mantenimiento ID ${maintenanceId}`,
                  description: ''
                };
              };

              const maintenanceInfo = getMaintenanceInfo(item.maintenanceId);

              return (
                <div key={index} className="border rounded-lg p-4 break-inside-avoid">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">
                        {index + 1}. {maintenanceInfo.title}
                      </h3>
                      {maintenanceInfo.description && (
                        <p className="text-gray-600 text-sm mb-2">{maintenanceInfo.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      {item.completedDate && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm whitespace-nowrap">
                          Completado: {item.completedDate}
                        </span>
                      )}
                      {item.rescheduleDate && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm whitespace-nowrap">
                          Reprogramado: {item.rescheduleDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {item.notes && (
                    <div className="mb-2">
                      <strong>Notas:</strong>
                      <p className="ml-2">{item.notes}</p>
                    </div>
                  )}

                  {item.issues && (
                    <div className="mb-2">
                      <strong>Inconvenientes:</strong>
                      <p className="ml-2">{item.issues}</p>
                    </div>
                  )}

                  {(item.currentKilometers && item.currentKilometers > 0) || (item.currentHours && item.currentHours > 0) ? (
                    <div className="mb-2 text-sm text-gray-600">
                      {item.currentKilometers && item.currentKilometers > 0 && <span>Kilómetros: {item.currentKilometers} km</span>}
                      {item.currentKilometers && item.currentKilometers > 0 && item.currentHours && item.currentHours > 0 && ' | '}
                      {item.currentHours && item.currentHours > 0 && <span>Horas: {item.currentHours} h</span>}
                    </div>
                  ) : null}

                  {(item.executors?.length > 0 || item.supervisors?.length > 0) && (
                    <div className="mt-2 text-sm">
                      {item.executors?.length > 0 && (
                        <div>
                          <strong>Ejecutores:</strong> {item.executors.join(', ')}
                        </div>
                      )}
                      {item.supervisors?.length > 0 && (
                        <div>
                          <strong>Supervisores:</strong> {item.supervisors.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}

          {/* Fallback: no pudimos mapear items pero sí hay detalles crudos */}
          {maintenanceItems.length === 0 && hasAnyDetails && (
            <div className="border rounded-lg p-4 text-xs break-inside-avoid bg-gray-50">
              <p className="mb-2 font-semibold">
                No se pudo mapear la estructura de la ejecución a la vista detallada de mantenimientos.
              </p>
              <p className="mb-2">
                A continuación se muestran los datos crudos de la ejecución (para referencia técnica):
              </p>
              <pre className="whitespace-pre-wrap break-all bg-white border rounded p-2 max-h-[400px] overflow-auto">
{JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}

          {/* Si realmente no hay nada */}
          {maintenanceItems.length === 0 && !hasAnyDetails && (
            <p className="text-sm text-gray-500">
              No hay datos de mantenimientos asociados a esta ejecución.
            </p>
          )}
        </div>

        {/* Firmas - En página separada */}
        {(signatures.executors || signatures.supervisors) && (() => {
          // Función para obtener el título del mantenimiento (nombre + ID)
          const getMaintenanceTitle = (maintenanceId: number): string => {
            // 1) Buscar en las fases del checklist
            if (checklist?.phases) {
              for (const phase of checklist.phases) {
                if (phase.items) {
                  const item = phase.items.find((i: any) => i.maintenanceId === maintenanceId);
                  if (item && item.title) {
                    return `${item.title} (ID: ${maintenanceId})`;
                  }
                }
              }
            }
            
            // 2) Buscar en items directos del checklist
            if (checklist?.items) {
              const item = checklist.items.find((i: any) => i.maintenanceId === maintenanceId);
              if (item && item.title) {
                return `${item.title} (ID: ${maintenanceId})`;
              }
            }
            
            // 3) Intentar usar el mapa de mantenimientos
            const maintenanceFromMap = maintenanceMap[maintenanceId];
            if (maintenanceFromMap?.title) {
              return `${maintenanceFromMap.title} (ID: ${maintenanceId})`;
            }
            
            // 4) Fallback: solo ID
            return `Mantenimiento ID ${maintenanceId}`;
          };

          // Agrupar mantenimientos por ejecutor y supervisor
          const executorToTasks: Record<string, Array<{ id: number; title: string }>> = {};
          const supervisorToTasks: Record<string, Array<{ id: number; title: string }>> = {};
          
          maintenanceItems.forEach((item: any) => {
            // Obtener el título del mantenimiento desde el checklist
            const maintenanceTitle = getMaintenanceTitle(item.maintenanceId);
            
            (item.executors || []).forEach((name: string) => {
              if (!executorToTasks[name]) executorToTasks[name] = [];
              executorToTasks[name].push({ 
                id: item.maintenanceId, 
                title: maintenanceTitle
              });
            });
            (item.supervisors || []).forEach((name: string) => {
              if (!supervisorToTasks[name]) supervisorToTasks[name] = [];
              supervisorToTasks[name].push({ 
                id: item.maintenanceId, 
                title: maintenanceTitle
              });
            });
          });

          const executorNames = Object.keys(executorToTasks);
          const supervisorNames = Object.keys(supervisorToTasks);

          return (
            <div className="mt-8 border-t pt-6 print-page-break-before">
              <h2 className="text-xl font-semibold mb-4">Responsables y Supervisores con Firmas</h2>

              {/* Tabla de Ejecutores */}
              {executorNames.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 text-lg">Responsables</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left border-b-2 border-gray-300">
                          <th className="py-3 pr-4 font-semibold text-gray-700">Empleado</th>
                          <th className="py-3 pr-4 font-semibold text-gray-700">Mantenimientos Realizados</th>
                          <th className="py-3 pr-4 font-semibold text-gray-700 w-48">Firma</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executorNames.map((name, idx) => (
                          <tr key={name} className="border-b border-gray-200">
                            <td className="py-4 pr-4 font-medium whitespace-nowrap">{name}</td>
                            <td className="py-4 pr-4">
                              <ul className="list-disc pl-5 space-y-1">
                                {executorToTasks[name].map((task) => (
                                  <li key={task.id} className="text-gray-700">
                                    {task.title}
                                    <span className="text-xs text-gray-500 ml-1">(ID {task.id})</span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td className="py-4 pr-4">
                              {signatures.executors && signatures.executors[name] ? (
                                <div className="flex items-center justify-center">
                                  <img
                                    src={signatures.executors[name]}
                                    alt={`Firma de ${name}`}
                                    className="max-w-full h-24 border-2 border-gray-300 rounded bg-white"
                                  />
                                </div>
                              ) : (
                                <div className="text-gray-400 text-xs italic">Sin firma</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabla de Supervisores */}
              {supervisorNames.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-lg">Supervisores</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left border-b-2 border-gray-300">
                          <th className="py-3 pr-4 font-semibold text-gray-700">Empleado</th>
                          <th className="py-3 pr-4 font-semibold text-gray-700">Mantenimientos Supervisados</th>
                          <th className="py-3 pr-4 font-semibold text-gray-700 w-48">Firma</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supervisorNames.map((name, idx) => (
                          <tr key={name} className="border-b border-gray-200">
                            <td className="py-4 pr-4 font-medium whitespace-nowrap">{name}</td>
                            <td className="py-4 pr-4">
                              <ul className="list-disc pl-5 space-y-1">
                                {supervisorToTasks[name].map((task) => (
                                  <li key={task.id} className="text-gray-700">
                                    {task.title}
                                    <span className="text-xs text-gray-500 ml-1">(ID {task.id})</span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td className="py-4 pr-4">
                              {signatures.supervisors && signatures.supervisors[name] ? (
                                <div className="flex items-center justify-center">
                                  <img
                                    src={signatures.supervisors[name]}
                                    alt={`Firma de ${name}`}
                                    className="max-w-full h-24 border-2 border-gray-300 rounded bg-white"
                                  />
                                </div>
                              ) : (
                                <div className="text-gray-400 text-xs italic">Sin firma</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Pie de página */}
        <div className="mt-8 pt-4 border-t text-sm text-gray-600 text-center">
          <p>Documento generado el {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
        </div>
      </div>

      {/* Estilos para impresión */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Resetear estilos del body */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          html {
            background: white !important;
          }
          
          /* Ocultar título ORVIT del navegador y cualquier elemento que lo contenga */
          html > head > title {
            display: none !important;
          }
          
          /* Ocultar cualquier texto que contenga ORVIT */
          body * {
            text-shadow: none !important;
          }
          
          /* Buscar y ocultar elementos con texto ORVIT */
          body > *:not(.print-layout):not([class*="print"]) {
            position: relative;
          }
          
          /* Asegurar que el título del documento no aparezca */
          title {
            display: none !important;
          }
          
          /* Ocultar elementos de navegación y UI */
          nav,
          footer,
          header:not(.print-header),
          aside,
          .sidebar,
          [class*="bottom"],
          [class*="navbar"],
          [class*="navigation"],
          [id*="bottom"],
          [id*="navbar"],
          [id*="navigation"],
          [class*="logo"],
          [class*="brand"],
          [class*="orvit"],
          [class*="ORVIT"],
          [class*="MobileBottomBar"],
          [class*="mobile-bottom-bar"],
          [class*="bottom-bar"],
          [class*="bottomNav"],
          [class*="bottom-nav"],
          [class*="nav-bar"],
          [class*="top-bar"],
          [class*="fixed"][class*="bottom"],
          [style*="bottom: 0"],
          [style*="position: fixed"],
          [aria-label*="navigation"],
          [role="navigation"],
          [role="banner"]:not(.print-header),
          button.print\\:hidden,
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
          }
          
          /* Ocultar elementos específicos comunes */
          body > nav,
          body > footer,
          body > header:not(.print-header),
          body > header > div:first-child,
          body > header > nav,
          body > div[class*="bottom"],
          body > div[class*="navbar"],
          body > div[class*="navigation"],
          body > div[class*="fixed"][class*="bottom"],
          div[class*="fixed"][class*="bottom-0"] {
            display: none !important;
            visibility: hidden !important;
            position: absolute !important;
            left: -9999px !important;
          }
          
          /* Ocultar cualquier elemento fijo en el bottom */
          [style*="position: fixed"][style*="bottom"],
          [class*="fixed"][class*="bottom-0"],
          [class*="fixed"][class*="bottom"] {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Configuración de página para ocultar URL y números de página */
          @page {
            margin: 1.5cm;
            size: A4;
            /* Ocultar URL y números de página - intentar múltiples métodos */
            marks: none;
            /* Ocultar encabezados y pies de página del navegador */
            @top-left { content: ""; }
            @top-center { content: ""; }
            @top-right { content: ""; }
            @bottom-left { content: ""; }
            @bottom-center { content: ""; }
            @bottom-right { content: ""; }
          }
          
          /* Forzar ocultar encabezados y pies de página del navegador */
          @page :first {
            margin-top: 1.5cm;
            margin-bottom: 1.5cm;
          }
          
          @page :left {
            margin-left: 1.5cm;
            margin-right: 1.5cm;
          }
          
          @page :right {
            margin-left: 1.5cm;
            margin-right: 1.5cm;
          }
          
          /* Ocultar elementos del layout principal */
          .print-layout {
            background: white !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:max-w-full {
            max-width: 100% !important;
          }
          
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          /* Salto de página antes de la sección de firmas */
          .print-page-break-before {
            page-break-before: always;
            break-before: page;
          }
          
          /* Asegurar que el contenido principal sea visible */
          .max-w-4xl {
            max-width: 100% !important;
            background: white !important;
            box-shadow: none !important;
          }
          
          /* Fondo blanco uniforme en todo el documento */
          body,
          html {
            background: white !important;
            background-color: white !important;
          }
          
          /* Fondo blanco en el contenedor principal */
          .print-layout,
          .max-w-4xl,
          div[class*="max-w"] {
            background: white !important;
            background-color: white !important;
          }
          
          /* Fondo blanco en todos los divs principales */
          body > div,
          body > div > div {
            background: white !important;
            background-color: white !important;
          }
          
          /* Solo mantener el fondo gris claro de las tarjetas de mantenimiento */
          .border.rounded-lg.p-4 {
            background: #f9fafb !important;
            background-color: #f9fafb !important;
          }
          
          /* Ocultar elementos que contengan "ORVIT" en el texto */
          *:not(.print-header):not(.print-layout) {
            color-adjust: exact !important;
          }
          
          /* Eliminar cualquier borde o sombra que pueda crear efectos visuales */
          .border,
          [class*="border"],
          [class*="shadow"],
          [class*="rounded"] {
            border-color: #e5e7eb !important;
          }
        }
        
        /* Estilos en pantalla (no impresión) */
        @media screen {
          .print-layout {
            min-height: 100vh;
          }
        }
      `}} />
      
      {/* Script de impresión eliminado: su funcionalidad ya está cubierta por
          el useEffect (líneas 63-93) y los estilos CSS @media print de arriba */}
    </div>
  );
}


