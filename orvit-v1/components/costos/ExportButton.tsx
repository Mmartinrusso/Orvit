'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProductPrice {
  id: number;
  product_name: string;
  product_description: string;
  sku: string;
  current_price: number;
  current_cost: number;
  stock_quantity: number;
  category_name: string;
  calculated_cost: number;
  calculated_price: number;
  cost_breakdown: {
    materials: number;
    indirect_costs: number;
    employee_costs: number;
    total: number;
  };
  average_sale_price: number;
  recipe_name: string | null;
}

interface ExportButtonProps {
  data: ProductPrice[];
  filename?: string;
}

export function ExportButton({ data, filename = 'costos-productos' }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const headers = [
        'ID',
        'Producto',
        'SKU',
        'Categoría',
        'Receta',
        'Stock',
        'Costo Calculado',
        'Precio Actual',
        'Precio Venta Promedio',
        'Materiales',
        'Costos Indirectos',
        'Costos Empleados',
        'Costo Total',
        'Margen (%)'
      ];

      const rows = data.map(product => {
        const margin = product.average_sale_price > 0 
          ? ((product.average_sale_price - product.calculated_cost) / product.average_sale_price) * 100 
          : 0;

        return [
          product.id,
          `"${product.product_name}"`,
          `"${product.sku}"`,
          `"${product.category_name}"`,
          `"${product.recipe_name || 'Sin receta'}"`,
          product.stock_quantity,
          product.calculated_cost,
          product.current_price,
          product.average_sale_price,
          product.cost_breakdown.materials,
          product.cost_breakdown.indirect_costs,
          product.cost_breakdown.employee_costs,
          product.cost_breakdown.total,
          margin.toFixed(2)
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exportando CSV:', error);
      toast.error('Error al exportar archivo CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = async () => {
    setIsExporting(true);
    try {
      const exportData = {
        exported_at: new Date().toISOString(),
        total_products: data.length,
        products: data.map(product => ({
          ...product,
          margin_percentage: product.average_sale_price > 0 
            ? ((product.average_sale_price - product.calculated_cost) / product.average_sale_price) * 100 
            : 0
        }))
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.json`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exportando JSON:', error);
      toast.error('Error al exportar archivo JSON');
    } finally {
      setIsExporting(false);
    }
  };

  const exportSummaryReport = async () => {
    setIsExporting(true);
    try {
      const categories = Array.from(new Set(data.map(p => p.category_name))).sort();
      
      let report = `REPORTE DE COSTOS DE PRODUCTOS\n`;
      report += `Generado el: ${new Date().toLocaleDateString('es-AR')}\n`;
      report += `Total de productos: ${data.length}\n\n`;

      // Resumen general
      const totalProducts = data.length;
      const productsWithRecipe = data.filter(p => p.recipe_name !== null).length;
      const productsWithZeroCost = data.filter(p => p.calculated_cost === 0).length;
      const averageCost = data.length > 0 
        ? data.reduce((sum, p) => sum + p.calculated_cost, 0) / data.length 
        : 0;
      const totalValue = data.reduce((sum, p) => sum + (p.calculated_cost * p.stock_quantity), 0);

      report += `RESUMEN GENERAL\n`;
      report += `===============\n`;
      report += `Total productos: ${totalProducts}\n`;
      report += `Productos con receta: ${productsWithRecipe}\n`;
      report += `Productos sin receta: ${totalProducts - productsWithRecipe}\n`;
      report += `Productos con costo $0: ${productsWithZeroCost}\n`;
      report += `Costo promedio: ${formatCurrency(averageCost)}\n`;
      report += `Valor total del inventario: ${formatCurrency(totalValue)}\n\n`;

      // Resumen por categoría
      report += `RESUMEN POR CATEGORÍA\n`;
      report += `=====================\n`;
      
      categories.forEach(category => {
        const categoryProducts = data.filter(p => p.category_name === category);
        const avgCost = categoryProducts.length > 0 
          ? categoryProducts.reduce((sum, p) => sum + p.calculated_cost, 0) / categoryProducts.length 
          : 0;
        const totalValue = categoryProducts.reduce((sum, p) => sum + (p.calculated_cost * p.stock_quantity), 0);
        
        report += `\n${category}:\n`;
        report += `  Productos: ${categoryProducts.length}\n`;
        report += `  Costo promedio: ${formatCurrency(avgCost)}\n`;
        report += `  Valor total: ${formatCurrency(totalValue)}\n`;
      });

      // Top productos
      report += `\n\nTOP 10 PRODUCTOS POR VALOR DE STOCK\n`;
      report += `===================================\n`;
      
      const topByValue = data
        .sort((a, b) => (b.calculated_cost * b.stock_quantity) - (a.calculated_cost * a.stock_quantity))
        .slice(0, 10);
      
      topByValue.forEach((product, index) => {
        const value = product.calculated_cost * product.stock_quantity;
        report += `${index + 1}. ${product.product_name} (${product.sku}): ${formatCurrency(value)}\n`;
      });

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte-${filename}-${new Date().toISOString().slice(0, 10)}.txt`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exportando reporte:', error);
      toast.error('Error al exportar reporte');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting || data.length === 0}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportSummaryReport}>
          <FileText className="h-4 w-4 mr-2" />
          Reporte Resumen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}