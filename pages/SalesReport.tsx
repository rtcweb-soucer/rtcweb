
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
  Printer,
  Wallet,
  CreditCard,
  Target,
  RefreshCw,
  Edit2
} from 'lucide-react';
import { Order, OrderStatus, Product, TechnicalSheet, Seller, Customer, MeasurementItem } from '../types';
import OrderContractPrint from '../components/OrderContractPrint';
import { X, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';
interface SalesReportProps {
  orders: Order[];
  sellers: Seller[];
  products: Product[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  onUpdateOrder?: (order: Order) => Promise<void>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const SalesReport = ({ orders, sellers, products, customers, technicalSheets, onUpdateOrder }: SalesReportProps) => {
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSellerId, setFilterSellerId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'sales' | 'receivables' | 'reconciliation'>('sales');
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reconciliation States
  const [reconciliationData, setReconciliationData] = useState<any[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [reconciliationResults, setReconciliationResults] = useState<{
    matches: any[],
    not_found: any[],
    already_paid: any[]
  }>({ matches: [], not_found: [], already_paid: [] });
  const [editingPaymentDate, setEditingPaymentDate] = useState<{
    orderId: string;
    installmentId: string;
    currentDate: string;
  } | null>(null);
  
  const [showOnlyPaid, setShowOnlyPaid] = useState(false);
  const [includeOldPaid, setIncludeOldPaid] = useState(false);

  const handlePrintOrder = () => {
    if (!printRef.current) return;
    
    const element = printRef.current;
    const opt = {
      margin: 10,
      filename: `pedido_${selectedOrderForView?.contractNumber || selectedOrderForView?.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save();
  };

  const handleUpdatePaymentDate = async (orderId: string, installmentId: string, newDate: string) => {
    if (!onUpdateOrder) {
      alert("Erro: Função de atualização não disponível.");
      return;
    }

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

  const confirmedOrders = useMemo(() => {
    return orders.filter((o: Order) => 
      o.status !== OrderStatus.QUOTE_SENT && 
      o.status !== OrderStatus.PENDING_MEASUREMENT
    );
  }, [orders]);

  const reportData = useMemo(() => {
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
  }, [confirmedOrders, customers, filterSellerId, filterStartDate, filterEndDate, searchTerm, filterType, technicalSheets, products]);

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
    const primaryTypes = ['Toldo', 'Cortina', 'Cobertura'];

    reportData.forEach(order => {
      const sheet = technicalSheets.find(s => s.id === order.technicalSheetId);
      const items = order.itemsSnapshot || (sheet ? sheet.items : []);
      if (!items || items.length === 0) return;

      const itemPrices = order.itemPrices || {};
      const hasIndividualPrices = Object.keys(itemPrices).length > 0;

      if (hasIndividualPrices) {
        const totalPriced = items.reduce((sum: number, item: any) => {
          return sum + (itemPrices[item.id] || 0);
        }, 0);

        items.forEach((item: any) => {
          const prod = products.find(p => p.id === item.productId);
          // PRIORIDADE: tipo atual do cadastro > tipo gravado no item > 'Outros'
          let rawType = prod?.tipo || item.productType || 'Outros';
          const type = primaryTypes.includes(rawType) ? rawType : 'Acessórios/Outros';

          const itemPrice = itemPrices[item.id] || 0;
          const proportion = totalPriced > 0 ? itemPrice / totalPriced : 1 / items.length;
          const itemValue = order.totalValue * proportion;
          typeMap[type] = (typeMap[type] || 0) + itemValue;
        });
      } else {
        const perItemValue = order.totalValue / items.length;
        items.forEach((item: any) => {
          const prod = products.find(p => p.id === item.productId);
          let rawType = prod?.tipo || item.productType || 'Outros';
          const type = primaryTypes.includes(rawType) ? rawType : 'Acessórios/Outros';
          typeMap[type] = (typeMap[type] || 0) + perItemValue;
        });
      }
    });

    const salesByType = Object.entries(typeMap).map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        // Ordem fixa sugerida pelo usuário
        const order = { 'Toldo': 1, 'Cortina': 2, 'Cobertura': 3, 'Acessórios/Outros': 4 } as any;
        return (order[a.name] || 99) - (order[b.name] || 99);
      });

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

  const receivableData = useMemo(() => {
    const data: any[] = [];
    const startDate = filterStartDate ? new Date(filterStartDate) : null;
    const endDate = filterEndDate ? new Date(filterEndDate + 'T23:59:59') : null;

    // Se incluir contratos antigos, processamos TODOS os pedidos confirmados.
    // Caso contrário, apenas os que já passaram pelo filtro de data (reportData).
    const ordersToProcess = includeOldPaid ? confirmedOrders : reportData;
    
    ordersToProcess.forEach(order => {
      const isFromReportData = reportData.some(ro => ro.id === order.id);
      const customer = customers.find(c => c.id === order.customerId);
      const installments = order.installments || [];
      
      installments.forEach(inst => {
        const instPaymentDateStr = inst.paymentDate?.split('T')[0];
        const instPaymentDate = instPaymentDateStr ? new Date(instPaymentDateStr + 'T12:00:00') : null;
        
        let shouldInclude = false;
        let isOldContractPayment = false;

        if (isFromReportData) {
          // Caso padrão: Contrato criado dentro do período
          shouldInclude = true;
        } else if (includeOldPaid && instPaymentDate && startDate && endDate) {
          // Caso Injetado: Contrato é antigo, mas foi pago neste período
          const orderDate = new Date(order.createdAt);
          if (orderDate < startDate && instPaymentDate >= startDate && instPaymentDate <= endDate) {
            shouldInclude = true;
            isOldContractPayment = true;
          }
        }

        // Filtro: Apenas Liquidadas
        if (shouldInclude && showOnlyPaid && inst.status !== 'PAID') {
          shouldInclude = false;
        }

        // Se passar por todos os critérios, adiciona à lista
        if (shouldInclude) {
          const vlrPago = inst.status === 'PAID' ? (inst.netValue ?? inst.value) : 0;
          const jurosLocal = inst.status === 'PAID' ? (vlrPago - inst.value) : 0;

          data.push({
            cliente: customer?.name || 'N/D',
            linkId: order.id,
            contrato: order.contractNumber || order.id.slice(0, 8),
            nf: order.nfeNumber || inst.nfe || '--',
            dataNF: order.createdAt,
            vlrTotalNF: order.totalValue,
            parcela: `${String(inst.number).padStart(2, '0')}/${String(installments.length).padStart(2, '0')}`,
            vlrParcela: inst.value,
            vencimento: inst.dueDate,
            dtPagto: inst.paymentDate,
            status: inst.status,
            valorPago: vlrPago,
            descontos: 0,
            juros: jurosLocal,
            banco: 'Itaú - RTC',
            conta: '16083-6',
            orderId: order.id,
            installmentId: inst.id,
            isOldContractPayment
          });
        }
      });
    });

    return data.sort((a, b) => {
      // 1. Separar pagamentos de contratos antigos (colocar no final)
      if (a.isOldContractPayment !== b.isOldContractPayment) {
        return a.isOldContractPayment ? 1 : -1;
      }
      
      // 2. Para o mesmo grupo, agrupar pelo contrato de forma decrescente
      if (b.contrato !== a.contrato) return b.contrato.localeCompare(a.contrato);
      
      // 3. Ordenar as parcelas dentro do contrato
      return a.parcela.localeCompare(b.parcela);
    });
  }, [reportData, confirmedOrders, customers, includeOldPaid, showOnlyPaid, filterStartDate, filterEndDate]);

  const productTypes = useMemo(() => {
    const types = new Set<string>();
    products.forEach(p => { if (p.tipo) types.add(p.tipo); });
    return Array.from(types).sort();
  }, [products]);

  const exportToExcel = () => {
    let exportData = [];
    let filename = "";

    if (activeTab === 'sales') {
        exportData = reportData.map(order => {
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
        filename = `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else {
        exportData = receivableData.map(row => ({
          'Cliente': row.cliente,
          'Contrato': row.contrato,
          'NF': row.nf,
          'Data NF': new Date(row.dataNF).toLocaleDateString(),
          'Vlr. Total NF': row.vlrTotalNF,
          'Parcela': row.parcela,
          'Vlr Parcela': row.vlrParcela,
          'Vencimento': new Date(row.vencimento + 'T12:00:00').toLocaleDateString(),
          'Dt. Pagto.': row.dtPagto ? new Date(row.dtPagto.split('T')[0] + 'T12:00:00').toLocaleDateString() : '-',
          'Descontos': row.descontos,
          'Juros': row.juros,
          'Valor Pago': row.valorPago,
          'Banco': row.banco,
          'Conta': row.conta
        }));
        filename = `Relatorio_Sintetico_Receber_${new Date().toISOString().split('T')[0]}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'sales' ? "Vendas" : "Receber");
    XLSX.writeFile(wb, filename);
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
      filename: activeTab === 'sales' ? `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.pdf` : `Relatorio_Sintetico_Receber_${new Date().toISOString().split('T')[0]}.pdf`,
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

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit no-pdf">
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
            activeTab === 'sales' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp size={16} />
          Relatório de Vendas
        </button>
        <button
          onClick={() => setActiveTab('receivables')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
            activeTab === 'receivables' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Wallet size={16} />
          Contas a Receber (Caixa)
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
            activeTab === 'reconciliation' 
              ? 'bg-white text-rose-600 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <RefreshCw size={16} />
          Conciliação Bancária
        </button>
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
        {activeTab === 'receivables' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Parcelas</label>
              <button 
                onClick={() => setShowOnlyPaid(!showOnlyPaid)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  showOnlyPaid 
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm' 
                    : 'bg-slate-50 text-slate-400 border border-transparent hover:bg-slate-100'
                }`}
              >
                {showOnlyPaid ? <Check size={14} /> : <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded-sm" />}
                APENAS LIQUIDADAS
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Abrangência</label>
              <button 
                onClick={() => setIncludeOldPaid(!includeOldPaid)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  includeOldPaid 
                    ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm' 
                    : 'bg-slate-50 text-slate-400 border border-transparent hover:bg-slate-100'
                }`}
              >
                {includeOldPaid ? <Check size={14} /> : <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded-sm" />}
                INCLUIR CONTRATOS ANTIGOS
              </button>
            </div>
          </>
        )}
        <button 
          onClick={() => {
            setFilterStartDate(''); setFilterEndDate(''); 
            setFilterSellerId(''); setFilterType(''); setSearchTerm('');
            setShowOnlyPaid(false); setIncludeOldPaid(false);
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
                    <h1 className="text-2xl font-black uppercase tracking-tight">
                        {activeTab === 'sales' ? 'Relatório de Vendas' : 'RELATÓRIO SINTÉTICO CONTAS A RECEBER'}
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">RTC DECOR - Toldos & Cortinas</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Gerado em</p>
                    <p className="text-sm font-black">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                </div>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 no-pdf">
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

        {activeTab === 'sales' ? (
          <>
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

            {/* Breakdown por Tipo de Produto */}
            {stats.salesByType.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-pdf">
                <h3 className="text-sm font-black text-slate-900 mb-5 flex items-center gap-2 uppercase tracking-tight">
                  <Package size={18} className="text-amber-500" />
                  Faturamento por Tipo de Produto
                  <span className="ml-auto text-[10px] font-bold text-slate-400 normal-case tracking-normal">
                    * valores proporcionais — somam o total do período
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {stats.salesByType.map((type, i) => {
                    const pct = stats.totalValue > 0 ? (type.value / stats.totalValue) * 100 : 0;
                    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-pink-500'];
                    const textColors = ['text-blue-600', 'text-emerald-600', 'text-amber-600', 'text-rose-600', 'text-violet-600', 'text-pink-600'];
                    const bgColors = ['bg-blue-50', 'bg-emerald-50', 'bg-amber-50', 'bg-rose-50', 'bg-violet-50', 'bg-pink-50'];
                    return (
                      <div key={type.name} className={`p-4 rounded-2xl border ${bgColors[i % bgColors.length]} border-slate-100`}>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-xs font-black uppercase tracking-wider ${textColors[i % textColors.length]}`}>{type.name}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full bg-white border ${textColors[i % textColors.length]}`}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xl font-black text-slate-900 mb-3">
                          R$ {type.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <div className="h-1.5 bg-white rounded-full overflow-hidden border border-slate-100">
                          <div
                            className={`h-full ${colors[i % colors.length]} rounded-full transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reconciliation Tab Content */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm text-center">
            <div className="max-w-md mx-auto space-y-6">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
                <RefreshCw size={40} className={isProcessingFile ? 'animate-spin' : ''} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Importar Extrato</h3>
                <p className="text-sm text-slate-500 mt-2 font-medium">Suba o arquivo Excel (.xlsx) ou CSV para conciliar pagamentos via código CV.</p>
              </div>
              
              <div className="flex flex-col gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv"
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    setIsProcessingFile(true);
                    try {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const bstr = evt.target?.result;
                        const wb = XLSX.read(bstr, { type: 'binary' });
                        const wsname = wb.SheetNames[0];
                        const ws = wb.Sheets[wsname];
                        const data = XLSX.utils.sheet_to_json(ws);
                        
                        console.log("Arquivo importado:", data);
                        
                        // Lógica de Match
                        const matches: any[] = [];
                        const not_found: any[] = [];
                        const already_paid: any[] = [];
                        
                        // Pegar todas as parcelas pendentes do sistema que tem CV
                        const allInstallmentsWithCV: any[] = [];
                        orders.forEach(order => {
                           order.installments?.forEach(inst => {
                              if (inst.cvCode) {
                                 allInstallmentsWithCV.push({ ...inst, orderId: order.id, customerName: customers.find(c => c.id === order.customerId)?.name || 'N/A' });
                              }
                           });
                        });

                        data.forEach((row: any) => {
                           // Tentar adivinhar a coluna de CV no Excel (pode ser CV, NSU, Transação, etc)
                           const rowCV = row['CV'] || row['NSU'] || row['Nǜ Transação'] || row['Código'] || row['cv'];
                           const rowValue = row['Valor'] || row['Bruto'] || row['Vlr Bruto'] || row['VALOR'];
                           const rowNetValue = row['Líquido'] || row['Vlr Líquido'] || row['Recebido'] || rowValue;
                           const rowDate = row['Data'] || row['DATA'] || row['Data Pagamento'];

                           if (rowCV) {
                              const match = allInstallmentsWithCV.find(inst => inst.cvCode?.toString() === rowCV?.toString());
                              if (match) {
                                 if (match.status === 'PAID') {
                                    already_paid.push({ ...row, systemMatch: match, rowCV });
                                 } else {
                                    matches.push({ ...row, systemMatch: match, rowCV, rowValue, rowNetValue, rowDate });
                                 }
                              } else {
                                 not_found.push({ ...row, rowCV });
                              }
                           }
                        });

                        setReconciliationResults({ matches, not_found, already_paid });
                      };
                      reader.readAsBinaryString(file);
                    } catch (err) {
                      alert("Erro ao ler arquivo: " + err);
                    } finally {
                      setIsProcessingFile(false);
                    }
                  }}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                >
                  <Download size={20} />
                  Escolher Arquivo
                </button>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Formatos aceitos: XLSX, XLS, CSV</p>
              </div>
            </div>
          </div>

          {(reconciliationResults.matches.length > 0 || reconciliationResults.not_found.length > 0) && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Matches Encontrados */}
                <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
                   <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                      <h4 className="font-black text-emerald-700 uppercase text-xs tracking-widest flex items-center gap-2">
                         <Check size={16} /> Matches Encontrados ({reconciliationResults.matches.length})
                      </h4>
                      {reconciliationResults.matches.length > 0 && (
                         <button 
                           onClick={async () => {
                              if (!confirm(`Deseja efetivar a baixa de ${reconciliationResults.matches.length} parcelas automaticamente?`)) return;
                              if (!onUpdateOrder) {
                                 alert("Erro: Função de atualização não disponível.");
                                 return;
                              }
                              
                              setIsProcessingFile(true);
                              try {
                                 let successCount = 0;
                                 for (const match of reconciliationResults.matches) {
                                    const order = orders.find(o => o.id === match.systemMatch.orderId);
                                    if (!order) continue;

                                    const updatedInstallments = order.installments?.map(inst => {
                                       if (inst.id === match.systemMatch.id) {
                                          return {
                                             ...inst,
                                             status: 'PAID' as 'PAID',
                                             paymentDate: match.rowDate || new Date().toISOString().split('T')[0],
                                             netValue: typeof match.rowNetValue === 'number' ? match.rowNetValue : parseFloat(match.rowNetValue?.toString().replace('R$', '').replace('.', '').replace(',', '.') || '0')
                                          };
                                       }
                                       return inst;
                                    });

                                    await onUpdateOrder({ ...order, installments: updatedInstallments });
                                    successCount++;
                                 }
                                 
                                 alert(`${successCount} parcelas baixadas com sucesso!`);
                                 setReconciliationResults({ matches: [], not_found: [], already_paid: [] });
                                 setReconciliationData([]);
                              } catch (e: any) {
                                 alert("Erro durante a baixa em massa: " + e.message);
                              } finally {
                                 setIsProcessingFile(false);
                              }
                           }}
                           className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                         >
                            EFETIVAR BAIXA EM MASSA
                         </button>
                      )}
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                               <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">CV / Match</th>
                               <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Extrato</th>
                               <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Sistema</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            {reconciliationResults.matches.map((m, i) => (
                               <tr key={i} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4">
                                     <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-900">{m.rowCV}</span>
                                        <span className="text-[10px] font-bold text-blue-600 uppercase mt-0.5">{m.systemMatch.customerName}</span>
                                     </div>
                                  </td>
                                  <td className="px-6 py-4">
                                     <span className="text-sm font-black text-emerald-600">
                                        {typeof m.rowValue === 'number' ? `R$ ${m.rowValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : m.rowValue}
                                     </span>
                                  </td>
                                  <td className="px-6 py-4">
                                     <span className="text-sm font-black text-slate-900">
                                        R$ {m.systemMatch.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                     </span>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>

                {/* Não Encontrados */}
                <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
                   <div className="p-6 bg-slate-50 border-b border-slate-100">
                      <h4 className="font-black text-slate-500 uppercase text-xs tracking-widest flex items-center gap-2">
                         <X size={16} /> Não Identificados ({reconciliationResults.not_found.length})
                      </h4>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                               <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">CV no Arquivo</th>
                               <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lançamento</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 opacity-60">
                            {reconciliationResults.not_found.slice(0, 10).map((m, i) => (
                               <tr key={i}>
                                  <td className="px-6 py-4 text-xs font-black text-slate-900">{m.rowCV}</td>
                                  <td className="px-6 py-4 text-xs font-bold text-slate-500 truncate max-w-[200px]">
                                     {JSON.stringify(m)}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
          )}
        </div>
      )}

      {/* Contract Detail Modal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-pdf no-pdf-break">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                    <TrendingUp size={20} className="text-blue-500" />
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
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">NFe</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor</th>
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
                                <button 
                                    onClick={() => { setSelectedOrderForView(order); setShowPrintModal(true); }}
                                    className="text-xs font-black text-blue-600 hover:underline text-left"
                                >
                                    {order.contractNumber || order.id}
                                </button>
                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">REF: {order.id.substring(0, 8)}</span>
                            </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`text-xs font-black ${order.nfeNumber ? 'text-blue-600' : 'text-slate-300'}`}>
                                    {order.nfeNumber || '--'}
                                </span>
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
                        <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic font-medium">
                            Nenhuma venda encontrada para os filtros selecionados.
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-900 uppercase tracking-tight">RELATÓRIO SINTÉTICO CONTAS A RECEBER</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                    {receivableData.length} Parcelas Encontradas
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Contratos</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">NF</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Data NF</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Vlr. Total NF</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-center">Parcela</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Vlr Parcela</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Vencimento</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Dt. Pagto.</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-right">Descontos</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-right">Juros</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Valor Pago</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Banco</th>
                            <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Conta</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-medium">
                        {receivableData.map((row, idx) => (
                            <tr key={`${row.contrato}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-slate-900 font-bold uppercase">{row.cliente}</td>
                                <td className="px-4 py-3 text-blue-600 font-black uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            onClick={() => {
                                                const originalOrder = orders.find(o => o.id === row.orderId);
                                                if (originalOrder) {
                                                    setSelectedOrderForView(originalOrder);
                                                    setShowPrintModal(true);
                                                }
                                            }}
                                            className="hover:underline text-left"
                                        >
                                            {row.contrato}
                                        </button>
                                        {row.isOldContractPayment && (
                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded text-[8px] font-black border border-blue-100 animate-pulse">
                                                ANTIGO
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-500 font-black">{row.nf}</td>
                                <td className="px-4 py-3 text-slate-600">{new Date(row.dataNF).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right text-slate-900">R$ {row.vlrTotalNF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-tighter shadow-sm border border-blue-100">
                                        {row.parcela}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-900 font-black">R$ {row.vlrParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="px-4 py-3 text-slate-600">{new Date(row.vencimento + 'T12:00:00').toLocaleDateString()}</td>
                                <td className="px-4 py-3 font-black text-[10px]">
                                    {editingPaymentDate?.installmentId === row.installmentId ? (
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="date"
                                                value={editingPaymentDate.currentDate}
                                                onChange={(e) => setEditingPaymentDate(editingPaymentDate ? { ...editingPaymentDate, currentDate: e.target.value } : null)}
                                                className="px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <button 
                                                onClick={() => editingPaymentDate && handleUpdatePaymentDate(row.orderId, row.installmentId, editingPaymentDate.currentDate)}
                                                className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"
                                                title="Confirmar"
                                            >
                                                <Check size={10} />
                                            </button>
                                            <button 
                                                onClick={() => setEditingPaymentDate(null)}
                                                className="p-1 bg-rose-100 text-rose-600 rounded hover:bg-rose-200"
                                                title="Cancelar"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {row.dtPagto ? (
                                                <span className="text-emerald-600 font-bold italic">{new Date(row.dtPagto.split('T')[0] + 'T12:00:00').toLocaleDateString()}</span>
                                            ) : (
                                                <span className="text-slate-300 font-normal">--/--/----</span>
                                            )}
                                            <button 
                                                onClick={() => setEditingPaymentDate({ orderId: row.orderId, installmentId: row.installmentId, currentDate: row.dtPagto || '' })}
                                                className="flex items-center gap-1 p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all border border-blue-100 ml-1"
                                                title="Editar Data de Pagamento"
                                            >
                                                <Edit2 size={14} />
                                                <span className="text-[9px] font-black uppercase tracking-tighter">MUDAR</span>
                                            </button>
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-400">{row.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="px-4 py-3 text-right text-slate-900 font-bold">
                                    {row.juros !== 0 ? (
                                        <span className={row.juros > 0 ? 'text-blue-600' : 'text-rose-600'}>
                                            {row.juros.toLocaleString('pt-BR', { minimumFractionDigits: 2, signDisplay: 'always' })}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">0,00</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right text-emerald-600 font-black italic">
                                    {row.valorPago > 0 ? `R$ ${row.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.banco}</td>
                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.conta}</td>
                            </tr>
                        ))}
                        {receivableData.length === 0 && (
                            <tr>
                                <td colSpan={14} className="px-6 py-20 text-center text-slate-400 italic font-medium">
                                    Nenhum recebível encontrado para os filtros selecionados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Impressão do Contrato */}
      {showPrintModal && selectedOrderForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 no-pdf">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Visualizar Contrato</h3>
                  <p className="text-xs text-slate-500">Pedido: {selectedOrderForView.contractNumber || selectedOrderForView.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintOrder}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Printer size={18} /> Imprimir / PDF
                </button>
                <button onClick={() => setShowPrintModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50">
              <div className="max-w-[850px] mx-auto">
                <OrderContractPrint 
                  ref={printRef}
                  order={selectedOrderForView}
                  customers={customers}
                  sellers={sellers}
                  products={products}
                  technicalSheets={technicalSheets}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReport;
