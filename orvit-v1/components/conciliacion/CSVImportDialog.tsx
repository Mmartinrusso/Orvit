'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, FileSpreadsheet, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BankAccount {
  id: number;
  nombre: string;
  banco: string;
}

interface ParsedItem {
  lineNumber: number;
  fecha: string;
  fechaOriginal: string;
  descripcion: string;
  referencia: string;
  debito: number;
  credito: number;
  saldo: number;
  valid: boolean;
}

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bancos: BankAccount[];
  onImport: (data: {
    bankAccountId: number;
    periodo: string;
    items: Array<{
      lineNumber: number;
      fecha: string;
      fechaValor?: string;
      descripcion: string;
      referencia?: string;
      debito: number;
      credito: number;
      saldo: number;
    }>;
    saldoInicial: number;
    saldoFinal?: number;
    docType: 'T1' | 'T2';
  }) => void;
  isImporting: boolean;
}

// Parsear números argentinos: "1.234,56" → 1234.56, "(1.234,56)" → -1234.56
function parseArgNumber(value: string): number {
  if (!value || value.trim() === '' || value.trim() === '-') return 0;
  let cleaned = value.trim();

  // Detectar negativos entre paréntesis: (1.234,56)
  let negative = false;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    negative = true;
    cleaned = cleaned.slice(1, -1);
  } else if (cleaned.startsWith('-')) {
    negative = true;
    cleaned = cleaned.slice(1);
  }

  // Remover puntos de miles, reemplazar coma decimal por punto
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');

  // Remover cualquier carácter no numérico excepto punto
  cleaned = cleaned.replace(/[^\d.]/g, '');

  const num = parseFloat(cleaned) || 0;
  return negative ? -num : num;
}

// Parsear fecha DD/MM/YYYY → YYYY-MM-DD
function parseArgDate(value: string): { iso: string; original: string; valid: boolean } {
  const trimmed = value.trim();

  // DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const date = new Date(iso);
    return { iso, original: trimmed, valid: !isNaN(date.getTime()) };
  }

  // YYYY-MM-DD (ya es ISO)
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(trimmed);
    return { iso: trimmed, original: trimmed, valid: !isNaN(date.getTime()) };
  }

  return { iso: trimmed, original: trimmed, valid: false };
}

// Detectar separador CSV/TSV
function detectSeparator(text: string): string {
  const firstLine = text.split('\n')[0] || '';
  const separators = [';', ',', '\t', '|'];
  let best = ';';
  let maxCount = 0;

  for (const sep of separators) {
    const count = firstLine.split(sep).length;
    if (count > maxCount) {
      maxCount = count;
      best = sep;
    }
  }

  return best;
}

export default function CSVImportDialog({
  open,
  onOpenChange,
  bancos,
  onImport,
  isImporting,
}: CSVImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    bankAccountId: 0,
    periodo: format(new Date(), 'yyyy-MM'),
    saldoInicial: 0,
    docType: 'T1' as 'T1' | 'T2',
  });

  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [csvText, setCsvText] = useState('');
  const [parseError, setParseError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const resetForm = useCallback(() => {
    setFormData({
      bankAccountId: 0,
      periodo: format(new Date(), 'yyyy-MM'),
      saldoInicial: 0,
      docType: 'T1',
    });
    setParsedItems([]);
    setCsvText('');
    setParseError('');
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      setParseError('El archivo debe tener al menos un encabezado y una fila de datos');
      setParsedItems([]);
      return;
    }

    const separator = detectSeparator(text);
    const items: ParsedItem[] = [];
    const errors: string[] = [];

    // Saltar encabezado
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 4) {
        errors.push(`Línea ${i + 1}: insuficientes columnas (${cols.length})`);
        continue;
      }

      const fechaResult = parseArgDate(cols[0]);
      const item: ParsedItem = {
        lineNumber: i,
        fecha: fechaResult.iso,
        fechaOriginal: fechaResult.original,
        descripcion: cols[1] || '',
        referencia: cols[2] || '',
        debito: Math.abs(parseArgNumber(cols[3] || '0')),
        credito: Math.abs(parseArgNumber(cols[4] || '0')),
        saldo: parseArgNumber(cols[5] || '0'),
        valid: fechaResult.valid && cols[1]?.trim().length > 0,
      };

      // Si solo hay 4 columnas, puede ser monto único (negativo=débito, positivo=crédito)
      if (cols.length === 4 || cols.length === 5) {
        const monto = parseArgNumber(cols[3] || '0');
        if (monto < 0) {
          item.debito = Math.abs(monto);
          item.credito = 0;
        } else {
          item.debito = 0;
          item.credito = monto;
        }
        item.referencia = cols.length >= 5 ? cols[4] || '' : '';
        item.saldo = 0;
      }

      items.push(item);
    }

    if (errors.length > 0) {
      setParseError(`Errores en ${errors.length} línea(s): ${errors.slice(0, 3).join('; ')}`);
    } else {
      setParseError('');
    }

    setParsedItems(items);
    setShowPreview(items.length > 0);
  }, []);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'csv' && ext !== 'txt' && ext !== 'tsv') {
        toast.error('Formato no soportado. Use CSV, TXT o TSV.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvText(text);
        parseCSV(text);
      };
      reader.readAsText(file, 'UTF-8');
    },
    [parseCSV]
  );

  const handleTextPaste = useCallback(
    (text: string) => {
      setCsvText(text);
      if (text.trim().split('\n').length >= 2) {
        parseCSV(text);
      }
    },
    [parseCSV]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bankAccountId) {
      toast.error('Seleccione un banco');
      return;
    }

    const validItems = parsedItems.filter((item) => item.valid);
    if (validItems.length === 0) {
      toast.error('No hay items válidos para importar');
      return;
    }

    const saldoFinal = validItems.length > 0 ? validItems[validItems.length - 1].saldo : undefined;

    onImport({
      bankAccountId: formData.bankAccountId,
      periodo: formData.periodo,
      items: validItems.map((item) => ({
        lineNumber: item.lineNumber,
        fecha: item.fecha,
        descripcion: item.descripcion,
        referencia: item.referencia || undefined,
        debito: item.debito,
        credito: item.credito,
        saldo: item.saldo,
      })),
      saldoInicial: formData.saldoInicial,
      saldoFinal,
      docType: formData.docType,
    });
  };

  const validCount = parsedItems.filter((i) => i.valid).length;
  const invalidCount = parsedItems.filter((i) => !i.valid).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Extracto Bancario
            </DialogTitle>
            <DialogDescription>
              Importe un extracto bancario desde CSV para conciliar. Formato argentino
              soportado (DD/MM/AAAA, separador decimal coma, montos entre paréntesis).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Fila 1: Banco + Período */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Cuenta Bancaria</Label>
                <Select
                  value={formData.bankAccountId.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, bankAccountId: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {bancos.map((banco) => (
                      <SelectItem key={banco.id} value={banco.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" />
                          {banco.nombre} - {banco.banco}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="periodo">Período</Label>
                <Input
                  id="periodo"
                  type="month"
                  value={formData.periodo}
                  onChange={(e) =>
                    setFormData({ ...formData, periodo: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {/* Fila 2: Saldo Inicial + DocType */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="saldoInicial">Saldo Inicial</Label>
                <Input
                  id="saldoInicial"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.saldoInicial || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      saldoInicial: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Tipo documento</Label>
                <Select
                  value={formData.docType}
                  onValueChange={(value: 'T1' | 'T2') =>
                    setFormData({ ...formData, docType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T1">T1 - Formal</SelectItem>
                    <SelectItem value="T2">T2 - Informal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Archivo / Texto CSV */}
            <div className="grid gap-2">
              <Label>Archivo CSV</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Cargar archivo
                </Button>
                <span className="text-xs text-muted-foreground self-center">
                  o pegue los datos directamente
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Formato: Fecha;Descripción;Referencia;Débito;Crédito;Saldo (separado por ;)
              </p>
              <textarea
                className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Fecha;Descripción;Referencia;Débito;Crédito;Saldo
01/01/2024;Transferencia recibida;TRF-001;0;10000;50000
02/01/2024;Pago proveedor;PAG-123;5000;0;45000"
                value={csvText}
                onChange={(e) => handleTextPaste(e.target.value)}
              />
            </div>

            {/* Parse Error */}
            {parseError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {parseError}
              </div>
            )}

            {/* Preview */}
            {showPreview && parsedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Vista previa ({parsedItems.length} filas)</Label>
                  <div className="flex gap-2">
                    {validCount > 0 && (
                      <Badge variant="default" className="text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {validCount} válidos
                      </Badge>
                    )}
                    {invalidCount > 0 && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {invalidCount} inválidos
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border overflow-hidden max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs w-8">#</TableHead>
                        <TableHead className="text-xs">Fecha</TableHead>
                        <TableHead className="text-xs">Descripción</TableHead>
                        <TableHead className="text-xs">Referencia</TableHead>
                        <TableHead className="text-xs text-right">Débito</TableHead>
                        <TableHead className="text-xs text-right">Crédito</TableHead>
                        <TableHead className="text-xs text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedItems.slice(0, 20).map((item, idx) => (
                        <TableRow
                          key={idx}
                          className={!item.valid ? 'bg-destructive/5' : ''}
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {item.lineNumber}
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.fechaOriginal}
                            {!item.valid && (
                              <AlertCircle className="h-3 w-3 text-destructive inline ml-1" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            {item.descripcion}
                          </TableCell>
                          <TableCell className="text-xs">{item.referencia || '-'}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-red-600">
                            {item.debito > 0 ? item.debito.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-green-600">
                            {item.credito > 0 ? item.credito.toFixed(2) : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">
                            {item.saldo !== 0 ? item.saldo.toFixed(2) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedItems.length > 20 && (
                    <div className="text-center py-2 text-xs text-muted-foreground border-t">
                      ...y {parsedItems.length - 20} filas más
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isImporting || validCount === 0}
            >
              {isImporting
                ? 'Importando...'
                : `Importar ${validCount > 0 ? `(${validCount} items)` : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
