---
name: "Mejora UI/UX"
description: "Mejora la interfaz de usuario, accesibilidad y experiencia general"
triggers:
  - "ui"
  - "ux"
  - "interfaz"
  - "diseño"
  - "design"
  - "accesibilidad"
  - "responsive"
  - "mobile"
  - "estilo"
  - "frontend"
  - "componente"
category: "frontend"
autoActivate: true
---
Al mejorar UI/UX, considera:

### Feedback al Usuario
- Siempre mostrar loading states durante operaciones async
- Usar toast notifications para confirmaciones y errores
- Empty states informativos con call-to-action
- Confirmaciones para acciones destructivas (eliminar, etc.)

### Consistencia Visual
- Seguir el sistema de diseño existente (Tailwind CSS)
- Usar los mismos espacios, bordes, sombras del proyecto
- Colores consistentes para estados (verde=exito, rojo=error, amarillo=warning)
- Dark mode: verificar que TODOS los elementos se ven bien en ambos temas

### Accesibilidad
- Textos con contraste suficiente (ratio minimo 4.5:1)
- Botones con tamaño minimo clickeable (44x44px en mobile)
- Labels para todos los inputs de formulario
- Keyboard navigation funcional (Tab, Enter, Escape)
- ARIA labels para elementos interactivos sin texto visible

### Responsive
- Mobile first: disenar para mobile y escalar hacia desktop
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Texto truncado con tooltip para textos largos
- Scroll horizontal para tablas en mobile
