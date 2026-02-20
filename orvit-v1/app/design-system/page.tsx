'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Save,
  Trash2,
  Edit,
  Search,
  Filter,
  Download,
  Upload,
  Settings,
  X,
  Check,
  AlertTriangle,
  Info,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DesignSystemPage() {
  const [activeSection, setActiveSection] = useState('dialogs');

  // Estados para demos
  const [dialogSmOpen, setDialogSmOpen] = useState(false);
  const [dialogMdOpen, setDialogMdOpen] = useState(false);
  const [dialogLgOpen, setDialogLgOpen] = useState(false);
  const [dialogXlOpen, setDialogXlOpen] = useState(false);
  const [dialogFullOpen, setDialogFullOpen] = useState(false);

  const [sheetSmOpen, setSheetSmOpen] = useState(false);
  const [sheetMdOpen, setSheetMdOpen] = useState(false);
  const [sheetLgOpen, setSheetLgOpen] = useState(false);
  const [sheetXlOpen, setSheetXlOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Design System - ORVIT</h1>
          <p className="text-muted-foreground mt-2">
            Catálogo de componentes para estandarización. Revisa cada sección y elige los que prefieras.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-b bg-card/50 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto py-2">
            {[
              { id: 'dialogs', label: 'Modales/Dialogs' },
              { id: 'sheets', label: 'Sheets (Paneles)' },
              { id: 'buttons', label: 'Botones' },
              { id: 'tabs', label: 'Tabs' },
              { id: 'badges', label: 'Badges' },
              { id: 'inputs', label: 'Inputs/Forms' },
              { id: 'cards', label: 'Cards' },
              { id: 'colors', label: 'Colores' },
            ].map((item) => (
              <Button
                key={item.id}
                variant={activeSection === item.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveSection(item.id)}
                className="shrink-0"
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">

        {/* DIALOGS SECTION */}
        {activeSection === 'dialogs' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Modales / Dialogs</h2>
              <p className="text-muted-foreground mb-6">
                Diferentes tamaños de modales. Haz click en cada uno para verlo en acción.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Small Dialog */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Small (max-w-md)</CardTitle>
                  <CardDescription>~448px - Confirmaciones, alertas</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setDialogSmOpen(true)} className="w-full">
                    Ver Dialog Small
                  </Button>
                </CardContent>
              </Card>

              {/* Medium Dialog */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Medium (max-w-2xl)</CardTitle>
                  <CardDescription>~672px - Formularios estándar</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setDialogMdOpen(true)} className="w-full">
                    Ver Dialog Medium
                  </Button>
                </CardContent>
              </Card>

              {/* Large Dialog */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Large (max-w-4xl)</CardTitle>
                  <CardDescription>~896px - Formularios complejos</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setDialogLgOpen(true)} className="w-full">
                    Ver Dialog Large
                  </Button>
                </CardContent>
              </Card>

              {/* XL Dialog */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extra Large (max-w-6xl)</CardTitle>
                  <CardDescription>~1152px - Tablas, dashboards</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setDialogXlOpen(true)} className="w-full">
                    Ver Dialog XL
                  </Button>
                </CardContent>
              </Card>

              {/* Full Dialog */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Full (95vw)</CardTitle>
                  <CardDescription>Casi pantalla completa</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setDialogFullOpen(true)} className="w-full">
                    Ver Dialog Full
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Dialog Demos */}
            <Dialog open={dialogSmOpen} onOpenChange={setDialogSmOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Dialog Small</DialogTitle>
                  <DialogDescription>
                    Este es un dialog pequeño, ideal para confirmaciones y alertas simples.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <p>¿Estás seguro de que deseas eliminar este elemento?</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogSmOpen(false)}>Cancelar</Button>
                  <Button variant="destructive">Eliminar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogMdOpen} onOpenChange={setDialogMdOpen}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Dialog Medium</DialogTitle>
                  <DialogDescription>
                    Este es un dialog mediano, ideal para formularios estándar.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input placeholder="Ingresa el nombre" />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea placeholder="Ingresa una descripción" />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cat1">Categoría 1</SelectItem>
                        <SelectItem value="cat2">Categoría 2</SelectItem>
                        <SelectItem value="cat3">Categoría 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="flex-shrink-0 border-t pt-4">
                  <Button variant="outline" onClick={() => setDialogMdOpen(false)}>Cancelar</Button>
                  <Button>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogLgOpen} onOpenChange={setDialogLgOpen}>
              <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Dialog Large</DialogTitle>
                  <DialogDescription>
                    Este es un dialog grande, ideal para formularios complejos con múltiples secciones.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h3 className="font-medium">Información General</h3>
                      <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input placeholder="Nombre" />
                      </div>
                      <div className="space-y-2">
                        <Label>Código</Label>
                        <Input placeholder="Código" />
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Textarea placeholder="Descripción" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-medium">Configuración</h3>
                      <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Opción 1</SelectItem>
                            <SelectItem value="2">Opción 2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Prioridad</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baja</SelectItem>
                            <SelectItem value="medium">Media</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="active" />
                        <Label htmlFor="active">Activo</Label>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-shrink-0 border-t pt-4">
                  <Button variant="outline" onClick={() => setDialogLgOpen(false)}>Cancelar</Button>
                  <Button>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogXlOpen} onOpenChange={setDialogXlOpen}>
              <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Dialog Extra Large</DialogTitle>
                  <DialogDescription>
                    Este es un dialog XL, ideal para tablas y dashboards.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4">
                  <div className="border rounded-lg">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 text-sm font-medium">ID</th>
                          <th className="text-left p-3 text-sm font-medium">Nombre</th>
                          <th className="text-left p-3 text-sm font-medium">Estado</th>
                          <th className="text-left p-3 text-sm font-medium">Fecha</th>
                          <th className="text-left p-3 text-sm font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <tr key={i} className="border-t">
                            <td className="p-3 text-sm">{i}</td>
                            <td className="p-3 text-sm">Elemento {i}</td>
                            <td className="p-3"><Badge>Activo</Badge></td>
                            <td className="p-3 text-sm">2024-01-{i.toString().padStart(2, '0')}</td>
                            <td className="p-3">
                              <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <DialogFooter className="flex-shrink-0 border-t pt-4">
                  <Button variant="outline" onClick={() => setDialogXlOpen(false)}>Cerrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogFullOpen} onOpenChange={setDialogFullOpen}>
              <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Dialog Full</DialogTitle>
                  <DialogDescription>
                    Este es un dialog de pantalla casi completa, para gestión compleja.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4">
                  <div className="grid grid-cols-3 gap-6">
                    <Card>
                      <CardHeader><CardTitle>Panel 1</CardTitle></CardHeader>
                      <CardContent>Contenido del panel 1</CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle>Panel 2</CardTitle></CardHeader>
                      <CardContent>Contenido del panel 2</CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle>Panel 3</CardTitle></CardHeader>
                      <CardContent>Contenido del panel 3</CardContent>
                    </Card>
                  </div>
                </div>
                <DialogFooter className="flex-shrink-0 border-t pt-4">
                  <Button variant="outline" onClick={() => setDialogFullOpen(false)}>Cerrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* SHEETS SECTION */}
        {activeSection === 'sheets' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Sheets (Paneles Laterales)</h2>
              <p className="text-muted-foreground mb-6">
                Paneles que se deslizan desde el lado. Ideales para formularios y detalles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Small (400px)</CardTitle>
                  <CardDescription>Detalles rápidos</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setSheetSmOpen(true)} className="w-full">
                    Ver Sheet Small
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Medium (600px)</CardTitle>
                  <CardDescription>Formularios estándar</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setSheetMdOpen(true)} className="w-full">
                    Ver Sheet Medium
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Large (800px)</CardTitle>
                  <CardDescription>Formularios complejos</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setSheetLgOpen(true)} className="w-full">
                    Ver Sheet Large
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">XL (1000px)</CardTitle>
                  <CardDescription>Gestión completa</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => setSheetXlOpen(true)} className="w-full">
                    Ver Sheet XL
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sheet Demos */}
            <Sheet open={sheetSmOpen} onOpenChange={setSheetSmOpen}>
              <SheetContent className="w-[400px] flex flex-col">
                <SheetHeader>
                  <SheetTitle>Sheet Small</SheetTitle>
                  <SheetDescription>Panel estrecho para detalles rápidos</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Nombre</Label>
                    <p className="font-medium">Máquina CNC-001</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Estado</Label>
                    <p><Badge variant="outline" className="bg-success-muted">Activo</Badge></p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Última revisión</Label>
                    <p className="font-medium">15/01/2024</p>
                  </div>
                </div>
                <SheetFooter className="border-t pt-4">
                  <Button variant="outline" onClick={() => setSheetSmOpen(false)}>Cerrar</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Sheet open={sheetMdOpen} onOpenChange={setSheetMdOpen}>
              <SheetContent className="w-[600px] flex flex-col">
                <SheetHeader>
                  <SheetTitle>Sheet Medium</SheetTitle>
                  <SheetDescription>Panel mediano para formularios</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input placeholder="Ingresa el nombre" />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea placeholder="Descripción" />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Categoría 1</SelectItem>
                        <SelectItem value="2">Categoría 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SheetFooter className="border-t pt-4 gap-2">
                  <Button variant="outline" onClick={() => setSheetMdOpen(false)}>Cancelar</Button>
                  <Button>Guardar</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Sheet open={sheetLgOpen} onOpenChange={setSheetLgOpen}>
              <SheetContent className="w-[800px] flex flex-col">
                <SheetHeader>
                  <SheetTitle>Sheet Large</SheetTitle>
                  <SheetDescription>Panel amplio para formularios complejos</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h3 className="font-medium border-b pb-2">Sección 1</h3>
                      <div className="space-y-2">
                        <Label>Campo 1</Label>
                        <Input />
                      </div>
                      <div className="space-y-2">
                        <Label>Campo 2</Label>
                        <Input />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-medium border-b pb-2">Sección 2</h3>
                      <div className="space-y-2">
                        <Label>Campo 3</Label>
                        <Input />
                      </div>
                      <div className="space-y-2">
                        <Label>Campo 4</Label>
                        <Input />
                      </div>
                    </div>
                  </div>
                </div>
                <SheetFooter className="border-t pt-4 gap-2">
                  <Button variant="outline" onClick={() => setSheetLgOpen(false)}>Cancelar</Button>
                  <Button>Guardar</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Sheet open={sheetXlOpen} onOpenChange={setSheetXlOpen}>
              <SheetContent className="w-[1000px] flex flex-col">
                <SheetHeader>
                  <SheetTitle>Sheet XL</SheetTitle>
                  <SheetDescription>Panel muy amplio para gestión completa</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto py-4">
                  <Tabs defaultValue="general">
                    <TabsList>
                      <TabsTrigger value="general">General</TabsTrigger>
                      <TabsTrigger value="config">Configuración</TabsTrigger>
                      <TabsTrigger value="history">Historial</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nombre</Label>
                          <Input />
                        </div>
                        <div className="space-y-2">
                          <Label>Código</Label>
                          <Input />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="config" className="mt-4">
                      <p>Contenido de configuración...</p>
                    </TabsContent>
                    <TabsContent value="history" className="mt-4">
                      <p>Contenido de historial...</p>
                    </TabsContent>
                  </Tabs>
                </div>
                <SheetFooter className="border-t pt-4 gap-2">
                  <Button variant="outline" onClick={() => setSheetXlOpen(false)}>Cancelar</Button>
                  <Button>Guardar</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        )}

        {/* BUTTONS SECTION */}
        {activeSection === 'buttons' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Botones</h2>
              <p className="text-muted-foreground mb-6">
                Variantes y tamaños de botones disponibles.
              </p>
            </div>

            {/* Variants */}
            <Card>
              <CardHeader>
                <CardTitle>Variantes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Button variant="default">Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
              </CardContent>
            </Card>

            {/* Sizes */}
            <Card>
              <CardHeader>
                <CardTitle>Tamaños</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Button size="sm">Small (h-8)</Button>
                  <Button size="default">Default (h-9)</Button>
                  <Button size="lg">Large (h-10)</Button>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <Button size="sm" className="h-6 px-2 text-xs">Extra Small (h-6)</Button>
                  <Button size="sm" className="h-7 px-2.5 text-xs">Mini (h-7)</Button>
                  <Button size="lg" className="h-11 px-8">Extra Large (h-11)</Button>
                </div>
              </CardContent>
            </Card>

            {/* With Icons */}
            <Card>
              <CardHeader>
                <CardTitle>Con Íconos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Button><Plus className="mr-2 h-4 w-4" /> Agregar</Button>
                  <Button variant="outline"><Save className="mr-2 h-4 w-4" /> Guardar</Button>
                  <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</Button>
                  <Button variant="secondary"><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <Button variant="outline"><Search className="mr-2 h-4 w-4" /> Buscar</Button>
                  <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filtrar</Button>
                  <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar</Button>
                  <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Importar</Button>
                </div>
              </CardContent>
            </Card>

            {/* Icon Only */}
            <Card>
              <CardHeader>
                <CardTitle>Solo Ícono</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-10 w-10">
                    <Settings className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* States */}
            <Card>
              <CardHeader>
                <CardTitle>Estados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Button>Normal</Button>
                  <Button disabled>Disabled</Button>
                  <Button className="opacity-50 cursor-wait">Loading...</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TABS SECTION */}
        {activeSection === 'tabs' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Tabs</h2>
              <p className="text-muted-foreground mb-6">
                Diferentes estilos de tabs/pestañas.
              </p>
            </div>

            {/* Style 1: Default */}
            <Card>
              <CardHeader>
                <CardTitle>Estilo 1: Default (Shadcn)</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tab1">
                  <TabsList>
                    <TabsTrigger value="tab1">General</TabsTrigger>
                    <TabsTrigger value="tab2">Configuración</TabsTrigger>
                    <TabsTrigger value="tab3">Avanzado</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab1" className="mt-4 p-4 border rounded">
                    Contenido de General
                  </TabsContent>
                  <TabsContent value="tab2" className="mt-4 p-4 border rounded">
                    Contenido de Configuración
                  </TabsContent>
                  <TabsContent value="tab3" className="mt-4 p-4 border rounded">
                    Contenido de Avanzado
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Style 2: With counts */}
            <Card>
              <CardHeader>
                <CardTitle>Estilo 2: Con Contadores</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all">
                  <TabsList className="h-9">
                    <TabsTrigger value="all" className="gap-1.5">
                      Todos
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">150</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="gap-1.5">
                      Pendientes
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">42</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="gap-1.5">
                      Completados
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">108</Badge>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="all" className="mt-4 p-4 border rounded">
                    Mostrando todos los elementos
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Style 3: Compact */}
            <Card>
              <CardHeader>
                <CardTitle>Estilo 3: Compacto (h-7)</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tab1">
                  <TabsList className="h-7 p-0.5">
                    <TabsTrigger value="tab1" className="h-6 px-2.5 text-xs">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2" className="h-6 px-2.5 text-xs">Tab 2</TabsTrigger>
                    <TabsTrigger value="tab3" className="h-6 px-2.5 text-xs">Tab 3</TabsTrigger>
                    <TabsTrigger value="tab4" className="h-6 px-2.5 text-xs">Tab 4</TabsTrigger>
                    <TabsTrigger value="tab5" className="h-6 px-2.5 text-xs">Tab 5</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab1" className="mt-4 p-4 border rounded">
                    Contenido
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Style 4: Scrollable */}
            <Card>
              <CardHeader>
                <CardTitle>Estilo 4: Scrollable Horizontal</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tab1">
                  <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="tab1">Dashboard</TabsTrigger>
                    <TabsTrigger value="tab2">Mantenimiento</TabsTrigger>
                    <TabsTrigger value="tab3">Inventario</TabsTrigger>
                    <TabsTrigger value="tab4">Reportes</TabsTrigger>
                    <TabsTrigger value="tab5">Configuración</TabsTrigger>
                    <TabsTrigger value="tab6">Usuarios</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab1" className="mt-4 p-4 border rounded">
                    Contenido del Dashboard
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Style 5: Underline (custom) */}
            <Card>
              <CardHeader>
                <CardTitle>Estilo 5: Underline (Sin fondo)</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tab1">
                  <TabsList className="bg-transparent border-b rounded-none h-auto p-0 w-full justify-start">
                    <TabsTrigger
                      value="tab1"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      General
                    </TabsTrigger>
                    <TabsTrigger
                      value="tab2"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Detalles
                    </TabsTrigger>
                    <TabsTrigger
                      value="tab3"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Historial
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab1" className="mt-4 p-4 border rounded">
                    Contenido
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}

        {/* BADGES SECTION */}
        {activeSection === 'badges' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Badges</h2>
              <p className="text-muted-foreground mb-6">
                Etiquetas para estados, categorías y contadores.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Variantes Base</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estados de Mantenimiento</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge className="bg-warning-muted text-warning-muted-foreground border-warning-muted">Pendiente</Badge>
                <Badge className="bg-info-muted text-info-muted-foreground border-info-muted">En Progreso</Badge>
                <Badge className="bg-success-muted text-success-muted-foreground border-success-muted">Completado</Badge>
                <Badge className="bg-destructive/10 text-destructive border-destructive/20">Vencido</Badge>
                <Badge className="bg-muted text-foreground border-border">Cancelado</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prioridades</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge className="bg-muted text-muted-foreground">Baja</Badge>
                <Badge className="bg-warning-muted text-warning-muted-foreground">Media</Badge>
                <Badge className="bg-warning-muted text-warning-muted-foreground">Alta</Badge>
                <Badge className="bg-destructive/10 text-destructive">Crítica</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tipos de Mantenimiento</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge className="bg-primary text-primary-foreground">Preventivo</Badge>
                <Badge className="bg-warning text-warning-foreground">Correctivo</Badge>
                <Badge className="bg-purple-500 text-white">Predictivo</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tamaños</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 items-center">
                <Badge className="px-1.5 py-0.5 text-[10px]">Extra Small</Badge>
                <Badge className="px-2 py-0.5 text-xs">Small (default)</Badge>
                <Badge className="px-2.5 py-1 text-sm">Medium</Badge>
                <Badge className="px-3 py-1.5 text-base">Large</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Con Íconos</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge className="bg-success-muted text-success-muted-foreground">
                  <Check className="mr-1 h-3 w-3" /> Aprobado
                </Badge>
                <Badge className="bg-destructive/10 text-destructive">
                  <X className="mr-1 h-3 w-3" /> Rechazado
                </Badge>
                <Badge className="bg-warning-muted text-warning-muted-foreground">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Advertencia
                </Badge>
                <Badge className="bg-info-muted text-info-muted-foreground">
                  <Info className="mr-1 h-3 w-3" /> Info
                </Badge>
              </CardContent>
            </Card>
          </div>
        )}

        {/* INPUTS SECTION */}
        {activeSection === 'inputs' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Inputs y Formularios</h2>
              <p className="text-muted-foreground mb-6">
                Campos de entrada y componentes de formulario.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Text Input</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Normal</Label>
                    <Input placeholder="Placeholder..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Con valor</Label>
                    <Input defaultValue="Valor ingresado" />
                  </div>
                  <div className="space-y-2">
                    <Label>Disabled</Label>
                    <Input disabled placeholder="Disabled" />
                  </div>
                  <div className="space-y-2">
                    <Label>Con error</Label>
                    <Input className="border-destructive" defaultValue="Valor inválido" />
                    <p className="text-sm text-destructive">Este campo es requerido</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tamaños de Input</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Small (h-8)</Label>
                    <Input className="h-8 text-sm" placeholder="Small input" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default (h-9)</Label>
                    <Input className="h-9" placeholder="Default input" />
                  </div>
                  <div className="space-y-2">
                    <Label>Large (h-10)</Label>
                    <Input className="h-10" placeholder="Large input" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Select</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Normal</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Opción 1</SelectItem>
                        <SelectItem value="2">Opción 2</SelectItem>
                        <SelectItem value="3">Opción 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Disabled</Label>
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Disabled" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Opción 1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Textarea</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Normal</Label>
                    <Textarea placeholder="Escribe aquí..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Con altura fija</Label>
                    <Textarea className="h-20 resize-none" placeholder="Altura fija..." />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Checkbox y Switch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="check1" />
                    <Label htmlFor="check1">Checkbox normal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="check2" checked />
                    <Label htmlFor="check2">Checkbox marcado</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="switch1" />
                    <Label htmlFor="switch1">Switch normal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="switch2" checked />
                    <Label htmlFor="switch2">Switch activo</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Input con Ícono</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Búsqueda</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Buscar..." />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* CARDS SECTION */}
        {activeSection === 'cards' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Cards</h2>
              <p className="text-muted-foreground mb-6">
                Diferentes estilos de tarjetas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Card Default</CardTitle>
                  <CardDescription>Descripción de la card</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Contenido de la card con padding estándar.</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-primary">
                <CardHeader>
                  <CardTitle>Card con Accent</CardTitle>
                  <CardDescription>Borde izquierdo de color</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Útil para destacar información importante.</p>
                </CardContent>
              </Card>

              <Card className="bg-muted">
                <CardHeader>
                  <CardTitle>Card Muted</CardTitle>
                  <CardDescription>Fondo gris</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Para información secundaria.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Mantenimientos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">150</p>
                  <p className="text-xs text-muted-foreground mt-1">+12% vs mes anterior</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>Card Interactiva</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span>Click para ver más</span>
                  <ChevronRight className="h-5 w-5" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Con Acciones</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <p>Card con botón de acciones en el header.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* COLORS SECTION */}
        {activeSection === 'colors' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Colores</h2>
              <p className="text-muted-foreground mb-6">
                Paleta de colores del sistema.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Colores Base (Tailwind)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {['red', 'orange', 'yellow', 'green', 'blue', 'purple'].map((color) => (
                    <div key={color} className="space-y-2">
                      <div className={`h-16 rounded-lg bg-${color}-500`} style={{ backgroundColor: `var(--${color}-500, ${color})` }} />
                      <p className="text-sm capitalize">{color}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colores de Estado</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-warning-muted border border-warning-muted">
                  <p className="font-medium text-warning-muted-foreground">Pendiente</p>
                  <p className="text-sm text-warning-muted-foreground">bg-warning-muted, text-warning-muted-foreground</p>
                </div>
                <div className="p-4 rounded-lg bg-info-muted border border-info-muted">
                  <p className="font-medium text-info-muted-foreground">En Progreso</p>
                  <p className="text-sm text-info-muted-foreground">bg-info-muted, text-info-muted-foreground</p>
                </div>
                <div className="p-4 rounded-lg bg-success-muted border border-success-muted">
                  <p className="font-medium text-success-muted-foreground">Completado</p>
                  <p className="text-sm text-success-muted-foreground">bg-success-muted, text-success-muted-foreground</p>
                </div>
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="font-medium text-destructive">Vencido / Error</p>
                  <p className="text-sm text-destructive">bg-destructive/10, text-destructive</p>
                </div>
                <div className="p-4 rounded-lg bg-muted border border-border">
                  <p className="font-medium text-foreground">Cancelado / Inactivo</p>
                  <p className="text-sm text-muted-foreground">bg-muted, text-foreground</p>
                </div>
                <div className="p-4 rounded-lg bg-warning-muted border border-warning-muted">
                  <p className="font-medium text-warning-muted-foreground">Advertencia</p>
                  <p className="text-sm text-warning-muted-foreground">bg-warning-muted, text-warning-muted-foreground</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colores de Prioridad</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="font-medium text-muted-foreground">Baja</p>
                </div>
                <div className="p-4 rounded-lg bg-warning-muted">
                  <p className="font-medium text-warning-muted-foreground">Media</p>
                </div>
                <div className="p-4 rounded-lg bg-warning-muted">
                  <p className="font-medium text-warning-muted-foreground">Alta</p>
                </div>
                <div className="p-4 rounded-lg bg-destructive/10">
                  <p className="font-medium text-destructive">Crítica</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colores de Tipo de Mantenimiento</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-primary text-primary-foreground">
                  <p className="font-medium">Preventivo</p>
                  <p className="text-sm opacity-90">bg-primary</p>
                </div>
                <div className="p-4 rounded-lg bg-warning text-warning-foreground">
                  <p className="font-medium">Correctivo</p>
                  <p className="text-sm opacity-90">bg-warning</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500 text-white">
                  <p className="font-medium">Predictivo</p>
                  <p className="text-sm opacity-90">bg-purple-500</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
