---
name: "Desarrollo de APIs"
description: "Crea o mejora endpoints API con validaciones, manejo de errores y documentacion"
triggers:
  - "api"
  - "endpoint"
  - "ruta"
  - "route"
  - "rest"
  - "backend"
  - "servidor"
  - "server"
category: "development"
autoActivate: true
---
Al desarrollar APIs, sigue estas convenciones:

### Estructura de Endpoints
- GET para leer datos (sin side effects)
- POST para crear recursos
- PUT/PATCH para actualizar recursos
- DELETE para eliminar recursos

### Respuestas Consistentes
```typescript
// Exito
{ success: true, data: {...} }
// o con lista
{ success: true, items: [...], total: number }

// Error
{ success: false, error: "Mensaje descriptivo" }
```

### Validaciones
- Validar TODOS los inputs (body, query params, path params)
- Usar Zod para schemas de validacion
- Retornar errores 400 para inputs invalidos con mensaje claro
- Retornar 404 cuando un recurso no existe
- Retornar 401/403 para errores de autenticacion/autorizacion

### Manejo de Errores
- Try-catch en cada handler
- Loguear errores con contexto (userId, endpoint, payload)
- No exponer detalles internos al cliente
- Errores 500 solo para errores inesperados

### Base de Datos
- Usar transacciones para operaciones multi-tabla
- Parametros preparados (nunca concatenar SQL)
- Paginacion para endpoints con muchos resultados
- Indices para columnas frecuentemente consultadas
