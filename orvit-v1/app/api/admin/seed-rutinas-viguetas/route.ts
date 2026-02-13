import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { userId: payload.userId as number, companyId: payload.companyId as number };
  } catch {
    throw new Error('Invalid token');
  }
}

// Helper para generar IDs únicos
const genId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

// POST /api/admin/seed-rutinas-viguetas - Crear las 5 rutinas de viguetas
export async function POST() {
  try {
    const { companyId } = await getUserFromToken();

    const rutinas = [
      // ========== 1. INICIO DEL DÍA ==========
      {
        code: 'VIG_INICIO_DIA',
        name: 'Inicio del Día - Viguetas',
        type: 'SHIFT_START',
        frequency: 'DAILY',
        items: [
          { id: genId(), description: 'Nivel Silo 3', inputs: [{ id: genId(), type: 'RATING', label: 'Nivel Silo 3', required: true, ratingMax: 10 }] },
          { id: genId(), description: 'Nivel Silo 4', inputs: [{ id: genId(), type: 'RATING', label: 'Nivel Silo 4', required: true, ratingMax: 10 }] },
          { id: genId(), description: '¿Qué silo se utiliza hoy?', inputs: [{ id: genId(), type: 'SELECT', label: '¿Qué silo se utiliza hoy?', required: true, options: ['Silo 3', 'Silo 4', 'Ambos'] }] },
          { id: genId(), description: 'Nivel triturado 3/9', inputs: [{ id: genId(), type: 'SELECT', label: 'Nivel triturado 3/9', required: true, options: ['Suficiente', 'Bajo', 'Crítico'] }] },
          { id: genId(), description: 'Nivel arena', inputs: [{ id: genId(), type: 'SELECT', label: 'Nivel arena', required: true, options: ['Suficiente', 'Bajo', 'Crítico'] }] },
          { id: genId(), description: 'Personal posicionado del día', inputs: [{ id: genId(), type: 'EMPLOYEE_SELECT', label: 'Personal posicionado del día', required: true }] },
          { id: genId(), description: 'Carro de mezcla limpio', inputs: [{ id: genId(), type: 'CHECK', label: 'Carro de mezcla limpio', required: true }] },
          { id: genId(), description: 'Viguetera limpia', inputs: [{ id: genId(), type: 'CHECK', label: 'Viguetera limpia', required: true }] },
          { id: genId(), description: 'Carro aéreo limpio', inputs: [{ id: genId(), type: 'CHECK', label: 'Carro aéreo limpio', required: true }] },
          { id: genId(), description: 'Pozo mugre - estado correcto', inputs: [{ id: genId(), type: 'CHECK', label: 'Pozo mugre - estado correcto', required: true }] },
          { id: genId(), description: 'Foto pozo mugre (si hay problema)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto pozo mugre', required: false }] },
          { id: genId(), description: 'Desagote/limpieza general OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Desagote/limpieza general OK', required: true }] },
          { id: genId(), description: '¿Fisuras en bancos curados (9-10)?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Fisuras en bancos curados?', required: true }] },
          { id: genId(), description: 'Si hay fisuras, ¿qué paños?', inputs: [{ id: genId(), type: 'TEXT', label: 'Paños con fisuras', required: false }] },
          { id: genId(), description: 'Estado hormigón curado', inputs: [{ id: genId(), type: 'SELECT', label: 'Estado hormigón curado', required: true, options: ['Normal', 'Seco', 'Húmedo'] }] },
          { id: genId(), description: 'Foto bancos curados', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto bancos curados', required: true }] },
          { id: genId(), description: 'Firma supervisor', inputs: [{ id: genId(), type: 'SIGNATURE', label: 'Firma supervisor', required: true }] },
        ],
      },
      // ========== 2. CONTROL ÁRIDOS ==========
      {
        code: 'VIG_CTRL_ARIDOS',
        name: 'Control Áridos - Por Carga',
        type: 'QUALITY',
        frequency: 'EVERY_SHIFT',
        items: [
          { id: genId(), description: 'Foto triturado 3/9', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto triturado 3/9', required: true }] },
          { id: genId(), description: 'Estado triturado OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Triturado en buen estado', required: true }] },
          { id: genId(), description: 'Foto arena', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto arena', required: true }] },
          { id: genId(), description: 'Estado arena OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Arena en buen estado', required: true }] },
          { id: genId(), description: 'Observaciones', inputs: [{ id: genId(), type: 'TEXT', label: 'Observaciones', required: false }] },
        ],
      },
      // ========== 3. CONTROL POR BANCO ==========
      {
        code: 'VIG_CTRL_BANCO',
        name: 'Control por Banco',
        type: 'QUALITY',
        frequency: 'EVERY_SHIFT',
        items: [
          { id: genId(), description: 'Banco Nº', inputs: [{ id: genId(), type: 'VALUE', label: 'Banco Nº', required: true, unit: '', minValue: 1, maxValue: 12 }] },
          { id: genId(), description: 'Estado general inicio', inputs: [{ id: genId(), type: 'SELECT', label: 'Estado general inicio', required: true, options: ['Bien', 'Regular', 'Mal'] }] },
          { id: genId(), description: 'Foto inicio banco', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto inicio banco', required: true }] },
          { id: genId(), description: 'Trenza que no gire', inputs: [{ id: genId(), type: 'CHECK', label: 'Trenza sin girar', required: true }] },
          { id: genId(), description: 'Desgaste peines', inputs: [{ id: genId(), type: 'SELECT', label: 'Desgaste peines', required: true, options: ['Bien', 'Regular', 'Mal'] }] },
          { id: genId(), description: '¿Gira trenza?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Gira la trenza?', required: true }] },
          { id: genId(), description: 'Control hormigón OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Control hormigón OK', required: true }] },
          { id: genId(), description: 'Estado final banco', inputs: [{ id: genId(), type: 'SELECT', label: 'Estado final banco', required: true, options: ['Bien', 'Regular', 'Mal'] }] },
          { id: genId(), description: 'Foto final (cabezal terminado)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cabezal terminado', required: true }] },
          { id: genId(), description: 'Foto medio banco', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto separación viguetas', required: true }] },
          { id: genId(), description: 'Limpieza cabezal adelante', inputs: [{ id: genId(), type: 'CHECK', label: 'Cabezal adelante limpio', required: true }] },
          { id: genId(), description: 'Foto cabezal adelante', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cabezal adelante', required: true }] },
          { id: genId(), description: 'Limpieza cabezal fondo', inputs: [{ id: genId(), type: 'CHECK', label: 'Cabezal fondo limpio', required: true }] },
          { id: genId(), description: 'Foto cabezal fondo', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cabezal fondo', required: true }] },
          { id: genId(), description: 'Estado bujes OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Bujes en buen estado', required: true }] },
          { id: genId(), description: 'Estado uñas OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Uñas en buen estado', required: true }] },
          { id: genId(), description: 'Colocación correcta', inputs: [{ id: genId(), type: 'CHECK', label: 'Colocación correcta', required: true }] },
          { id: genId(), description: '¿Cuántas uñas?', inputs: [{ id: genId(), type: 'VALUE', label: 'Cantidad de uñas', required: true, unit: 'u' }] },
          { id: genId(), description: 'Ubicación uñas', inputs: [{ id: genId(), type: 'SELECT', label: 'Ubicación', required: true, options: ['Adelante', 'Fondo', 'Ambos'] }] },
          { id: genId(), description: '¿Hubo falla/defecto?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hubo falla?', required: true }] },
          { id: genId(), description: 'Descripción falla', inputs: [{ id: genId(), type: 'TEXT', label: 'Descripción de la falla', required: false }] },
        ],
      },
      // ========== 4. CONTROL CADA 2 BANCOS ==========
      {
        code: 'VIG_CTRL_2BANCOS',
        name: 'Control cada 2 Bancos',
        type: 'QUALITY',
        frequency: 'EVERY_SHIFT',
        items: [
          // Chimango
          { id: genId(), description: 'Foto cemento utilizado', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cemento', required: true }] },
          { id: genId(), description: 'Arrime chimango correcto', inputs: [{ id: genId(), type: 'CHECK', label: 'Arrime chimango OK', required: true }] },
          { id: genId(), description: 'Humedad pedida', inputs: [{ id: genId(), type: 'VALUE', label: 'Humedad pedida', required: true, unit: '%' }] },
          { id: genId(), description: 'Humedad final', inputs: [{ id: genId(), type: 'VALUE', label: 'Humedad final', required: true, unit: '%' }] },
          { id: genId(), description: 'Foto humedad', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto humedad', required: true }] },
          { id: genId(), description: 'Foto parámetros', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto parámetros', required: true }] },
          // Pista/Vías
          { id: genId(), description: 'Limpieza de pista OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Pista limpia', required: true }] },
          { id: genId(), description: 'Limpieza vías puente grúa', inputs: [{ id: genId(), type: 'SELECT', label: 'Estado vías', required: true, options: ['Bien', 'Regular', 'Mal'] }] },
          { id: genId(), description: 'Foto vías puente grúa', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto vías', required: true }] },
          { id: genId(), description: 'Banco Nº (desmoldante)', inputs: [{ id: genId(), type: 'VALUE', label: 'Banco Nº', required: true, unit: '' }] },
          { id: genId(), description: 'Desmoldante OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Desmoldante OK', required: true }] },
          { id: genId(), description: 'Foto desmoldante', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto desmoldante', required: true }] },
          // Cortadora
          { id: genId(), description: 'Banco Nº (corte)', inputs: [{ id: genId(), type: 'VALUE', label: 'Banco Nº corte', required: true, unit: '' }] },
          { id: genId(), description: 'Control medida OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Medida verificada', required: true }] },
          { id: genId(), description: '¿Hay desperdicio?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hay desperdicio?', required: true }] },
          { id: genId(), description: 'Metros desperdicio', inputs: [{ id: genId(), type: 'VALUE', label: 'Metros desperdicio', required: false, unit: 'm' }] },
          { id: genId(), description: 'Foto panel cortadora', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto panel', required: true }] },
          { id: genId(), description: '¿Corta alambres abajo?', inputs: [{ id: genId(), type: 'CHECK', label: 'Corta alambres abajo', required: true }] },
          { id: genId(), description: 'Medida = Pedido gerencia', inputs: [{ id: genId(), type: 'CHECK', label: 'Medida coincide', required: true }] },
          // Paquetes
          { id: genId(), description: 'Banco Nº (paquete)', inputs: [{ id: genId(), type: 'VALUE', label: 'Banco Nº paquete', required: true, unit: '' }] },
          { id: genId(), description: '¿Fisuras?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hay fisuras?', required: true }] },
          { id: genId(), description: 'Posición alambres OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Alambres OK', required: true }] },
          { id: genId(), description: 'Profundidad corte OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Profundidad OK', required: true }] },
          { id: genId(), description: 'Control medidas OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Medidas OK', required: true }] },
          { id: genId(), description: 'Foto lejos (pila)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto pila lejos', required: true }] },
          { id: genId(), description: 'Foto cerca (fisuras)', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto cerca', required: true }] },
          { id: genId(), description: 'Confirmado puentistas', inputs: [{ id: genId(), type: 'CHECK', label: 'Confirmado', required: true }] },
        ],
      },
      // ========== 5. CIERRE DEL DÍA ==========
      {
        code: 'VIG_CIERRE_DIA',
        name: 'Cierre del Día - Viguetas',
        type: 'SHIFT_END',
        frequency: 'DAILY',
        items: [
          { id: genId(), description: 'Válvulas vapor ON', inputs: [{ id: genId(), type: 'CHECK', label: 'Válvulas vapor ON', required: true }] },
          { id: genId(), description: '¿Pérdidas vapor?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hay pérdidas de vapor?', required: true }] },
          { id: genId(), description: 'Prueba caldera (si aplica)', inputs: [{ id: genId(), type: 'CHECK', label: 'Prueba caldera OK', required: false }] },
          { id: genId(), description: 'Bancos a regar', inputs: [{ id: genId(), type: 'CHECKBOX', label: 'Bancos a regar', required: true, options: ['Banco 1', 'Banco 2', 'Banco 3', 'Banco 4', 'Banco 5', 'Banco 6', 'Banco 7', 'Banco 8', 'Banco 9', 'Banco 10', 'Banco 11', 'Banco 12'] }] },
          { id: genId(), description: 'Horario riego', inputs: [{ id: genId(), type: 'TIME', label: 'Horario riego', required: true }] },
          { id: genId(), description: '¿Cortadora en marcha?', inputs: [{ id: genId(), type: 'CHECK', label: 'Cortadora en marcha', required: true }] },
          { id: genId(), description: 'Cortadora tapada', inputs: [{ id: genId(), type: 'CHECK', label: 'Cortadora tapada', required: false }] },
          { id: genId(), description: 'Bancos producidos', inputs: [{ id: genId(), type: 'VALUE', label: 'Bancos producidos', required: true, unit: 'u' }] },
          { id: genId(), description: 'Herramientas ordenadas', inputs: [{ id: genId(), type: 'CHECK', label: 'Herramientas OK', required: true }] },
          { id: genId(), description: 'Limpieza general OK', inputs: [{ id: genId(), type: 'CHECK', label: 'Limpieza OK', required: true }] },
          { id: genId(), description: 'Sala comando apagada', inputs: [{ id: genId(), type: 'CHECK', label: 'Sala apagada', required: true }] },
          { id: genId(), description: '¿Cortes mal?', inputs: [{ id: genId(), type: 'CHECK', label: '¿Hubo cortes mal?', required: true }] },
          { id: genId(), description: 'Detalle cortes mal', inputs: [{ id: genId(), type: 'TEXT', label: 'Detalle', required: false }] },
          { id: genId(), description: 'Bombas apagadas', inputs: [{ id: genId(), type: 'CHECK', label: 'Bombas OFF', required: true }] },
          { id: genId(), description: 'Carpas 1-8', inputs: [{ id: genId(), type: 'SELECT', label: 'Carpas 1-8', required: true, options: ['OK', 'Revisar', 'Mal'] }] },
          { id: genId(), description: 'Carpas 9-12', inputs: [{ id: genId(), type: 'SELECT', label: 'Carpas 9-12', required: true, options: ['OK', 'Revisar', 'Mal'] }] },
          { id: genId(), description: 'Foto bancos a quemar', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto quemar', required: true }] },
          { id: genId(), description: 'Foto parámetros vapor', inputs: [{ id: genId(), type: 'PHOTO', label: 'Foto vapor', required: true }] },
          { id: genId(), description: 'Firma supervisor', inputs: [{ id: genId(), type: 'SIGNATURE', label: 'Firma', required: true }] },
        ],
      },
    ];

    const results = [];

    for (const rutina of rutinas) {
      // Check if exists
      const existing = await prisma.productionRoutineTemplate.findFirst({
        where: { companyId, code: rutina.code },
      });

      if (existing) {
        results.push({ code: rutina.code, name: rutina.name, status: 'skipped', reason: 'Ya existe' });
        continue;
      }

      // Create
      const itemsData = {
        itemsStructure: 'flat',
        items: rutina.items,
        groups: null,
        preExecutionInputs: [],
      };

      const template = await prisma.productionRoutineTemplate.create({
        data: {
          code: rutina.code,
          name: rutina.name,
          type: rutina.type,
          frequency: rutina.frequency,
          items: itemsData,
          isActive: true,
          companyId,
        },
      });

      results.push({ code: rutina.code, name: rutina.name, status: 'created', id: template.id });
    }

    return NextResponse.json({
      success: true,
      message: 'Rutinas de viguetas procesadas',
      results,
      summary: {
        created: results.filter(r => r.status === 'created').length,
        skipped: results.filter(r => r.status === 'skipped').length,
      },
    });
  } catch (error) {
    console.error('Error seeding rutinas:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear rutinas' },
      { status: 500 }
    );
  }
}

// GET para verificar el estado
export async function GET() {
  try {
    const { companyId } = await getUserFromToken();

    const rutinas = await prisma.productionRoutineTemplate.findMany({
      where: {
        companyId,
        code: {
          in: ['VIG_INICIO_DIA', 'VIG_CTRL_ARIDOS', 'VIG_CTRL_BANCO', 'VIG_CTRL_2BANCOS', 'VIG_CIERRE_DIA'],
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        _count: { select: { executions: true } },
      },
    });

    return NextResponse.json({
      success: true,
      rutinas,
      installed: rutinas.length,
      total: 5,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error' }, { status: 500 });
  }
}
