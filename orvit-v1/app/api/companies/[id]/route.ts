import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// Helper para obtener usuario desde JWT
async function getUserFromToken() {
  try {
    const token = cookies().get('token')?.value;
    
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number }
    });

    return user;
  } catch (error) {
    console.error('Error obteniendo usuario desde JWT:', error);
    return null;
  }
}

// GET /api/companies/[id] - Obtener empresa específica
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    
    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: 'ID de empresa inválido' },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(company, { status: 200 });
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    return NextResponse.json(
      { error: 'Error al obtener la empresa' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/companies/[id] - Actualizar empresa
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    
    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: 'ID de empresa inválido' },
        { status: 400 }
      );
    }

    // Obtener usuario autenticado
    const currentUser = await getUserFromToken();
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar permisos usando el sistema de permisos
    const userCompany = await prisma.userOnCompany.findFirst({
      where: {
        userId: currentUser.id,
        companyId: companyId
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    console.log('🔍 [API] Verificando permisos para usuario:', {
      userId: currentUser.id,
      userRole: currentUser.role,
      userName: currentUser.name,
      companyId: companyId,
      userCompanyRole: userCompany?.role?.name,
      rolePermissions: userCompany?.role?.permissions?.map(rp => ({
        permission: rp.permission.name,
        isGranted: rp.isGranted
      })) || []
    });

    // Verificar si el usuario tiene el permiso company.settings, company.edit o configuracion_empresa
    let hasPermission = currentUser.role === 'SUPERADMIN';

    if (!hasPermission && userCompany?.role) {
      // Verificar permisos del rol
      hasPermission = userCompany.role.permissions?.some(
        rp => (rp.permission.name === 'company.settings' || rp.permission.name === 'company.edit' || rp.permission.name === 'configuracion_empresa') && rp.isGranted
      ) || false;
    }

    // Si no tiene permiso por rol, verificar permisos específicos del usuario
    if (!hasPermission) {
      const userPermissions = await prisma.userPermission.findMany({
        where: {
          userId: currentUser.id,
          permission: {
            name: {
              in: ['company.settings', 'company.edit', 'configuracion_empresa']
            }
          },
          isGranted: true
        }
      });
      
      hasPermission = userPermissions.length > 0;
    }
    
    // También verificar si tiene el permiso configuracion_empresa (permiso del frontend)
    if (!hasPermission) {
      const configuracionPermission = await prisma.userPermission.findFirst({
        where: {
          userId: currentUser.id,
          permission: {
            name: 'configuracion_empresa'
          },
          isGranted: true
        }
      });
      
      if (!configuracionPermission && userCompany?.role) {
        const roleConfigPermission = userCompany.role.permissions?.find(
          rp => rp.permission.name === 'configuracion_empresa' && rp.isGranted
        );
        hasPermission = !!roleConfigPermission;
      } else {
        hasPermission = !!configuracionPermission;
      }
    }

    console.log('🔍 [API] Resultado de verificación de permisos:', {
      hasPermission,
      isSuperAdmin: currentUser.role === 'SUPERADMIN',
      rolePermissionsFound: userCompany?.role?.permissions?.filter(
        rp => (rp.permission.name === 'company.settings' || rp.permission.name === 'company.edit' || rp.permission.name === 'configuracion_empresa') && rp.isGranted
      ).length || 0
    });

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'No tienes permisos para editar empresas' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    console.log('🔍 [API] Datos recibidos para actualizar empresa:', {
      companyId,
      body,
      nameProvided: body.name !== undefined,
      nameValue: body.name
    });
    
    // Verificar que la empresa existe
    const existingCompany = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!existingCompany) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar empresa
    const updateData: any = {};
    
    // Siempre actualizar el nombre si se proporciona
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    
    // Actualizar otros campos si se proporcionan
    if (body.cuit !== undefined) updateData.cuit = body.cuit;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.website !== undefined) updateData.website = body.website;
    // Obtener los logos anteriores si se están actualizando
    let oldLogo: string | null = null;
    let oldLogoDark: string | null = null;
    let oldLogoLight: string | null = null;
    
    if (body.logo !== undefined || body.logoDark !== undefined || body.logoLight !== undefined) {
      // Usar SQL directo para obtener los logos anteriores (evita problemas con Prisma Client no regenerado)
      try {
        const currentCompany = await prisma.company.findUnique({
          where: { id: companyId },
          select: { logo: true }
        });
        oldLogo = currentCompany?.logo || null;
        
        // Obtener logoDark y logoLight usando SQL directo
        const logosResult = await prisma.$queryRaw<Array<{ logoDark: string | null; logoLight: string | null }>>`
          SELECT "logoDark", "logoLight" FROM "Company" WHERE id = ${companyId}
        `;
        if (logosResult && logosResult.length > 0) {
          oldLogoDark = logosResult[0].logoDark;
          oldLogoLight = logosResult[0].logoLight;
        }
      } catch (error: any) {
        // Si falla, intentar obtener solo logo
        const currentCompany = await prisma.company.findUnique({
          where: { id: companyId },
          select: { logo: true }
        });
        oldLogo = currentCompany?.logo || null;
      }
    }
    
    if (body.logo !== undefined) {
      updateData.logo = body.logo;
    }
    
    // Separar campos normales de logoDark y logoLight (usaremos SQL directo para estos)
    const logoDarkValue = body.logoDark;
    const logoLightValue = body.logoLight;
    const hasLogoFields = logoDarkValue !== undefined || logoLightValue !== undefined;
    
    console.log('🔍 [API] Datos a actualizar:', {
      regularFields: updateData,
      logoDark: logoDarkValue,
      logoLight: logoLightValue
    });
    
    // Verificar que hay algo que actualizar
    if (Object.keys(updateData).length === 0 && !hasLogoFields) {
      return NextResponse.json(
        { error: 'No hay datos para actualizar' },
        { status: 400 }
      );
    }
    
    let updatedCompany;
    
    // Si hay campos de logo especiales, actualizarlos con SQL directo
    if (hasLogoFields) {
      // Actualizar campos regulares primero (si hay)
      if (Object.keys(updateData).length > 0) {
        updatedCompany = await prisma.company.update({
          where: { id: companyId },
          data: updateData
        });
      } else {
        updatedCompany = await prisma.company.findUnique({
          where: { id: companyId }
        });
      }
      
      // Actualizar logoDark y logoLight con SQL directo
      if (logoDarkValue !== undefined && logoLightValue !== undefined) {
        await prisma.$executeRaw`
          UPDATE "Company" 
          SET "logoDark" = ${logoDarkValue}, "logoLight" = ${logoLightValue}
          WHERE id = ${companyId}
        `;
      } else if (logoDarkValue !== undefined) {
        await prisma.$executeRaw`
          UPDATE "Company" 
          SET "logoDark" = ${logoDarkValue}
          WHERE id = ${companyId}
        `;
      } else if (logoLightValue !== undefined) {
        await prisma.$executeRaw`
          UPDATE "Company" 
          SET "logoLight" = ${logoLightValue}
          WHERE id = ${companyId}
        `;
      }
      
      // Obtener la empresa actualizada con logoDark y logoLight usando SQL directo
      const companyWithLogos = await prisma.$queryRaw<Array<{
        id: number;
        name: string;
        cuit: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        logo: string | null;
        logoDark: string | null;
        logoLight: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>>`
        SELECT id, name, cuit, address, phone, email, website, logo, "logoDark", "logoLight", "createdAt", "updatedAt"
        FROM "Company"
        WHERE id = ${companyId}
      `;
      
      if (companyWithLogos && companyWithLogos.length > 0) {
        updatedCompany = companyWithLogos[0] as any;
      } else {
        updatedCompany = await prisma.company.findUnique({
          where: { id: companyId }
        });
      }
    } else {
      // Actualización normal sin campos de logo especiales
      updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: updateData
      });
    }
    
    // Eliminar logos anteriores de S3 si se eliminaron o reemplazaron
    const { deleteS3File } = await import('@/lib/s3-utils');
    
    if (oldLogo && body.logo !== undefined) {
      const isDeleting = body.logo === null || body.logo === '';
      const isReplacing = !isDeleting && body.logo !== oldLogo;
      
      if (isDeleting || isReplacing) {
        try {
          await deleteS3File(oldLogo);
          console.log(`✅ Logo anterior eliminado de S3: ${oldLogo}`);
        } catch (error) {
          console.error('⚠️ Error eliminando logo anterior de S3:', error);
        }
      }
    }
    
    if (oldLogoDark && body.logoDark !== undefined) {
      const isDeleting = body.logoDark === null || body.logoDark === '';
      const isReplacing = !isDeleting && body.logoDark !== oldLogoDark;
      
      if (isDeleting || isReplacing) {
        try {
          await deleteS3File(oldLogoDark);
          console.log(`✅ Logo dark anterior eliminado de S3: ${oldLogoDark}`);
        } catch (error) {
          console.error('⚠️ Error eliminando logo dark anterior de S3:', error);
        }
      }
    }
    
    if (oldLogoLight && body.logoLight !== undefined) {
      const isDeleting = body.logoLight === null || body.logoLight === '';
      const isReplacing = !isDeleting && body.logoLight !== oldLogoLight;
      
      if (isDeleting || isReplacing) {
        try {
          await deleteS3File(oldLogoLight);
          console.log(`✅ Logo light anterior eliminado de S3: ${oldLogoLight}`);
        } catch (error) {
          console.error('⚠️ Error eliminando logo light anterior de S3:', error);
        }
      }
    }

    console.log('✅ Empresa actualizada:', {
      id: updatedCompany.id,
      name: updatedCompany.name,
      cuit: updatedCompany.cuit,
      address: updatedCompany.address
    });
    return NextResponse.json(updatedCompany, { status: 200 });
  } catch (error: any) {
    console.error('Error al actualizar empresa:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Si el error es por CUIT duplicado
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya existe una empresa con ese CUIT' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: `Error al actualizar la empresa: ${error.message || 'Error desconocido'}` },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/companies/[id] - Eliminar empresa
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = parseInt(params.id);
    
    if (isNaN(companyId)) {
      return NextResponse.json(
        { error: 'ID de empresa inválido' },
        { status: 400 }
      );
    }

    // Obtener usuario autenticado
    const currentUser = await getUserFromToken();
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Solo SUPERADMIN puede eliminar empresas
    if (currentUser.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: 'Solo los superadministradores pueden eliminar empresas' },
        { status: 403 }
      );
    }

    // Verificar que la empresa existe
    const existingCompany = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!existingCompany) {
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }

    // Eliminar logos de S3 si existen
    const { deleteS3File } = await import('@/lib/s3-utils');
    
    if (existingCompany.logo) {
      try {
        await deleteS3File(existingCompany.logo);
        console.log(`✅ Logo de empresa eliminado de S3: ${existingCompany.logo}`);
      } catch (error) {
        console.error('⚠️ Error eliminando logo de empresa de S3:', error);
      }
    }
    
    if ((existingCompany as any).logoDark) {
      try {
        await deleteS3File((existingCompany as any).logoDark);
        console.log(`✅ Logo dark de empresa eliminado de S3: ${(existingCompany as any).logoDark}`);
      } catch (error) {
        console.error('⚠️ Error eliminando logo dark de empresa de S3:', error);
      }
    }
    
    if ((existingCompany as any).logoLight) {
      try {
        await deleteS3File((existingCompany as any).logoLight);
        console.log(`✅ Logo light de empresa eliminado de S3: ${(existingCompany as any).logoLight}`);
      } catch (error) {
        console.error('⚠️ Error eliminando logo light de empresa de S3:', error);
      }
    }

    // Eliminar empresa (Prisma manejará las relaciones en cascada)
    await prisma.company.delete({
      where: { id: companyId }
    });

    console.log('✅ Empresa eliminada:', existingCompany.name);
    return NextResponse.json(
      { message: 'Empresa eliminada correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error al eliminar empresa:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la empresa' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 