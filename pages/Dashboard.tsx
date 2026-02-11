
import * as React from 'react';
import { useMemo } from 'react';
import {
  TrendingUp,
  Users,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Tent
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Order, OrderStatus, Product, TechnicalSheet, Appointment } from '../types';

const data = [
  { name: 'Seg', vendas: 4000, pcp: 2400 },
  { name: 'Ter', vendas: 3000, pcp: 1398 },
  { name: 'Qua', vendas: 2000, pcp: 9800 },
  { name: 'Qui', vendas: 2780, pcp: 3908 },
  { name: 'Sex', vendas: 1890, pcp: 4800 },
  { name: 'Sab', vendas: 2390, pcp: 3800 },
];

interface DashboardProps {
  orders: Order[];
  appointments: Appointment[];
  products: Product[];
  technicalSheets: TechnicalSheet[];
}

const Dashboard = ({ orders, appointments, products, technicalSheets }: DashboardProps) => {
  const stats = useMemo(() => {
    const now = new Date();
    const confirmedOrders = orders.filter((o: Order) =>
      o.status !== OrderStatus.QUOTE_SENT &&
      o.status !== OrderStatus.PENDING_MEASUREMENT &&
      o.status !== OrderStatus.TECHNICAL_SHEET_CREATED
    );

    const currentMonthOrders = confirmedOrders.filter((o: Order) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    let toldoTotal = 0;
    let cortinaTotal = 0;

    currentMonthOrders.forEach((order: Order) => {
      const sheet = technicalSheets.find((s: TechnicalSheet) => s.id === order.technicalSheetId);
      if (!sheet) return;

      const items = order.itemIds ? sheet.items.filter((i: any) => order.itemIds?.includes(i.id)) : sheet.items;
      let orderToldoRaw = 0;
      let orderCortinaRaw = 0;

      items.forEach((item: any) => {
        const product = products.find((p: Product) => p.id === item.productId);
        if (!product) return;
        const area = (item.width * item.height) || 1;
        const val = product.unidade === 'M2' ? product.valor * area : product.valor;
        if (product.tipo === 'Toldo') orderToldoRaw += val;
        // Fix: Use orderCortinaRaw instead of undefined orderCortinaTotal
        else orderCortinaRaw += val; // Corrigido: acumular no total de cortina
      });

      // Prorate based on items to split the actual final totalValue
      const totalRaw = orderToldoRaw + orderCortinaRaw;
      if (totalRaw > 0) {
        const ratioToldo = orderToldoRaw / totalRaw;
        const ratioCortina = orderCortinaRaw / totalRaw;
        toldoTotal += order.totalValue * ratioToldo;
        cortinaTotal += order.totalValue * ratioCortina;
      } else {
        // Fallback se não houver itens com valor: assume pela maioria (mock)
        toldoTotal += order.totalValue;
      }
    });

    return {
      toldoTotal,
      cortinaTotal,
      totalGeral: toldoTotal + cortinaTotal,
      activeOrders: confirmedOrders.length
    };
  }, [orders, products, technicalSheets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Visão Geral</h2>
          <p className="text-slate-500">Bem-vindo de volta ao painel administrativo.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            Exportar Relatório
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-shadow shadow-md">
            Novo Orçamento
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Vendas Mês: Toldo', value: `R$ ${stats.toldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: <Tent className="text-orange-500" />, trend: 'Atualizado', isUp: true },
          { label: 'Vendas Mês: Cortina', value: `R$ ${stats.cortinaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: <Layers className="text-blue-500" />, trend: 'Atualizado', isUp: true },
          { label: 'Total do Mês', value: `R$ ${stats.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: <TrendingUp className="text-emerald-500" />, trend: 'Real', isUp: true },
          { label: 'Contratos Ativos', value: stats.activeOrders.toString(), icon: <Clock className="text-indigo-500" />, trend: 'Vigentes', isUp: true },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-xl">{stat.icon}</div>
              <div className={`flex items-center text-[10px] font-black px-2 py-1 rounded-full ${stat.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} uppercase tracking-tighter`}>
                {stat.trend}
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-900">Desempenho de Produção vs Vendas</h3>
            <select className="text-xs border-none bg-slate-100 rounded p-1 outline-none">
              <option>Últimos 7 dias</option>
              <option>Últimos 30 dias</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="vendas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVendas)" />
                <Area type="monotone" dataKey="pcp" stroke="#f59e0b" strokeWidth={3} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Column */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Próximas Visitas</h3>
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">Nenhuma visita agendada</p>
            ) : (
              appointments.slice(0, 5).map((app: Appointment, i: number) => (
                <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex flex-col items-center justify-center shrink-0 border border-indigo-100">
                    <span className="text-[10px] uppercase font-black">{new Date(app.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    <span className="text-lg font-black leading-none">{new Date(app.date).getDate()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{orders.find((o: Order) => o.customerId === app.customerId)?.id || 'Novo Cliente'}</p>
                    <p className="text-[11px] text-slate-500 mt-1 uppercase font-medium">{app.time} • Visita Técnica</p>
                  </div>
                </div>
              ))
            )}
            <button className="w-full py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors mt-4">
              Ver Agenda Completa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
