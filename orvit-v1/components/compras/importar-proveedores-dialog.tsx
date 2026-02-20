'use client';

import { useState, useCallback, useRef } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
 DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from '@/components/ui/table';
import {
 Bot,
 FileSpreadsheet,
 Copy,
 Check,
 Upload,
 AlertTriangle,
 CheckCircle2,
 Loader2,
 Download,
 X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProveedorPreview {
 nombre: string;
 razonSocial?: string;
 cuit?: string;
 email?: string;
 telefono?: string;
 direccion?: string;
 ciudad?: string;
 provincia?: string;
 codigoPostal?: string;
 contactoNombre?: string;
 condicionesPago?: string;
 condicionIva?: string;
 notas?: string;
 codigo?: string;
 _incluir: boolean;
 _error?: string;
}

interface ImportResult {
 creados: number;
 omitidos: number;
 errores: number;
 detalle: {
 creados: { id: number; nombre: string }[];
 omitidos: { nombre: string; razon: string }[];
 errores: { nombre: string; error: string }[];
 };
}

interface Props {
 isOpen: boolean;
 onClose: () => void;
 onImportado: () => void;
}

// ─── Prompt para IA externa ───────────────────────────────────────────────────

const AI_PROMPT = `Extraé la información de proveedores del texto que te voy a pasar y devolvé ÚNICAMENTE un array JSON con la estructura indicada. Sin explicaciones, sin markdown, sin texto adicional — solo el JSON puro.

Estructura de cada objeto proveedor:
{
 "nombre": "Nombre comercial (REQUERIDO)",
 "razonSocial": "Razón social legal (si no hay, igual al nombre)",
 "cuit": "XX-XXXXXXXX-X (solo si figura explícitamente)",
 "email": "email@empresa.com",
 "telefono": "+54 11 1234-5678",
 "direccion": "Av. Ejemplo 1234",
 "ciudad": "Buenos Aires",
 "provincia": "CABA",
 "codigoPostal": "C1000",
 "contactoNombre": "Nombre del contacto de la empresa",
 "contactoEmail": "contacto@empresa.com",
 "contactoTelefono": "+54 11 9876-5432",
 "condicionesPago": "30 días / contado / etc.",
 "condicionIva": "Responsable Inscripto / Monotributo / Exento",
 "notas": "Cualquier info adicional relevante"
}

Reglas:
- Omitir campos sin datos (no poner null ni string vacío)
- Un objeto por cada proveedor encontrado
- Devolver SOLO el array JSON, nada más

---
[PEGÁ ACÁ TU LISTA, EXCEL COPIADO, TEXTO O DATOS DE PROVEEDORES]`;

// ─── Plantilla CSV ────────────────────────────────────────────────────────────

const CSV_TEMPLATE_HEADERS = [
 'nombre',
 'razonSocial',
 'cuit',
 'email',
 'telefono',
 'direccion',
 'ciudad',
 'provincia',
 'codigoPostal',
 'contactoNombre',
 'condicionesPago',
 'condicionIva',
 'notas',
 'codigo',
];

const CSV_COLUMN_MAP: Record<string, keyof ProveedorPreview> = {
 nombre: 'nombre',
 name: 'nombre',
 razonsocial: 'razonSocial',
 razon_social: 'razonSocial',
 'razon social': 'razonSocial',
 cuit: 'cuit',
 email: 'email',
 correo: 'email',
 telefono: 'telefono',
 phone: 'telefono',
 tel: 'telefono',
 direccion: 'direccion',
 address: 'direccion',
 ciudad: 'ciudad',
 city: 'ciudad',
 provincia: 'provincia',
 province: 'provincia',
 codigopostal: 'codigoPostal',
 codigo_postal: 'codigoPostal',
 postal: 'codigoPostal',
 contactonombre: 'contactoNombre',
 contact_name: 'contactoNombre',
 contacto: 'contactoNombre',
 condicionespago: 'condicionesPago',
 condiciones_pago: 'condicionesPago',
 pago: 'condicionesPago',
 condicioniva: 'condicionIva',
 condicion_iva: 'condicionIva',
 iva: 'condicionIva',
 notas: 'notas',
 notes: 'notas',
 observaciones: 'notas',
 codigo: 'codigo',
 code: 'codigo',
 id: 'codigo',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCSV(text: string): ProveedorPreview[] {
 // Remover BOM si existe
 const clean = text.replace(/^\uFEFF/, '').trim();
 const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
 if (lines.length < 2) return [];

 const parseLine = (line: string): string[] => {
 const values: string[] = [];
 let current = '';
 let inQuotes = false;
 for (const char of line) {
 if (char === '"') {
 inQuotes = !inQuotes;
 } else if (char === ',' && !inQuotes) {
 values.push(current.trim());
 current = '';
 } else {
 current += char;
 }
 }
 values.push(current.trim());
 return values;
 };

 const rawHeaders = parseLine(lines[0]).map((h) =>
 h.replace(/"/g, '').toLowerCase().trim()
 );

 const mappedHeaders = rawHeaders.map((h) => CSV_COLUMN_MAP[h] || null);

 return lines.slice(1).map((line) => {
 const values = parseLine(line);
 const row: Partial<ProveedorPreview> & { _incluir: boolean } = { _incluir: true };
 mappedHeaders.forEach((field, i) => {
 if (field && values[i] && values[i] !== '') {
 (row as any)[field] = values[i].replace(/"/g, '');
 }
 });
 if (!row.nombre) row._error = 'Nombre requerido';
 return row as ProveedorPreview;
 }).filter((r) => r.nombre || r._error);
}

function parseAIJson(text: string): ProveedorPreview[] {
 // Intentar extraer JSON de la respuesta
 const trimmed = text.trim();
 let jsonStr = trimmed;

 // Remover bloques de markdown si los hay
 const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
 if (match) jsonStr = match[1].trim();

 const parsed = JSON.parse(jsonStr);
 if (!Array.isArray(parsed)) throw new Error('Se esperaba un array JSON');

 return parsed.map((item: any) => ({
 nombre: item.nombre || item.name || '',
 razonSocial: item.razonSocial || item.razon_social || '',
 cuit: item.cuit || '',
 email: item.email || '',
 telefono: item.telefono || item.phone || '',
 direccion: item.direccion || item.address || '',
 ciudad: item.ciudad || item.city || '',
 provincia: item.provincia || item.province || '',
 codigoPostal: item.codigoPostal || item.codigo_postal || '',
 contactoNombre: item.contactoNombre || item.contact_name || '',
 condicionesPago: item.condicionesPago || item.condiciones_pago || '',
 condicionIva: item.condicionIva || item.condicion_iva || '',
 notas: item.notas || item.notes || '',
 codigo: item.codigo || item.code || '',
 _incluir: true,
 _error: !item.nombre ? 'Nombre requerido' : undefined,
 }));
}

function downloadCSVTemplate() {
 const ejemplo = [
 'Proveedor Ejemplo S.A.',
 'Proveedor Ejemplo Sociedad Anónima',
 '30-12345678-9',
 'ventas@proveedor.com',
 '+54 11 1234-5678',
 'Av. Corrientes 1234',
 'Buenos Aires',
 'CABA',
 'C1000',
 'Juan Pérez',
 '30 días',
 'Responsable Inscripto',
 'Proveedor principal de insumos',
 'PROV-001',
 ];
 const content = [CSV_TEMPLATE_HEADERS.join(','), ejemplo.map((v) => `"${v}"`).join(',')].join('\n');
 const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = 'plantilla_proveedores.csv';
 link.click();
}

// ─── Preview Table ────────────────────────────────────────────────────────────

function PreviewTable({
 items,
 onToggle,
}: {
 items: ProveedorPreview[];
 onToggle: (i: number) => void;
}) {
 const validos = items.filter((i) => !i._error);
 const invalidos = items.filter((i) => i._error);

 return (
 <div className="space-y-3">
 <div className="flex items-center gap-3 text-xs">
 <span className="flex items-center gap-1 text-success">
 <CheckCircle2 className="h-3.5 w-3.5" />
 {validos.filter((i) => i._incluir).length} a importar
 </span>
 {invalidos.length > 0 && (
 <span className="flex items-center gap-1 text-warning-muted-foreground">
 <AlertTriangle className="h-3.5 w-3.5" />
 {invalidos.length} con error (se omitirán)
 </span>
 )}
 </div>

 <ScrollArea className="h-[280px] border rounded-lg">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30 text-[10px]">
 <TableHead className="w-8 py-2" />
 <TableHead className="py-2">Nombre</TableHead>
 <TableHead className="py-2">CUIT</TableHead>
 <TableHead className="py-2">Email</TableHead>
 <TableHead className="py-2">Ciudad</TableHead>
 <TableHead className="py-2">Estado</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {items.map((item, i) => (
 <TableRow
 key={i}
 className={cn(
 'text-xs cursor-pointer',
 !item._incluir && 'opacity-40',
 item._error && 'bg-warning-muted '
 )}
 onClick={() => !item._error && onToggle(i)}
 >
 <TableCell className="py-1.5">
 {item._error ? (
 <AlertTriangle className="h-3.5 w-3.5 text-warning-muted-foreground" />
 ) : item._incluir ? (
 <Check className="h-3.5 w-3.5 text-success" />
 ) : (
 <X className="h-3.5 w-3.5 text-muted-foreground" />
 )}
 </TableCell>
 <TableCell className="py-1.5 font-medium">
 {item.nombre || <span className="text-muted-foreground italic">sin nombre</span>}
 {item.razonSocial && item.razonSocial !== item.nombre && (
 <span className="block text-[10px] text-muted-foreground">{item.razonSocial}</span>
 )}
 </TableCell>
 <TableCell className="py-1.5 text-muted-foreground">{item.cuit || '-'}</TableCell>
 <TableCell className="py-1.5 text-muted-foreground truncate max-w-[120px]">
 {item.email || '-'}
 </TableCell>
 <TableCell className="py-1.5 text-muted-foreground">{item.ciudad || '-'}</TableCell>
 <TableCell className="py-1.5">
 {item._error ? (
 <Badge variant="outline" className="text-[9px] border-warning-muted text-warning-muted-foreground px-1 py-0">
 {item._error}
 </Badge>
 ) : item._incluir ? (
 <Badge variant="outline" className="text-[9px] border-success-muted text-success px-1 py-0">
 Incluir
 </Badge>
 ) : (
 <Badge variant="outline" className="text-[9px] px-1 py-0">
 Omitir
 </Badge>
 )}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </ScrollArea>

 <p className="text-[10px] text-muted-foreground">
 Hacé click en una fila para incluirla/omitirla. Los errores se omiten siempre.
 </p>
 </div>
 );
}

// ─── Resultado de importación ─────────────────────────────────────────────────

function ImportResultView({ result, onClose }: { result: ImportResult; onClose: () => void }) {
 return (
 <div className="space-y-4 py-2">
 <div className="grid grid-cols-3 gap-3">
 <div className="text-center p-3 bg-success-muted rounded-lg border border-success-muted ">
 <p className="text-2xl font-bold text-success">{result.creados}</p>
 <p className="text-xs text-success mt-0.5">Creados</p>
 </div>
 <div className="text-center p-3 bg-warning-muted rounded-lg border border-warning-muted ">
 <p className="text-2xl font-bold text-warning-muted-foreground">{result.omitidos}</p>
 <p className="text-xs text-warning-muted-foreground mt-0.5">Omitidos</p>
 </div>
 <div className="text-center p-3 bg-destructive/10 rounded-lg border border-destructive/30 ">
 <p className="text-2xl font-bold text-destructive">{result.errores}</p>
 <p className="text-xs text-destructive mt-0.5">Errores</p>
 </div>
 </div>

 {result.detalle.omitidos.length > 0 && (
 <div>
 <p className="text-xs font-medium text-warning-muted-foreground mb-1">Omitidos (duplicados u otros):</p>
 <ScrollArea className="h-[100px] border rounded-md p-2 bg-warning-muted/50 ">
 {result.detalle.omitidos.map((o, i) => (
 <p key={i} className="text-[11px] text-warning-muted-foreground py-0.5">
 <span className="font-medium">{o.nombre}</span> — {o.razon}
 </p>
 ))}
 </ScrollArea>
 </div>
 )}

 {result.detalle.errores.length > 0 && (
 <div>
 <p className="text-xs font-medium text-destructive mb-1">Errores:</p>
 <ScrollArea className="h-[80px] border rounded-md p-2 bg-destructive/10/50 ">
 {result.detalle.errores.map((e, i) => (
 <p key={i} className="text-[11px] text-destructive py-0.5">
 <span className="font-medium">{e.nombre}</span> — {e.error}
 </p>
 ))}
 </ScrollArea>
 </div>
 )}

 <Button className="w-full" onClick={onClose}>
 <CheckCircle2 className="h-4 w-4 mr-2" />
 Cerrar
 </Button>
 </div>
 );
}

// ─── Dialog principal ─────────────────────────────────────────────────────────

export function ImportarProveedoresDialog({ isOpen, onClose, onImportado }: Props) {
 // Estado IA
 const [promptCopiado, setPromptCopiado] = useState(false);
 const [aiJson, setAiJson] = useState('');
 const [aiItems, setAiItems] = useState<ProveedorPreview[]>([]);
 const [aiParseError, setAiParseError] = useState('');

 // Estado CSV
 const [csvItems, setCsvItems] = useState<ProveedorPreview[]>([]);
 const [csvError, setCsvError] = useState('');
 const [isDragging, setIsDragging] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Estado compartido
 const [activeTab, setActiveTab] = useState<'ia' | 'csv'>('ia');
 const [importing, setImporting] = useState(false);
 const [result, setResult] = useState<ImportResult | null>(null);

 const handleClose = () => {
 setAiJson('');
 setAiItems([]);
 setAiParseError('');
 setCsvItems([]);
 setCsvError('');
 setResult(null);
 setPromptCopiado(false);
 onClose();
 };

 // ── Copiar prompt ──
 const copyPrompt = async () => {
 try {
 await navigator.clipboard.writeText(AI_PROMPT);
 setPromptCopiado(true);
 setTimeout(() => setPromptCopiado(false), 2500);
 toast.success('Prompt copiado');
 } catch {
 toast.error('No se pudo copiar');
 }
 };

 // ── Parsear JSON de IA ──
 const handleAiJsonChange = (text: string) => {
 setAiJson(text);
 setAiParseError('');
 setAiItems([]);
 if (!text.trim()) return;
 try {
 const items = parseAIJson(text);
 setAiItems(items);
 } catch (e: any) {
 setAiParseError('No se pudo parsear el JSON. Asegurate de pegar solo el array devuelto por la IA.');
 }
 };

 // ── Toggle inclusión ──
 const toggleAiItem = (i: number) => {
 setAiItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, _incluir: !item._incluir } : item)));
 };
 const toggleCsvItem = (i: number) => {
 setCsvItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, _incluir: !item._incluir } : item)));
 };

 // ── Parsear CSV ──
 const handleCSVFile = useCallback((file: File) => {
 setCsvError('');
 const reader = new FileReader();
 reader.onload = (e) => {
 const text = e.target?.result as string;
 if (!text) {
 setCsvError('Archivo vacío');
 return;
 }
 const items = parseCSV(text);
 if (items.length === 0) {
 setCsvError('No se encontraron datos válidos. Verificá el formato del archivo.');
 return;
 }
 setCsvItems(items);
 };
 reader.onerror = () => setCsvError('Error al leer el archivo');
 reader.readAsText(file, 'utf-8');
 }, []);

 const handleDrop = useCallback(
 (e: React.DragEvent) => {
 e.preventDefault();
 setIsDragging(false);
 const file = e.dataTransfer.files[0];
 if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
 handleCSVFile(file);
 } else {
 setCsvError('Solo se aceptan archivos .csv');
 }
 },
 [handleCSVFile]
 );

 // ── Importar ──
 const handleImport = async (items: ProveedorPreview[]) => {
 const toImport = items.filter((i) => i._incluir && !i._error);
 if (toImport.length === 0) {
 toast.error('No hay proveedores válidos seleccionados');
 return;
 }

 setImporting(true);
 try {
 const response = await fetch('/api/compras/proveedores/bulk', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ proveedores: toImport }),
 });

 if (!response.ok) {
 const err = await response.json().catch(() => ({}));
 throw new Error(err.error || 'Error del servidor');
 }

 const data: ImportResult = await response.json();
 setResult(data);
 onImportado();
 if (data.creados > 0) {
 toast.success(`${data.creados} proveedor(es) importado(s) exitosamente`);
 }
 } catch (err: any) {
 toast.error(err.message || 'Error al importar');
 } finally {
 setImporting(false);
 }
 };

 // ─────────────────────────────────────────────────────────────────────────────

 return (
 <Dialog open={isOpen} onOpenChange={handleClose}>
 <DialogContent size="xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Upload className="h-5 w-5 text-info-muted-foreground" />
 Importar Proveedores Masivamente
 </DialogTitle>
 </DialogHeader>

 <DialogBody>
 {result ? (
 <ImportResultView result={result} onClose={handleClose} />
 ) : (
 <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ia' | 'csv')}>
 <TabsList className="grid w-full grid-cols-2">
 <TabsTrigger value="ia" className="gap-2">
 <Bot className="h-4 w-4" />
 Con IA Externa
 </TabsTrigger>
 <TabsTrigger value="csv" className="gap-2">
 <FileSpreadsheet className="h-4 w-4" />
 Excel / CSV
 </TabsTrigger>
 </TabsList>

 {/* ─── Tab IA ──────────────────────────────────── */}
 <TabsContent value="ia" className="space-y-4 mt-4">
 {/* Paso 1: Prompt */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <p className="text-sm font-medium flex items-center gap-2">
 <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
 1
 </span>
 Copiá el prompt y enviáselo a ChatGPT o Claude
 </p>
 <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyPrompt}>
 {promptCopiado ? (
 <>
 <Check className="h-3.5 w-3.5 text-success" />
 Copiado
 </>
 ) : (
 <>
 <Copy className="h-3.5 w-3.5" />
 Copiar prompt
 </>
 )}
 </Button>
 </div>
 <div className="relative">
 <pre className="text-[10px] text-muted-foreground bg-muted/50 border rounded-lg p-3 overflow-auto max-h-[120px] leading-relaxed whitespace-pre-wrap">
 {AI_PROMPT}
 </pre>
 </div>
 <p className="text-[11px] text-muted-foreground">
 Pegá el prompt en la IA, agregá tu lista de proveedores al final y enviá. La IA te va a devolver un JSON.
 </p>
 </div>

 {/* Paso 2: Pegar resultado */}
 <div className="space-y-2">
 <p className="text-sm font-medium flex items-center gap-2">
 <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
 2
 </span>
 Pegá el JSON que devolvió la IA
 </p>
 <Textarea
 value={aiJson}
 onChange={(e) => handleAiJsonChange(e.target.value)}
 placeholder={'[\n { "nombre": "Proveedor ABC", "cuit": "30-12345678-9", ... }\n]'}
 className="font-mono text-xs min-h-[100px] resize-none"
 />
 {aiParseError && (
 <Alert variant="destructive" className="py-2">
 <AlertTriangle className="h-4 w-4" />
 <AlertDescription className="text-xs">{aiParseError}</AlertDescription>
 </Alert>
 )}
 </div>

 {/* Preview IA */}
 {aiItems.length > 0 && (
 <div className="space-y-2">
 <p className="text-sm font-medium flex items-center gap-2">
 <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
 3
 </span>
 Revisá y confirmá
 </p>
 <PreviewTable items={aiItems} onToggle={toggleAiItem} />
 </div>
 )}
 </TabsContent>

 {/* ─── Tab CSV ──────────────────────────────────── */}
 <TabsContent value="csv" className="space-y-4 mt-4">
 <div className="flex items-center justify-between">
 <p className="text-sm font-medium">Subí tu archivo CSV de proveedores</p>
 <Button
 variant="outline"
 size="sm"
 className="h-7 gap-1.5 text-xs"
 onClick={downloadCSVTemplate}
 >
 <Download className="h-3.5 w-3.5" />
 Descargar plantilla
 </Button>
 </div>

 {csvItems.length === 0 ? (
 <div
 className={cn(
 'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
 isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
 )}
 onDragOver={(e) => {
 e.preventDefault();
 setIsDragging(true);
 }}
 onDragLeave={() => setIsDragging(false)}
 onDrop={handleDrop}
 onClick={() => fileInputRef.current?.click()}
 >
 <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
 <p className="text-sm font-medium">
 Arrastrá tu CSV o hacé click para seleccionar
 </p>
 <p className="text-xs text-muted-foreground mt-1">
 Formato: .csv con encabezados en la primera fila
 </p>
 <input
 ref={fileInputRef}
 type="file"
 accept=".csv,.txt"
 className="hidden"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) handleCSVFile(file);
 }}
 />
 </div>
 ) : (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <p className="text-sm font-medium">Vista previa</p>
 <Button
 variant="ghost"
 size="sm"
 className="h-7 text-xs gap-1"
 onClick={() => {
 setCsvItems([]);
 setCsvError('');
 if (fileInputRef.current) fileInputRef.current.value = '';
 }}
 >
 <X className="h-3.5 w-3.5" />
 Cambiar archivo
 </Button>
 </div>
 <PreviewTable items={csvItems} onToggle={toggleCsvItem} />
 </div>
 )}

 {csvError && (
 <Alert variant="destructive" className="py-2">
 <AlertTriangle className="h-4 w-4" />
 <AlertDescription className="text-xs">{csvError}</AlertDescription>
 </Alert>
 )}

 <Alert className="py-2">
 <AlertDescription className="text-[11px] text-muted-foreground">
 <strong>Columnas esperadas:</strong> nombre, razonSocial, cuit, email, telefono, direccion, ciudad, provincia, codigoPostal, contactoNombre, condicionesPago, condicionIva, notas, codigo
 </AlertDescription>
 </Alert>
 </TabsContent>
 </Tabs>
 )}
 </DialogBody>

 {!result && (
 <DialogFooter>
 <Button variant="outline" onClick={handleClose} disabled={importing}>
 Cancelar
 </Button>
 {activeTab === 'ia' && aiItems.filter((i) => i._incluir && !i._error).length > 0 && (
 <Button disabled={importing} onClick={() => handleImport(aiItems)} className="gap-2">
 {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
 Importar {aiItems.filter((i) => i._incluir && !i._error).length} proveedor(es)
 </Button>
 )}
 {activeTab === 'csv' && csvItems.filter((i) => i._incluir && !i._error).length > 0 && (
 <Button disabled={importing} onClick={() => handleImport(csvItems)} className="gap-2">
 {importing ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <FileSpreadsheet className="h-4 w-4" />
 )}
 Importar {csvItems.filter((i) => i._incluir && !i._error).length} proveedor(es)
 </Button>
 )}
 </DialogFooter>
 )}
 </DialogContent>
 </Dialog>
 );
}
