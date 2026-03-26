
import * as React from 'react';
import { useMemo, useState, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart, 
  Pie
} from 'recharts';
import { 
  FileText, 
  Filter, 
  Download, 
  TrendingUp, 
  Users, 
  Package, 
  Search,
  Calendar,
  ChevronRight,
  ArrowRight,
  Printer
} from 'lucide-react';
import { Order, OrderStatus, Product, TechnicalSheet, Seller, Customer } from '../types';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface SalesReportProps {
  orders: Order[];
  sellers: Seller[];
  products: Product[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const SalesReport = ({ orders, sellers, products, customers, technicalSheets }: SalesReportProps) => {
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSellerId, setFilterSellerId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const reportData = useMemo(() => {
    const confirmedOrders = orders.filter((o: Order) => 
      o.status !== OrderStatus.QUOTE_SENT && 
      o.status !== OrderStatus.PENDING_MEASUREMENT
    );

    return confirmedOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const customer = customers.find(c => c.id === order.customerId);
      const matchSeller = filterSellerId === '' || order.sellerId === filterSellerId;
      
      const matchDateStart = filterStartDate === '' || orderDate >= new Date(filterStartDate);
      const matchDateEnd = filterEndDate === '' || orderDate <= new Date(filterEndDate + 'T23:59:59');
      
      const matchSearch = searchTerm === '' || 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.contractNumber?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchType = true;
      if (filterType !== '') {
        const sheet = technicalSheets.find(s => s.id === order.technicalSheetId);
        const items = order.itemsSnapshot || (sheet ? sheet.items : []);
        matchType = items.some((item: any) => {
            const prod = products.find(p => p.id === item.productId);
            return prod?.tipo === filterType || item.productType === filterType;
        });
      }

      return matchSeller && matchDateStart && matchDateEnd && matchSearch && matchType;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, customers, filterSellerId, filterStartDate, filterEndDate, searchTerm, filterType, technicalSheets, products]);

  const stats = useMemo(() => {
    const totalValue = reportData.reduce((acc, o) => acc + o.totalValue, 0);
    const count = reportData.length;
    const avgTicket = count > 0 ? totalValue / count : 0;

    const salesBySeller = sellers.map(seller => {
      const sellerOrders = reportData.filter(o => o.sellerId === seller.id);
      return {
        name: seller.name,
        value: sellerOrders.reduce((acc, o) => acc + o.totalValue, 0),
        count: sellerOrders.length
      };
    }).filter(s => s.count > 0).sort((a, b) => b.value - a.value);

    const typeMap: Record<string, number> = {};
    reportData.forEach(order => {
      const sheet = technicalSheets.find(s => s.id === order.technicalSheetId);
      const items = order.itemsSnapshot || (sheet ? sheet.items : []);
      items.forEach((item: any) => {
        const prod = products.find(p => p.id === item.productId);
        const type = prod?.tipo || item.productType || 'Outros';
        const itemValue = order.totalValue / (items.length || 1);
        typeMap[type] = (typeMap[type] || 0) + itemValue;
      });
    });

    const salesByType = Object.entries(typeMap).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const salesByDay: Record<string, number> = {};
    reportData.forEach(o => {
      const dateKey = new Date(o.createdAt).toLocaleDateString();
      salesByDay[dateKey] = (salesByDay[dateKey] || 0) + o.totalValue;
    });

    const dailyData = Object.entries(salesByDay).map(([date, value]) => ({ date, value }))
      .sort((a, b) => {
          const [dayA, monthA, yearA] = a.date.split('/');
          const [dayB, monthB, yearB] = b.date.split('/');
          return new Date(`${yearA}-${monthA}-${dayA}`).getTime() - new Date(`${yearB}-${monthB}-${dayB}`).getTime();
      });

    return { totalValue, count, avgTicket, salesBySeller, salesByType, dailyData };
  }, [reportData, sellers, products, technicalSheets]);

  const productTypes = useMemo(() => {
    const types = new Set<string>();
    products.forEach(p => { if (p.tipo) types.add(p.tipo); });
    return Array.from(types).sort();
  }, [products]);

  const exportToExcel = () => {
    const exportData = reportData.map(order => {
      const seller = sellers.find(s => s.id === order.sellerId);
      const customer = customers.find(c => c.id === order.customerId);
      const sheet = technicalSheets.find(s => s.id === order.technicalSheetId);
      const items = order.itemsSnapshot || (sheet ? sheet.items : []);
      const productList = items.map((item: any) => {
        const prod = products.find(p => p.id === item.productId);
        return `${item.quantity || 1}x ${prod?.nome || item.productType || 'Produto'}`;
      }).join(', ');

      return {
        'ID Pedido': order.contractNumber || order.id,
        'Data': new Date(order.createdAt).toLocaleDateString(),
        'Cliente': customer?.name || 'N/D',
        'Vendedor': seller?.name || 'N/D',
        'Produtos': productList,
        'Valor Total': order.totalValue,
        'Status': order.status,
        'NFe': order.nfeNumber || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    XLSX.writeFile(wb, `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    if (!reportRef.current) return;
    
    // Clone and customize for PDF
    const element = reportRef.current.cloneNode(true) as HTMLElement;
    
    // Add PDF Header (it's hidden in UI but we'll show it in PDF)
    const pdfHeader = element.querySelector('.pdf-header');
    if (pdfHeader) pdfHeader.classList.remove('hidden');

    // Hide unwanted elements in PDF
    const noPdfElements = element.querySelectorAll('.no-pdf');
    noPdfElements.forEach(el => (el as HTMLElement).style.display = 'none');

    // Remove "Produtos" column from PDF table (Header and Cells)
    const table = element.querySelector('table');
    if (table) {
        // Encontrar o índice da coluna "Produtos"
        const headers = Array.from(table.querySelectorAll('thead th'));
        const productsIdx = headers.findIndex(h => h.textContent?.includes('Produtos'));
        
        if (productsIdx !== -1) {
            // Remover header
            headers[productsIdx].remove();
            
            // Remover células em cada linha
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells[productsIdx]) cells[productsIdx].remove();
            });
        }
        
        // Aplicar estilo de tabela formal (com bordas) para o PDF
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.querySelectorAll('th, td').forEach(cell => {
            (cell as HTMLElement).style.border = '1px solid #e2e8f0';
            (cell as HTMLElement).style.padding = '8px';
        });
        table.querySelectorAll('th').forEach(th => {
            (th as HTMLElement).style.backgroundColor = '#f8fafc';
        });
    }

    const opt = {
      margin: 10,
      filename: `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Relatório de Vendas</h2>
          <p className="text-slate-500 text-sm">Análise detalhada de performance e faturamento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Download size={18} /> Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
          >
            <Printer size={18} /> PDF
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Início</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="date" 
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-40"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fim</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="date" 
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-40"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vendedor</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={filterSellerId}
              onChange={(e) => setFilterSellerId(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none min-w-[160px]"
            >
              <option value="">Todos Vendedores</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo</label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none min-w-[140px]"
            >
              <option value="">Todos Tipos</option>
              {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pesquisa</label>
          <div className="relative font-bold">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar pedido ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <button 
          onClick={() => {
            setFilterStartDate(''); setFilterEndDate(''); 
            setFilterSellerId(''); setFilterType(''); setSearchTerm('');
          }}
          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
          title="Limpar Filtros"
        >
          <Filter size={20} />
        </button>
      </div>

      <div ref={reportRef} className="space-y-6">
        {/* PDF Exclusive Header */}
        <div className="pdf-header hidden mb-6 p-6 bg-slate-900 rounded-3xl text-white">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight">Relatório de Vendas</h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">RTC DECOR - Toldos & Cortinas</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Gerado em</p>
                    <p className="text-sm font-black">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Início</p>
                    <p className="text-sm font-bold">{filterStartDate || 'Sem limite'}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Fim</p>
                    <p className="text-sm font-bold">{filterEndDate || 'Hoje'}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Vendedor</p>
                    <p className="text-sm font-bold">{sellers.find(s => s.id === filterSellerId)?.name || 'Todos'}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tipo de Produto</p>
                    <p className="text-sm font-bold">{filterType || 'Todos'}</p>
                </div>
            </div>
        </div>

        {/* Summary Cards */}
        <div className="no-pdf grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-blue-50 opacity-10 group-hover:scale-110 transition-transform">
                <TrendingUp size={80} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturamento Total</p>
            <p className="text-3xl font-black text-slate-900">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                <TrendingUp size={12} /> Período Selecionado
            </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-indigo-50 opacity-10 group-hover:scale-110 transition-transform">
                <FileText size={80} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Pedidos</p>
            <p className="text-3xl font-black text-slate-900">{stats.count}</p>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded-lg">
                <ArrowRight size={12} /> Vendas Convertidas
            </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-amber-50 opacity-10 group-hover:scale-110 transition-transform">
                <Users size={80} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Médio</p>
            <p className="text-3xl font-black text-slate-900">R$ {stats.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 w-fit px-2 py-1 rounded-lg">
                <TrendingUp size={12} /> Valor por Pedido
            </div>
            </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-pdf no-pdf-break">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                <TrendingUp size={20} className="text-blue-500" />
                Vendas Diárias
            </h3>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                        dy={10}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                    <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Vendas']}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                <Users size={20} className="text-indigo-500" />
                Performance por Vendedor
            </h3>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.salesBySeller} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                        width={100}
                    />
                    <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Histórico de Vendas</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                    {reportData.length} Lançamentos Encontrados
                </span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">NFe</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produtos</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                {reportData.map((order) => {
                    const seller = sellers.find(s => s.id === order.sellerId);
                    const customer = customers.find(c => c.id === order.customerId);
                    const sheet = technicalSheets.find(s => s.id === order.technicalSheetId);
                    const items = order.itemsSnapshot || (sheet ? sheet.items : []);
                    const productSummary = items.map((item: any) => {
                        const prod = products.find(p => p.id === item.productId);
                        return `${item.quantity || 1}x ${prod?.nome || item.productType || 'Produto'}`;
                    }).join(', ');

                    return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-900">{order.contractNumber || order.quoteNumber || order.id}</span>
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">REF: {order.id.substring(0, 8)}</span>
                        </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-600">{new Date(order.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className="px-6 py-4">
                        <span className="text-xs font-black text-slate-700 uppercase">{customer?.name || 'N/D'}</span>
                        </td>
                        <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600">{seller?.name || 'N/D'}</span>
                        </td>
                        <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-500">{order.nfeNumber || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                        <p className="text-[10px] text-slate-500 font-medium max-w-xs truncate" title={productSummary}>
                            {productSummary}
                        </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-slate-900 italic">R$ {order.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </td>
                    </tr>
                    );
                })}
                {reportData.length === 0 && (
                    <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic font-medium">
                        Nenhuma venda encontrada para os filtros selecionados.
                    </td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReport;
