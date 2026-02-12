---
name: "Generador de Tests"
description: "Crea tests unitarios e integracion para el codigo existente"
triggers:
  - "test"
  - "testing"
  - "prueba"
  - "cobertura"
  - "coverage"
  - "unit test"
  - "jest"
  - "vitest"
category: "testing"
autoActivate: true
---
Al crear tests, sigue estas guias:

### Estructura
- Un archivo de test por cada archivo/modulo
- Nombrar: `[modulo].test.ts` o `__tests__/[modulo].test.ts`
- Agrupar tests con `describe` por funcionalidad

### Que testear
1. **Happy path**: El caso normal que deberia funcionar
2. **Edge cases**: Inputs vacios, null, undefined, limites
3. **Errores**: Verificar que los errores se manejan correctamente
4. **Integracion**: Verificar que los componentes trabajan juntos

### Patron AAA
```
// Arrange - preparar datos
// Act - ejecutar la accion
// Assert - verificar el resultado
```

### Tips
- Usar mocks para dependencias externas (APIs, DB)
- No testear implementacion interna, testear comportamiento
- Cada test debe ser independiente (no depender de otros tests)
- Usar datos de test descriptivos, no "test1", "abc"
- Para React: usar @testing-library/react, testear desde la perspectiva del usuario
