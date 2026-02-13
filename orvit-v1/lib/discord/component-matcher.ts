/**
 * Component Matcher - Identificación de Componentes por Nombre
 *
 * Busca coincidencias entre el componente mencionado por el usuario
 * y los componentes registrados de una máquina específica.
 */

import { prisma } from '@/lib/prisma'

export interface ComponentInfo {
  id: number
  name: string
  code?: string | null
  type?: string | null
  parentId?: number | null
  parentName?: string | null
  machineId: number
}

export interface ComponentMatch extends ComponentInfo {
  similarity: number
  matchType: 'exact' | 'partial' | 'number' | 'fuzzy'
  isSubcomponent: boolean
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
 */
function extractNumbers(str: string): string[] {
  const matches = str.match(/\d+/g) || []
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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
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
 * Busca componentes que coincidan con el identificador
 */
export function findMatchingComponents(
  identifier: string,
  components: ComponentInfo[]
): ComponentMatch[] {
  const normalizedId = normalize(identifier)
  const idNumbers = extractNumbers(identifier)
  const matches: ComponentMatch[] = []

  for (const component of components) {
    const normalizedName = normalize(component.name)
    const normalizedCode = component.code ? normalize(component.code) : null
    const componentNumbers = extractNumbers(component.name)
    const codeNumbers = component.code ? extractNumbers(component.code) : []

    let bestMatch: { similarity: number; matchType: ComponentMatch['matchType'] } | null = null

    // 1. Coincidencia exacta
    if (normalizedName === normalizedId || normalizedCode === normalizedId) {
      bestMatch = { similarity: 1, matchType: 'exact' }
    }

    // 2. Coincidencia parcial (contiene)
    if (!bestMatch) {
      if (normalizedName.includes(normalizedId) || normalizedId.includes(normalizedName)) {
        const sim =
          Math.max(normalizedId.length, normalizedName.length) > 0
            ? Math.min(normalizedId.length, normalizedName.length) /
              Math.max(normalizedId.length, normalizedName.length)
            : 0
        bestMatch = { similarity: 0.7 + sim * 0.2, matchType: 'partial' }
      }
      if (
        normalizedCode &&
        (normalizedCode.includes(normalizedId) || normalizedId.includes(normalizedCode))
      ) {
        const sim =
          Math.min(normalizedId.length, normalizedCode.length) /
          Math.max(normalizedId.length, normalizedCode.length)
        const newSim = 0.7 + sim * 0.2
        if (!bestMatch || newSim > bestMatch.similarity) {
          bestMatch = { similarity: newSim, matchType: 'partial' }
        }
      }
    }

    // 3. Coincidencia por número
    if (!bestMatch && idNumbers.length > 0) {
      const allComponentNumbers = [...componentNumbers, ...codeNumbers]
      const numberMatch = idNumbers.some(n => allComponentNumbers.includes(n))
      if (numberMatch) {
        const sim = idNumbers.length === 1 && allComponentNumbers.length === 1 ? 0.85 : 0.7
        bestMatch = { similarity: sim, matchType: 'number' }
      }
    }

    // 4. Coincidencia fuzzy (Levenshtein)
    if (!bestMatch) {
      const nameSim = calculateSimilarity(identifier, component.name)
      const codeSim = component.code ? calculateSimilarity(identifier, component.code) : 0
      const maxSim = Math.max(nameSim, codeSim)

      if (maxSim >= 0.6) {
        bestMatch = { similarity: maxSim, matchType: 'fuzzy' }
      }
    }

    if (bestMatch) {
      matches.push({
        ...component,
        similarity: bestMatch.similarity,
        matchType: bestMatch.matchType,
        isSubcomponent: component.parentId !== null,
      })
    }
  }

  // Ordenar por similitud descendente
  matches.sort((a, b) => b.similarity - a.similarity)

  return matches
}

/**
 * Busca la mejor coincidencia única
 */
export function findBestComponentMatch(
  identifier: string,
  components: ComponentInfo[],
  minSimilarity: number = 0.75
): ComponentMatch | null {
  const matches = findMatchingComponents(identifier, components)

  if (matches.length === 0) {
    return null
  }

  const best = matches[0]
  if (best.similarity >= minSimilarity) {
    if (matches.length === 1) {
      return best
    }

    const second = matches[1]
    if (best.similarity - second.similarity > 0.15) {
      return best
    }

    if (best.matchType === 'exact' && second.matchType !== 'exact') {
      return best
    }
  }

  return null
}

/**
 * Obtiene los componentes de una máquina con su jerarquía
 */
export async function getComponentsForMachine(machineId: number): Promise<ComponentInfo[]> {
  const components = await prisma.component.findMany({
    where: { machineId },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      parentId: true,
      machineId: true,
      parent: {
        select: { name: true },
      },
    },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
  })

  return components.map(c => ({
    id: c.id,
    name: c.name,
    code: c.code,
    type: c.type,
    parentId: c.parentId,
    parentName: c.parent?.name || null,
    machineId: c.machineId,
  }))
}

/**
 * Busca un componente para una falla
 * Retorna el componente encontrado o null si no hay coincidencia clara
 */
export async function findComponentForFailure(
  identifier: string | null | undefined,
  machineId: number
): Promise<{
  found: boolean
  component?: ComponentMatch
  alternatives?: ComponentMatch[]
}> {
  if (!identifier || identifier.trim() === '') {
    return { found: false }
  }

  const components = await getComponentsForMachine(machineId)

  if (components.length === 0) {
    return { found: false }
  }

  const bestMatch = findBestComponentMatch(identifier, components)

  if (bestMatch) {
    return { found: true, component: bestMatch }
  }

  // Si no hay coincidencia clara, retornar alternativas
  const matches = findMatchingComponents(identifier, components)

  if (matches.length > 0) {
    return {
      found: false,
      alternatives: matches.slice(0, 5),
    }
  }

  return { found: false }
}

/**
 * Formatea la lista de componentes para mostrar al usuario
 */
export function formatComponentList(components: ComponentInfo[]): string {
  if (components.length === 0) {
    return 'No hay componentes registrados'
  }

  // Agrupar por padre
  const rootComponents = components.filter(c => !c.parentId)
  const childComponents = components.filter(c => c.parentId)

  const lines: string[] = []

  for (const root of rootComponents) {
    lines.push(`- ${root.name}${root.code ? ` (${root.code})` : ''}`)

    // Buscar hijos de este componente
    const children = childComponents.filter(c => c.parentId === root.id)
    for (const child of children) {
      lines.push(`  - ${child.name}${child.code ? ` (${child.code})` : ''}`)
    }
  }

  // Agregar huérfanos (hijos cuyo padre no está en la lista)
  const parentIds = rootComponents.map(c => c.id)
  const orphans = childComponents.filter(c => !parentIds.includes(c.parentId!))
  for (const orphan of orphans) {
    lines.push(`- ${orphan.parentName ? `${orphan.parentName} > ` : ''}${orphan.name}`)
  }

  return lines.join('\n')
}
