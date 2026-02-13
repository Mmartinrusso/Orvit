// Función para traducir etiquetas de manera consistente
export function translateTag(tag: string): string {
  const translations: { [key: string]: string } = {
    'DONE': 'Realizada',
    'TODO': 'Pendiente',
    'IN_PROGRESS': 'En Curso',
    'PENDING': 'Pendiente',
    'COMPLETED': 'Completada',
    'CANCELLED': 'Cancelada'
  };
  return translations[tag] || tag;
}

// Función para obtener el color de la etiqueta
export function getTagColor(tag: string): string {
  const normalizedTag = tag.toUpperCase();
  switch (normalizedTag) {
    case 'DONE':
    case 'COMPLETED':
    case 'REALIZADA':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'TODO':
    case 'PENDING':
    case 'PENDIENTE':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    case 'IN_PROGRESS':
    case 'EN_CURSO':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Función para verificar si una etiqueta indica completado
export function isCompletedTag(tag: string): boolean {
  const normalizedTag = tag.toUpperCase();
  return ['DONE', 'COMPLETED', 'REALIZADA'].includes(normalizedTag);
} 