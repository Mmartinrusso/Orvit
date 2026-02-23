# Regla 3: Pre-flight antes de implementar

Antes de empezar una feature o rediseño, verificar mentalmente estos 5 puntos.
Si falta alguno Y es crítico para no tener que rehacer, preguntar al usuario.
Si se puede inferir del contexto, NO preguntar — asumir y avanzar.

---

## Los 5 puntos

1. **¿Dónde va?** — Página, módulo, sidebar. Si no es obvio, preguntar.
2. **¿Cómo se ve?** — Si hay componente visual nuevo (tabla, card, modal, wizard):
   - ¿Hay referencia? (otra parte de la app, sitio externo, descripción)
   - Si no hay referencia, proponer un mini-mockup ASCII antes de implementar
3. **¿Qué datos?** — ¿De qué tabla/API? ¿Qué campos? Si hay duda sobre nombres de campos, verificar en schema.prisma antes de escribir código.
4. **¿Quién lo usa?** — ¿Necesita permisos? ¿Va en el sidebar? ¿Algún rol no debería verlo?
5. **¿Alcance completo?** — ¿Solo frontend? ¿Backend + DB? ¿Seed data? ¿PDF? ¿Navegación/sidebar?

---

## Cuándo preguntar vs cuándo asumir

| Situación | Acción |
|-----------|--------|
| Diseño visual sin referencia | **Preguntar** o proponer mockup ASCII |
| Alcance ambiguo ("hacé algo para X") | **Preguntar** alcance: ¿solo UI? ¿backend también? |
| Ubicación obvia por contexto | **Asumir** y avanzar |
| Permisos estándar (admin ve todo, user ve lo suyo) | **Asumir** y avanzar |
| Patrones que ya existen en la app | **Asumir** y seguir el patrón |
| Cosas técnicas (qué hook, qué import, qué patrón) | **Nunca preguntar** — decidir solo |

**Regla de oro**: máximo 1-2 preguntas antes de empezar. Si necesitás más de 2, probablemente podés inferir las respuestas.

---

## Para rediseños

Si el usuario dice "no me convence" o "cambiá el diseño":
1. Preguntar QUÉ específicamente no convence (layout? colores? información? densidad?)
2. Pedir referencia si es posible ("¿cómo algo que hayas visto que te guste?")
3. Si no hay referencia, proponer 2 opciones concretas con mockup ASCII

---

## Para features grandes

Si la tarea es grande (nuevo módulo, sistema completo):
1. Listar TODO lo que vas a hacer antes de empezar (endpoints, páginas, componentes, DB)
2. Preguntar: "¿falta algo o cambiarías algo antes de que arranque?"
3. Esto evita el "ah, también quiero X" a mitad de camino

---

## Verificación de campo names

Antes de escribir código que use campos de Prisma:
- Leer el modelo en `schema.prisma` para confirmar nombres exactos
- No asumir: `fecha` puede ser `fechaEmision`, `fechaCreacion`, `createdAt`, etc.
- Los campos de relación pueden tener nombres no obvios
