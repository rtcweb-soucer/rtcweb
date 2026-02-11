
import * as React from 'react';
import { useState, useRef } from 'react';
import { Order, Customer, TechnicalSheet, Product, OrderStatus, Seller, Installment, ProductionStage, MeasurementItem } from '../types';
import {
  Briefcase,
  Search,
  ChevronRight,
  MapPin,
  Calendar,
  User,
  ArrowLeft,
  DollarSign,
  Layers,
  Printer,
  Monitor,
  Info,
  CreditCard,
  FileText,
  Edit3,
  Trash2,
  X,
  Clock,
  Activity,
  ArrowDown,
  Phone,
  Filter,
  UserCheck,
  MapPin as PinIcon,
  CreditCard as DocIcon
} from 'lucide-react';

interface OrdersProps {
  orders: Order[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  products: Product[];
  sellers: Seller[];
  onUpdateOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
}

const Orders = ({
  orders,
  customers,
  technicalSheets,
  products,
  sellers,
  onUpdateOrder,
  onDeleteOrder
}: OrdersProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);

  // New Filters
  const [filterSellerId, setFilterSellerId] = useState('');
  const [filterNeighborhood, setFilterNeighborhood] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterCPF, setFilterCPF] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  const filteredOrders = orders.filter((order: Order) => {
    const isOrder = order.status !== OrderStatus.QUOTE_SENT && order.status !== OrderStatus.PENDING_MEASUREMENT;
    if (!isOrder) return false;

    const customer = customers.find((c: Customer) => c.id === order.customerId);
    const orderDate = new Date(order.createdAt);

    // Filter Logic
    const matchSearch = customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) || order.id.includes(searchTerm);
    const matchSeller = filterSellerId === '' || order.sellerId === filterSellerId;
    const matchNeighborhood = filterNeighborhood === '' || customer?.address.neighborhood.toLowerCase().includes(filterNeighborhood.toLowerCase());
    const matchAddress = filterAddress === '' || customer?.address.street.toLowerCase().includes(filterAddress.toLowerCase());
    const matchPhone = filterPhone === '' || customer?.phone.includes(filterPhone);
    const matchCPF = filterCPF === '' || customer?.document.includes(filterCPF);

    const matchDateStart = filterStartDate === '' || orderDate >= new Date(filterStartDate);
    const matchDateEnd = filterEndDate === '' || orderDate <= new Date(filterEndDate + 'T23:59:59');

    return matchSearch && matchSeller && matchNeighborhood && matchAddress && matchPhone && matchCPF && matchDateStart && matchDateEnd;
  });

  const selectedOrder = orders.find((o: Order) => o.id === selectedOrderId);
  const selectedCustomer = selectedOrder ? customers.find((c: Customer) => c.id === selectedOrder.customerId) : null;
  const seller = selectedOrder ? sellers.find((s: Seller) => s.id === selectedOrder.sellerId) : null;
  const originalSheet = selectedOrder ? technicalSheets.find((s: TechnicalSheet) => s.id === selectedOrder.technicalSheetId) : null;

  const orderItems = (() => {
    if (!originalSheet) return [];
    if (!selectedOrder?.itemIds) return originalSheet.items;
    return originalSheet.items.filter((item: MeasurementItem) => selectedOrder.itemIds?.includes(item.id));
  })();

  const calculateItemPrice = (item: MeasurementItem) => {
    if (!selectedOrder) return 0;
    const product = products.find((p: Product) => p.id === item.productId);
    if (!product) return 0;

    const originalTotal = orderItems.reduce((acc: number, it: MeasurementItem) => {
      const p = products.find((prod: Product) => prod.id === it.productId);
      if (!p) return acc;
      const area = (it.width * it.height) || 1;
      return acc + (p.unidade === 'M2' ? p.valor * area : p.valor);
    }, 0);

    const area = (item.width * item.height) || 1;
    const baseValue = product.unidade === 'M2' ? product.valor * area : product.valor;

    if (originalTotal > 0 && selectedOrder.totalValue !== originalTotal) {
      const ratio = selectedOrder.totalValue / originalTotal;
      return baseValue * ratio;
    }
    return baseValue;
  };

  const handleEditClick = () => {
    if (selectedOrder) {
      setEditingOrder({ ...selectedOrder });
      setShowEditModal(true);
    }
  };

  const openHistory = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setHistoryOrder(order);
    setShowHistoryModal(true);
  };

  const handleUpdateInstallment = (index: number, field: keyof Installment, value: any) => {
    if (!editingOrder?.installments) return;
    const updated = [...editingOrder.installments];
    updated[index] = { ...updated[index], [field]: value };
    setEditingOrder({ ...editingOrder, installments: updated });

    if (field === 'value') {
      const newTotal = updated.reduce((acc: number, curr: Installment) => acc + (parseFloat(curr.value.toString()) || 0), 0);
      setEditingOrder({ ...editingOrder, installments: updated, totalValue: parseFloat(newTotal.toFixed(2)) });
    }
  };

  const saveEdits = () => {
    if (editingOrder) {
      onUpdateOrder(editingOrder);
      setShowEditModal(false);
      setEditingOrder(null);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const handleGeneratePrint = (autoPrint: boolean = true) => {
    if (!printRef.current || !selectedOrder) return;

    const printWindow = window.open('', '_blank', 'width=1024,height=800');
    if (!printWindow) {
      alert("Por favor, habilite pop-ups.");
      return;
    }

    const content = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <title>RTC DECOR - Contrato ${selectedOrder.id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
          <style>
            @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } @page { size: A4; margin: 0; } }
            body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; padding: 20px; display: flex; justify-content: center; }
            .a4-page { background: white; width: 210mm; min-height: 297mm; padding: 12mm; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.1); box-sizing: border-box; position: relative; }
            @media print { body { background: white; padding: 0; } .a4-page { width: 100%; height: 100%; margin: 0; padding: 12mm; box-shadow: none; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            section, tr, .footer-content { page-break-inside: avoid; }
            .logo-img { max-height: 70px; }
          </style>
        </head>
        <body>
          <div class="a4-page">${content}</div>
          ${autoPrint ? `<script>window.onload = () => { setTimeout(() => { window.print(); }, 1000); };</script>` : ''}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (selectedOrderId && selectedOrder && selectedCustomer) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 mb-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 no-print">
          <button onClick={() => setSelectedOrderId(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors">
            <ArrowLeft size={20} /> Voltar para Lista
          </button>
          <div className="flex flex-wrap gap-3">
            <button onClick={(e) => openHistory(e, selectedOrder)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
              <Activity size={18} className="text-blue-500" /> Ver Log PCP
            </button>
            <button onClick={handleEditClick} className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
              <Edit3 size={18} /> Editar Pedido
            </button>
            <button onClick={() => onDeleteOrder(selectedOrder.id)} className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all shadow-sm">
              <Trash2 size={18} /> Excluir
            </button>
            <button onClick={() => handleGeneratePrint(true)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              <Printer size={18} /> Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Layout de Pedido */}
        <div ref={printRef} className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 print:shadow-none print:border-none print:m-0 print:rounded-none">
          {/* Header */}
          <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-start gap-8">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-slate-200">
                <img src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg" alt="RTC Logo" className="logo-img object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>Contrato de Venda</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase">Nº {selectedOrder.id}</span>
                  <span className="text-slate-400 font-medium text-[9px]">Data: {new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="text-right space-y-0">
              <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Contratada</p>
              <p className="text-xs font-black text-slate-900">RTC TOLDOS E DECORAÇÕES</p>
              <p className="text-[9px] text-slate-500 font-medium">CNPJ: 06.276.371/0001-87</p>
              <p className="text-[9px] text-slate-500 font-medium">(21) 2281-8224 | (21) 99798-6419</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Info do Cliente */}
            <section className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                <div className="col-span-2">
                  <p className="text-[7px] text-slate-400 uppercase font-black">Contratante</p>
                  <p className="text-xs font-bold text-slate-900">{selectedCustomer.name}</p>
                </div>
                <div>
                  <p className="text-[7px] text-slate-400 uppercase font-black">Documento</p>
                  <p className="text-xs font-bold text-slate-900">{selectedCustomer.document}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[7px] text-slate-400 uppercase font-black">Local da Instalação</p>
                  <p className="text-xs font-bold text-slate-900">{selectedCustomer.address.street}, {selectedCustomer.address.number} - {selectedCustomer.address.neighborhood}</p>
                </div>
                <div>
                  <p className="text-[7px] text-slate-400 uppercase font-black">Cidade/UF</p>
                  <p className="text-xs font-bold text-slate-900">{selectedCustomer.address.city} - {selectedCustomer.address.state}</p>
                </div>
              </div>
            </section>

            {/* Itens do Pedido */}
            <section>
              <h2 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><Layers size={10} className="text-blue-500" /> Itens Contratados</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-4 py-2 text-[8px] font-black uppercase">Ambiente</th>
                      <th className="px-4 py-2 text-[8px] font-black uppercase">Descrição do Produto</th>
                      <th className="px-4 py-2 text-[8px] font-black uppercase text-center">Cor</th>
                      <th className="px-4 py-2 text-[8px] font-black uppercase text-center">Medida (L x A)</th>
                      <th className="px-4 py-2 text-[8px] font-black uppercase text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderItems.map((item: MeasurementItem) => (
                      <tr key={item.id}>
                        <td className="px-4 py-1.5 text-xs font-bold text-slate-900">{item.environment}</td>
                        <td className="px-4 py-1.5 text-xs text-slate-700 font-medium">{products.find((p: Product) => p.id === item.productId)?.nome || 'Item Personalizado'}</td>
                        <td className="px-4 py-1.5 text-xs text-center text-slate-600 italic">{item.color || '-'}</td>
                        <td className="px-4 py-1.5 text-xs text-center font-mono font-bold text-blue-600">{item.width.toFixed(3)}m x {item.height.toFixed(3)}m</td>
                        <td className="px-4 py-1.5 text-xs text-right font-black text-slate-900">R$ {(calculateItemPrice(item) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-600 text-white">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-[9px] font-black text-right uppercase tracking-widest">Valor Total do Pedido</td>
                      <td className="px-4 py-2 text-lg font-black text-right">R$ {(selectedOrder.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Grade de Parcelas */}
            <section className="animate-in fade-in duration-500">
              <h2 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><CreditCard size={10} className="text-blue-500" /> Condições de Pagamento</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-500 uppercase">Parcela</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-500 uppercase">Vencimento</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-500 uppercase text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.installments?.map((inst: Installment, idx: number) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-xs font-bold text-slate-700">
                          {String(inst.number).padStart(2, '0')}/{String(selectedOrder.installments?.length || 1).padStart(2, '0')}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600">{new Date(inst.dueDate).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-xs text-right font-black text-blue-600">R$ {(inst.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    )) || (
                        <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic text-xs">Nenhum detalhamento de parcelas disponível.</td></tr>
                      )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Rodapé e Assinaturas */}
            <div className="grid grid-cols-2 gap-8 pt-2">
              <div className="space-y-4">
                <section>
                  <h3 className="text-[8px] font-black text-blue-600 uppercase mb-2">Informações Adicionais</h3>
                  <div className="p-4 bg-slate-50 rounded-xl border-l-3 border-blue-600 text-[9px] text-slate-600 leading-relaxed italic">
                    <p className="font-bold text-slate-800 mb-1">Forma: {selectedOrder.paymentMethod || 'A Definir'}</p>
                    {selectedOrder.paymentConditions || 'Conforme acordado no ato do fechamento.'}
                    <p className="mt-2">Garantia RTC Decor de 01 ano contra defeitos de fabricação.</p>
                  </div>
                </section>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Vendedor</p>
                    <p className="text-xs font-black text-slate-900 truncate uppercase">{seller?.name || 'Vendedor RTC'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Status</p>
                    <p className="text-xs font-black text-slate-900 uppercase">{selectedOrder.status}</p>
                  </div>
                </div>
                <div className="pt-4 text-center">
                  <div className="h-10 w-full border-b border-slate-900 mb-1.5 opacity-30"></div>
                  <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Assinatura do Cliente</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 py-3 text-center">
            <p className="text-[7px] text-white/30 uppercase font-black tracking-[0.4em]">RTC DECOR • QUALIDADE E EXCELÊNCIA EM RIO DE JANEIRO</p>
          </div>
        </div>

        {/* Modal de Edição */}
        {showEditModal && editingOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900">Editar Detalhes do Pedido {editingOrder.id}</h3>
                <button onClick={() => setShowEditModal(false)} className="p-2 text-slate-400 hover:text-rose-500"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[85vh] overflow-y-auto">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grade de Recebimento</h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 font-black text-slate-500 uppercase">Parc.</th>
                          <th className="px-4 py-2 font-black text-slate-500 uppercase text-right">Valor (R$)</th>
                          <th className="px-4 py-2 font-black text-slate-500 uppercase text-center">Pagamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {editingOrder.installments?.map((inst: Installment, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-bold text-slate-400">
                              {String(inst.number).padStart(2, '0')}/{String(editingOrder.installments?.length || 1).padStart(2, '0')}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <input
                                type="number" step="0.01"
                                value={inst.value}
                                onChange={(e) => handleUpdateInstallment(idx, 'value', parseFloat(e.target.value) || 0)}
                                className="bg-slate-50 border border-slate-200 rounded-lg font-black text-blue-600 text-right w-24 px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-2 text-center text-[10px]">
                              <input
                                type="date"
                                value={inst.paymentDate || ''}
                                onChange={(e) => handleUpdateInstallment(idx, 'paymentDate', e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-600 px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pagamento</label>
                    <input
                      value={editingOrder.paymentMethod || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, paymentMethod: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status Operacional</label>
                    <select
                      value={editingOrder.status}
                      onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value as OrderStatus })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
                    >
                      {Object.values(OrderStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
                  <button onClick={saveEdits} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all">Salvar Alterações</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pedidos Confirmados</h2>
          <p className="text-slate-500">Gestão de contratos fechados e em andamento.</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2 text-blue-600">
          <Filter size={18} />
          <h3 className="text-sm font-black uppercase tracking-widest">Filtros Avançados</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="ID ou Cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
          </div>

          <select value={filterSellerId} onChange={(e) => setFilterSellerId(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium">
            <option value="">Todos os Vendedores</option>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <input type="text" placeholder="Bairro..." value={filterNeighborhood} onChange={(e) => setFilterNeighborhood(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
          <input type="text" placeholder="Endereço..." value={filterAddress} onChange={(e) => setFilterAddress(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input type="text" placeholder="Telefone..." value={filterPhone} onChange={(e) => setFilterPhone(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
          <input type="text" placeholder="CPF/Documento..." value={filterCPF} onChange={(e) => setFilterCPF(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />

          <div className="flex items-center gap-2 md:col-span-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">De</span>
              <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-600" />
            </div>
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Até</span>
              <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-[9px]">
                <th className="px-4 py-4">ID / Data</th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Contato / Doc</th>
                <th className="px-4 py-4">Localização</th>
                <th className="px-4 py-4">Vendedor</th>
                <th className="px-4 py-4 text-right">Total</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-center no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400 italic font-bold">
                    Nenhum pedido encontrado com estes filtros.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: Order) => {
                  const customer = customers.find((c: Customer) => c.id === order.customerId);
                  const seller = sellers.find((s: Seller) => s.id === order.sellerId);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setSelectedOrderId(order.id)}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="font-black text-blue-600">#{order.id}</p>
                        <p className="text-[10px] text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-4 font-black text-slate-900 uppercase">{customer?.name}</td>
                      <td className="px-4 py-4">
                        <p className="flex items-center gap-1.5"><Phone size={10} className="text-blue-500" /> {customer?.phone}</p>
                        <p className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold"><DocIcon size={10} /> {customer?.document}</p>
                      </td>
                      <td className="px-4 py-4 max-w-[200px]">
                        <p className="truncate"><PinIcon size={10} className="inline mr-1 text-slate-400" /> {customer?.address.neighborhood}</p>
                        <p className="truncate text-[10px] text-slate-400 font-bold">{customer?.address.street}, {customer?.address.number}</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                            {seller?.name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-700">{seller?.name || 'Vendedor RTC'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-slate-900">
                        R$ {(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full uppercase tracking-tighter border border-emerald-100">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          <button onClick={(e: React.MouseEvent) => openHistory(e, order)} className="p-2 text-slate-400 hover:text-blue-600 transition-all" title="Histórico PCP"><Activity size={16} /></button>
                          <ChevronRight className="text-slate-300 group-hover:text-blue-600" size={18} />
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

      {/* Modal de Histórico de Produção (Linha do Tempo) */}
      {showHistoryModal && historyOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Histórico de Produção PCP</h3>
                  <p className="text-xs text-slate-500">Contrato Nº {historyOrder.id}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-0 max-h-[70vh] overflow-y-auto">
              {historyOrder.productionHistory && historyOrder.productionHistory.length > 0 ? (
                <div className="space-y-0 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-100">
                  {historyOrder.productionHistory.map((entry: any, idx: number) => {
                    const nextEntry = historyOrder.productionHistory![idx + 1];
                    const duration = nextEntry
                      ? formatDuration(new Date(nextEntry.timestamp).getTime() - new Date(entry.timestamp).getTime())
                      : null;

                    return (
                      <div key={idx} className="relative pl-10 pb-8">
                        {/* Marcador Circular */}
                        <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-blue-600 z-10"></div>

                        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-blue-100 hover:bg-white transition-all">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{entry.stage}</h4>
                            <span className="text-[10px] font-black text-blue-500 bg-white px-2 py-0.5 rounded-full border border-blue-100">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Início: {new Date(entry.timestamp).toLocaleTimeString()}</p>

                          {duration && (
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                              <Clock size={12} /> Tempo decorrido: {duration}
                            </div>
                          )}
                          {!nextEntry && historyOrder.status !== OrderStatus.FINISHED && (
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">
                              <Clock size={12} /> Em andamento nesta etapa...
                            </div>
                          )}
                        </div>

                        {/* Seta de Transição */}
                        {nextEntry && (
                          <div className="absolute left-3.5 bottom-0 h-8 flex items-center justify-center -mb-4">
                            <ArrowDown size={14} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center opacity-40">
                  <Clock size={48} className="mx-auto mb-4 text-slate-200" />
                  <p className="font-medium italic text-slate-500">Nenhum histórico de produção registrado.</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors shadow-sm"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
