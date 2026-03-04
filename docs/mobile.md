Desde el punto de vista frontend/UI, lo que “veo” es este layout y componentes:

1) Estructura general

Pantalla mobile con safe-areas arriba/abajo.

Fondo general tipo off-white/beige.

Todo está contenido con padding lateral consistente (16–20px aprox).

Lenguaje visual: soft UI / neumorphism light, con sombras muy suaves y bordes redondeados.

2) Top bar (Header)

Row horizontal con 3 zonas:

Left: Avatar circular (32–40px).

Center: “Month picker” tipo pill (chip grande) con texto “Jan, 2025” + chevron ↓.

Right: Botón circular (icon button) con bell.

Props típicos

Botones: IconButton con size=40, borderRadius=999, fondo blanco, sombra suave.

3) Week Calendar (Horizontal)

Fila de labels: M T W T F S S en gris.

Debajo: chips ovalados para cada día (6–12).

El seleccionado (11) cambia a relleno blanco + sombra más marcada.

Componente

WeekStrip con DayPill.

DayPill states: default | active.

4) “Pinned projects” section

Header de sección:

Título a la izquierda: Pinned projects

Acción a la derecha: See all >

Contenido:

Grid 2 columnas de cards.

Cada card:

ícono carpeta (arriba izq)

menú de 3 puntos (arriba der)

título (1–2 líneas)

línea “x/y completed” con un bullet/asterisco colorido (rojo/naranja/celeste).

Componente

SectionHeader(title, action)

ProjectCard

ProjectsGrid (grid-cols-2 gap-12/16)

5) “Today’s tasks” section

Header:

“Today’s tasks”

Badge circular con número 3.

Lista de tareas:

Card grande tipo “TaskCard” con:

etiqueta de proyecto (chip o texto pequeño)

título principal (semibold)

descripción (muted)

checkbox a la derecha (square)

footer con:

progreso 3/4 completed

iconito + contador (comentarios o subtareas) “10”

a la derecha un progress ring con “75%”.

Componente

TaskCard

ProgressRing(percent)

Checkbox

6) Bottom navigation

Barra fija inferior con 5 acciones:

ícono (izq)

ícono (segundo)

botón central flotante “+” (circular grande, color celeste)

ícono (cuarto)

ícono (derecha)

Componente

BottomNav + FloatingActionButton

Tokens/estilo que usaría para replicarlo

radius: 16–20 en cards, 999 en pills

shadow: muy suave (tipo shadow-sm + blur alto)

border: casi imperceptible o ninguno

typography: títulos 14–16px semibold, labels 12–13px, muted 11–12px

spacing: secciones separadas por 16–24px

Si querés, te lo traduzco directo a component tree (React/Next + Tailwind + shadcn) con los nombres de componentes y clases aproximadas.