'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useComprasCategories } from '@/hooks/compras/use-compras-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
 Plus,
 MoreHorizontal,
 Edit,
 Trash2,
 ChevronRight,
 ChevronDown,
 Package,
 FolderTree,
 Search,
 Loader2,
} from 'lucide-react';

interface Category {
 id: number;
 name: string;
 description: string | null;
 code: string | null;
 color: string | null;
 icon: string | null;
 parentId: number | null;
 isActive: boolean;
 sortOrder: number;
 parent?: { id: number; name: string } | null;
 children?: Category[];
 _count?: { supplies: number; children: number };
}

const ICONS = [
 { value: 'cog', label: 'Engranaje' },
 { value: 'zap', label: 'Electricidad' },
 { value: 'droplet', label: 'Líquido' },
 { value: 'wrench', label: 'Herramienta' },
 { value: 'package', label: 'Caja' },
 { value: 'shield', label: 'Escudo' },
 { value: 'cpu', label: 'Electrónica' },
 { value: 'thermometer', label: 'Temperatura' },
];

const COLORS = [
 '#3B82F6', // Blue
 '#10B981', // Green
 '#F59E0B', // Amber
 '#EF4444', // Red
 '#8B5CF6', // Purple
 '#EC4899', // Pink
 '#06B6D4', // Cyan
 '#84CC16', // Lime
];

export function CategoriasManager() {
 const { categories, flatCategories, isLoading: loading, invalidate } = useComprasCategories();

 const [search, setSearch] = useState('');
 const [modalOpen, setModalOpen] = useState(false);
 const [deleteModalOpen, setDeleteModalOpen] = useState(false);
 const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
 const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
 const [submitting, setSubmitting] = useState(false);

 // Form state
 const [formData, setFormData] = useState({
 name: '',
 description: '',
 code: '',
 color: COLORS[0],
 icon: 'package',
 parentId: null as number | null,
 sortOrder: 0,
 isActive: true,
 });

 const handleSubmit = async () => {
 if (!formData.name.trim()) {
 toast.error('El nombre es requerido');
 return;
 }

 setSubmitting(true);
 try {
 const url = selectedCategory
 ? `/api/compras/categorias/${selectedCategory.id}`
 : '/api/compras/categorias';
 const method = selectedCategory ? 'PATCH' : 'POST';

 const res = await fetch(url, {
 method,
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(formData),
 });

 const data = await res.json();

 if (!res.ok) {
 throw new Error(data.error || 'Error al guardar');
 }

 toast.success(selectedCategory ? 'Categoría actualizada' : 'Categoría creada');
 setModalOpen(false);
 resetForm();
 invalidate();
 } catch (error: any) {
 toast.error(error.message || 'Error al guardar categoría');
 } finally {
 setSubmitting(false);
 }
 };

 const handleDelete = async () => {
 if (!selectedCategory) return;

 setSubmitting(true);
 try {
 const res = await fetch(`/api/compras/categorias/${selectedCategory.id}`, {
 method: 'DELETE',
 });

 const data = await res.json();

 if (!res.ok) {
 throw new Error(data.error || 'Error al eliminar');
 }

 toast.success('Categoría eliminada');
 setDeleteModalOpen(false);
 setSelectedCategory(null);
 invalidate();
 } catch (error: any) {
 toast.error(error.message || 'Error al eliminar categoría');
 } finally {
 setSubmitting(false);
 }
 };

 const resetForm = () => {
 setFormData({
 name: '',
 description: '',
 code: '',
 color: COLORS[0],
 icon: 'package',
 parentId: null,
 sortOrder: 0,
 isActive: true,
 });
 setSelectedCategory(null);
 };

 const openEditModal = (category: Category) => {
 setSelectedCategory(category);
 setFormData({
 name: category.name,
 description: category.description || '',
 code: category.code || '',
 color: category.color || COLORS[0],
 icon: category.icon || 'package',
 parentId: category.parentId,
 sortOrder: category.sortOrder,
 isActive: category.isActive,
 });
 setModalOpen(true);
 };

 const toggleExpand = (id: number) => {
 const newExpanded = new Set(expandedIds);
 if (newExpanded.has(id)) {
 newExpanded.delete(id);
 } else {
 newExpanded.add(id);
 }
 setExpandedIds(newExpanded);
 };

 const renderCategoryRow = (category: Category, level: number = 0) => {
 const hasChildren = (category.children?.length || 0) > 0;
 const isExpanded = expandedIds.has(category.id);
 const matchesSearch = search
 ? category.name.toLowerCase().includes(search.toLowerCase()) ||
 category.code?.toLowerCase().includes(search.toLowerCase())
 : true;

 if (!matchesSearch && !hasChildren) return null;

 return (
 <>
 <TableRow key={category.id} className={!category.isActive ? 'opacity-50' : ''}>
 <TableCell>
 <div className="flex items-center gap-2" style={{ paddingLeft: level * 24 }}>
 {hasChildren ? (
 <button
 onClick={() => toggleExpand(category.id)}
 className="p-1 hover:bg-accent rounded"
 >
 {isExpanded ? (
 <ChevronDown className="h-4 w-4" />
 ) : (
 <ChevronRight className="h-4 w-4" />
 )}
 </button>
 ) : (
 <div className="w-6" />
 )}
 {category.color && (
 <div
 className="w-3 h-3 rounded-full"
 style={{ backgroundColor: category.color }}
 />
 )}
 <span className="font-medium">{category.name}</span>
 {category.code && (
 <Badge variant="outline" className="ml-2">
 {category.code}
 </Badge>
 )}
 </div>
 </TableCell>
 <TableCell className="text-muted-foreground">
 {category.description || '-'}
 </TableCell>
 <TableCell className="text-center">
 <div className="flex items-center justify-center gap-2">
 <Package className="h-4 w-4 text-muted-foreground" />
 {category._count?.supplies || 0}
 </div>
 </TableCell>
 <TableCell className="text-center">
 <div className="flex items-center justify-center gap-2">
 <FolderTree className="h-4 w-4 text-muted-foreground" />
 {category._count?.children || 0}
 </div>
 </TableCell>
 <TableCell className="text-center">
 <Badge variant={category.isActive ? 'default' : 'secondary'}>
 {category.isActive ? 'Activa' : 'Inactiva'}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="icon" aria-label="Opciones">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => openEditModal(category)}>
 <Edit className="h-4 w-4 mr-2" />
 Editar
 </DropdownMenuItem>
 <DropdownMenuItem
 className="text-destructive"
 onClick={() => {
 setSelectedCategory(category);
 setDeleteModalOpen(true);
 }}
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Eliminar
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </TableCell>
 </TableRow>
 {hasChildren && isExpanded && category.children?.map((child) =>
 renderCategoryRow(child, level + 1)
 )}
 </>
 );
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-48">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar categoría..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="pl-9 w-[250px]"
 />
 </div>
 <span className="text-sm text-muted-foreground">
 {flatCategories.length} categorías
 </span>
 </div>
 <Button onClick={() => { resetForm(); setModalOpen(true); }}>
 <Plus className="h-4 w-4 mr-2" />
 Nueva Categoría
 </Button>
 </div>

 {/* Table */}
 <div className="border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-[300px]">Nombre</TableHead>
 <TableHead>Descripción</TableHead>
 <TableHead className="text-center w-[100px]">Insumos</TableHead>
 <TableHead className="text-center w-[120px]">Subcategorías</TableHead>
 <TableHead className="text-center w-[100px]">Estado</TableHead>
 <TableHead className="text-right w-[80px]">Acciones</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {categories.length === 0 ? (
 <TableRow>
 <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
 No hay categorías. Crea la primera.
 </TableCell>
 </TableRow>
 ) : (
 categories.map((cat) => renderCategoryRow(cat))
 )}
 </TableBody>
 </Table>
 </div>

 {/* Create/Edit Modal */}
 <Dialog open={modalOpen} onOpenChange={setModalOpen}>
 <DialogContent size="sm">
 <DialogHeader>
 <DialogTitle>
 {selectedCategory ? 'Editar Categoría' : 'Nueva Categoría'}
 </DialogTitle>
 <DialogDescription>
 {selectedCategory ? 'Modifica los datos de la categoría' : 'Completa los datos para crear una nueva categoría'}
 </DialogDescription>
 </DialogHeader>

 <DialogBody className="space-y-4">
 <div className="space-y-2">
 <Label>Nombre *</Label>
 <Input
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 placeholder="Ej: Rodamientos"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label>Código</Label>
 <Input
 value={formData.code}
 onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
 placeholder="ROD"
 maxLength={20}
 />
 </div>
 <div className="space-y-2">
 <Label>Orden</Label>
 <Input
 type="number"
 value={formData.sortOrder}
 onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label>Descripción</Label>
 <Input
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 placeholder="Descripción opcional"
 />
 </div>

 <div className="space-y-2">
 <Label>Categoría Padre</Label>
 <Select
 value={formData.parentId?.toString() || 'none'}
 onValueChange={(val) => setFormData({
 ...formData,
 parentId: val === 'none' ? null : parseInt(val)
 })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Sin categoría padre" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Sin categoría padre</SelectItem>
 {flatCategories
 .filter((c) => c.id !== selectedCategory?.id)
 .map((cat) => (
 <SelectItem key={cat.id} value={cat.id.toString()}>
 {cat.parent ? `${cat.parent.name} > ` : ''}{cat.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Color</Label>
 <div className="flex gap-2">
 {COLORS.map((color) => (
 <button
 key={color}
 onClick={() => setFormData({ ...formData, color })}
 className={cn('w-8 h-8 rounded-full border-2 transition-all', formData.color === color ? 'border-primary scale-110' : 'border-transparent')}
 style={{ backgroundColor: color }}
 />
 ))}
 </div>
 </div>

 {selectedCategory && (
 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="isActive"
 checked={formData.isActive}
 onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
 className="rounded"
 />
 <Label htmlFor="isActive">Categoría activa</Label>
 </div>
 )}
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={() => setModalOpen(false)}>
 Cancelar
 </Button>
 <Button onClick={handleSubmit} disabled={submitting}>
 {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 {selectedCategory ? 'Guardar Cambios' : 'Crear Categoría'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Delete Confirmation Modal */}
 <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
 <DialogContent size="sm">
 <DialogHeader>
 <DialogTitle>Eliminar Categoría</DialogTitle>
 <DialogDescription>
 Esta acción no se puede deshacer.
 </DialogDescription>
 </DialogHeader>
 <DialogBody className="space-y-3">
 <p>
 ¿Estás seguro de eliminar la categoría <strong>{selectedCategory?.name}</strong>?
 </p>
 {selectedCategory?._count?.supplies ? (
 <p className="text-destructive text-sm">
 Esta categoría tiene {selectedCategory._count.supplies} insumos asignados.
 Debes moverlos a otra categoría primero.
 </p>
 ) : null}
 {selectedCategory?._count?.children ? (
 <p className="text-destructive text-sm">
 Esta categoría tiene {selectedCategory._count.children} subcategorías.
 Debes eliminarlas o moverlas primero.
 </p>
 ) : null}
 </DialogBody>
 <DialogFooter>
 <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
 Cancelar
 </Button>
 <Button
 variant="destructive"
 onClick={handleDelete}
 disabled={submitting || (selectedCategory?._count?.supplies || 0) > 0 || (selectedCategory?._count?.children || 0) > 0}
 >
 {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 Eliminar
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
