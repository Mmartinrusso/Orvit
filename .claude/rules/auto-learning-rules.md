# Regla 4: Auto-aprendizaje continuo

Después de completar trabajo significativo, actualizar los archivos de memoria correspondientes.
Los archivos están en: `~/.claude/projects/-Users-martinrusso10-Orvit/memory/`

---

## Triggers — cuándo actualizar qué

| Evento | Archivo a actualizar |
|--------|---------------------|
| Fixeo un bug que tardó en diagnosticar | `errores-comunes.md` — agregar síntoma, causa, fix |
| El usuario dice "no me convence" / pide rediseño / expresa preferencia | `preferencias-usuario.md` — agregar la preferencia |
| Tomo una decisión arquitectónica no obvia | `decisiones.md` — agregar bajo el módulo correspondiente |
| Descubro un patrón reutilizable | `patrones-codigo.md` — agregar con ejemplo de código |
| Algo en MEMORY.md resulta incorrecto | `MEMORY.md` — corregir inmediatamente |

---

## Cómo actualizar

- **Append, no rewrite**: Agregar al final de la sección correspondiente
- **Nunca borrar** aprendizajes anteriores a menos que sean incorrectos
- **Formato consistente**: seguir el formato que ya tiene cada archivo
- **Sin duplicar**: verificar que no exista antes de agregar
- **Conciso**: 2-3 líneas por entry. Si necesita código, máximo 10 líneas

---

## Cuándo NO actualizar

- Decisiones triviales (qué import usar, orden de props)
- Errores de typo o cosas que se arreglan en 1 minuto
- Info que ya está en CLAUDE.md o en un skill
- Preferencias temporales ("por ahora hacelo así")
