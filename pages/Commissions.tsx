
import React, { useState, useMemo } from 'react';
import { Order, Customer, Product, Seller, TechnicalSheet, MeasurementItem } from '../types';
import {
    DollarSign,
    Calendar,
    TrendingUp,
    Users,
    Search,
    ChevronRight,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    BadgePercent,
    Coins,
    Printer,
    FileText
} from 'lucide-react';

interface CommissionsProps {
    orders: Order[];
    customers: Customer[];
    products: Product[];
    sellers: Seller[];
    technicalSheets: TechnicalSheet[];
}

const Commissions = ({ orders, customers, products, sellers, technicalSheets }: CommissionsProps) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const calculateCommissionData = useMemo(() => {
        const data: {
            orderId: string;
            customerName: string;
            sellerName: string;
            paymentDate: string;
            installmentValue: number;
            commissionRate: number;
            commissionValue: number;
            discount: number;
            sellerId: string;
            installmentNumber: number;
            totalInstallments: number;
        }[] = [];

        orders.forEach(order => {
            const seller = sellers.find(s => s.id === order.sellerId);
            const customer = customers.find(c => c.id === order.customerId);
            const sheet = technicalSheets.find(s => s.id === order.technicalSheetId);

            if (!order.installments || !sheet) return;

            // Calculate Integral Total for this order
            const orderItems = order.itemIds
                ? sheet.items.filter(item => order.itemIds?.includes(item.id))
                : sheet.items;

            const integralTotal = orderItems.reduce((acc, item) => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return acc;
                const area = (item.width * item.height) || 1;
                return acc + (product.unidade === 'M2' ? product.valor * area : product.valor);
            }, 0);

            // Rule for Commission Rate
            let rate = 0.10; // Default 10%
            const discount = integralTotal > 0 ? (integralTotal - order.totalValue) / integralTotal : 0;

            if (discount > 0.10) {
                rate = 0.04;
            } else if (discount > 0) {
                rate = 0.07;
            } else {
                rate = 0.10;
            }

            order.installments.forEach(inst => {
                if (inst.status === 'PAID' && inst.paymentDate) {
                    const pDate = new Date(inst.paymentDate);
                    // User said: "o que for pago dentro do mes paga no mes seguinte"
                    // So if we select MARCH, we look for payments in FEBRUARY.

                    const targetMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
                    const targetYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;

                    if (pDate.getMonth() === targetMonth && pDate.getFullYear() === targetYear) {
                        data.push({
                            orderId: order.id,
                            customerName: customer?.name || 'Cliente Desconhecido',
                            sellerName: seller?.name || 'Vendedor RTC',
                            sellerId: order.sellerId,
                            paymentDate: inst.paymentDate,
                            installmentValue: inst.value,
                            commissionRate: rate,
                            commissionValue: inst.value * rate,
                            discount: discount * 100,
                            installmentNumber: inst.number,
                            totalInstallments: order.installments!.length
                        });
                    }
                }
            });
        });

        return data;
    }, [orders, sellers, customers, products, technicalSheets, selectedMonth, selectedYear]);

    const filteredData = calculateCommissionData.filter(d =>
        d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.orderId.includes(searchTerm) ||
        d.sellerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totals = useMemo(() => {
        return filteredData.reduce((acc, curr) => ({
            totalComissão: acc.totalComissão + curr.commissionValue,
            totalVolume: acc.totalVolume + curr.installmentValue
        }), { totalComissão: 0, totalVolume: 0 });
    }, [filteredData]);

    const sellerSummaries = useMemo(() => {
        const summary: Record<string, { id: string, name: string, total: number }> = {};
        filteredData.forEach(d => {
            if (!summary[d.sellerId]) summary[d.sellerId] = { id: d.sellerId, name: d.sellerName, total: 0 };
            summary[d.sellerId].total += d.commissionValue;
        });
        return Object.values(summary).sort((a, b) => b.total - a.total);
    }, [filteredData]);

    const handlePrintSellerExtract = (sellerId: string) => {
        const seller = sellers.find(s => s.id === sellerId);
        if (!seller) return;

        const sellerData = calculateCommissionData.filter(d => d.sellerId === sellerId);
        const sellerTotal = sellerData.reduce((acc, d) => acc + d.commissionValue, 0);
        const sellerVolume = sellerData.reduce((acc, d) => acc + d.installmentValue, 0);

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const monthsLong = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        printWindow.document.write(`
      <html>
        <head>
          <title>Extrato de Comissão - ${seller.name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              @page { margin: 2cm; }
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body class="p-10 text-slate-900 font-sans">
          <div class="max-w-4xl mx-auto">
            <div class="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
              <div>
                <img src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg" alt="RTC Logo" class="h-12 mb-4" />
                <h1 class="text-2xl font-black uppercase tracking-tighter text-slate-900">Extrato de Comissão</h1>
                <p class="text-sm font-bold text-slate-500">Vendedor: ${seller.name}</p>
              </div>
              <div class="text-right">
                <p class="text-[10px] font-black uppercase text-slate-400">Referente a</p>
                <p class="text-sm font-black">${monthsLong[selectedMonth === 0 ? 11 : selectedMonth - 1]} / ${selectedMonth === 0 ? selectedYear - 1 : selectedYear}</p>
                <p class="text-[10px] font-black uppercase text-slate-400 mt-2">Data de Emissão</p>
                <p class="text-xs font-bold text-slate-600">${new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-8 mb-10">
              <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Receber</p>
                <p class="text-3xl font-black text-blue-600">R$ ${sellerTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume de Vendas (Base)</p>
                <p class="text-xl font-black text-slate-700">R$ ${sellerVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr class="border-b-2 border-slate-200">
                  <th class="py-3 font-black uppercase text-slate-500 text-[10px]">Data Pagto</th>
                  <th class="py-3 font-black uppercase text-slate-500 text-[10px]">Pedido / Cliente</th>
                  <th class="py-3 font-black uppercase text-slate-500 text-[10px] text-center">Desc.</th>
                  <th class="py-3 font-black uppercase text-slate-500 text-[10px] text-center">Taxa</th>
                  <th class="py-3 font-black uppercase text-slate-500 text-[10px] text-right">Base</th>
                  <th class="py-3 font-black uppercase text-slate-500 text-[10px] text-right">Comissão</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${sellerData.map(d => `
                  <tr>
                    <td class="py-4 font-medium text-slate-600">${new Date(d.paymentDate).toLocaleDateString()}</td>
                    <td class="py-4">
                      <p class="font-bold text-slate-900">${d.customerName}</p>
                      <div class="flex items-center gap-2">
                        <p class="text-[10px] font-black text-blue-600 uppercase">Pedido ${d.orderId}</p>
                        <span class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-black">Parc. ${String(d.installmentNumber).padStart(2, '0')}/${String(d.totalInstallments).padStart(2, '0')}</span>
                      </div>
                    </td>
                    <td class="py-4 text-center">
                      <span class="text-[10px] font-black">${d.discount.toFixed(1)}%</span>
                    </td>
                    <td class="py-4 text-center font-black">${(d.commissionRate * 100).toFixed(0)}%</td>
                    <td class="py-4 text-right font-medium text-slate-500">R$ ${d.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td class="py-4 text-right font-black text-emerald-600">R$ ${d.commissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="mt-20 pt-8 border-t border-slate-200 text-center">
              <p class="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">RTC DECOR • QUALIDADE E EXCELÊNCIA</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Coins className="text-amber-500" size={28} /> Comissões de Vendas
                    </h2>
                    <p className="text-slate-500">Pagamento referente a recebimentos de {months[selectedMonth === 0 ? 11 : selectedMonth - 1]} / {selectedMonth === 0 ? selectedYear - 1 : selectedYear}.</p>
                </div>

                <div className="flex gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none px-2"
                    >
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none px-2"
                    >
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 p-6 rounded-3xl shadow-xl shadow-slate-200">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-white/10 text-white rounded-2xl"><DollarSign size={24} /></div>
                        <ArrowUpRight className="text-emerald-400" size={20} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total em Comissões</p>
                    <p className="text-3xl font-black text-white">R$ {totals.totalComissão.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                        <BadgePercent size={14} className="text-amber-500" />
                        Volume Recebido: R$ {totals.totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                </div>

                <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14} className="text-blue-500" /> Ranking por Vendedor</h3>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500">{sellerSummaries.length} Vendedores com Comissão</span>
                    </div>
                    <div className="flex flex-wrap gap-4 overflow-x-auto pb-2">
                        {sellerSummaries.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Nenhuma comissão gerada para este período.</p>
                        ) : (
                            sellerSummaries.map((s, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl min-w-[200px] flex-1 flex flex-col justify-between group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{s.name}</p>
                                            <p className="text-lg font-black text-blue-600 mt-1">R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <button
                                            onClick={() => handlePrintSellerExtract(s.id)}
                                            className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                                            title="Imprimir Extrato"
                                        >
                                            <Printer size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Filter size={16} className="text-blue-600" /> Detalhamento Mensal
                    </h3>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente, pedido ou vendedor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-6 py-4">Vendedor</th>
                                <th className="px-6 py-4">Cliente / Pedido</th>
                                <th className="px-6 py-4">Pagamento</th>
                                <th className="px-6 py-4 text-center">Desconto</th>
                                <th className="px-6 py-4 text-center">Taxa</th>
                                <th className="px-6 py-4 text-right">Base</th>
                                <th className="px-6 py-4 text-right">Comissão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="opacity-20 mb-4 flex justify-center"><Coins size={48} /></div>
                                        <p className="text-slate-400 font-medium italic">Nenhum recebimento encontrado para os critérios de busca.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((d, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs uppercase">
                                                    {d.sellerName.charAt(0)}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{d.sellerName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-slate-900">{d.customerName}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Pedido {d.orderId}</p>
                                                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-black">Parc. {String(d.installmentNumber).padStart(2, '0')}/{String(d.totalInstallments).padStart(2, '0')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                <Calendar size={14} className="text-slate-300" /> {new Date(d.paymentDate).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter transition-all ${d.discount > 10 ? 'bg-rose-50 text-rose-600' : d.discount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                                }`}>
                                                {d.discount.toFixed(1)}% OFF
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-sm font-black text-slate-900">{(d.commissionRate * 100).toFixed(0)}%</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-xs font-bold text-slate-500">R$ {d.installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-emerald-600">R$ {d.commissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Commissions;
