import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener el usuario actual y sus empresas
async function getCurrentUserWithCompanies() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true
          }
        },
        ownedCompanies: true
      }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Obtener la primera empresa (o la empresa que posee)
    const userCompany = user.ownedCompanies[0] || user.companies[0]?.company;
    
    return { user, userCompany };
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return { user: null, userCompany: null };
  }
}

// GET /api/maquinas?companyId=123&sectorId=456&plantZoneId=789&includeMobileUnits=true
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let companyId = searchParams.get('companyId');
  const sectorId = searchParams.get('sectorId');
  const plantZoneId = searchParams.get('plantZoneId');
  const includeMobileUnits = searchParams.get('includeMobileUnits') === 'true';
  const noZone = searchParams.get('noZone') === 'true'; // Máquinas sin zona asignada

  try {
    // Si no se proporciona companyId, usar el de la empresa del usuario
    if (!companyId || companyId === 'undefined') {
      const { user, userCompany } = await getCurrentUserWithCompanies();
      if (userCompany) {
        companyId = userCompany.id.toString();
      }
    }

    const where: any = {};
    if (companyId && companyId !== 'undefined') {
      where.companyId = Number(companyId);
    }
    if (sectorId && sectorId !== 'undefined') {
      where.sectorId = Number(sectorId);
    }
    // Filtrar por zona de planta
    if (plantZoneId && plantZoneId !== 'undefined') {
      where.plantZoneId = Number(plantZoneId);
    } else if (noZone) {
      where.plantZoneId = null; // Solo máquinas sin zona asignada
    }

    // Obtener máquinas regulares
    const machines = await prisma.machine.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        company: true,
        sector: {
          include: {
            area: true
          }
        },
        plantZone: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    });

    // Si se solicitan unidades móviles, incluirlas también
    let allEquipment = [...machines];
    
    if (includeMobileUnits) {
      const mobileUnits = await prisma.unidadMovil.findMany({
        where: {
          companyId: companyId ? Number(companyId) : undefined,
          sectorId: sectorId && sectorId !== 'undefined' ? Number(sectorId) : undefined,
          estado: 'ACTIVO'
        },
        orderBy: { nombre: 'asc' },
        include: {
          company: true,
          sector: {
            include: {
              area: true
            }
          }
        }
      });

      // Transformar unidades móviles para que tengan la misma estructura que las máquinas
      const transformedMobileUnits = mobileUnits.map(unit => ({
        id: `mobile-${unit.id}`, // Prefijo para distinguir de máquinas regulares
        name: unit.nombre,
        nickname: unit.tipo,
        type: 'UNIDAD_MOVIL',
        brand: unit.marca,
        model: unit.modelo,
        serialNumber: unit.patente,
        status: unit.estado,
        acquisitionDate: unit.fechaAdquisicion,
        companyId: unit.companyId,
        sectorId: unit.sectorId,
        company: unit.company,
        sector: unit.sector,
        // Campos específicos de unidad móvil
        originalId: unit.id,
        patente: unit.patente,
        kilometraje: unit.kilometraje,
        isMobileUnit: true
      }));

      allEquipment = [...machines, ...transformedMobileUnits];
    }
    
    return NextResponse.json(Array.isArray(allEquipment) ? allEquipment : [], { status: 200 });
  } catch (error) {
    console.error('Error en GET /api/maquinas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
}

// POST /api/maquinas
export async function POST(request: NextRequest) {
  try {
    // Obtener usuario actual y su empresa
    const { user, userCompany } = await getCurrentUserWithCompanies();
    
    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }
    
    if (!userCompany) {
      return NextResponse.json({ error: 'Usuario no tiene empresa asignada' }, { status: 400 });
    }
    
    const body = await request.json();
    const { name, nickname, type, brand, model, serialNumber, status, acquisitionDate, sectorId, plantZoneId } = body;

    // Usar SIEMPRE la empresa del usuario logueado, no del frontend
    const companyId = userCompany.id;
    
    if (!name || !type || !brand || !status || !acquisitionDate || !sectorId) {
      return NextResponse.json({ error: 'Campos requeridos: name, type, brand, status, acquisitionDate, sectorId' }, { status: 400 });
    }
    
    // Verificar que el sector pertenece a la empresa del usuario
    const sector = await prisma.sector.findFirst({
      where: {
        id: Number(sectorId),
        area: {
          companyId: companyId
        }
      },
      include: {
        area: true
      }
    });
    
    if (!sector) {
      return NextResponse.json({
        error: `El sector ${sectorId} no pertenece a la empresa ${userCompany.name}`
      }, { status: 400 });
    }

    // Si se proporciona plantZoneId, validar que existe y pertenece al sector
    if (plantZoneId) {
      const zone = await prisma.plantZone.findFirst({
        where: {
          id: Number(plantZoneId),
          sectorId: Number(sectorId),
          companyId: companyId
        }
      });
      if (!zone) {
        return NextResponse.json({
          error: 'La zona de planta no existe o no pertenece al sector especificado'
        }, { status: 400 });
      }
    }

    const newMachine = await prisma.machine.create({
      data: {
        name,
        nickname,
        type: type.toUpperCase(), // Convertir a mayúsculas para el enum
        brand,
        model,
        serialNumber,
        status: status.toUpperCase(), // Convertir a mayúsculas para el enum
        acquisitionDate: new Date(acquisitionDate),
        companyId,
        sectorId: Number(sectorId),
        plantZoneId: plantZoneId ? Number(plantZoneId) : null,
        logo: body.logo || '',
      },
      include: {
        company: true,
        sector: {
          include: {
            area: true
          }
        },
        plantZone: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    });

    return NextResponse.json(newMachine, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/maquinas:', error);
    return NextResponse.json({ 
      error: 'Error al crear máquina', 
      details: error instanceof Error ? error.message : 'Error desconocido' 
    }, { status: 500 });
  }
  // ✅ OPTIMIZADO: Removido $disconnect()
} 