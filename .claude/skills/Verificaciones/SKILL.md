---
name: Verificaciones
description: Use when the user asks to test a page, module, or section in the browser. Alias of the "testear" skill — same process, same 5 phases.
---

# Verificaciones

Este skill es un alias de **testear**. Ejecuta el mismo proceso de 5 fases:

1. **Leer código** — Inventario completo de funcionalidades
2. **Testear en Chrome** — Chrome DevTools MCP, funcional, checklist completa
3. **Validar design system** — Contra `docs/rules/design-system.md`
4. **Corregir con frontend-design** — Invocar skill `frontend-design:frontend-design`
5. **Auditar performance** — Invocar skill `vercel-react-best-practices`

**REQUIRED:** Invocar el skill `testear` para el proceso completo.
