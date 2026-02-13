// ============================================
// Autenticación para el Asistente IA
// ============================================

import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { AssistantContext } from './types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'tu-clave-secreta-super-segura'
)

/**
 * Obtiene el contexto del usuario para el asistente
 */
export async function getAssistantContext(): Promise<AssistantContext | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token) {
      return null
    }

    // Verificar JWT
    const { payload } = await jwtVerify(token, JWT_SECRET)

    // Buscar usuario en BD
    const user = await prisma.user.findUnique({
      where: { id: payload.userId as number },
      include: {
        companies: {
          include: {
            company: true,
            role: true,
          },
        },
        ownedCompanies: true,
      },
    })

    if (!user) {
      return null
    }

    // Obtener companyId
    let companyId: number = 1
    if (user.ownedCompanies && user.ownedCompanies.length > 0) {
      companyId = user.ownedCompanies[0].id
    } else if (user.companies && user.companies.length > 0) {
      companyId = user.companies[0].company.id
    }

    // Obtener rol
    let userRole = 'user'
    if (user.role === 'SUPERADMIN' || user.role === 'ADMIN' || user.role === 'ADMIN_ENTERPRISE') {
      userRole = 'manager'
    } else if (user.companies && user.companies.length > 0) {
      const roleName = user.companies[0].role?.name?.toLowerCase() || ''
      if (roleName.includes('supervisor')) {
        userRole = 'supervisor'
      } else if (roleName.includes('tecnico') || roleName.includes('técnico')) {
        userRole = 'technician'
      } else if (roleName.includes('ingeniero') || roleName.includes('engineer')) {
        userRole = 'engineer'
      }
    }

    return {
      userId: user.id,
      companyId,
      userRole,
    }
  } catch (error) {
    console.error('Error getting assistant context:', error)
    return null
  }
}

/**
 * Verifica si el usuario tiene acceso al asistente
 */
export async function hasAssistantAccess(): Promise<boolean> {
  const context = await getAssistantContext()
  if (!context) return false

  // Por ahora, todos los usuarios autenticados tienen acceso
  // Después se puede agregar lógica de permisos específicos
  return true
}
