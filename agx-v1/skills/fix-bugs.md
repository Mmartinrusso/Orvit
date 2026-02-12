---
name: "Corrector de Bugs"
description: "Analiza y corrige bugs en el codigo, incluyendo errores de runtime, logica incorrecta y edge cases"
triggers:
  - "bug"
  - "error"
  - "fix"
  - "corregir"
  - "falla"
  - "rompe"
  - "crash"
  - "no funciona"
  - "broken"
category: "development"
autoActivate: true
---
Cuando corrijas bugs, sigue este proceso:

1. **Reproducir**: Primero entiende exactamente como se manifiesta el bug
2. **Diagnosticar**: Lee el codigo relevante y traza la logica para encontrar la causa raiz
3. **Corregir**: Implementa el fix mas minimo y preciso posible
4. **Verificar**: Asegurate de que el fix no rompe otras cosas

Reglas:
- No hagas refactors innecesarios al corregir un bug
- Si el bug es en la base de datos, verifica las migraciones
- Si es un bug de UI, verifica tanto la version light como dark mode
- Siempre considera edge cases: null, undefined, arrays vacios, strings vacios
- Si hay tests existentes, verifica que pasen despues del fix
