---
name: "Auditor de Seguridad"
description: "Revisa y mejora la seguridad del codigo: validaciones, autenticacion, OWASP top 10"
triggers:
  - "seguridad"
  - "security"
  - "vulnerabilidad"
  - "autenticacion"
  - "auth"
  - "xss"
  - "injection"
  - "csrf"
  - "permisos"
category: "security"
autoActivate: true
---
Al revisar seguridad, verifica:

### OWASP Top 10
1. **Inyeccion**: SQL injection, NoSQL injection, command injection
   - Usar parametros preparados, nunca concatenar inputs en queries
   - Validar y sanitizar TODOS los inputs del usuario

2. **Autenticacion rota**: Sesiones debiles, tokens predecibles
   - Verificar que JWT se valida correctamente
   - Verificar expiracion de tokens
   - Verificar que las rutas protegidas verifican auth

3. **Exposicion de datos**: Datos sensibles en logs, responses, URLs
   - No exponer IDs internos, stack traces, o info del servidor
   - Verificar que passwords no se loguean ni se retornan en APIs

4. **XSS**: Input del usuario renderizado sin sanitizar
   - En React, evitar dangerouslySetInnerHTML
   - Sanitizar todo input antes de renderizar

5. **CSRF**: Operaciones mutables sin token CSRF
   - Verificar que POST/PUT/DELETE requieren autenticacion

### Validaciones
- Validar tipos, rangos, y formato de todos los inputs
- Usar Zod o similar para validacion de schemas
- Verificar rate limiting en endpoints publicos
- Verificar CORS configuration
