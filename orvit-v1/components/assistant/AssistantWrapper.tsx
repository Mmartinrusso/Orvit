'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AssistantChat } from './AssistantChat'

/**
 * Wrapper que solo muestra el AssistantChat si el usuario está autenticado
 */
export function AssistantWrapper() {
  const { user, isLoading } = useAuth()

  // No mostrar si está cargando o no hay usuario
  if (isLoading || !user) {
    return null
  }

  return <AssistantChat />
}
