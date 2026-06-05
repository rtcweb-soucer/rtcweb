import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { Download } from 'lucide-react';
import { Order, Customer, FinancialTransaction, AccountCategory, Product, Seller, TechnicalSheet } from '../types';
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
   Trash2,
   Eye,
   Layers,
   ChevronRight,
   FileText,
   CreditCard,
   Info,
   MessageCircle,
   RefreshCw,
   Copy,
   ExternalLink,
   Check,
   Phone,
   Edit2
} from 'lucide-react';

interface FinanceProps {
   orders: Order[];
   customers: Customer[];
   products: Product[];
   sellers: Seller[];
   transactions: FinancialTransaction[];
   categories: AccountCategory[];
   onUpdateOrder: (order: Order) => void;
   onSaveTransaction: (transaction: FinancialTransaction) => void;
   onDeleteTransaction: (id: string) => void;
   technicalSheets: TechnicalSheet[];
}

const Finance = ({ orders, customers, products, sellers, technicalSheets, transactions, categories, onUpdateOrder, onSaveTransaction, onDeleteTransaction }: FinanceProps) => {
   const [activeSection, setActiveSection] = useState<'receivable' | 'payable' | 'transactions' | 'dashboard'>('dashboard');
   const [searchTerm, setSearchTerm] = useState('');
   const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
   const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
   const [dateFilterType, setDateFilterType] = useState<'due' | 'payment'>('due');
   const reportRef = useRef<HTMLDivElement>(null);
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
   const [selectedIds, setSelectedIds] = useState<string[]>([]);
   const [viewOrder, setViewOrder] = useState<Order | null>(null);
   const [showBatchModal, setShowBatchModal] = useState(false);
   const [activeViewTab, setActiveViewTab] = useState<'items' | 'html'>('items');
   const [batchSettleData, setBatchSettleData] = useState({
      paymentDate: new Date().toISOString().split('T')[0],
      nfe: '',
      totalPaid: 0
   });
   const [isSincronizing, setIsSincronizing] = useState<string | null>(null);
   const [isGenerating, setIsGenerating] = useState<string | null>(null);
   const [editingPaymentDate, setEditingPaymentDate] = useState<{
      orderId: string;
      installmentId: string;
      currentDate: string;
   } | null>(null);

   const handleCopyValue = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("Copiado com sucesso!");
   };

   const handleGeneratePaymentForInstallment = async (inst: any) => {
      const order = orders.find(o => o.id === inst.orderId);
      if (!order) return;

      const instId = inst.id;
      setIsGenerating(`${inst.orderId}-${instId}`);
      try {
         const { infinitePayService } = await import('../services/infinitePayService');
         const customer = customers.find(c => c.id === order.customerId);
         const customerData = {
            name: customer?.name || 'Cliente',
            email: customer?.email || '',
            phone: customer?.phone || ''
         };

         const charge = await infinitePayService.createCharge(order, inst, customerData);

         const updatedInstallments = order.installments?.map(i => {
            if (i.id === instId) {
               return {
                  ...i,
                  paymentLink: charge.url,
                  pixCopyPaste: charge.pixCode,
                  paymentId: charge.id
               };
            }
            return i;
         });

         await onUpdateOrder({ ...order, installments: updatedInstallments });
      } catch (err: any) {
         alert("Erro ao oferecer pagamento: " + err.message);
      } finally {
         setIsGenerating(null);
      }
   };

   const handleWhatsAppManualShare = (inst: any) => {
      const order = orders.find(o => o.id === inst.orderId);
      if (!order || !order.customerPhone) {
         alert("Telefone do cliente não encontrado");
         return;
      }

      let message = `Olá! Referente ao seu pedido *${order.contractNumber || order.id.slice(0, 8).toUpperCase()}*, segue a cobrança da parcela *${inst.installmentNumber}/${inst.totalInstallments}*.\n\n`;
      message += `💰 *Valor:* R$ ${inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;

      if (inst.pixCopyPaste) {
         message += `\n*Código PIX Copia e Cola:*\n\`${inst.pixCopyPaste}\`\n\n_Copie e cole no app do seu banco._`;
      } else if (inst.paymentLink) {
         message += `\n🔗 *Link para Pagamento:* ${inst.paymentLink}`;
      }

      const cleanPhone = order.customerPhone.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
   };

   const filteredInstallments = useMemo(() => {
      const all: any[] = [];
      orders.forEach(order => {
         if (order.installments && order.installments.length > 0) {
            order.installments.forEach((inst, idx) => {
               const customer = customers.find(c => c.id === order.customerId);
               const seller = sellers.find(s => s.id === order.sellerId);
               all.push({
                  ...inst,
                  orderId: order.id,
                  customerName: customer?.name || 'Cliente não encontrado',
                  customerPhone: customer?.phone || '',
                  sellerName: seller?.name || '---',
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
         
         const dateToCompare = dateFilterType === 'due' 
            ? inst.dueDate 
            : (inst.paymentDate ? inst.paymentDate.split('T')[0] : null);

         const matchesDate = !dateFilter.start || !dateFilter.end || (
            dateToCompare && dateToCompare >= dateFilter.start && dateToCompare <= dateFilter.end
         );

         return matchesSearch && matchesStatus && matchesDate;
      }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
   }, [orders, customers, searchTerm, statusFilter, dateFilter, dateFilterType]);

   const exportToExcel = () => {
      const exportData = filteredInstallments.map(inst => {
         const order = orders.find(o => o.id === inst.orderId);
         return {
            'Contrato': order?.contractNumber || inst.orderId.slice(0, 8),
            'Cliente': inst.customerName,
            'Vendedor': inst.sellerName,
            'NFe': order?.nfeNumber || '--',
            'Parcela': `${inst.installmentNumber}/${inst.totalInstallments}`,
            'Vencimento': new Date(inst.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
            'Pagamento': inst.paymentDate ? new Date(inst.paymentDate).toLocaleDateString('pt-BR') : '--',
            'Valor': inst.value,
            'Status': inst.status === 'PAID' ? 'Liquidado' : 'Pendente'
         };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Contas a Receber");
      XLSX.writeFile(wb, `Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.xlsx`);
   };

   const exportToPDF = () => {
      if (!reportRef.current) return;
      
      const element = reportRef.current.cloneNode(true) as HTMLElement;
      
      const pdfHeader = element.querySelector('.pdf-header');
      if (pdfHeader) pdfHeader.classList.remove('hidden');

      const noPdfElements = element.querySelectorAll('.no-pdf');
      noPdfElements.forEach(el => (el as HTMLElement).style.display = 'none');

      const opt = {
         margin: 10,
         filename: `Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.pdf`,
         image: { type: 'jpeg' as const, quality: 0.98 },
         html2canvas: { scale: 2, useCORS: true },
         jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
      };

      html2pdf().set(opt).from(element).save();
   };

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

   const handleSyncPaymentStatus = async (installment: any) => {
      if (!installment.paymentId) return;
      
      setIsSincronizing(installment.id);
      try {
         const { infinitePayService } = await import('../services/infinitePayService');
         const type = installment.pixCopyPaste ? 'PIX' : 'LINK';
         const status = await infinitePayService.checkStatus(installment.paymentId, type, installment.orderId, installment.id);
         
         if (status === 'PAID') {
            const relatedInstallments = filteredInstallments.filter(i => 
               i.paymentId === installment.paymentId && i.status === 'PENDING'
            );
            
            for (const inst of relatedInstallments) {
               const order = orders.find(o => o.id === inst.orderId);
               if (!order) continue;

               const updatedInstallments = order.installments?.map(i => 
                  i.id === inst.id || (i.paymentId === installment.paymentId && i.paymentId !== undefined)
                     ? { ...i, status: 'PAID' as 'PAID', paymentDate: new Date().toISOString() } 
                     : i
               );

               const updatedOrder = { ...order, installments: updatedInstallments };
               await onUpdateOrder(updatedOrder);
               
               const category = categories.find(c => c.type === 'INCOME' && c.name.toUpperCase().includes('VENDA'));
               const transaction: Partial<FinancialTransaction> = {
                  description: `REC: Pedido ${order.contractNumber || order.id.slice(0,8)} (Parc ${inst.number} - AUTO)`,
                  amount: inst.value,
                  type: 'INCOME',
                  due_date: new Date().toISOString(),
                  paid_date: new Date().toISOString(),
                  status: 'PAID',
                  category_id: category?.id,
                  payment_method: inst.paymentMethod || (inst.pixCopyPaste ? 'PIX' : 'Cartão (Link)'),
                  order_id: order.id
               };
               await onSaveTransaction(transaction as FinancialTransaction);
            }
            
            alert(`✅ Recibo confirmado! ${relatedInstallments.length} parcela(s) baixada(s).`);
         } else {
            alert("ℹ️ Pagamento ainda não consta como aprovado na InfinitePay.");
         }
      } catch (err: any) {
         console.error("Erro ao sincronizar status ou verificação não suportada na V1:", err);
         alert("🤖 A InfinitePay (na nova versão V1) desativou a consulta manual de pagamentos por motivo de segurança.\n\nA partir de agora dependemos exclusivamente da Baixa Automática (Webhook).\n\nSe o pagamento foi feito com sucesso, aguarde o aviso automático deles ou faça a baixa manual (Botão Verde)!");
      } finally {
         setIsSincronizing(null);
      }
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
               paymentDate: settleModal.paymentDate,
               netValue: settleModal.netValue,
               nfe: settleModal.nfe
            };
         }
         return inst;
      });

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
         await onUpdateOrder({ ...order, installments: updatedInstallments });
         await onSaveTransaction(transaction);

         const difference = settleModal.grossValue - settleModal.netValue;
         if (difference > 0.01) {
            const expenseCategory = categories.find(c => c.code === '2.0.0') || categories.find(c => c.type === 'EXPENSE');
            const expenseTransaction: FinancialTransaction = {
               id: crypto.randomUUID(),
               description: `Diferença/Taxa: Parcela ${order.id} - ${customer?.name}`,
               amount: difference,
               type: 'EXPENSE',
               status: 'PAID',
               due_date: settleModal.paymentDate,
               paid_date: settleModal.paymentDate,
               order_id: order.id,
               installment_id: settleModal.installmentId,
               category_id: expenseCategory?.id,
               notes: `Ajuste automático por recebimento divergente (Bruto: ${settleModal.grossValue} | Recebido: ${settleModal.netValue})`
            };
            await onSaveTransaction(expenseTransaction);
         }

         if (order.sellerId) {
            const technicalSheet = technicalSheets?.find((s: any) => s.id === order.technicalSheetId);
            let rate = 0.10; 
            
            if (technicalSheet) {
               const orderItems = order.itemIds
                  ? technicalSheet.items.filter((item: any) => order.itemIds?.includes(item.id))
                  : technicalSheet.items;

               const integralTotal = orderItems.reduce((acc: number, item: any) => {
                  const product = products.find(p => p.id === item.productId);
                  if (!product) return acc;
                  if (product.nome?.toLowerCase().includes('frete') || product.nome?.toLowerCase().includes('instalação')) return acc;
                  
                  const area = (item.width * item.height) || 1;
                  return acc + (product.unidade === 'M2' ? product.valor * area : product.valor);
               }, 0);

               const discount = integralTotal > 0 ? (integralTotal - order.totalValue) / integralTotal : 0;
               if (discount > 0.10) {
                  rate = 0.04;
               } else if (discount > 0) {
                  rate = 0.07;
               } else {
                  rate = 0.10;
               }
            }

            const commissionAmount = settleModal.netValue * rate;
            const commCategory = categories.find(c => c.code === '2.1.0') || categories.find(c => c.name?.toLowerCase().includes('comissão'));
            
            const commissionTransaction: FinancialTransaction = {
               id: crypto.randomUUID(),
               description: `Comissão: Parcela ${order.id} - Vendedor: ${sellers.find(s => s.id === order.sellerId)?.name}`,
               amount: commissionAmount,
               type: 'EXPENSE',
               status: 'PAID',
               due_date: settleModal.paymentDate,
               paid_date: settleModal.paymentDate,
               order_id: order.id,
               installment_id: settleModal.installmentId,
               seller_id: order.sellerId,
               category_id: commCategory?.id,
               notes: `Comissão automática (${(rate * 100).toFixed(0)}%) sobre baixa de R$ ${settleModal.netValue.toLocaleString('pt-BR')}`
            };
            await onSaveTransaction(commissionTransaction);
         }

         setSettleModal(null);
      } catch (err: any) {
         console.error("Erro detalhado na baixa:", err);
         alert("Erro ao processar baixa: " + (err.message || "Erro desconhecido"));
      }
   };

   const handleUpdatePaymentDate = async (orderId: string, installmentId: string, newDate: string) => {
      try {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const updatedInstallments = order.installments?.map(inst => {
          if (inst.id === installmentId) {
            return { ...inst, paymentDate: newDate };
          }
          return inst;
        });

        await onUpdateOrder({ ...order, installments: updatedInstallments });
        setEditingPaymentDate(null);
      } catch (err: any) {
        alert("Erro ao atualizar data: " + err.message);
      }
   };

   const handleBatchSettle = () => {
      if (selectedIds.length === 0) return;
      
      const totalGross = filteredInstallments
         .filter(i => selectedIds.includes(`${i.orderId}-${i.id}`))
         .reduce((acc, current) => acc + current.value, 0);

      setBatchSettleData({
         ...batchSettleData,
         totalPaid: totalGross,
         paymentDate: new Date().toISOString().split('T')[0],
         nfe: ''
      });
      setShowBatchModal(true);
   };

   const confirmBatchSettle = async () => {
      const selectedInstallments = filteredInstallments.filter(i => selectedIds.includes(`${i.orderId}-${i.id}`));
      const totalGross = selectedInstallments.reduce((acc, current) => acc + current.value, 0);
      
      for (const item of selectedInstallments) {
         const order = orders.find(o => o.id === item.orderId);
         if (!order || !order.installments) continue;

         const proportion = item.value / totalGross;
         const adjustedValue = totalGross > 0 ? (batchSettleData.totalPaid * proportion) : 0;

         const updatedInstallments = order.installments.map(inst => {
            if (inst.id === item.id) {
               return {
                   ...inst,
                   status: 'PAID' as const,
                   paymentDate: batchSettleData.paymentDate,
                   netValue: adjustedValue,
                  nfe: batchSettleData.nfe
               };
            }
            return inst;
         });

         const customer = customers.find(c => c.id === order.customerId);
         const transaction: FinancialTransaction = {
            id: crypto.randomUUID(),
            description: `Recebimento Parcela ${order.id} - ${customer?.name}`,
            amount: adjustedValue,
            type: 'INCOME',
            status: 'PAID',
            due_date: item.dueDate,
            paid_date: batchSettleData.paymentDate,
            order_id: order.id,
            installment_id: item.id,
            payment_method: order.paymentMethod || 'A Definir',
            notes: batchSettleData.nfe ? `NFe: ${batchSettleData.nfe} (Lote)` : ''
         };

         onUpdateOrder({ ...order, installments: updatedInstallments });
         onSaveTransaction(transaction);
      }

      setSelectedIds([]);
      setShowBatchModal(false);
   };

   const toggleSelectAll = () => {
      if (selectedIds.length === filteredInstallments.filter(i => i.status === 'PENDING').length) {
         setSelectedIds([]);
      } else {
         setSelectedIds(filteredInstallments.filter(i => i.status === 'PENDING').map(i => `${i.orderId}-${i.id}`));
      }
   };

   const toggleSelect = (id: string) => {
      if (selectedIds.includes(id)) {
         setSelectedIds(selectedIds.filter(i => i !== id));
      } else {
         setSelectedIds([...selectedIds, id]);
      }
   };

   const handleManualTransaction = async () => {
      if (!newTransaction.description || !newTransaction.amount || !newTransaction.due_date) {
         alert("Preencha os campos obrigatórios");
         return;
      }

      try {
         const repeatCount = (newTransaction as any).repeatMonths || 1;
         const baseDate = new Date(newTransaction.due_date + 'T12:00:00');

         for (let i = 0; i < repeatCount; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(baseDate.getMonth() + i);
            
            const transaction: FinancialTransaction = {
               id: crypto.randomUUID(),
               description: repeatCount > 1 
                  ? `${newTransaction.description} (${i + 1}/${repeatCount})`
                  : newTransaction.description!,
               amount: Number(newTransaction.amount),
               type: newTransaction.type as 'INCOME' | 'EXPENSE',
               status: newTransaction.status as 'PENDING' | 'PAID' | 'CANCELED',
               due_date: dueDate.toISOString().split('T')[0],
               paid_date: newTransaction.status === 'PAID' ? dueDate.toISOString().split('T')[0] : undefined,
               category_id: newTransaction.category_id || undefined,
               notes: newTransaction.notes,
               payment_method: newTransaction.payment_method,
               created_at: new Date().toISOString()
            };

            await onSaveTransaction(transaction);
         }

         setShowTransactionModal(false);
         setNewTransaction({
            type: 'EXPENSE',
            status: 'PENDING',
            due_date: new Date().toISOString().split('T')[0]
         });
      } catch (err: any) {
         console.error("Erro ao salvar lançamento manual:", err);
         alert("Erro ao salvar lançamento: " + (err.message || "Verifique os dados"));
      }
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
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagto</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Pago</th>
                               <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Pago</th>
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
                                 {t.notes && <p className="text-[9px] text-slate-400 italic mt-0.5">{t.notes}</p>}
                                 {t.payment_method && <p className="text-[9px] text-slate-400 mt-0.5">Método: {t.payment_method}</p>}
                              </td>
                              <td className="px-6 py-4">
                                 <p className="text-sm text-slate-600 font-medium">{new Date(t.due_date).toLocaleDateString('pt-BR')}</p>
                              </td>
                              <td className="px-6 py-4">
                                 <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
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
                              <td className="px-6 py-4 text-center">
                                 <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                       onClick={() => {
                                          setNewTransaction({
                                             ...t,
                                             id: undefined,
                                             status: 'PENDING',
                                             due_date: new Date().toISOString().split('T')[0]
                                          });
                                          setShowTransactionModal(true);
                                       }}
                                       className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                       title="Clonar / Repetir"
                                    >
                                       <Plus size={16} />
                                    </button>
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
      <div className="space-y-6" ref={reportRef}>
         {/* PDF Header - Visible only in PDF */}
         <div className="pdf-header hidden mb-8 border-b-2 border-slate-900 pb-4">
            <div className="flex justify-between items-end">
               <div>
                  <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic">RTC</h1>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Toldos & Cortinas</p>
               </div>
               <div className="text-right">
                  <h2 className="text-xl font-black text-slate-900">Relatório Financeiro</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
               </div>
            </div>
         </div>
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
                  onClick={exportToExcel}
                  className="no-pdf flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
               >
                  <Download size={18} />
                  Excel
               </button>
               <button
                  onClick={exportToPDF}
                  className="no-pdf flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
               >
                  <Printer size={18} />
                  PDF
               </button>
            </div>
         </div>

         {/* Header Actions for Selection */}
         {selectedIds.length > 0 && activeSection === 'receivable' && (
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300 shadow-sm">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                     <Layers size={18} />
                  </div>
                  <div>
                     <p className="text-sm font-black text-blue-900">{selectedIds.length} parcela(s) selecionada(s)</p>
                     <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Ação em lote disponível</p>
                  </div>
               </div>
               <div className="flex gap-2">
                  <button
                     onClick={() => setSelectedIds([])}
                     className="px-4 py-2 text-slate-500 text-xs font-bold hover:text-slate-700"
                  >
                     Cancelar
                  </button>
                  <button
                     onClick={handleBatchSettle}
                     className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md shadow-blue-200 uppercase tracking-widest"
                  >
                     Dar Baixa em Lote
                  </button>
               </div>
            </div>
         )}

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
         <div className="no-pdf grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
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
            <select
               value={dateFilterType}
               onChange={(e: any) => setDateFilterType(e.target.value)}
               className="px-4 py-2 bg-blue-50 text-blue-700 border-none rounded-xl text-xs font-black focus:ring-2 focus:ring-blue-500 outline-none appearance-none uppercase tracking-tight"
            >
               <option value="due">Por Vencimento</option>
               <option value="payment">Por Pagamento</option>
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
               className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
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
                              <th className="px-6 py-4 w-10 text-center">
                                 <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={selectedIds.length > 0 && selectedIds.length === filteredInstallments.filter(i => i.status === 'PENDING').length}
                                    onChange={toggleSelectAll}
                                 />
                              </th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contrato / Cliente</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">NFe</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parcela</th>
                              <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Produção</th>
                              <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Instalação</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagamento</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Pago</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {filteredInstallments.length === 0 ? (
                              <tr><td colSpan={13} className="px-6 py-10 text-center text-slate-400">Nenhum recebimento encontrado</td></tr>
                           ) : (
                              filteredInstallments.map((inst, idx) => {
                                 const order = orders.find(o => o.id === inst.orderId);
                                 return (
                                 <tr 
                                    key={`${inst.orderId}-${idx}`} 
                                    className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.includes(`${inst.orderId}-${inst.id}`) ? 'bg-blue-50/30' : ''}`}
                                 >
                                    <td className="px-6 py-4 text-center">
                                       {inst.status === 'PENDING' && (
                                          <input 
                                             type="checkbox" 
                                             className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                             checked={selectedIds.includes(`${inst.orderId}-${inst.id}`)}
                                             onChange={() => toggleSelect(`${inst.orderId}-${inst.id}`)}
                                          />
                                       )}
                                    </td>
                                    <td className="px-6 py-4">
                                       <div className="flex items-center gap-2">
                                          <p className="text-sm font-black text-slate-900 leading-tight">
                                             {order?.contractNumber 
                                                ? `${order.quoteNumber || order.id.slice(0, 8).toUpperCase()} / ${order.contractNumber}`
                                                : `Nº ${order?.quoteNumber || inst.orderId.slice(0, 8).toUpperCase()}`}
                                          </p>
                                          <button 
                                             onClick={() => setViewOrder(order || null)}
                                             className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                             title="Ver Pedido Completo"
                                          >
                                             <Eye size={12} />
                                          </button>
                                       </div>
                                       <div className="mt-1 space-y-1">
                                          <p className="text-[11px] font-bold text-slate-700 truncate max-w-[200px]">{inst.customerName}</p>
                                          <div className="flex gap-2">
                                             {inst.customerPhone && (
                                                <>
                                                   <button 
                                                      onClick={() => {
                                                         const cleanPhone = inst.customerPhone.replace(/\D/g, '');
                                                         const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                                                         window.open(`https://wa.me/${fullPhone}`, '_blank');
                                                      }}
                                                      className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 hover:text-emerald-700"
                                                      title="WhatsApp"
                                                   >
                                                      <MessageCircle size={10} />
                                                      WhatsApp
                                                   </button>
                                                   <button 
                                                      onClick={() => window.location.href = `tel:${inst.customerPhone}`}
                                                      className="flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-700"
                                                      title="Ligar"
                                                   >
                                                      <Phone size={10} />
                                                      Ligar
                                                   </button>
                                                </>
                                             )}
                                          </div>
                                       </div>
                                    </td>

                                     <td className="px-6 py-4">
                                        <span className={`text-xs font-black ${order?.nfeNumber ? 'text-blue-600' : 'text-slate-300'}`}>
                                           {order?.nfeNumber || '--'}
                                        </span>
                                     </td>
                                    <td className="px-6 py-4">
                                       <p className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{inst.sellerName}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className="text-[10px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                                          {inst.installmentNumber} / {inst.totalInstallments}
                                       </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                       {order?.productionStage ? (
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight
                                             ${order.productionStage === 'Finalizado' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                               order.productionStage === 'Novos Pedidos' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                               'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                             {order.productionStage}
                                          </span>
                                       ) : (
                                          <span className="text-slate-300 text-[9px]">---</span>
                                       )}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                       <div className="flex flex-col items-center">
                                          <span className="text-[10px] font-bold text-slate-700">{order?.installationDate ? new Date(order.installationDate).toLocaleDateString('pt-BR') : '---'}</span>
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-400 font-medium">
                                       {new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4">
                                       {editingPaymentDate?.installmentId === inst.id ? (
                                          <div className="flex items-center gap-1">
                                             <input 
                                                type="date"
                                                value={editingPaymentDate.currentDate}
                                                onChange={(e) => setEditingPaymentDate({ ...editingPaymentDate, currentDate: e.target.value })}
                                                className="px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500"
                                             />
                                             <button 
                                                onClick={() => handleUpdatePaymentDate(inst.orderId, inst.id, editingPaymentDate.currentDate)}
                                                className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"
                                             >
                                                <Check size={10} />
                                             </button>
                                             <button 
                                                onClick={() => setEditingPaymentDate(null)}
                                                className="p-1 bg-rose-100 text-rose-600 rounded hover:bg-rose-200"
                                             >
                                                <X size={10} />
                                             </button>
                                          </div>
                                       ) : (
                                          <div className="flex items-center gap-2">
                                             {inst.paymentDate ? (
                                                <p className="text-sm text-emerald-600 font-black italic">{new Date(inst.paymentDate.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                             ) : (
                                                <span className="text-[10px] font-bold text-slate-300 uppercase italic">Pendente</span>
                                             )}
                                             <button 
                                                onClick={() => setEditingPaymentDate({ orderId: inst.orderId, installmentId: inst.id, currentDate: inst.paymentDate ? inst.paymentDate.split('T')[0] : '' })}
                                                className="flex items-center gap-1 p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all border border-blue-100 ml-1"
                                                title="Editar Data de Pagamento"
                                             >
                                                <Edit2 size={12} />
                                                <span className="text-[9px] font-black uppercase tracking-tighter">MUDAR</span>
                                             </button>
                                          </div>
                                       )}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">
                                       R$ {inst.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                     <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right italic">
                                        {inst.netValue > 0 ? `R$ ${inst.netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '--'}
                                     </td>
                                    <td className="px-6 py-4">
                                       <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${inst.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                          }`}>
                                          {inst.status === 'PAID' ? 'Liquidado' : 'Pendente'}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                       <div className="flex items-center justify-center gap-2">
                                          {inst.status === 'PENDING' ? (
                                             <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                   <button
                                                      onClick={() => handleSettleInstallment(inst)}
                                                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                                                   >
                                                      Baixar
                                                   </button>
                                                   {inst.paymentId && (
                                                      <button
                                                         onClick={() => handleSyncPaymentStatus(inst)}
                                                         disabled={isSincronizing === inst.id}
                                                         className={`p-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-all ${isSincronizing === inst.id ? 'animate-spin' : ''}`}
                                                         title="Consultar na InfinitePay"
                                                      >
                                                         <RefreshCw size={14} />
                                                      </button>
                                                   )}
                                                </div>

                                                {/* InfinitePay Actions */}
                                                <div className="flex items-center gap-1">
                                                   {!inst.paymentLink && !inst.pixCopyPaste ? (
                                                      (inst.paymentMethod?.toUpperCase().includes('PIX') || inst.paymentMethod?.toUpperCase().includes('CART')) && (
                                                         <button
                                                            onClick={() => handleGeneratePaymentForInstallment(inst)}
                                                            disabled={isGenerating === `${inst.orderId}-${inst.id}`}
                                                            className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-md hover:bg-blue-100 transition-all disabled:opacity-50"
                                                         >
                                                            {isGenerating === `${inst.orderId}-${inst.id}` ? 'Gerando...' :
                                                               inst.paymentMethod?.toUpperCase().includes('PIX') ? 'Gerar PIX' : 'Gerar Link'}
                                                         </button>
                                                      )
                                                   ) : (
                                                      <div className="flex items-center gap-1">
                                                         <button
                                                            onClick={() => handleCopyValue(inst.pixCopyPaste || inst.paymentLink || '')}
                                                            className="p-1 text-slate-400 hover:text-blue-600 bg-slate-50 border border-slate-100 rounded transition-all"
                                                            title="Copiar Link/PIX"
                                                         >
                                                            <Copy size={12} />
                                                         </button>
                                                         <button
                                                            onClick={() => handleWhatsAppManualShare(inst)}
                                                            className="p-1 text-slate-400 hover:text-emerald-600 bg-slate-50 border border-slate-100 rounded transition-all"
                                                            title="Enviar via WhatsApp"
                                                         >
                                                            <MessageCircle size={12} />
                                                         </button>
                                                         {inst.paymentLink && (
                                                            <a
                                                               href={inst.paymentLink}
                                                               target="_blank"
                                                               rel="noopener noreferrer"
                                                               className="p-1 text-slate-400 hover:text-blue-600 bg-slate-50 border border-slate-100 rounded transition-all"
                                                               title="Abrir Link"
                                                            >
                                                               <ExternalLink size={12} />
                                                            </a>
                                                         )}
                                                      </div>
                                                   )}
                                                </div>
                                             </div>
                                          ) : (
                                             <CheckCircle2 size={18} className="text-emerald-500 mx-auto" />
                                          )}
                                       </div>
                                    </td>
                                 </tr>
                                 );
                              })
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

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                              <select
                                 className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                                 value={newTransaction.status}
                                 onChange={(e) => setNewTransaction({ ...newTransaction, status: e.target.value as any })}
                              >
                                 <option value="PENDING">Pendente</option>
                                 <option value="PAID">Pago / Recebido</option>
                              </select>
                           </div>
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagto</label>
                              <input
                                 type="text"
                                 placeholder="Ex: Pix, Dinheiro..."
                                 className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                                 value={newTransaction.payment_method || ''}
                                 onChange={(e) => setNewTransaction({ ...newTransaction, payment_method: e.target.value })}
                              />
                           </div>
                        </div>

                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações (Opcional)</label>
                           <textarea
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                              rows={2}
                              value={newTransaction.notes || ''}
                              onChange={(e) => setNewTransaction({ ...newTransaction, notes: e.target.value })}
                           />
                        </div>
                        
                        {/* Opção de Repetir Lançamento */}
                        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <History size={16} className="text-blue-600" />
                                 <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Repetir Lançamento?</span>
                              </div>
                              <input 
                                 type="checkbox" 
                                 className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                 checked={!!(newTransaction as any).repeat}
                                 onChange={(e) => setNewTransaction({ ...newTransaction, repeat: e.target.checked } as any)}
                              />
                           </div>
                           
                           { (newTransaction as any).repeat && (
                              <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade de meses</label>
                                 <div className="flex items-center gap-3 mt-1">
                                    <input
                                       type="number"
                                       min="2"
                                       max="48"
                                       className="w-24 px-4 py-2 bg-white border border-blue-200 rounded-xl text-sm font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                                       value={(newTransaction as any).repeatMonths || 2}
                                       onChange={(e) => setNewTransaction({ ...newTransaction, repeatMonths: Number(e.target.value) } as any)}
                                    />
                                    <span className="text-xs text-slate-500 font-bold">Lançamentos mensais</span>
                                 </div>
                              </div>
                           )}
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
                     <p className="text-center text-slate-500 mt-2 text-sm leading-relaxed">Deseja confirmar o recebimento desta parcela? Um lançamento automático será gerado em seu fluxo de caixa.</p>

                     <div className="mt-8 space-y-4">
                        <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50 space-y-3">
                           <div className="flex justify-between items-center text-[10px] font-black text-blue-400 uppercase tracking-widest">
                              <span>Valor da Parcela</span>
                              <span className="bg-white px-2 py-0.5 rounded border border-blue-100">R$ {settleModal.grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           </div>
                           <div className="flex justify-between items-center pt-3 border-t border-blue-100/50">
                              <span className="text-sm font-black text-slate-900">Valor Recebido</span>
                              <div className="relative">
                                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-blue-400">R$</span>
                                 <input
                                    type="number"
                                    className="w-32 pl-9 pr-4 py-2 bg-white border border-blue-200 rounded-xl text-right font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    value={settleModal.netValue}
                                    onChange={(e) => setSettleModal({ ...settleModal, netValue: Number(e.target.value) })}
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Data de Recebimento</label>
                              <div className="relative">
                                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                 <input
                                    type="date"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                                    value={settleModal.paymentDate}
                                    onChange={(e) => setSettleModal({ ...settleModal, paymentDate: e.target.value })}
                                 />
                              </div>
                           </div>

                           <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Documento / NFe (Opcional)</label>
                              <div className="relative">
                                 <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                 <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                                    placeholder="Número do recibo ou nota..."
                                    value={settleModal.nfe}
                                    onChange={(e) => setSettleModal({ ...settleModal, nfe: e.target.value })}
                                 />
                              </div>
                           </div>
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

         {/* Batch Settle Modal */}
         {showBatchModal && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-8">
                     <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 mx-auto">
                        <Layers size={32} />
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 text-center">Baixa em Lote</h3>
                     <p className="text-slate-500 mt-2 text-center text-sm">Liquidando <strong>{selectedIds.length}</strong> parcelas selecionadas.</p>
                     
                     <div className="mt-8 space-y-4">
                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Total Pago (R$)</label>
                           <input
                              type="number"
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-black text-blue-600"
                              value={batchSettleData.totalPaid}
                              onChange={(e) => setBatchSettleData({ ...batchSettleData, totalPaid: Number(e.target.value) })}
                           />
                        </div>

                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data do Recebimento</label>
                           <input
                              type="date"
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                              value={batchSettleData.paymentDate}
                              onChange={(e) => setBatchSettleData({ ...batchSettleData, paymentDate: e.target.value })}
                           />
                        </div>

                        <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número da Nota (Opcional)</label>
                           <input
                              type="text"
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none mt-1 font-bold"
                              placeholder="NFe para todos..."
                              value={batchSettleData.nfe}
                              onChange={(e) => setBatchSettleData({ ...batchSettleData, nfe: e.target.value })}
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3 mt-8">
                        <button
                           onClick={() => setShowBatchModal(false)}
                           className="py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                        >
                           Cancelar
                        </button>
                        <button
                           onClick={confirmBatchSettle}
                           className="py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                        >
                           Confirmar
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* Order Details Modal */}
         {viewOrder && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                     <div>
                        <h3 className="text-xl font-black text-slate-900">Detalhes do Pedido #{viewOrder.id}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status: {viewOrder.status}</p>
                     </div>
                     <button onClick={() => setViewOrder(null)} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200">
                        <X size={20} />
                     </button>
                  </div>
                  
                  <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                     <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cliente</p>
                           <p className="text-sm font-black text-slate-900">{customers.find(c => c.id === viewOrder.customerId)?.name || 'N/A'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor Total</p>
                           <p className="text-lg font-black text-blue-600">R$ {viewOrder.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                     </div>

                     <div className="flex border-b border-slate-100 mb-6">
                        <button 
                           className={`px-6 py-3 text-sm font-black transition-all border-b-2 ${activeViewTab === 'items' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
                           onClick={() => setActiveViewTab('items')}
                        >
                           Resumo
                        </button>
                        <button 
                           className={`px-6 py-3 text-sm font-black transition-all border-b-2 ${activeViewTab === 'html' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
                           onClick={() => setActiveViewTab('html')}
                        >
                           Pedido HTML
                        </button>
                     </div>

                     {activeViewTab === 'items' ? (
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Receipt size={14} className="text-blue-600" />
                              Itens do Pedido
                           </h4>
                           <div className="space-y-2">
                              {viewOrder.itemsSnapshot?.map((item: any) => (
                                 <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-100 transition-all duration-300">
                                    <div>
                                       <p className="text-sm font-black text-slate-800">{item.productName || 'Produto'}</p>
                                       <p className="text-[10px] text-slate-500 font-medium italic">{item.environment} | {item.width.toFixed(3)}x{item.height.toFixed(3)}m</p>
                                    </div>
                                    <p className="text-sm font-black text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">
                                       R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                 </div>
                              ))}
                           </div>
                        </div>
                     ) : (
                        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-inner overflow-x-auto">
                           {/* Premium Print Layout Template */}
                           <table className="w-full">
                              <thead>
                                 <tr>
                                    <td>
                                       <div className="p-6 pb-4 mb-4 bg-white border-b-2 border-slate-100 flex justify-between items-start gap-8">
                                          <div className="flex items-center gap-4">
                                             <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-slate-200">
                                                <img src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg" alt="RTC Logo" className="logo-img object-contain" />
                                             </div>
                                             <div>
                                                <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>Contrato de Venda</h1>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                   <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase">
                                                      {viewOrder.contractNumber
                                                         ? `${viewOrder.quoteNumber || viewOrder.id.slice(0, 8)} / ${viewOrder.contractNumber}`
                                                         : `Nº ${viewOrder.quoteNumber || viewOrder.id.slice(0, 8).toUpperCase()}`}
                                                   </span>
                                                   <span className="text-slate-400 font-medium text-[9px]">Data: {new Date(viewOrder.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded-md w-fit">
                                                   <span className="text-[8px] font-black text-yellow-700 uppercase tracking-widest">Consultor:</span>
                                                   <span className="text-[10px] font-black text-slate-900 uppercase">{sellers.find(s => s.id === viewOrder.sellerId)?.name || 'NÃO DEFINIDO'}</span>
                                                </div>
                                             </div>
                                          </div>
                                          <div className="text-right space-y-0 hidden sm:block">
                                             <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Contratada</p>
                                             <p className="text-xs font-black text-slate-900">RTC TOLDOS E COBERTURAS LTDA</p>
                                             <p className="text-[9px] text-slate-500 font-medium">CNPJ: 12.655.737/0001-21</p>
                                             <p className="text-[9px] text-slate-500 font-medium">(21) 4062-7090 | (21) 2201-8118</p>
                                             <p className="text-[9px] text-emerald-600 font-bold">WhatsApp: (21) 97078-9399 / (21) 96433-4539</p>
                                          </div>
                                       </div>
                                    </td>
                                 </tr>
                              </thead>
                              <tbody>
                                 <tr>
                                    <td>
                                       <div className="px-6 space-y-4">
                                          {/* Contratante Info */}
                                          <section className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                             <div className="grid grid-cols-6 gap-x-6 gap-y-2">
                                                <div className="col-span-3">
                                                   <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">Contratante</p>
                                                   <p className="text-xs font-bold text-slate-900">{customers.find(c => c.id === viewOrder.customerId)?.name || 'Consumidor Final'}</p>
                                                   {customers.find(c => c.id === viewOrder.customerId)?.tradeName && (
                                                      <p className="text-[9px] text-slate-500 font-medium font-italic">({customers.find(c => c.id === viewOrder.customerId)?.tradeName})</p>
                                                   )}
                                                </div>
                                                <div className="col-span-1">
                                                   <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">Documento</p>
                                                   <p className="text-xs font-bold text-slate-900">{customers.find(c => c.id === viewOrder.customerId)?.document || '-'}</p>
                                                </div>
                                                <div className="col-span-2 text-right">
                                                   <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">Telefone</p>
                                                   <p className="text-xs font-bold text-slate-900">{customers.find(c => c.id === viewOrder.customerId)?.phone || '-'}</p>
                                                </div>
                                                <div className="col-span-3">
                                                   <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">Endereço de Instalação</p>
                                                   <p className="text-xs font-bold text-slate-900">
                                                      {(() => {
                                                         const c = customers.find(c => c.id === viewOrder.customerId);
                                                         return c?.address ? `${c.address.street}, ${c.address.number}` : '-';
                                                      })()}
                                                   </p>
                                                </div>
                                                <div className="col-span-1">
                                                   <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">CEP</p>
                                                   <p className="text-xs font-bold text-slate-900">{customers.find(c => c.id === viewOrder.customerId)?.address?.cep || '-'}</p>
                                                </div>
                                                <div className="col-span-2 text-right">
                                                   <p className="text-[7px] text-slate-400 uppercase font-black tracking-wider">E-mail</p>
                                                   <p className="text-xs font-bold text-slate-900 truncate">{customers.find(c => c.id === viewOrder.customerId)?.email || '-'}</p>
                                                </div>
                                             </div>
                                          </section>

                                          {/* Itens do Pedido */}
                                          <section>
                                             <h2 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5 underline decoration-blue-500/30 underline-offset-4">
                                                <Layers size={10} className="text-blue-500" /> Detalhamento dos Itens Contratados
                                             </h2>
                                             <div className="overflow-hidden rounded-xl border border-slate-200">
                                                <table className="w-full text-left border-collapse">
                                                   <thead className="bg-slate-900 text-white">
                                                      <tr>
                                                         <th className="px-3 py-1.5 text-[8px] font-black uppercase" style={{ width: '15%' }}>Ambiente</th>
                                                         <th className="px-3 py-1.5 text-[8px] font-black uppercase" style={{ width: '40%' }}>Descrição do Produto</th>
                                                         <th className="px-3 py-1.5 text-[8px] font-black uppercase text-center" style={{ width: '10%' }}>Cor</th>
                                                         <th className="px-3 py-1.5 text-[8px] font-black uppercase text-center font-mono" style={{ width: '20%' }}>Medida (L x A)</th>
                                                         <th className="px-3 py-1.5 text-[8px] font-black uppercase text-right" style={{ width: '15%' }}>Subtotal</th>
                                                      </tr>
                                                   </thead>
                                                   <tbody className="divide-y divide-slate-100">
                                                      {viewOrder.itemsSnapshot?.map((item: any, idx: number) => (
                                                         <tr key={idx}>
                                                            <td className="px-3 py-1.5 text-xs font-bold text-slate-900">{item.environment}</td>
                                                            <td className="px-3 py-1.5 text-xs text-slate-700 font-medium">{item.productName || 'Produto'}</td>
                                                            <td className="px-3 py-1.5 text-xs text-center text-slate-600 italic">{item.color || '-'}</td>
                                                            <td className="px-3 py-1.5 text-xs text-center font-mono font-bold text-blue-600 bg-blue-50/30">
                                                               {item.width?.toFixed(3)}m x {item.height?.toFixed(3)}m
                                                            </td>
                                                            <td className="px-3 py-1.5 text-xs text-right font-black text-slate-900 whitespace-nowrap">
                                                               R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </td>
                                                         </tr>
                                                      ))}
                                                   </tbody>
                                                   <tfoot className="bg-slate-50">
                                                      <tr>
                                                         <td colSpan={4} className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Valor Total do Pedido</td>
                                                         <td className="px-4 py-3 text-right text-sm font-black text-slate-900 whitespace-nowrap">
                                                            R$ {viewOrder.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                         </td>
                                                      </tr>
                                                   </tfoot>
                                                </table>
                                             </div>
                                          </section>

                                          {/* Financeiro e Prazos */}
                                          <div className="w-full">
                                             <section className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                                                   <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                      <CreditCard size={12} className="text-blue-500" /> Condições de Pagamento
                                                   </h4>
                                                </div>

                                                {viewOrder.installments && viewOrder.installments.length > 0 && (
                                                   <div className="space-y-1 list-none mb-4">
                                                      <div className="px-3 flex justify-between text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-b border-slate-100 pb-1">
                                                         <div className="flex gap-4">
                                                            <span className="w-16 text-center">Nº Parcela</span>
                                                            <span>Forma de Pagamento</span>
                                                         </div>
                                                         <div className="flex gap-10">
                                                            <span className="w-16 text-right">Vencimento</span>
                                                            <span className="w-20 text-right">Valor</span>
                                                         </div>
                                                      </div>
                                                      {viewOrder.installments.map((inst, idx, arr) => (
                                                         <div key={inst.id} className="py-1 px-3 bg-white border border-slate-100 rounded-lg flex items-center justify-between text-[9px] uppercase group hover:border-blue-200 transition-colors">
                                                            <div className="flex items-center gap-4">
                                                               <span className="font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[8px] w-16 text-center">{(inst as any).installmentNumber || (idx + 1)}/{arr.length}</span>
                                                               <span className="font-bold text-slate-600 truncate max-w-[150px]">{inst.paymentMethod || viewOrder.paymentMethod || 'Espécie'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-10">
                                                               <div className="flex flex-col items-end w-16">
                                                                  <span className="font-black text-slate-900 leading-tight">{new Date(inst.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                                               </div>
                                                               <div className="flex flex-col items-end min-w-[80px]">
                                                                  <span className="font-black text-blue-700 leading-tight">R$ {(inst.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                               </div>
                                                            </div>
                                                         </div>
                                                      ))}
                                                   </div>
                                                )}

                                                <div className="space-y-2">
                                                   {viewOrder.paymentConditions && (
                                                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                                                         <h4 className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                            <CreditCard size={10} /> Observações de Pagamento
                                                         </h4>
                                                         <p className="text-[9px] font-bold text-slate-700 whitespace-pre-wrap">{viewOrder.paymentConditions}</p>
                                                      </div>
                                                   )}
                                                   {viewOrder.contractObservations && (
                                                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                                         <h4 className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                            <Info size={10} /> Observações do Contrato
                                                         </h4>
                                                         <p className="text-[9px] font-bold text-slate-700 whitespace-pre-wrap">{viewOrder.contractObservations}</p>
                                                      </div>
                                                   )}
                                                </div>
                                             </section>
                                          </div>

                                          {/* Contract Clauses */}
                                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                                             <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">Cláusulas Contratuais</h3>

                                             <div className="grid grid-cols-1 gap-4 text-[7.5px] text-slate-500 leading-relaxed text-justify px-2 pb-6">
                                                <div>
                                                   <p className="font-black text-slate-700 mb-1 uppercase tracking-wider">DA ENTREGA E INSTALAÇÃO:</p>
                                                   <p>O prazo de entrega será de <span className="font-black text-slate-900">{(viewOrder.deliveryDays || 25)} dias úteis</span> para os Produtos Contratados, definido a partir do primeiro pagamento efetuado a CONTRATADA. Prazo contado a partir do 1º dia útil após o pagamento efetuado e comprovado. Havendo ausência de pagamento o prazo será suspenso e remarcado após a comprovação dos pagamentos. Os pagamentos efetuados por depósito ou transferências deverão ser comprovados pela CONTRATANTE sob pena de não serem reconhecidos. O prazo acima definido está sujeito a alteração mediante a condições especiais como clima, chuvas intensas e etc.</p>
                                                </div>

                                                <div>
                                                   <p className="font-black text-slate-700 mb-1 uppercase tracking-wider">DA GARANTIA:</p>
                                                   <p>Os Produtos e seus componentes, acessórios e os complementos que deles fazem parte, descritos neste Contrato e seus anexos, têm garantia contra defeitos de fabricação de <span className="font-black text-slate-900">01 ano (já inclusa a garantia legal)</span>, estabelecida pela CONTRATADA e por seus fornecedores, de acordo com o disposto no art. 26, inciso II, da Lei 8.078 (CDC), a partir da entrega ou disponibilização dos produtos.</p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                   <div>
                                                      <p className="font-black text-slate-700 mb-1 uppercase italic tracking-wider">A garantia ficará automaticamente cancelada se:</p>
                                                      <p>1ª- Houver danos por mau uso, manuseio ou remoção das embalagens inadequadamente por pessoal não autorizado; 2ª- Ajustes forem executados por terceiros inabilitados; 3ª- Houver problemas estruturais nos locais de fixação (paredes, lajes). É responsabilidade da CONTRATANTE providenciar os reforços necessários; 4ª- Intempéries naturais causarem danos. Nestes casos a CONTRATADA prestará suporte mediante nova proposta de custos.</p>
                                                   </div>
                                                   <div>
                                                      <p className="font-black text-slate-700 mb-1 uppercase tracking-wider">DEMAIS CLÁUSULAS:</p>
                                                      <div className="space-y-1">
                                                         <p>a) A CONTRATANTE confirma as medidas, cores e modelos detalhados no item de especificações deste contrato.</p>
                                                         <p>b) A fabricação observará o planejamento de produção conduzido pela CONTRATADA para atender ao prazo estipulado.</p>
                                                         <p>c) No caso de desistência a CONTRATANTE se obriga a arcar com o valor de 30% do valor do contrato para custos de material sob medida e administração.</p>
                                                         <p>d) O comprador obriga-se a pagar pela compra a importância lançada no item de valor total deste contrato.</p>
                                                      </div>
                                                   </div>
                                                </div>
                                             </div>
                                          </div>
                                       </div>
                                    </td>
                                 </tr>
                              </tbody>
                              <tfoot>
                                 <tr>
                                    <td>
                                       <div className="p-8 bg-white border-t border-slate-100 mt-2">
                                          <div className="flex justify-between items-end gap-12">
                                             <div className="flex-1 text-center">
                                                <div className="h-0.5 w-full bg-slate-900 mb-2 opacity-30"></div>
                                                <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Assinatura do Cliente</p>
                                             </div>
                                             <div className="flex-1 text-center flex flex-col items-center">
                                                <img
                                                   src="/signature.png"
                                                   alt="Assinatura RTC"
                                                   className="h-10 mb-[-10px] z-10"
                                                   style={{ mixBlendMode: 'multiply' }}
                                                />
                                                <div className="h-0.5 w-full bg-slate-900 mb-2 opacity-30"></div>
                                                <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">RTC TOLDOS E COBERTURAS LTDA</p>
                                             </div>
                                          </div>
                                          <div className="mt-8 bg-slate-900 py-3 text-center rounded-xl">
                                             <p className="text-[7px] text-white/30 uppercase font-black tracking-[0.4em]">RTC DECOR • QUALIDADE E EXCELÊNCIA EM RIO DE JANEIRO</p>
                                          </div>
                                       </div>
                                    </td>
                                 </tr>
                              </tfoot>
                           </table>
                        </div>
                     )}
                  </div>

                  <div className="px-8 py-6 bg-slate-50 border-t border-slate-200">
                     <button
                        onClick={() => setViewOrder(null)}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all uppercase tracking-widest"
                     >
                        Fechar Detalhes
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default Finance;
