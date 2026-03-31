
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
import { Order, OrderStatus, Product, TechnicalSheet, Appointment, FinancialTransaction } from '../types';

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
  transactions: FinancialTransaction[];
}

const Dashboard = ({ orders, appointments, products, technicalSheets, transactions }: DashboardProps) => {
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

      let orderToldoRaw = 0;
      let orderCortinaRaw = 0;

      if (sheet) {
        const items = order.itemIds ? sheet.items.filter((i: any) => order.itemIds?.includes(i.id)) : sheet.items;
        items.forEach((item: any) => {
          const product = products.find((p: Product) => p.id === item.productId);
          if (!product) return;
          const area = (item.width * item.height) || 1;
          const val = product.unidade === 'M2' ? product.valor * area : product.valor;
          const tipo = product.tipo?.toLowerCase() || '';
          if (tipo === 'toldo' || tipo === 'cobertura') orderToldoRaw += val;
          else orderCortinaRaw += val;
        });
      }

      const totalRaw = orderToldoRaw + orderCortinaRaw;
      if (totalRaw > 0) {
        const ratioToldo = orderToldoRaw / totalRaw;
        const ratioCortina = orderCortinaRaw / totalRaw;
        toldoTotal += order.totalValue * ratioToldo;
        cortinaTotal += order.totalValue * ratioCortina;
      } else {
        toldoTotal += order.totalValue;
      }
    });

    const income = transactions.filter(t => t.status === 'PAID' && t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.status === 'PAID' && t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);

    return {
      toldoTotal,
      cortinaTotal,
      totalGeral: toldoTotal + cortinaTotal,
      activeOrders: confirmedOrders.length,
      financial: { income, expense, balance: income - expense }
    };
  }, [orders, products, technicalSheets, transactions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Visão Geral</h2>
          <p className="text-slate-500">Bem-vindo de volta ao painel administrativo.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
            Exportar Relatório
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <ArrowUpRight size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realizado</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total de Entradas</p>
          <p className="text-2xl font-black mt-2 text-emerald-600">
            R$ {stats.financial.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
              <ArrowDownRight size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realizado</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total de Saídas</p>
          <p className="text-2xl font-black mt-2 text-rose-600">
            R$ {stats.financial.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-200 transition-all hover:translate-y-[-2px]">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 rounded-xl text-white">
              <TrendingUp size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Atual</span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Balanço em Caixa</p>
          <p className="text-2xl font-black mt-2 text-white">
            R$ {stats.financial.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <TrendingUp size={24} />
            </div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Vendas (Mês)</p>
          </div>
          <p className="text-2xl font-black text-slate-900">R$ {stats.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <Users size={24} />
            </div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pedidos Ativos</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.activeOrders}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
              <Layers size={24} />
            </div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Toldos (Mês)</p>
          </div>
          <p className="text-2xl font-black text-slate-900">R$ {stats.toldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <Tent size={24} />
            </div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Cortinas (Mês)</p>
          </div>
          <p className="text-2xl font-black text-slate-900">R$ {stats.cortinaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Desempenho Semanal</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="vendas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pcp" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Crescimento Mensal</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="vendas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVendas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
