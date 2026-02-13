/**
 * Machine Matcher - Identificación de Máquinas por Nombre/Número
 *
 * Busca coincidencias entre el identificador mencionado por el usuario
 * y las máquinas disponibles en el sistema.
 */

import { prisma } from '@/lib/prisma'

export interface MachineInfo {
  id: number
  name: string
  nickname?: string | null
  aliases?: string[] | null // Múltiples nombres alternativos
  sectorId?: number | null
  sectorName?: string | null
}

export interface MachineMatch extends MachineInfo {
  similarity: number
  matchType: 'exact' | 'partial' | 'number' | 'fuzzy'
}

/**
 * Normaliza un string para comparación
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9]/g, ' ') // Reemplazar caracteres especiales por espacio
    .replace(/\s+/g, ' ') // Colapsar espacios múltiples
    .trim()
}

/**
 * Extrae números del identificador
 * "máquina 5" → ["5"]
 * "CNC-01" → ["01", "1"]
 * "prensa 2A" → ["2"]
 */
function extractNumbers(str: string): string[] {
  const matches = str.match(/\d+/g) || []
  // Agregar versiones sin ceros a la izquierda
  const withoutLeadingZeros = matches.map(n => String(parseInt(n, 10)))
  return [...new Set([...matches, ...withoutLeadingZeros])]
}

/**
 * Calcula la distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          matrix[i][j - 1] + 1, // inserción
          matrix[i - 1][j] + 1 // eliminación
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calcula similitud entre dos strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalize(str1)
  const s2 = normalize(str2)

  if (s1 === s2) return 1

  const maxLength = Math.max(s1.length, s2.length)
  if (maxLength === 0) return 1

  const distance = levenshteinDistance(s1, s2)
  return 1 - distance / maxLength
}

/**
 * Extrae posibles sectores del identificador
 */
function extractSectorFromIdentifier(identifier: string, machines: MachineInfo[]): string | null {
  const normalizedId = normalize(identifier)

  // Obtener lista única de sectores
  const sectors = [...new Set(machines.map(m => m.sectorName).filter(Boolean))] as string[]

  for (const sector of sectors) {
    const normalizedSector = normalize(sector)
    // Verificar si el identificador contiene el nombre del sector
    if (normalizedId.includes(normalizedSector) || normalizedSector.split(' ').some(word => word.length > 3 && normalizedId.includes(word))) {
      return sector
    }
  }

  return null
}

/**
 * Busca máquinas que coincidan con el identificador
 */
export function findMatchingMachines(identifier: string, machines: MachineInfo[]): MachineMatch[] {
  const normalizedId = normalize(identifier)
  const idNumbers = extractNumbers(identifier)
  const matches: MachineMatch[] = []

  // Detectar si mencionó un sector
  const mentionedSector = extractSectorFromIdentifier(identifier, machines)

  for (const machine of machines) {
    const normalizedName = normalize(machine.name)
    const normalizedNickname = machine.nickname ? normalize(machine.nickname) : null
    const normalizedAliases = (machine.aliases || []).map(a => normalize(a))
    const machineNumbers = extractNumbers(machine.name)
    const nicknameNumbers = machine.nickname ? extractNumbers(machine.nickname) : []
    const aliasNumbers = (machine.aliases || []).flatMap(a => extractNumbers(a))

    let bestMatch: { similarity: number; matchType: MachineMatch['matchType'] } | null = null

    // 1. Coincidencia exacta (nombre, apodo o alias)
    if (normalizedName === normalizedId || normalizedNickname === normalizedId) {
      bestMatch = { similarity: 1, matchType: 'exact' }
    }
    // Verificar aliases
    if (!bestMatch && normalizedAliases.some(alias => alias === normalizedId)) {
      bestMatch = { similarity: 1, matchType: 'exact' }
    }

    // 2. Coincidencia parcial (contiene)
    if (!bestMatch) {
      if (normalizedName.includes(normalizedId) || normalizedId.includes(normalizedName)) {
        const sim = Math.max(normalizedId.length, normalizedName.length) > 0
          ? Math.min(normalizedId.length, normalizedName.length) / Math.max(normalizedId.length, normalizedName.length)
          : 0
        bestMatch = { similarity: 0.7 + sim * 0.2, matchType: 'partial' }
      }
      if (normalizedNickname && (normalizedNickname.includes(normalizedId) || normalizedId.includes(normalizedNickname))) {
        const sim = Math.min(normalizedId.length, normalizedNickname.length) / Math.max(normalizedId.length, normalizedNickname.length)
        const newSim = 0.7 + sim * 0.2
        if (!bestMatch || newSim > bestMatch.similarity) {
          bestMatch = { similarity: newSim, matchType: 'partial' }
        }
      }
      // Verificar aliases para coincidencia parcial
      for (const alias of normalizedAliases) {
        if (alias.includes(normalizedId) || normalizedId.includes(alias)) {
          const sim = Math.min(normalizedId.length, alias.length) / Math.max(normalizedId.length, alias.length)
          const newSim = 0.7 + sim * 0.2
          if (!bestMatch || newSim > bestMatch.similarity) {
            bestMatch = { similarity: newSim, matchType: 'partial' }
          }
        }
      }
    }

    // 3. Coincidencia por número
    if (!bestMatch && idNumbers.length > 0) {
      const allMachineNumbers = [...machineNumbers, ...nicknameNumbers, ...aliasNumbers]
      const numberMatch = idNumbers.some(n => allMachineNumbers.includes(n))
      if (numberMatch) {
        // Dar más peso si solo hay un número y coincide
        const sim = idNumbers.length === 1 && allMachineNumbers.length === 1 ? 0.85 : 0.7
        bestMatch = { similarity: sim, matchType: 'number' }
      }
    }

    // 4. Coincidencia fuzzy (Levenshtein)
    if (!bestMatch) {
      const nameSim = calculateSimilarity(identifier, machine.name)
      const nickSim = machine.nickname ? calculateSimilarity(identifier, machine.nickname) : 0
      // Calcular similitud con aliases
      const aliasSims = (machine.aliases || []).map(a => calculateSimilarity(identifier, a))
      const maxSim = Math.max(nameSim, nickSim, ...aliasSims)

      if (maxSim >= 0.6) {
        bestMatch = { similarity: maxSim, matchType: 'fuzzy' }
      }
    }

    if (bestMatch) {
      // BOOST: Si mencionó un sector y la máquina está en ese sector, aumentar similitud
      let finalSimilarity = bestMatch.similarity
      if (mentionedSector && machine.sectorName === mentionedSector) {
        // Boost de 15% para máquinas del sector mencionado
        finalSimilarity = Math.min(1, bestMatch.similarity + 0.15)
        console.log(`[MachineMatcher] Boost por sector "${mentionedSector}" para "${machine.name}": ${bestMatch.similarity.toFixed(2)} → ${finalSimilarity.toFixed(2)}`)
      }
      // PENALIZACIÓN: Si mencionó un sector pero la máquina NO está en ese sector
      else if (mentionedSector && machine.sectorName && machine.sectorName !== mentionedSector) {
        // Penalización de 20% para máquinas de otro sector
        finalSimilarity = Math.max(0, bestMatch.similarity - 0.2)
      }

      matches.push({
        ...machine,
        similarity: finalSimilarity,
        matchType: bestMatch.matchType,
      })
    }
  }

  // Ordenar por similitud descendente
  matches.sort((a, b) => b.similarity - a.similarity)

  return matches
}

/**
 * Busca la mejor coincidencia única
 * Retorna null si no hay coincidencias o si hay ambigüedad
 */
export function findBestMatch(
  identifier: string,
  machines: MachineInfo[],
  minSimilarity: number = 0.8
): MachineMatch | null {
  const matches = findMatchingMachines(identifier, machines)

  if (matches.length === 0) {
    return null
  }

  // Si la mejor coincidencia tiene alta similitud y es significativamente mejor que la segunda
  const best = matches[0]
  if (best.similarity >= minSimilarity) {
    if (matches.length === 1) {
      return best
    }

    const second = matches[1]
    // Si hay una diferencia significativa (>0.15), aceptar la mejor
    if (best.similarity - second.similarity > 0.15) {
      return best
    }

    // Si ambas son exactas o muy similares, es ambiguo
    if (best.matchType === 'exact' && second.matchType !== 'exact') {
      return best
    }
  }

  return null
}

/**
 * Obtiene las máquinas disponibles para un usuario/empresa
 */
export async function getMachinesForUser(userId: number, companyId: number): Promise<MachineInfo[]> {
  // Obtener rol del usuario y sectores a los que tiene acceso
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      discordSectorAccess: {
        select: { sectorId: true },
      },
    },
  })

  if (!user) {
    return []
  }

  // Si es admin o superadmin, puede ver todas las máquinas de la empresa
  const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(user.role || '')

  const machineSelect = {
    id: true,
    name: true,
    nickname: true,
    aliases: true,
    sectorId: true,
    sector: { select: { name: true } },
  }

  let rawMachines
  if (isAdmin) {
    rawMachines = await prisma.machine.findMany({
      where: {
        sector: { companyId },
        status: 'ACTIVE',
      },
      select: machineSelect,
      orderBy: { name: 'asc' },
    })
  } else {
    // Usuario normal: máquinas de los sectores a los que tiene acceso
    const sectorIds = user.discordSectorAccess.map(a => a.sectorId)

    if (sectorIds.length === 0) {
      // Si no tiene acceso a ningún sector vía Discord, mostrar todas las de la empresa
      rawMachines = await prisma.machine.findMany({
        where: {
          sector: { companyId },
          status: 'ACTIVE',
        },
        select: machineSelect,
        orderBy: { name: 'asc' },
      })
    } else {
      rawMachines = await prisma.machine.findMany({
        where: {
          sectorId: { in: sectorIds },
          status: 'ACTIVE',
        },
        select: machineSelect,
        orderBy: { name: 'asc' },
      })
    }
  }

  // Mapear a MachineInfo con sector y aliases
  return rawMachines.map(m => ({
    id: m.id,
    name: m.name,
    nickname: m.nickname,
    aliases: Array.isArray(m.aliases) ? (m.aliases as string[]) : null,
    sectorId: m.sectorId,
    sectorName: m.sector?.name || null,
  }))
}

/**
 * Wrapper que combina búsqueda y obtención de máquinas
 */
export async function findMachineForFailure(
  identifier: string,
  userId: number,
  companyId: number
): Promise<{
  found: boolean
  machine?: MachineMatch
  alternatives?: MachineMatch[]
  allMachines?: MachineInfo[]
}> {
  const machines = await getMachinesForUser(userId, companyId)

  if (machines.length === 0) {
    return { found: false, allMachines: [] }
  }

  const bestMatch = findBestMatch(identifier, machines)

  if (bestMatch) {
    return { found: true, machine: bestMatch }
  }

  // Si no hay coincidencia clara, retornar alternativas
  const matches = findMatchingMachines(identifier, machines)

  if (matches.length > 0) {
    return {
      found: false,
      alternatives: matches.slice(0, 5),
      allMachines: machines,
    }
  }

  return {
    found: false,
    allMachines: machines,
  }
}
