/**
 * Discord Components Helper
 *
 * Builders para botones, select menus y action rows
 * Usa imports dinámicos para evitar problemas con webpack
 *
 * IMPORTANTE: Discord limita a 5 botones por fila (ActionRow)
 * - Sectores: máximo 4 + 1 cancelar = 5
 * - Si hay más de 4 sectores, usar StringSelectMenu
 *
 * Última actualización: 2026-01-23
 */

// Cache del módulo discord.js
let discordModule: any = null

async function loadDiscordModule() {
  if (!discordModule) {
    // @ts-ignore - webpackIgnore es necesario para evitar bundling
    discordModule = await import(/* webpackIgnore: true */ 'discord.js')
  }
  return discordModule
}

// ============================================
// TIPOS
// ============================================

export interface ButtonConfig {
  customId: string
  label: string
  style: 'primary' | 'secondary' | 'success' | 'danger'
  emoji?: string
  disabled?: boolean
}

export interface SelectOption {
  label: string
  value: string
  description?: string
  emoji?: string
}

export interface SelectMenuConfig {
  customId: string
  placeholder: string
  options: SelectOption[]
  minValues?: number
  maxValues?: number
  disabled?: boolean
}

// ============================================
// BUTTON BUILDERS
// ============================================

/**
 * Crea un botón de Discord
 */
export async function createButton(config: ButtonConfig) {
  const discord = await loadDiscordModule()

  const styleMap: Record<string, number> = {
    primary: discord.ButtonStyle.Primary,
    secondary: discord.ButtonStyle.Secondary,
    success: discord.ButtonStyle.Success,
    danger: discord.ButtonStyle.Danger,
  }

  const button = new discord.ButtonBuilder()
    .setCustomId(config.customId)
    .setLabel(config.label)
    .setStyle(styleMap[config.style] || discord.ButtonStyle.Primary)

  if (config.emoji) {
    button.setEmoji(config.emoji)
  }

  if (config.disabled) {
    button.setDisabled(true)
  }

  return button
}

/**
 * Crea una fila de botones
 */
export async function createButtonRow(buttons: ButtonConfig[]) {
  const discord = await loadDiscordModule()

  const row = new discord.ActionRowBuilder()

  for (const config of buttons) {
    const button = await createButton(config)
    row.addComponents(button)
  }

  return row
}

// ============================================
// SELECT MENU BUILDERS
// ============================================

/**
 * Crea un select menu de strings
 */
export async function createSelectMenu(config: SelectMenuConfig) {
  const discord = await loadDiscordModule()

  const select = new discord.StringSelectMenuBuilder()
    .setCustomId(config.customId)
    .setPlaceholder(config.placeholder)
    .addOptions(
      config.options.map(opt => {
        const option: any = {
          label: opt.label.substring(0, 100), // Max 100 chars
          value: opt.value.substring(0, 100),
        }
        if (opt.description) {
          option.description = opt.description.substring(0, 100)
        }
        if (opt.emoji) {
          option.emoji = opt.emoji
        }
        return option
      })
    )

  if (config.minValues !== undefined) {
    select.setMinValues(config.minValues)
  }

  if (config.maxValues !== undefined) {
    select.setMaxValues(config.maxValues)
  }

  if (config.disabled) {
    select.setDisabled(true)
  }

  return new discord.ActionRowBuilder().addComponents(select)
}

// ============================================
// FAILURE FLOW COMPONENTS
// ============================================

/**
 * Botones para selección de sector
 */
export async function createSectorButtons(
  sectors: { id: number; name: string }[]
): Promise<any[]> {
  const rows: any[] = []
  const discord = await loadDiscordModule()

  console.log(`[DiscordComponents] createSectorButtons: ${sectors.length} sectores recibidos`)

  // Discord permite máximo 5 botones por fila
  // Usamos botones SOLO si hay <= 4 sectores (para dejar espacio al botón cancelar)
  // Si hay 5 o más sectores, usar select menu
  if (sectors.length <= 4) {
    console.log(`[DiscordComponents] Usando botones (${sectors.length} <= 4)`)
    const buttons: ButtonConfig[] = sectors.map((s, i) => ({
      customId: `sector_${s.id}`,
      label: s.name.substring(0, 80),
      style: 'primary',
      emoji: ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i],
    }))

    // Agregar botón cancelar (total máximo: 5 botones)
    buttons.push({
      customId: 'cancel_flow',
      label: 'Cancelar',
      style: 'secondary',
      emoji: '❌',
    })

    rows.push(await createButtonRow(buttons))
  } else {
    // Usar select menu para más de 4 sectores (5+)
    console.log(`[DiscordComponents] Usando select menu (${sectors.length} > 4)`)
    const options: SelectOption[] = sectors.map(s => ({
      label: s.name.substring(0, 100),
      value: `sector_${s.id}`,
      emoji: '🏭',
    }))

    rows.push(
      await createSelectMenu({
        customId: 'sector_select',
        placeholder: 'Selecciona un sector...',
        options,
      })
    )

    // Fila de cancelar
    rows.push(
      await createButtonRow([
        {
          customId: 'cancel_flow',
          label: 'Cancelar',
          style: 'secondary',
          emoji: '❌',
        },
      ])
    )
  }

  return rows
}

/**
 * Select menu para clarificación de máquina
 */
export async function createMachineSelectMenu(
  machines: { id: number; name: string; nickname?: string | null }[],
  maxOptions: number = 25 // Discord limit
): Promise<any[]> {
  const rows: any[] = []

  // Limitar opciones (Discord permite máx 25)
  const limitedMachines = machines.slice(0, maxOptions)

  const options: SelectOption[] = limitedMachines.map(m => ({
    label: m.nickname || m.name,
    value: `machine_${m.id}`,
    description: m.nickname ? m.name : undefined,
    emoji: '⚙️',
  }))

  rows.push(
    await createSelectMenu({
      customId: 'machine_select',
      placeholder: '¿Qué máquina es?',
      options,
    })
  )

  // Botón cancelar
  rows.push(
    await createButtonRow([
      {
        customId: 'cancel_flow',
        label: 'Cancelar',
        style: 'secondary',
        emoji: '❌',
      },
    ])
  )

  return rows
}

/**
 * Botones post-falla (después de crear la falla)
 */
export async function createPostFailureButtons(failureId: number): Promise<any> {
  return createButtonRow([
    {
      customId: `resolve_${failureId}`,
      label: 'Ya la solucioné',
      style: 'success',
      emoji: '✅',
    },
    {
      customId: `create_ot_${failureId}`,
      label: 'Crear OT',
      style: 'primary',
      emoji: '🔧',
    },
    {
      customId: `done_${failureId}`,
      label: 'Listo',
      style: 'secondary',
      emoji: '👍',
    },
  ])
}

// Tipo extendido para técnicos
interface TechnicianOption {
  id: number
  name: string
  pendingOTs?: number
  machineHistory?: number
  isAvailable?: boolean
}

/**
 * Select menu para técnicos
 */
export async function createTechnicianSelectMenu(
  technicians: TechnicianOption[],
  failureId: number,
  prefix: string = 'tech' // Prefijo para diferenciar OT desde falla vs OT directa
): Promise<any[]> {
  const rows: any[] = []
  const selectCustomId = prefix === 'ot_direct' ? 'ot_direct_tech_select' : 'technician_select'

  if (technicians.length === 0) {
    // Si no hay técnicos, solo mostrar botón de crear sin asignar
    rows.push(
      await createButtonRow([
        {
          customId: prefix === 'ot_direct' ? 'ot_direct_no_assign' : `ot_no_assign_${failureId}`,
          label: 'Crear sin asignar',
          style: 'primary',
          emoji: '📝',
        },
        {
          customId: 'cancel_ot',
          label: 'Cancelar',
          style: 'secondary',
          emoji: '❌',
        },
      ])
    )
    return rows
  }

  // Limitar a 24 opciones (+ 1 para "sin asignar")
  const limitedTechs = technicians.slice(0, 24)

  const options: SelectOption[] = [
    {
      label: 'Sin asignar',
      value: prefix === 'ot_direct' ? 'ot_direct_none' : `tech_none_${failureId}`,
      description: 'Crear OT sin asignar técnico',
      emoji: '📝',
    },
    ...limitedTechs.map((t, index) => {
      // Construir descripción con toda la info
      const descParts: string[] = []
      if (t.pendingOTs !== undefined) {
        descParts.push(`${t.pendingOTs} OT${t.pendingOTs !== 1 ? 's' : ''} pend.`)
      }
      if (t.machineHistory && t.machineHistory > 0) {
        descParts.push(`${t.machineHistory} trab. previos`)
      }
      if (t.isAvailable === false) {
        descParts.push('No disponible')
      }

      // Emoji según estado
      let emoji = '👷'
      if (index === 0 && t.machineHistory && t.machineHistory > 0 && t.isAvailable !== false) {
        emoji = '⭐' // Recomendado
      } else if (t.isAvailable === false) {
        emoji = '🔴'
      }

      return {
        label: t.name.substring(0, 100),
        value: prefix === 'ot_direct' ? `ot_direct_${t.id}` : `tech_${t.id}_${failureId}`,
        description: descParts.length > 0 ? descParts.join(' | ').substring(0, 100) : undefined,
        emoji,
      }
    }),
  ]

  rows.push(
    await createSelectMenu({
      customId: selectCustomId,
      placeholder: '¿A quién asignar la OT?',
      options,
    })
  )

  rows.push(
    await createButtonRow([
      {
        customId: 'cancel_ot',
        label: 'Cancelar',
        style: 'secondary',
        emoji: '❌',
      },
    ])
  )

  return rows
}

/**
 * Botón de reintento
 */
export async function createRetryButton(action: string): Promise<any> {
  return createButtonRow([
    {
      customId: `retry_${action}`,
      label: 'Reintentar',
      style: 'primary',
      emoji: '🔄',
    },
    {
      customId: 'cancel_flow',
      label: 'Cancelar',
      style: 'secondary',
      emoji: '❌',
    },
  ])
}

/**
 * Deshabilita todos los componentes en un mensaje
 * Útil después de que el usuario hizo una selección
 */
export async function disableAllComponents(components: any[]): Promise<any[]> {
  const discord = await loadDiscordModule()
  const disabled: any[] = []

  for (const row of components) {
    const newRow = new discord.ActionRowBuilder()
    for (const component of row.components) {
      if (component.data?.type === 2) {
        // Button
        const btn = new discord.ButtonBuilder()
          .setCustomId(component.data.custom_id)
          .setLabel(component.data.label)
          .setStyle(component.data.style)
          .setDisabled(true)
        if (component.data.emoji) {
          btn.setEmoji(component.data.emoji)
        }
        newRow.addComponents(btn)
      } else if (component.data?.type === 3) {
        // Select menu
        const select = new discord.StringSelectMenuBuilder()
          .setCustomId(component.data.custom_id)
          .setPlaceholder(component.data.placeholder || 'Seleccionado')
          .setDisabled(true)
          .addOptions([{ label: 'Seleccionado', value: 'selected' }])
        newRow.addComponents(select)
      }
    }
    disabled.push(newRow)
  }

  return disabled
}

// ============================================
// PARSING HELPERS
// ============================================

/**
 * Extrae el ID de un customId de botón/select
 * Ej: "sector_5" → 5, "machine_123" → 123
 */
export function parseCustomId(customId: string): {
  action: string
  id?: number
  extra?: string
} {
  const parts = customId.split('_')
  const action = parts[0]

  if (parts.length === 1) {
    return { action }
  }

  const idPart = parts[1]
  const id = parseInt(idPart, 10)

  if (isNaN(id)) {
    return { action, extra: parts.slice(1).join('_') }
  }

  if (parts.length > 2) {
    return { action, id, extra: parts.slice(2).join('_') }
  }

  return { action, id }
}
