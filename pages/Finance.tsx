
import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import { Order, Customer, Installment } from '../types';
import {
   Wallet,
   Search,
   Calendar,
   CheckCircle2,
   AlertCircle,
   Clock,
   Printer,
   Filter,
   DollarSign,
   User,
   FileText,
   ArrowUpRight,
   TrendingUp,
   X,
   Receipt
} from 'lucide-react';
import { dataService } from '../services/dataService';

interface FinanceProps {
   orders: Order[];
   customers: Customer[];
   onUpdateOrder: (order: Order) => void;
}

const Finance = ({ orders, customers, onUpdateOrder }: FinanceProps) => {
   const [searchTerm, setSearchTerm] = useState('');
   const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
   const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
   const [showReport, setShowReport] = useState(false);
   const [settleModal, setSettleModal] = useState<{
      show: boolean;
      orderId: string;
      installmentId: string;
      grossValue: number;
      paymentDate: string;
      nfe: string;
      netValue: number;
   } | null>(null);

   const reportPrintRef = useRef<HTMLDivElement>(null);

   const flattenedInstallments = useMemo(() => {
      const list: { installment: Installment; order: Order; customer: Customer | undefined }[] = [];
      orders.forEach(order => {
         if (order.installments) {
            order.installments.forEach(inst => {
               list.push({
                  installment: inst,
                  order: order,
                  customer: customers.find(c => c.id === order.customerId)
               });
            });
         }
      });

      // Sort by due date
      return list.sort((a, b) => new Date(a.installment.dueDate).getTime() - new Date(b.installment.dueDate).getTime());
   }, [orders, customers]);

   const filteredInstallments = useMemo(() => {
      return flattenedInstallments.filter(item => {
         const matchesSearch = item.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.order.id.includes(searchTerm);
         const matchesStatus = statusFilter === 'ALL' || item.installment.status === statusFilter;

         let matchesDate = true;
         if (dateFilter.start) matchesDate = matchesDate && new Date(item.installment.dueDate) >= new Date(dateFilter.start);
         if (dateFilter.end) matchesDate = matchesDate && new Date(item.installment.dueDate) <= new Date(dateFilter.end);

         return matchesSearch && matchesStatus && matchesDate;
      });
   }, [flattenedInstallments, searchTerm, statusFilter, dateFilter]);

   const stats = useMemo(() => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const pending = filteredInstallments.filter(i => i.installment.status === 'PENDING');
      const paid = filteredInstallments.filter(i => i.installment.status === 'PAID');
      const overdue = pending.filter(i => new Date(i.installment.dueDate) < now);

      return {
         totalPendente: pending.reduce((acc, i) => acc + i.installment.value, 0),
         totalPago: paid.reduce((acc, i) => acc + i.installment.value, 0),
         totalAtrasado: overdue.reduce((acc, i) => acc + i.installment.value, 0),
         countPendente: pending.length,
         countPago: paid.length,
         countAtrasado: overdue.length
      };
   }, [filteredInstallments]);

   const handleTogglePayment = (orderId: string, installmentId: string) => {
      const order = orders.find(o => o.id === orderId);
      if (!order || !order.installments) return;

      const inst = order.installments.find(i => i.id === installmentId);
      if (!inst) return;

      if (inst.status === 'PAID') {
         // Estorno simples
         const updatedInstallments = order.installments.map(i => {
            if (i.id === installmentId) {
               return { ...i, status: 'PENDING', paymentDate: undefined, nfe: undefined, netValue: undefined } as Installment;
            }
            return i;
         });
         onUpdateOrder({ ...order, installments: updatedInstallments });
      } else {
         // Abrir modal de baixa
         setSettleModal({
            show: true,
            orderId,
            installmentId,
            grossValue: inst.value,
            paymentDate: new Date().toISOString().split('T')[0],
            nfe: '',
            netValue: inst.value
         });
      }
   };

   const handleConfirmSettlement = async () => {
      if (!settleModal) return;

      const order = orders.find(o => o.id === settleModal.orderId);
      if (!order || !order.installments) return;

      const updatedInstallments = order.installments.map(inst => {
         if (inst.id === settleModal.installmentId) {
            return {
               ...inst,
               status: 'PAID',
               paymentDate: settleModal.paymentDate,
               nfe: settleModal.nfe,
               netValue: settleModal.netValue
            } as Installment;
         }
         return inst;
      });

      // Se houver diferença (despesa)
      const difference = settleModal.grossValue - settleModal.netValue;
      if (difference > 0) {
         try {
            await dataService.saveExpense({
               id: crypto.randomUUID(),
               orderId: settleModal.orderId,
               installmentId: settleModal.installmentId,
               description: `Quebra de recebimento - Pedido ${settleModal.orderId} (Parc. ${order.installments.find(i => i.id === settleModal.installmentId)?.number})`,
               value: parseFloat(difference.toFixed(2)),
               date: settleModal.paymentDate,
               category: 'FEE'
            });
         } catch (err) {
            console.error("Erro ao salvar despesa automática:", err);
            alert("Pagamento processado, mas houve um erro ao registrar a despesa.");
         }
      }

      onUpdateOrder({ ...order, installments: updatedInstallments });
      setSettleModal(null);
   };

   const handlePrintReport = () => {
      if (!reportPrintRef.current) return;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
      <html>
        <head>
          <title>Relatório Contas a Receber - RTC Decor</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="p-10">
          ${reportPrintRef.current.innerHTML}
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
      printWindow.document.close();
   };

   return (
      <div className="space-y-6">
         <div className="flex justify-between items-center">
            <div>
               <h2 className="text-2xl font-bold text-slate-900">Contas a Receber</h2>
               <p className="text-slate-500">Gestão financeira de parcelas e fluxos de caixa.</p>
            </div>
            <button
               onClick={() => setShowReport(true)}
               className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 shadow-sm transition-all font-bold"
            >
               <FileText size={20} className="text-blue-500" />
               Gerar Relatório
            </button>
         </div>

         {/* Estatísticas Rápidas */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><DollarSign size={20} /></div>
                  <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-widest">A Receber</span>
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Pendente</p>
               <p className="text-2xl font-black text-slate-900 mt-2">R$ {(stats.totalPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
               <p className="text-xs text-slate-500 mt-1 font-medium">{stats.countPendente} parcelas aguardando</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
                  <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-widest">Recebido</span>
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Pago</p>
               <p className="text-2xl font-black text-slate-900 mt-2 text-emerald-600">R$ {(stats.totalPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
               <p className="text-xs text-slate-500 mt-1 font-medium">{stats.countPago} parcelas quitadas</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><AlertCircle size={20} /></div>
                  <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-full uppercase tracking-widest">Atrasado</span>
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Vencidos</p>
               <p className="text-2xl font-black text-rose-600 mt-2">R$ {(stats.totalAtrasado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
               <p className="text-xs text-slate-500 mt-1 font-medium">{stats.countAtrasado} parcelas fora do prazo</p>
            </div>
         </div>

         {/* Filtros */}
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-1 w-full">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pesquisa</label>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                     type="text"
                     placeholder="Cliente ou Contrato..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
               </div>
            </div>
            <div className="w-full md:w-48 space-y-1">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
               <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
               >
                  <option value="ALL">Todos Status</option>
                  <option value="PENDING">Pendentes</option>
                  <option value="PAID">Pagos</option>
               </select>
            </div>
            <div className="w-full md:w-80 grid grid-cols-2 gap-2 space-y-0 items-end">
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Início</label>
                  <input
                     type="date"
                     value={dateFilter.start}
                     onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                     className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fim</label>
                  <input
                     type="date"
                     value={dateFilter.end}
                     onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                     className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
               </div>
            </div>
         </div>

         {/* Tabela de Parcelas */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Vencimento</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Cliente / Contrato</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-center">Parcela</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Valor</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-center">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {filteredInstallments.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic font-medium">Nenhum registro encontrado para os filtros selecionados.</td></tr>
                     ) : (
                        filteredInstallments.map((item, idx) => {
                           const isOverdue = item.installment.status === 'PENDING' && new Date(item.installment.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
                           return (
                              <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-rose-50/20' : ''}`}>
                                 <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                       <Calendar size={14} className={isOverdue ? 'text-rose-500' : 'text-slate-400'} />
                                       <span className={`text-sm font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                                          {new Date(item.installment.dueDate).toLocaleDateString()}
                                       </span>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{item.customer?.name}</p>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">Pedido {item.order.id}</p>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <span className="text-xs font-black text-slate-400">
                                       {String(item.installment.number).padStart(2, '0')}/{String(item.order.installments?.length || 1).padStart(2, '0')}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <span className="text-sm font-black text-slate-900">
                                       R$ {item.installment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    {item.installment.status === 'PAID' && item.installment.netValue !== undefined && (
                                       <div className="flex flex-col items-end mt-1">
                                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Líquido: R$ {item.installment.netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                          {item.installment.nfe && <span className="text-[9px] font-bold text-slate-400">NFE: {item.installment.nfe}</span>}
                                       </div>
                                    )}
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${item.installment.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                       }`}>
                                       {item.installment.status === 'PAID' ? 'Pago' : isOverdue ? 'Em Atraso' : 'Pendente'}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <button
                                       onClick={() => handleTogglePayment(item.order.id, item.installment.id)}
                                       className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${item.installment.status === 'PAID' ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700'
                                          }`}
                                    >
                                       {item.installment.status === 'PAID' ? 'Estornar' : 'Baixar'}
                                    </button>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Relatório para Impressão */}
         {showReport && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 h-[85vh] flex flex-col">
                  <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                     <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2"><FileText size={20} className="text-blue-600" /> Pré-visualização do Relatório</h3>
                     <div className="flex gap-2">
                        <button onClick={handlePrintReport} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">
                           <Printer size={18} /> Imprimir Relatório
                        </button>
                        <button onClick={() => setShowReport(false)} className="p-2 text-slate-400 hover:text-rose-500">
                           <X size={24} />
                        </button>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
                     <div ref={reportPrintRef} className="bg-white p-12 border border-slate-100 shadow-sm rounded-lg min-h-full">
                        {/* Header do Relatório */}
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
                           <div>
                              <img src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg" alt="RTC Logo" className="h-12 mb-4" />
                              <h1 className="text-2xl font-black uppercase tracking-tighter">Relatório Financeiro</h1>
                              <p className="text-sm font-bold text-slate-500">Contas a Receber • RTC TOLDOS E COBERTURAS LTDA</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black uppercase text-slate-400">Gerado em</p>
                              <p className="text-sm font-black">{new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
                           </div>
                        </div>

                        {/* Resumo */}
                        <div className="grid grid-cols-3 gap-8 mb-10">
                           <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pendente</p>
                              <p className="text-xl font-black text-slate-900">R$ {stats.totalPendente.toLocaleString('pt-BR')}</p>
                           </div>
                           <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pago</p>
                              <p className="text-xl font-black text-emerald-600">R$ {stats.totalPago.toLocaleString('pt-BR')}</p>
                           </div>
                           <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Vencido</p>
                              <p className="text-xl font-black text-rose-600">R$ {stats.totalAtrasado.toLocaleString('pt-BR')}</p>
                           </div>
                        </div>

                        {/* Tabela de Itens */}
                        <table className="w-full text-left border-collapse text-xs">
                           <thead>
                              <tr className="border-b-2 border-slate-200">
                                 <th className="py-2 font-black uppercase">Vencimento</th>
                                 <th className="py-2 font-black uppercase">Cliente</th>
                                 <th className="py-2 font-black uppercase text-center">Parc.</th>
                                 <th className="py-2 font-black uppercase">Contrato</th>
                                 <th className="py-2 font-black uppercase text-right">Valor (R$)</th>
                                 <th className="py-2 font-black uppercase text-center">Status</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {filteredInstallments.map((item, idx) => (
                                 <tr key={idx}>
                                    <td className="py-3 font-bold">{new Date(item.installment.dueDate).toLocaleDateString()}</td>
                                    <td className="py-3 font-medium">{item.customer?.name}</td>
                                    <td className="py-3 text-center font-bold">
                                       {String(item.installment.number).padStart(2, '0')}/{String(item.order.installments?.length || 1).padStart(2, '0')}
                                    </td>
                                    <td className="py-3 font-mono text-[10px]">#{item.order.id}</td>
                                    <td className="py-3 text-right font-black">R$ {item.installment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-3 text-center">
                                       <span className={`text-[8px] font-black uppercase ${item.installment.status === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                          {item.installment.status === 'PAID' ? 'Liquidado' : 'Aberto'}
                                       </span>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>

                        <div className="mt-20 pt-8 border-t border-slate-200 text-center">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">RTC TOLDOS E COBERTURAS LTDA • QUALIDADE E EXCELÊNCIA</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Modal de Baixa de Pagamento */}
         {settleModal && settleModal.show && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg">
                           <CheckCircle2 size={20} />
                        </div>
                        <div>
                           <h3 className="font-bold text-lg text-slate-900">Baixa de Pagamento</h3>
                           <p className="text-xs text-slate-500">Confirmar recebimento da parcela</p>
                        </div>
                     </div>
                     <button onClick={() => setSettleModal(null)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                        <X size={24} />
                     </button>
                  </div>

                  <div className="p-8 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Bruto</label>
                           <p className="text-lg font-black text-slate-900">R$ {settleModal.grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Pagamento</label>
                           <input
                              type="date"
                              value={settleModal.paymentDate}
                              onChange={(e) => setSettleModal({ ...settleModal, paymentDate: e.target.value })}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                           />
                        </div>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Número NFE (Opcional)</label>
                        <div className="relative">
                           <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                           <input
                              type="text"
                              placeholder="000.000.000"
                              value={settleModal.nfe}
                              onChange={(e) => setSettleModal({ ...settleModal, nfe: e.target.value })}
                              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                           />
                        </div>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Valor Líquido Recebido</label>
                        <div className="relative">
                           <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={18} />
                           <input
                              type="number"
                              step="0.01"
                              value={settleModal.netValue}
                              onChange={(e) => setSettleModal({ ...settleModal, netValue: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-10 pr-4 py-3 bg-blue-50 border-2 border-blue-100 rounded-xl text-lg font-black text-blue-600 outline-none focus:border-blue-500 transition-all"
                           />
                        </div>
                        {settleModal.grossValue - settleModal.netValue > 0 && (
                           <p className="text-[10px] text-rose-500 font-bold mt-1 animate-pulse">
                              ⚠️ Diferença de R$ {(settleModal.grossValue - settleModal.netValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} entrará como despesa.
                           </p>
                        )}
                     </div>

                     <div className="flex gap-4 pt-4 border-t border-slate-100">
                        <button onClick={() => setSettleModal(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
                        <button onClick={handleConfirmSettlement} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all">Confirmar Baixa</button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default Finance;
