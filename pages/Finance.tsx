
import * as React from 'react';
import { useState, useMemo } from 'react';
import { Order, Customer, FinancialTransaction, AccountCategory } from '../types';
import {
   Wallet,
   Search,
   Calendar,
   CheckCircle2,
   Clock,
   Printer,
   ArrowUpRight,
   TrendingUp,
   X,
   Receipt,
   ArrowDownRight,
   History,
   LayoutDashboard,
   Plus,
   Trash2
} from 'lucide-react';

interface FinanceProps {
   orders: Order[];
   customers: Customer[];
   transactions: FinancialTransaction[];
   categories: AccountCategory[];
   onUpdateOrder: (order: Order) => void;
   onSaveTransaction: (transaction: FinancialTransaction) => void;
   onDeleteTransaction: (id: string) => void;
}

const Finance = ({ orders, customers, transactions, categories, onUpdateOrder, onSaveTransaction, onDeleteTransaction }: FinanceProps) => {
   const [activeSection, setActiveSection] = useState<'receivable' | 'payable' | 'transactions' | 'dashboard'>('dashboard');
   const [searchTerm, setSearchTerm] = useState('');
   const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
   const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
   const [showTransactionModal, setShowTransactionModal] = useState(false);
   const [newTransaction, setNewTransaction] = useState<Partial<FinancialTransaction>>({
      type: 'EXPENSE',
      status: 'PENDING',
      due_date: new Date().toISOString().split('T')[0]
   });
   const [settleModal, setSettleModal] = useState<{
      show: boolean;
      orderId: string;
      installmentId: string;
      grossValue: number;
      paymentDate: string;
      nfe: string;
      netValue: number;
   } | null>(null);

   const filteredInstallments = useMemo(() => {
      const all: any[] = [];
      orders.forEach(order => {
         if (order.installments && order.installments.length > 0) {
            order.installments.forEach((inst, idx) => {
               const customer = customers.find(c => c.id === order.customerId);
               all.push({
                  ...inst,
                  orderId: order.id,
                  customerName: customer?.name || 'Cliente não encontrado',
                  installmentNumber: idx + 1,
                  totalInstallments: order.installments?.length
               });
            });
         }
      });

      return all.filter(inst => {
         const matchesSearch = inst.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inst.orderId.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesStatus = statusFilter === 'ALL' || inst.status === statusFilter;
         const matchesDate = (!dateFilter.start || inst.dueDate >= dateFilter.start) &&
            (!dateFilter.end || inst.dueDate <= dateFilter.end);
         return matchesSearch && matchesStatus && matchesDate;
      }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
   }, [orders, customers, searchTerm, statusFilter, dateFilter]);

   const financialStats = useMemo(() => {
      const confirmedReceivables = filteredInstallments.filter(i => i.status === 'PAID').reduce((acc, current) => acc + current.value, 0);
      const pendingReceivables = filteredInstallments.filter(i => i.status === 'PENDING').reduce((acc, current) => acc + current.value, 0);

      const paidTransactions = transactions.filter(t => t.status === 'PAID' && t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
      const pendingTransactions = transactions.filter(t => t.status === 'PENDING' && t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);

      const incomeTransactions = transactions.filter(t => t.status === 'PAID' && t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);

      return {
         totalRevenue: confirmedReceivables + incomeTransactions,
         pendingRevenue: pendingReceivables,
         totalExpenses: paidTransactions,
         pendingExpenses: pendingTransactions,
         balance: (confirmedReceivables + incomeTransactions) - paidTransactions
      };
   }, [filteredInstallments, transactions]);

   const handleSettleInstallment = (inst: any) => {
      setSettleModal({
         show: true,
         orderId: inst.orderId,
         installmentId: inst.id,
         grossValue: inst.value,
         paymentDate: new Date().toISOString().split('T')[0],
         nfe: '',
         netValue: inst.value
      });
   };

   const confirmSettle = async () => {
      if (!settleModal) return;

      const order = orders.find(o => o.id === settleModal.orderId);
      if (!order || !order.installments) return;

      const updatedInstallments = order.installments.map(inst => {
         if (inst.id === settleModal.installmentId) {
            return {
               ...inst,
               status: 'PAID' as const,
               paidDate: settleModal.paymentDate,
               netValue: settleModal.netValue,
               nfe: settleModal.nfe
            };
         }
         return inst;
      });

      // Gerar transação financeira automática de entrada
      const inst = order.installments.find(i => i.id === settleModal.installmentId);
      const customer = customers.find(c => c.id === order.customerId);
      const transaction: FinancialTransaction = {
         id: crypto.randomUUID(),
         description: `Recebimento Parcela ${order.id} - ${customer?.name}`,
         amount: settleModal.netValue,
         type: 'INCOME',
         status: 'PAID',
         due_date: inst?.dueDate || settleModal.paymentDate,
         paid_date: settleModal.paymentDate,
         order_id: order.id,
         installment_id: settleModal.installmentId,
         payment_method: order.paymentMethod || 'A Definir',
         notes: `NFe: ${settleModal.nfe}`
      };

      try {
         onUpdateOrder({ ...order, installments: updatedInstallments });
         onSaveTransaction(transaction);
         setSettleModal(null);
      } catch (err) {
         alert("Erro ao processar baixa");
      }
   };

   const handleManualTransaction = async () => {
      if (!newTransaction.description || !newTransaction.amount || !newTransaction.due_date) {
         alert("Preencha os campos obrigatórios");
         return;
      }

      const transaction: FinancialTransaction = {
         id: crypto.randomUUID(),
         description: newTransaction.description,
         amount: Number(newTransaction.amount),
         type: newTransaction.type as 'INCOME' | 'EXPENSE',
         status: newTransaction.status as 'PENDING' | 'PAID' | 'CANCELED',
         due_date: newTransaction.due_date,
         category_id: newTransaction.category_id,
         notes: newTransaction.notes,
         payment_method: newTransaction.payment_method,
         created_at: new Date().toISOString()
      };

      onSaveTransaction(transaction);
      setShowTransactionModal(false);
      setNewTransaction({
         type: 'EXPENSE',
         status: 'PENDING',
         due_date: new Date().toISOString().split('T')[0]
      });
   };

   const renderDashboard = () => (
      <div className="space-y-6">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
               { label: 'Saldo em Caixa', value: financialStats.balance, icon: <Wallet className="text-blue-600" />, sub: 'Realizado' },
               { label: 'Receitas (Mês)', value: financialStats.totalRevenue, icon: <ArrowUpRight className="text-emerald-600" />, sub: 'Confirmado' },
               { label: 'Despesas (Mês)', value: financialStats.totalExpenses, icon: <ArrowDownRight className="text-rose-600" />, sub: 'Pago' },
               { label: 'Pendente (Receber)', value: financialStats.pendingRevenue, icon: <Clock className="text-amber-600" />, sub: 'Próximos dias' }
            ].map((stat, i) => (
               <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                     <div className="p-3 bg-slate-50 rounded-xl">{stat.icon}</div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.sub}</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                  <p className={`text-2xl font-black mt-2 ${i === 0 ? 'text-blue-600' : 'text-slate-900'}`}>
                     R$ {stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
               </div>
            ))}
         </div>

         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
               <TrendingUp size={20} className="text-blue-600" />
               Fluxo de Caixa Simplificado
            </h3>
            <div className="space-y-4">
               <div className="flex justify-between text-sm items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Entradas Totais (Bruto)</span>
                  <span className="font-bold text-emerald-600">R$ {(financialStats.totalRevenue + financialStats.pendingRevenue).toLocaleString('pt-BR')}</span>
               </div>
               <div className="flex justify-between text-sm items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Saídas Totais (Previsto)</span>
                  <span className="font-bold text-rose-600">R$ {(financialStats.totalExpenses + financialStats.pendingExpenses).toLocaleString('pt-BR')}</span>
               </div>
               <div className="flex justify-between text-lg items-center pt-2">
                  <span className="font-black text-slate-900">Resultado Previsto</span>
                  <span className={`font-black ${(financialStats.balance + financialStats.pendingRevenue - financialStats.pendingExpenses) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                     R$ {(financialStats.balance + financialStats.pendingRevenue - financialStats.pendingExpenses).toLocaleString('pt-BR')}
                  </span>
               </div>
            </div>
         </div>
      </div>
   );

   const renderTransactionsTable = (typeFilter?: 'INCOME' | 'EXPENSE') => {
      const list = transactions.filter(t => {
         if (typeFilter && t.type !== typeFilter) return false;
         const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
         return matchesSearch && matchesStatus;
      }).sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

      return (
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-50/50 border-b border-slate-200">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {list.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Nenhum lançamento encontrado</td></tr>
                     ) : (
                        list.map((t) => (
                           <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-6 py-4">
                                 <p className="text-sm font-bold text-slate-900">{t.description}</p>
                                 {t.order_id && <p className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">Pedido: {t.order_id}</p>}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">
                                 {new Date(t.due_date).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-6 py-4">
                                 <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase">
                                    {categories.find(c => c.id === t.category_id)?.name || 'Geral'}
                                 </span>
                              </td>
                              <td className={`px-6 py-4 text-sm font-black text-right ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                 {t.type === 'EXPENSE' && '- '}R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-6 py-4">
                                 <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${t.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' :
                                       t.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                    }`}>
                                    {t.status === 'PAID' ? 'Efetivado' : t.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                                 </span>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex justify-center gap-2">
                                    {t.status === 'PENDING' && (
                                       <button
                                          onClick={() => onSaveTransaction({ ...t, status: 'PAID', paid_date: new Date().toISOString().split('T')[0] })}
                                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                          title="Confirmar Pagamento"
                                       >
                                          <CheckCircle2 size={16} />
                                       </button>
                                    )}
                                    <button
                                       onClick={() => onDeleteTransaction(t.id)}
                                       className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                       title="Excluir"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      );
   };

   return (
      <div className="space-y-6">
         {/* Top Header */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-xl text-white">
                     <Wallet size={24} />
                  </div>
                  Gestão Financeira
               </h2>
               <p className="text-slate-500 mt-1">Controle de entradas, saídas e fluxo de caixa.</p>
            </div>
            <div className="flex gap-2">
               <button
                  onClick={() => setShowTransactionModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
               >
                  <Plus size={18} />
                  Novo Lançamento
               </button>
               <button
                  onClick={() => { }}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
               >
                  <Printer size={18} />
                  Relatório
               </button>
            </div>
         </div>

         {/* Navigation Tabs */}
         <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
            {[
               { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
               { id: 'receivable', label: 'Contas a Receber', icon: <ArrowUpRight size={16} /> },
               { id: 'payable', label: 'Contas a Pagar', icon: <ArrowDownRight size={16} /> },
               { id: 'transactions', label: 'Lançamentos', icon: <History size={16} /> }
            ].map(tab => (
               <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSection === tab.id
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                     }`}
               >
                  {tab.icon}
                  {tab.label}
               </button>
            ))}
         </div>

         {/* Filters */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
               />
            </div>
            <select
               value={statusFilter}
               onChange={(e: any) => setStatusFilter(e.target.value)}
               className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none"
            >
               <option value="ALL">Todos os status</option>
               <option value="PENDING">Pendentes</option>
               <option value="PAID">Liquidados</option>
            </select>
            <input
               type="date"
               value={dateFilter.start}
               onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
               className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
               placeholder="Início"
            />
            <input
               type="date"
               value={dateFilter.end}
               onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
               className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
               placeholder="Fim"
            />
         </div>

         {/* Main Content Sections */}
         <div className="min-h-[400px]">
            {activeSection === 'dashboard' && renderDashboard()}

            {activeSection === 'receivable' && (
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-slate-50/50 border-b border-slate-200">
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido / Cliente</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parcela</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {filteredInstallments.length === 0 ? (
                              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Nenhum recebimento encontrado</td></tr>
                           ) : (
                              filteredInstallments.map((inst, idx) => (
                                 <tr key={`${inst.orderId}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                       <p className="text-sm font-bold text-slate-900 leading-tight">#{inst.orderId}</p>
                                       <p className="text-[11px] text-slate-500 mt-0.5">{inst.customerName}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                                          {inst.installmentNumber} / {inst.totalInstallments}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                       {new Date(inst.dueDate).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">
                                       R$ {inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${inst.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                          }`}>
                                          {inst.status === 'PAID' ? 'Liquidado' : 'Pendente'}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                       {inst.status === 'PENDING' ? (
                                          <button
                                             onClick={() => handleSettleInstallment(inst)}
                                             className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                          >
                                             Baixar
                                          </button>
                                       ) : (
                                          <CheckCircle2 size={18} className="text-emerald-500 mx-auto" />
                                       )}
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}

            {activeSection === 'payable' && renderTransactionsTable('EXPENSE')}

            {activeSection === 'transactions' && renderTransactionsTable()}
         </div>

         {/* New Transaction Modal */}
         {showTransactionModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <div>
                        <h3 className="text-xl font-black text-slate-900">Novo Lançamento Manual</h3>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">Avulso ou fixo</p>
                     </div>
                     <button onClick={() => setShowTransactionModal(false)} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200">
                        <X size={20} />
                     </button>
                  </div>

                  <div className="p-8 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <button
                           onClick={() => setNewTransaction({ ...newTransaction, type: 'EXPENSE' })}
                           className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${newTransaction.type === 'EXPENSE'
                                 ? 'border-rose-500 bg-rose-50 text-rose-700'
                                 : 'border-slate-200 hover:border-slate-300 text-slate-500'
                              }`}
                        >
                           <ArrowDownRight size={24} />
                           <span className="text-xs font-black uppercase">Despesa (Saída)</span>
                        </button>
                        <button
                           onClick={() => setNewTransaction({ ...newTransaction, type: 'INCOME' })}
                           className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${newTransaction.type === 'INCOME'
                                 ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                 : 'border-slate-200 hover:border-slate-300 text-slate-500'
                              }`}
                        >
                           <ArrowUpRight size={24} />
                           <span className="text-xs font-black uppercase">Receita (Entrada)</span>
                        </button>
                     </div>

                     <div className="space-y-4">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                           <input
                              type="text"
                              required
                              placeholder="Ex: Aluguel, Compra de Alumínio..."
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                              value={newTransaction.description || ''}
                              onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                              <input
                                 type="number"
                                 required
                                 className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-black text-blue-600"
                                 value={newTransaction.amount || ''}
                                 onChange={(e) => setNewTransaction({ ...newTransaction, amount: Number(e.target.value) })}
                              />
                           </div>
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimento</label>
                              <input
                                 type="date"
                                 required
                                 className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                                 value={newTransaction.due_date || ''}
                                 onChange={(e) => setNewTransaction({ ...newTransaction, due_date: e.target.value })}
                              />
                           </div>
                        </div>
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria (Plano de Contas)</label>
                           <select
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold appearance-none"
                              value={newTransaction.category_id || ''}
                              onChange={(e) => setNewTransaction({ ...newTransaction, category_id: e.target.value })}
                           >
                              <option value="">Selecione uma categoria...</option>
                              {categories
                                 .filter(c => c.type === newTransaction.type)
                                 .map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                 ))
                              }
                           </select>
                        </div>
                     </div>

                     <div className="pt-4">
                        <button
                           onClick={handleManualTransaction}
                           className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98] uppercase tracking-widest"
                        >
                           Salvar Lançamento
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Settle Modal (Receivable) */}
         {settleModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-8">
                     <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 mx-auto">
                        <CheckCircle2 size={32} />
                     </div>
                     <h3 className="text-2xl font-black text-center text-slate-900">Confirmar Liquidação</h3>
                     <p className="text-center text-slate-500 mt-2">Deseja confirmar o recebimento desta parcela? Um lançamento automático será gerado em seu fluxo de caixa.</p>

                     <div className="mt-8 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
                           <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <span>Valor da Parcela</span>
                              <span>R$ {settleModal.grossValue.toLocaleString('pt-BR')}</span>
                           </div>
                           <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                              <span>Valor Líquido</span>
                              <input
                                 type="number"
                                 className="w-24 text-right bg-transparent outline-none focus:text-blue-600"
                                 value={settleModal.netValue}
                                 onChange={(e) => setSettleModal({ ...settleModal, netValue: Number(e.target.value) })}
                              />
                           </div>
                        </div>

                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data do Pagamento</label>
                           <input
                              type="date"
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                              value={settleModal.paymentDate}
                              onChange={(e) => setSettleModal({ ...settleModal, paymentDate: e.target.value })}
                           />
                        </div>

                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número da Nota (Opcional)</label>
                           <input
                              type="text"
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                              placeholder="NFe..."
                              value={settleModal.nfe}
                              onChange={(e) => setSettleModal({ ...settleModal, nfe: e.target.value })}
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3 mt-8">
                        <button
                           onClick={() => setSettleModal(null)}
                           className="py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                        >
                           Cancelar
                        </button>
                        <button
                           onClick={confirmSettle}
                           className="py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
                        >
                           Confirmar Baixa
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default Finance;
