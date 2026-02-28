import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const maintenanceId = params.id;
    
    if (!maintenanceId) {
      return NextResponse.json(
        { error: 'ID de mantenimiento es requerido' },
        { status: 400 }
      );
    }
    
    // Obtener el historial específico de este mantenimiento
    let executions: any[] = [];
    
    try {
      const response = await fetch(`${request.nextUrl.origin}/api/maintenance/history?maintenanceId=${maintenanceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        executions = data.data?.executions || data.executions || [];
      } else {
        console.error('Error obteniendo historial:', response.status, response.statusText);
        // Si no hay historial, continuar con array vacío
      }
    } catch (fetchError) {
      console.error('Error en fetch de historial:', fetchError);
      // Continuar con array vacío si falla el fetch
    }
    
    if (executions.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          maintenanceId: Number(maintenanceId),
          stats: {
            totalExecutions: 0,
            averageDuration: 0,
            minDuration: 0,
            maxDuration: 0,
            lastExecution: null,
            firstExecution: null,
            averageEfficiency: 0,
            totalCost: 0,
            averageQuality: 0,
            trend: 'stable'
          },
          timeline: [],
          recommendations: []
        }
      });
    }
    
    // Calcular estadísticas detalladas
    const sortedByDate = executions.sort((a: any, b: any) => 
      new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
    );
    
    const totalExecutions = executions.length;
    const durations = executions.map((ex: any) => ex.actualDuration || 0).filter((d: number) => d > 0);
    const averageDuration = durations.reduce((sum: number, d: number) => sum + d, 0) / durations.length || 0;
    const minDuration = Math.min(...durations) || 0;
    const maxDuration = Math.max(...durations) || 0;
    
    const firstExecution = sortedByDate[0];
    const lastExecution = sortedByDate[sortedByDate.length - 1];
    
    // Calcular tendencia (comparar últimas 3 vs primeras 3 ejecuciones)
    let trend = 'stable';
    if (executions.length >= 6) {
      const firstThree = sortedByDate.slice(0, 3);
      const lastThree = sortedByDate.slice(-3);
      
      const firstAvg = firstThree.reduce((sum: number, ex: any) => sum + (ex.actualDuration || 0), 0) / 3;
      const lastAvg = lastThree.reduce((sum: number, ex: any) => sum + (ex.actualDuration || 0), 0) / 3;
      
      if (lastAvg > firstAvg * 1.1) {
        trend = 'increasing';
      } else if (lastAvg < firstAvg * 0.9) {
        trend = 'decreasing';
      }
    }
    
    // Calcular eficiencia promedio
    const efficiencies = executions.filter((ex: any) => ex.efficiency).map((ex: any) => ex.efficiency);
    const averageEfficiency = efficiencies.length > 0 
      ? efficiencies.reduce((sum: number, eff: number) => sum + eff, 0) / efficiencies.length 
      : 0;
    
    // Calcular costo total
    const totalCost = executions.reduce((sum: number, ex: any) => sum + (ex.cost || 0), 0);
    
    // Calcular calidad promedio
    const qualityScores = executions.filter((ex: any) => ex.qualityScore).map((ex: any) => ex.qualityScore);
    const averageQuality = qualityScores.length > 0 
      ? qualityScores.reduce((sum: number, score: number) => sum + score, 0) / qualityScores.length 
      : 0;
    
    // Timeline para gráfico
    const timeline = sortedByDate.map((ex: any) => ({
      date: ex.executedAt,
      duration: ex.actualDuration || 0,
      efficiency: ex.efficiency || 0,
      quality: ex.qualityScore || 0,
      cost: ex.cost || 0
    }));
    
    // Generar recomendaciones
    const recommendations = [];
    
    if (trend === 'increasing') {
      recommendations.push({
        type: 'warning',
        message: 'La duración de los mantenimientos está aumentando. Considere revisar el procedimiento.'
      });
    }
    
    if (averageEfficiency < 80) {
      recommendations.push({
        type: 'warning',
        message: 'La eficiencia promedio es baja. Revise los tiempos estimados vs reales.'
      });
    }
    
    if (averageQuality < 7) {
      recommendations.push({
        type: 'alert',
        message: 'La calidad promedio es baja. Considere mejorar el procedimiento o capacitación.'
      });
    }
    
    if (maxDuration > averageDuration * 2) {
      recommendations.push({
        type: 'info',
        message: 'Hay variaciones significativas en la duración. Analice las causas de los mantenimientos más largos.'
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        maintenanceId: Number(maintenanceId),
        stats: {
          totalExecutions,
          averageDuration: Math.round(averageDuration * 100) / 100,
          minDuration: Math.round(minDuration * 100) / 100,
          maxDuration: Math.round(maxDuration * 100) / 100,
          lastExecution: lastExecution?.executedAt || null,
          firstExecution: firstExecution?.executedAt || null,
          averageEfficiency: Math.round(averageEfficiency * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          averageQuality: Math.round(averageQuality * 100) / 100,
          trend
        },
        timeline,
        recommendations
      }
    });
    
  } catch (error: any) {
    console.error('Error obteniendo estadísticas de mantenimiento:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error?.message || 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
