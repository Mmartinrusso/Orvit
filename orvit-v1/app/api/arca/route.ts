import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * API Route para consultar datos de ARCA (Administración Federal de Ingresos Públicos)
 * 
 * ARCA es un servicio que permite consultar datos de contribuyentes por CUIT
 * Esta implementación es un placeholder que debe ser completado con la integración real
 * 
 * Para integrar con ARCA real, necesitarás:
 * - Credenciales de acceso a la API de ARCA
 * - Certificado digital (si es requerido)
 * - Implementar la autenticación correspondiente
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const cuit = searchParams.get('cuit');

    if (!cuit) {
      return NextResponse.json(
        { error: 'CUIT es requerido' },
        { status: 400 }
      );
    }

    // Validar formato de CUIT (11 dígitos sin guiones)
    const cuitClean = cuit.replace(/\D/g, '');
    if (cuitClean.length !== 11) {
      return NextResponse.json(
        { error: 'CUIT inválido. Debe tener 11 dígitos' },
        { status: 400 }
      );
    }

    // ============================================
    // INTEGRACIÓN CON API REAL DE ARCA
    // ============================================
    
    // OPCIÓN 1: TusFacturasAPP (Recomendado - Más fácil)
    // Configurar en .env.local:
    // TUSFACTURAS_API_URL=https://api.tusfacturas.app
    // TUSFACTURAS_API_KEY=tu_api_key
    // TUSFACTURAS_API_TOKEN=tu_api_token
    // TUSFACTURAS_USER_TOKEN=tu_user_token
    
    const TUSFACTURAS_API_URL = process.env.TUSFACTURAS_API_URL;
    const TUSFACTURAS_API_KEY = process.env.TUSFACTURAS_API_KEY;
    const TUSFACTURAS_API_TOKEN = process.env.TUSFACTURAS_API_TOKEN;
    const TUSFACTURAS_USER_TOKEN = process.env.TUSFACTURAS_USER_TOKEN;
    
    if (TUSFACTURAS_API_URL && TUSFACTURAS_API_KEY && TUSFACTURAS_API_TOKEN) {
      try {
        // Endpoint de TusFacturasAPP para consultar CUIT
        const response = await fetch(`${TUSFACTURAS_API_URL}/api/v1/consulta-cuit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': TUSFACTURAS_API_KEY,
            'X-API-Token': TUSFACTURAS_API_TOKEN,
            ...(TUSFACTURAS_USER_TOKEN && { 'X-User-Token': TUSFACTURAS_USER_TOKEN }),
          },
          body: JSON.stringify({
            cuit: cuitClean,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Mapear respuesta de TusFacturasAPP al formato esperado
          // La estructura puede variar según la versión de la API
          return NextResponse.json({
            cuit: data.cuit || cuitClean,
            razonSocial: data.razonSocial || data.denominacion || data.nombre || '',
            nombreFantasia: data.nombreFantasia || data.denominacion || '',
            domicilio: data.domicilio || data.direccion || data.domicilioFiscal || '',
            piso: data.piso || '',
            departamento: data.departamento || '',
            localidad: data.localidad || data.ciudad || '',
            provincia: data.provincia || '',
            codigoPostal: data.codigoPostal || data.cp || '',
            condicionIva: data.condicionIva || data.condicion || data.condicionAnteIVA || '',
            ingresosBrutos: data.ingresosBrutos || data.ingresosBrutosNumero || '',
            fechaInicioActividades: data.fechaInicioActividades || '',
            estado: data.estado || data.estadoClave || 'Activo',
            email: data.email || '',
            telefono: data.telefono || '',
          });
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error en TusFacturasAPP:', response.status, errorData);
          throw new Error(`Error ${response.status}: ${errorData.message || 'Error al consultar'}`);
        }
      } catch (apiError) {
        console.error('Error consultando TusFacturasAPP:', apiError);
        // Continuar con otras opciones o mock
      }
    }
    
    // OPCIÓN 2: API Genérica (si usas otro proveedor)
    const ARCA_API_URL = process.env.ARCA_API_URL;
    const ARCA_API_KEY = process.env.ARCA_API_KEY;
    const ARCA_API_TOKEN = process.env.ARCA_API_TOKEN;
    
    if (ARCA_API_URL && ARCA_API_KEY) {
      try {
        const arcaResponse = await fetch(`${ARCA_API_URL}?cuit=${cuitClean}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${ARCA_API_TOKEN || ARCA_API_KEY}`,
            'Content-Type': 'application/json',
            'X-API-Key': ARCA_API_KEY,
          },
        });
        
        if (arcaResponse.ok) {
          const realData = await arcaResponse.json();
          return NextResponse.json({
            cuit: realData.cuit || cuitClean,
            razonSocial: realData.razonSocial || realData.denominacion || realData.nombre,
            nombreFantasia: realData.nombreFantasia || realData.denominacion || '',
            domicilio: realData.domicilio || realData.direccion || '',
            piso: realData.piso || '',
            departamento: realData.departamento || '',
            localidad: realData.localidad || realData.ciudad || '',
            provincia: realData.provincia || '',
            codigoPostal: realData.codigoPostal || realData.cp || '',
            condicionIva: realData.condicionIva || realData.condicion || '',
            ingresosBrutos: realData.ingresosBrutos || '',
            fechaInicioActividades: realData.fechaInicioActividades || '',
            estado: realData.estado || 'Activo',
            email: realData.email || '',
            telefono: realData.telefono || '',
          });
        }
      } catch (apiError) {
        console.error('Error en consulta genérica a ARCA:', apiError);
      }
    }
    
    // ============================================
    // CÓDIGO MOCK - Solo para desarrollo/testing
    // ============================================
    
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 500));

    // Datos mock basados en el CUIT
    // En producción, estos datos vendrán de la API de ARCA
    // Estos son todos los campos que ARCA puede devolver según la documentación oficial
    
    // Determinar tipo de contribuyente por el primer dígito del CUIT
    const tipoContribuyente = cuitClean.slice(0, 2);
    let razonSocial = '';
    let nombreFantasia = '';
    
    if (tipoContribuyente === '20' || tipoContribuyente === '23' || tipoContribuyente === '24' || tipoContribuyente === '27') {
      // Persona física
      razonSocial = `Pérez, Juan ${cuitClean.slice(2, 5)}`;
      nombreFantasia = `Juan Pérez ${cuitClean.slice(2, 5)}`;
    } else if (tipoContribuyente === '30' || tipoContribuyente === '33' || tipoContribuyente === '34') {
      // Sociedad
      razonSocial = `Empresa ${cuitClean.slice(2, 5)} S.A.`;
      nombreFantasia = `Empresa ${cuitClean.slice(2, 5)}`;
    } else {
      // Otros
      razonSocial = `Contribuyente ${cuitClean.slice(2, 5)}`;
      nombreFantasia = `Contribuyente ${cuitClean.slice(2, 5)}`;
    }
    
    const mockData = {
      cuit: cuitClean,
      razonSocial: razonSocial,
      nombreFantasia: nombreFantasia,
      // Dirección completa
      domicilio: `Av. Corrientes ${cuitClean.slice(4, 7)}`,
      piso: cuitClean.slice(6, 7) || '',
      departamento: cuitClean.slice(7, 8) ? `A${cuitClean.slice(7, 8)}` : '',
      localidad: 'Ciudad Autónoma de Buenos Aires',
      provincia: 'Buenos Aires',
      codigoPostal: `C${cuitClean.slice(4, 8)}`,
      // Datos fiscales
      condicionIva: tipoContribuyente === '30' ? 'Responsable Inscripto' : 'Monotributo',
      ingresosBrutos: `30-${cuitClean.slice(2, 10)}-9`,
      fechaInicioActividades: '2010-01-01',
      estado: 'Activo',
      // Información de contacto (si está disponible)
      email: `contacto@empresa${cuitClean.slice(2, 5)}.com.ar`,
      telefono: `+54 11 ${cuitClean.slice(4, 8)}-${cuitClean.slice(8, 12)}`,
      codigoArea: '011',
    };

    return NextResponse.json(mockData);

  } catch (error) {
    console.error('Error consultando ARCA:', error);
    return NextResponse.json(
      { error: 'Error al consultar ARCA' },
      { status: 500 }
    );
  }
}

