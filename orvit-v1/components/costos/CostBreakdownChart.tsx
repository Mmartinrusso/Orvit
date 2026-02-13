'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CostBreakdownChartProps {
  data: {
    materials: number;
    indirect_costs: number;
    employee_costs: number;
  };
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6'];

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  const total = data.materials + data.indirect_costs + data.employee_costs;
  
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos de costos para mostrar
      </div>
    );
  }

  const chartData = [
    {
      name: 'Materiales',
      value: data.materials,
      percentage: ((data.materials / total) * 100).toFixed(1)
    },
    {
      name: 'Costos Indirectos',
      value: data.indirect_costs,
      percentage: ((data.indirect_costs / total) * 100).toFixed(1)
    },
    {
      name: 'Costos Empleados',
      value: data.employee_costs,
      percentage: ((data.employee_costs / total) * 100).toFixed(1)
    }
  ].filter(item => item.value > 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-blue-600">{formatCurrency(data.value)}</p>
          <p className="text-sm text-muted-foreground">{data.percentage}% del total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name}: ${percentage}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}