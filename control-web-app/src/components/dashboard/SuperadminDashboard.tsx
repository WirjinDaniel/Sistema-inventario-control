'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ColmadoStats {
  id: number;
  nombre: string;
  ventas_hoy: number;
  tickets_hoy: number;
  usuarios: number;
  productos: number;
}

interface DashboardData {
  periodo: string;
  colmados_activos: number;
  ventas_totales: number;
  ventas_hoy: number;
  tickets_totales: number;
  tickets_hoy: number;
  clientes_activos: number;
  productos_totales: number;
  productos_bajo_stock: number;
  gastos_totales: number;
  gastos_hoy: number;
  colmados_stats: ColmadoStats[];
}

interface VentasPorColmado {
  colmado_nombre: string;
  total: number;
  porcentaje: number;
  tickets: number;
}

export default function SuperadminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [ventasColmado, setVentasColmado] = useState<VentasPorColmado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ventasRes] = await Promise.all([
          api.get('/dashboard/stats/'),
          api.get('/dashboard/ventas-por-colmado/'),
        ]);
        setData(statsRes.data);
        setVentasColmado(ventasRes.data);
      } catch (err) {
        console.error('Error fetcheando dashboard:', err);
        setError('Error al cargar los datos del dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-4">Cargando dashboard global...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!data) return <div className="p-4">Error al cargar datos</div>;

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Global - Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Consolidado de todos los colmados</p>
      </div>

      {/* Resumen de Números */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Ventas Hoy" value={`RD$${Number(data.ventas_hoy).toFixed(2)}`} color="blue" />
        <Card title="Tickets Hoy" value={data.tickets_hoy} color="green" />
        <Card title="Colmados Activos" value={data.colmados_activos} color="purple" />
        <Card title="Ventas Totales (todo)" value={`RD$${Number(data.ventas_totales).toFixed(2)}`} color="indigo" />
      </div>

      {/* Segunda fila */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Clientes Activos" value={data.clientes_activos} color="orange" />
        <Card title="Productos" value={data.productos_totales} color="cyan" />
        <Card title="Stock Bajo" value={data.productos_bajo_stock} color="red" />
        <Card title="Gastos Hoy" value={`RD$${Number(data.gastos_hoy).toFixed(2)}`} color="yellow" />
      </div>

      {/* Gráfico de ventas por colmado */}
      {ventasColmado.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Ventas por Colmado (Últimos 30 días)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ventasColmado}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="colmado_nombre" />
              <YAxis />
              <Tooltip formatter={(value) => `RD$${value}`} />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" name="Ventas (RD$)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ranking por colmado */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Stats por Colmado (Hoy)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Colmado</th>
                <th className="px-4 py-2 text-right">Ventas (RD$)</th>
                <th className="px-4 py-2 text-right">Tickets</th>
                <th className="px-4 py-2 text-right">Usuarios</th>
                <th className="px-4 py-2 text-right">Productos</th>
              </tr>
            </thead>
            <tbody>
              {data.colmados_stats.map((col, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold">{col.nombre}</td>
                  <td className="px-4 py-2 text-right">{Number(col.ventas_hoy).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{col.tickets_hoy}</td>
                  <td className="px-4 py-2 text-right">{col.usuarios}</td>
                  <td className="px-4 py-2 text-right">{col.productos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking de ventas */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Ranking de Ventas</h2>
        <div className="space-y-3">
          {ventasColmado.map((col, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 rounded-full font-bold text-sm">
                  {idx + 1}
                </span>
                <span className="font-semibold">{col.colmado_nombre}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="font-bold">RD${Number(col.total).toFixed(2)}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-300 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min(Number(col.porcentaje), 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{Number(col.porcentaje).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, color }: { title: string; value: string | number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    orange: 'bg-orange-50 border-orange-200',
    cyan: 'bg-cyan-50 border-cyan-200',
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };

  const textClasses = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    purple: 'text-purple-700',
    indigo: 'text-indigo-700',
    orange: 'text-orange-700',
    cyan: 'text-cyan-700',
    red: 'text-red-700',
    yellow: 'text-yellow-700',
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} border-l-4 p-4 rounded`}>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${textClasses[color as keyof typeof textClasses]}`}>{value}</p>
    </div>
  );
}
