import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import QRCode from 'qrcode'
import { requireAuth } from '@/lib/auth/shared-helpers'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

/**
 * GET /api/machines/[id]/qr
 * Genera el código QR para una máquina
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const machineId = parseInt(params.id)
    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'Invalid machine ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'dataurl' // dataurl, svg, png
    const size = parseInt(searchParams.get('size') || '200')

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: {
        id: true,
        name: true,
        assetCode: true,
        slug: true,
        companyId: true,
        company: { select: { id: true, name: true } }
      }
    })

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    // Generar código único para el QR (usando slug o id)
    const qrCode = machine.slug || `machine-${machine.id}`

    // URL que el QR debe abrir
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orvit.com'
    const qrUrl = `${baseUrl}/qr/${qrCode}`

    if (format === 'svg') {
      const svg = await QRCode.toString(qrUrl, {
        type: 'svg',
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })

      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600'
        }
      })
    }

    if (format === 'png') {
      const buffer = await QRCode.toBuffer(qrUrl, {
        type: 'png',
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600'
        }
      })
    }

    // Default: dataurl
    const dataUrl = await QRCode.toDataURL(qrUrl, {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })

    return NextResponse.json({
      machine: {
        id: machine.id,
        name: machine.name,
        assetCode: machine.assetCode,
        company: machine.company.name
      },
      qr: {
        code: qrCode,
        url: qrUrl,
        dataUrl,
        size
      }
    })
  } catch (error) {
    console.error('Error generating QR:', error)
    return NextResponse.json(
      { error: 'Error generating QR code' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/machines/[id]/qr
 * Genera o actualiza el slug/código QR de una máquina
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { user, error: authError } = await requireAuth()
    if (authError) return authError

    const machineId = parseInt(params.id)
    if (isNaN(machineId)) {
      return NextResponse.json({ error: 'Invalid machine ID' }, { status: 400 })
    }

    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { id: true, name: true, companyId: true, slug: true }
    })

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }

    const body = await request.json()
    const { customSlug } = body

    // Generar slug si no hay uno personalizado
    let slug = customSlug
    if (!slug) {
      // Crear slug único basado en nombre y timestamp
      const baseSlug = machine.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const timestamp = Date.now().toString(36)
      slug = `${baseSlug}-${timestamp}`
    }

    // Verificar que el slug no exista
    const existing = await prisma.machine.findFirst({
      where: {
        slug,
        id: { not: machineId }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Este código QR ya está en uso' },
        { status: 400 }
      )
    }

    const updated = await prisma.machine.update({
      where: { id: machineId },
      data: { slug },
      select: { id: true, name: true, slug: true }
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.orvit.com'

    return NextResponse.json({
      success: true,
      machine: updated,
      qrUrl: `${baseUrl}/qr/${updated.slug}`
    })
  } catch (error) {
    console.error('Error updating QR slug:', error)
    return NextResponse.json(
      { error: 'Error updating QR code' },
      { status: 500 }
    )
  }
}
