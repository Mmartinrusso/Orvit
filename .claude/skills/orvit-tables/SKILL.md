---
name: orvit-tables
description: Tablas de datos en Orvit — shadcn/ui Table con filtros, sorting, paginación y acciones. Usar cuando se necesita mostrar listas de datos tabulares con búsqueda, ordenamiento o paginación.
---

# Tables — Orvit Patterns

## Cuándo usar tabla vs cards

| Tabla | Cards (grid) |
|-------|-------------|
| Muchas columnas de datos comparables | Pocos atributos, imagen/ícono destacado |
| Necesitás ordenar por columnas | Navegación visual / kanban |
| Export a CSV es prioritario | Mobile-first |
| > 10 atributos por item | ≤ 5 atributos por item |

---

## Estructura base

```tsx
// components/[feature]/RecursoTable.tsx
'use client';

import { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortField = 'name' | 'createdAt' | 'value';
type SortDir = 'asc' | 'desc';

interface Props {
  data: Recurso[];
  isLoading: boolean;
  onEdit: (item: Recurso) => void;
  onDelete: (id: number) => void;
}

export function RecursoTable({ data, isLoading, onEdit, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let items = data;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    if (filter === 'active') items = items.filter(i => i.isActive);
    if (filter === 'inactive') items = items.filter(i => !i.isActive);
    items = [...items].sort((a, b) => {
      const val = sortDir === 'asc' ? 1 : -1;
      if (a[sortField] < b[sortField]) return -val;
      if (a[sortField] > b[sortField]) return val;
      return 0;
    });
    return items;
  }, [data, search, filter, sortField, sortDir]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (isLoading) return <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(v: typeof filter) => { setFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="flex items-center text-xs font-medium hover:text-foreground"
                  onClick={() => toggleSort('name')}
                >
                  Nombre <SortIcon field="name" />
                </button>
              </TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>
                <button
                  className="flex items-center text-xs font-medium hover:text-foreground"
                  onClick={() => toggleSort('value')}
                >
                  Valor <SortIcon field="value" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center text-xs font-medium hover:text-foreground"
                  onClick={() => toggleSort('createdAt')}
                >
                  Creado <SortIcon field="createdAt" />
                </button>
              </TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No se encontraron resultados
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(item => (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? 'default' : 'secondary'}>
                      {item.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(item.value)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(item)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => onDelete(item.id)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Export CSV desde tabla

```tsx
const handleExportCSV = () => {
  const headers = ['Nombre', 'Estado', 'Valor', 'Creado'];
  const rows = filtered.map(i => [
    i.name,
    i.isActive ? 'Activo' : 'Inactivo',
    i.value,
    format(new Date(i.createdAt), 'dd/MM/yyyy'),
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  toast.success('CSV descargado');
};
```

---

## Paginación del lado del servidor (para datasets grandes)

```tsx
// Hook con paginación server-side
const { data, isLoading } = useQuery({
  queryKey: ['recurso', 'list', { page, search, filter }],
  queryFn: async () => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      search,
      filter,
    });
    const res = await fetch(`/api/recurso?${params}`);
    return res.json(); // { data: [], total: number, page: number }
  },
});

// En el API route
const { skip, take } = getPaginationParams(req); // de @/lib/api-utils
const [items, total] = await prisma.$transaction([
  prisma.recurso.findMany({ where, skip, take, orderBy }),
  prisma.recurso.count({ where }),
]);
return NextResponse.json({ data: items, total });
```

---

## Anti-patterns

- ❌ Renderizar 1000+ rows sin paginación
- ❌ Filtrado/sorting en el servidor cuando los datos son < 200 registros (hacerlo en el cliente es más rápido)
- ❌ Columnas sin `truncate` para texto largo — siempre `className="max-w-[200px] truncate"`
- ❌ Sorting controlado solo por el servidor — si los datos ya están en memoria, sortear en el cliente
