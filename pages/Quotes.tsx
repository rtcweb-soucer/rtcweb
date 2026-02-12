import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/dataService';
import { Order, Customer, TechnicalSheet, Product, OrderStatus, Installment, MeasurementItem, ProductionStage, Seller } from '../types';
import { addBusinessDays } from '../utils/dateUtils';
import {
  FileText,
  Search,
  Printer,
  Mail,
  ChevronRight,
  User,
  Calendar,
  Layers,
  ArrowLeft,
  Briefcase,
  Monitor,
  Info,
  CheckCircle2,
  DollarSign,
  CreditCard,
  X
} from 'lucide-react';

const PAYMENT_METHODS = [
  'PIX',
  'Dinheiro',
  'Cartão de Crédito',
  'Débito',
  'Boleto',
  'TED/DOC',
  'Empenho'
];

interface QuotesProps {
  orders: Order[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  products: Product[];
  sellers: Seller[];
  onUpdateOrder: (order: Order) => void;
  initialSelectedId?: string;
  onClearSelection?: () => void;
  onNavigateToOrders?: () => void;
}

const Quotes = ({ orders, customers, technicalSheets, products, sellers, onUpdateOrder, initialSelectedId, onClearSelection, onNavigateToOrders }: QuotesProps) => {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [finalValue, setFinalValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentConditions, setPaymentConditions] = useState('');
  const [numInstallments, setNumInstallments] = useState(1);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [filterSellerId, setFilterSellerId] = useState('');
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [isSaving, setIsSaving] = useState(false);
  const [deliveryDays, setDeliveryDays] = useState(25);

  const printRef = useRef<HTMLDivElement>(null);

  const activeQuoteId = selectedQuoteId || initialSelectedId;

  const filteredOrders = orders.filter((order: Order) => {
    const isQuote = activeTab === 'open'
      ? order.status === OrderStatus.QUOTE_SENT
      : (order.status !== OrderStatus.QUOTE_SENT && order.status !== OrderStatus.PENDING_MEASUREMENT);

    if (!isQuote) return false;
    const customer = customers.find((c: Customer) => c.id === order.customerId);
    const matchesSearch = customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) || order.id.includes(searchTerm);
    const matchesSeller = filterSellerId ? order.sellerId === filterSellerId : true;
    return matchesSearch && matchesSeller;
  });

  const selectedOrder = orders.find((o: Order) => o.id === activeQuoteId);
  const selectedCustomer = selectedOrder ? customers.find((c: Customer) => c.id === selectedOrder.customerId) : null;
  const originalSheet = selectedOrder ? technicalSheets.find((s: TechnicalSheet) => s.id === selectedOrder.technicalSheetId) : null;

  const getOrderItems = () => {
    if (!originalSheet) return [];
    if (!selectedOrder?.itemIds) return originalSheet.items;
    return originalSheet.items.filter((item: MeasurementItem) => selectedOrder.itemIds?.includes(item.id));
  };

  const orderItems = getOrderItems();

  // Sincroniza os valores comerciais quando o orçamento selecionado muda
  // ou quando o valor total da proposta é alterado (enquanto o modal está fechado)
  useEffect(() => {
    if (selectedOrder && !showOrderModal) {
      setFinalValue(selectedOrder.totalValue);
      setPaymentMethod(selectedOrder.paymentMethod || '');
      setPaymentConditions(selectedOrder.paymentConditions || '');
      setDeliveryDays(selectedOrder.deliveryDays || 25);
    }
  }, [selectedOrder?.id, selectedOrder?.totalValue, selectedOrder?.deliveryDays, showOrderModal]);

  // Gera parcelas automaticamente quando o valor ou quantidade de parcelas muda
  useEffect(() => {
    if (showOrderModal) {
      let remainingValue = finalValue - downPayment;
      if (remainingValue < 0) remainingValue = 0;

      const numRemaining = downPayment > 0 ? numInstallments - 1 : numInstallments;
      const perInstallment = numRemaining > 0 ? parseFloat((remainingValue / numRemaining).toFixed(2)) : 0;

      const newInstallments: Installment[] = [];
      let accumulated = 0;

      // 1. Entrada (se houver)
      if (downPayment > 0) {
        newInstallments.push({
          id: crypto.randomUUID(),
          number: 1,
          value: downPayment,
          dueDate: new Date().toISOString().split('T')[0],
          status: 'PENDING',
          paymentMethod: paymentMethod // Fallback para o método geral
        });
      }

      // 2. Demais parcelas
      for (let i = 1; i <= numRemaining; i++) {
        const dueDate = new Date();
        const monthOffset = downPayment > 0 ? i : i - 1;
        dueDate.setMonth(dueDate.getMonth() + monthOffset);

        const value = i === numRemaining
          ? parseFloat((remainingValue - accumulated).toFixed(2))
          : perInstallment;

        accumulated += value;

        newInstallments.push({
          id: crypto.randomUUID(),
          number: downPayment > 0 ? i + 1 : i,
          value: value,
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'PENDING',
          paymentMethod: paymentMethod
        });
      }
      setInstallments(newInstallments);
    }
  }, [finalValue, numInstallments, downPayment, showOrderModal, paymentMethod]);

  const handleBack = () => {
    setSelectedQuoteId(null);
    onClearSelection?.();
  };

  const updateInstallment = (index: number, field: keyof Installment, value: any) => {
    const updated = [...installments];
    updated[index] = { ...updated[index], [field]: value };
    setInstallments(updated);

    // Se mudou o valor individual de uma parcela, atualiza o total final para manter consistência
    if (field === 'value') {
      const newTotal = updated.reduce((acc: number, curr: Installment) => acc + (parseFloat(curr.value.toString()) || 0), 0);
      setFinalValue(parseFloat(newTotal.toFixed(2)));
    }
  };

  const handleTransformToOrder = async () => {
    if (!selectedOrder || isSaving) return;
    setIsSaving(true);

    try {
      const updatedOrder: Order = {
        ...selectedOrder,
        status: OrderStatus.CONTRACT_SIGNED,
        totalValue: finalValue,
        paymentMethod: paymentMethod,
        paymentConditions: paymentConditions,
        installments: installments,
        deliveryDays: deliveryDays,
        deliveryDeadline: addBusinessDays(new Date(), deliveryDays).toISOString(),
        createdAt: new Date()
      };

      // 3. Save Order (Commercial data)
      await dataService.saveOrder(updatedOrder);

      // 4. Initialize Production Tracking
      await dataService.initializeProduction(
        updatedOrder.id,
        ProductionStage.NEW_ORDER,
        [{ stage: ProductionStage.NEW_ORDER, timestamp: new Date() }]
      );

      // 5. Update UI and Navigate
      onUpdateOrder(updatedOrder);
      setShowOrderModal(false);
      setSelectedQuoteId(null);
      onNavigateToOrders?.();
    } catch (err: any) {
      console.error("Erro ao confirmar pedido:", err);
      alert("Erro ao confirmar pedido: " + (err.message || "Erro desconhecido. Verifique se as colunas necessárias foram criadas no banco de dados."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePrint = (autoPrint: boolean = true) => {
    if (!printRef.current || !selectedOrder) return;

    const printWindow = window.open('', '_blank', 'width=1024,height=800');
    if (!printWindow) {
      alert("Por favor, habilite pop-ups para visualizar o documento.");
      return;
    }

    const content = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <title>RTC DECOR - Proposta ${selectedOrder.id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
              @page {
                size: A4;
                margin: 0;
              }
            }
            body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; padding: 20px; display: flex; justify-content: center; }
            .a4-page { background: white; width: 210mm; min-height: 297mm; padding: 12mm; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.1); box-sizing: border-box; position: relative; }
            @media print { body { background: white; padding: 0; } .a4-page { width: 100%; height: 100%; margin: 0; padding: 12mm; box-shadow: none; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            section, tr, .footer-content, .spec-item { page-break-inside: avoid; }
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

  // Componente de Input de Moeda com Estado Local para evitar travamentos
  const CurrencyInput = ({
    value,
    onChange,
    className = "",
    prefix = "R$",
    prefixColor = "text-slate-400"
  }: {
    value: number,
    onChange: (val: number) => void,
    className?: string,
    prefix?: string,
    prefixColor?: string
  }) => {
    const [localValue, setLocalValue] = useState(value.toFixed(2));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (!isFocused) {
        setLocalValue(value.toFixed(2));
      }
    }, [value, isFocused]);

    const handleBlur = () => {
      setIsFocused(false);
      const numericValue = parseFloat(localValue.replace(',', '.'));
      if (!isNaN(numericValue)) {
        onChange(numericValue);
      } else {
        setLocalValue(value.toFixed(2));
      }
    };

    return (
      <div className={`relative flex items-center gap-1 ${className}`}>
        {prefix && <span className={`text-[10px] font-bold ${prefixColor}`}>{prefix}</span>}
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          className="w-20 text-right bg-transparent border-none p-0 font-black text-slate-900 focus:ring-0 outline-none no-print appearance-none"
        />
      </div>
    );
  };

  const calculateItemPrice = (item: MeasurementItem) => {
    // 1. Se houver um preço explícito definido para este item, use-o
    if (selectedOrder?.itemPrices && selectedOrder.itemPrices[item.id] !== undefined) {
      return selectedOrder.itemPrices[item.id];
    }

    // 2. Caso contrário, calcule o preço base do produto
    const product = products.find((p: Product) => p.id === item.productId);
    if (!product) return 0;

    const area = (item.width * item.height) || 1;
    const baseValue = product.unidade === 'M2' ? product.valor * area : product.valor;

    // 3. Se o total da proposta foi ajustado globalmente (desconto/acréscimo) 
    // e ainda não temos preços por item definidos, aplique a proporção
    const originalTotal = orderItems.reduce((acc: number, it: MeasurementItem) => {
      const p = products.find((prod: Product) => prod.id === it.productId);
      if (!p) return acc;
      const a = (it.width * it.height) || 1;
      return acc + (p.unidade === 'M2' ? p.valor * a : p.valor);
    }, 0);

    if (selectedOrder && selectedOrder.totalValue !== originalTotal && originalTotal > 0) {
      // Se já existem itemPrices, mas este item específico não está lá, 
      // não aplicamos o ratio para evitar cálculos circulares ou saltos inesperados.
      // Nesse caso, o usuário provavelmente quer definir todos manualmente.
      if (selectedOrder.itemPrices && Object.keys(selectedOrder.itemPrices).length > 0) {
        return baseValue;
      }

      const ratio = selectedOrder.totalValue / originalTotal;
      return baseValue * ratio;
    }

    return baseValue;
  };

  const updateItemPrice = async (itemId: string, newPrice: number) => {
    if (!selectedOrder) return;

    // Inicializa todos os preços se for a primeira vez que editamos itens individualmente
    // para garantir que os outros itens não "resetem" para o valor original sem desconto
    let newItemPrices = { ...(selectedOrder.itemPrices || {}) };
    if (Object.keys(newItemPrices).length === 0) {
      orderItems.forEach((item: MeasurementItem) => {
        newItemPrices[item.id] = calculateItemPrice(item);
      });
    }

    newItemPrices[itemId] = newPrice;
    const newTotal = Object.values(newItemPrices).reduce((acc, curr) => acc + curr, 0);

    const updatedOrder: Order = {
      ...selectedOrder,
      itemPrices: newItemPrices,
      totalValue: newTotal
    };

    await dataService.saveOrder(updatedOrder);
    onUpdateOrder(updatedOrder);
  };

  const updateDeliveryDays = async (days: number) => {
    if (!selectedOrder || isNaN(days)) return;

    const updatedOrder: Order = {
      ...selectedOrder,
      deliveryDays: days
    };

    try {
      await dataService.saveOrder(updatedOrder);
      onUpdateOrder(updatedOrder);
    } catch (error) {
      console.error("Erro ao salvar prazo:", error);
    }
  };

  const uniqueSpecs = (() => {
    if (orderItems.length === 0) return [];
    const uniqueIds = Array.from(new Set(orderItems.map((i: MeasurementItem) => i.productId)));
    return uniqueIds
      .map(id => products.find((p: Product) => p.id === id))
      .filter((p: Product | undefined) => p && p.detalhamento_tecnico);
  })();

  if (activeQuoteId && selectedOrder && selectedCustomer) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 mb-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 no-print">
          <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors">
            <ArrowLeft size={20} /> Voltar para Lista
          </button>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowOrderModal(true)} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
              <CheckCircle2 size={18} /> Transformar em Pedido
            </button>
            <button onClick={() => handleGeneratePrint(false)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
              <Monitor size={18} /> Visualizar HTML
            </button>
            <button onClick={() => handleGeneratePrint(true)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              <Printer size={18} /> Imprimir / PDF
            </button>
          </div>
        </div>

        <div ref={printRef} className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 print:shadow-none print:border-none print:m-0 print:rounded-none">
          <div className="p-6 bg-slate-50 border-b-2 border-slate-100 flex justify-between items-start gap-8">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-slate-200">
                <img src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg" alt="RTC Logo" className="logo-img object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>Proposta Comercial</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase">Nº {selectedOrder.id}</span>
                  <span className="text-slate-400 font-medium text-[9px]">Data: {new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="text-right space-y-0">
              <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Contratada</p>
              <p className="text-xs font-black text-slate-900">RTC TOLDOS E DECORAÇÕES</p>
              <p className="text-[9px] text-slate-500 font-medium">CNPJ: 12.655.737/0001-21</p>
              <p className="text-[9px] text-slate-500 font-medium">(21) 2281-8224 | (21) 99798-6419</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
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

            <section>
              <h2 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><Layers size={10} className="text-blue-500" /> Itens e Especificações</h2>
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
                        <td className="px-4 py-1.5 text-xs text-right font-black text-slate-900">
                          <div className="flex justify-end no-print">
                            <CurrencyInput
                              value={calculateItemPrice(item)}
                              onChange={(val) => updateItemPrice(item.id, val)}
                              className="border-b border-transparent hover:border-slate-200 transition-all focus-within:border-blue-400"
                            />
                          </div>
                          <span className="hidden print:block font-black">R$ {(calculateItemPrice(item) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-600 text-white">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-[9px] font-black text-right uppercase tracking-widest">Valor Total da Proposta</td>
                      <td className="px-4 py-2 text-lg font-black text-right">R$ {(selectedOrder.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {uniqueSpecs.length > 0 && (
              <section className="animate-in fade-in duration-500">
                <h2 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><Info size={10} className="text-blue-500" /> Especificações</h2>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uniqueSpecs.map((p) => (
                    <div key={p?.id} className="spec-item">
                      <p className="text-[8px] font-black text-blue-600 uppercase mb-1">{p?.nome}</p>
                      <p className="text-[9px] text-slate-600 leading-tight italic">{p?.detalhamento_tecnico}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-8 pt-2">
              <div className="space-y-4">
                <section>
                  <h3 className="text-[8px] font-black text-blue-600 uppercase mb-2">Observações Gerais</h3>
                  <div className="p-4 bg-slate-50 rounded-xl border-l-3 border-blue-600 text-[9px] text-slate-600 leading-relaxed italic">
                    Garantia RTC Decor de 01 ano contra defeitos de fabricação. Prazo de instalação: {deliveryDays} Dias Úteis. Proposta válida por 07 dias.
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Garantia</p>
                    <p className="text-md font-black text-slate-900">12 Meses</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100 group/prazo relative">
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Prazo</p>
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        value={deliveryDays}
                        onChange={(e) => setDeliveryDays(parseInt(e.target.value) || 0)}
                        onBlur={() => updateDeliveryDays(deliveryDays)}
                        className="w-12 text-md font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-md font-black text-slate-900 truncate">Dias Úteis</span>
                    </div>
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

        {showOrderModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 no-print">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900">Fechar Contrato de Venda</h3>
                <button onClick={() => setShowOrderModal(false)} className="p-2 text-slate-400 hover:text-rose-500">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6 max-h-[85vh] overflow-y-auto">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Valor Original da Proposta</p>
                  <p className="text-2xl font-black text-slate-900">R$ {(selectedOrder.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Valor Final</label>
                      <CurrencyInput
                        value={finalValue}
                        onChange={(val) => setFinalValue(val)}
                        prefixColor="text-blue-400"
                        className="w-full px-3 py-2.5 bg-blue-50/30 border border-blue-100 rounded-xl text-md font-black text-blue-600 focus-within:ring-2 focus-within:ring-blue-500 transition-all cursor-text"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Entrada</label>
                      <CurrencyInput
                        value={downPayment}
                        onChange={(val) => setDownPayment(val)}
                        prefixColor="text-emerald-400"
                        className="w-full px-3 py-2.5 bg-emerald-50/30 border border-emerald-100 rounded-xl text-md font-black text-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500 transition-all cursor-text"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Qtd. Parcelas</label>
                      <select
                        value={numInstallments}
                        onChange={(e) => setNumInstallments(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-md font-bold text-slate-700 outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 10, 12].map(n => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Grade de Parcelas Editável */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grade de Parcelamento (Editável)</h4>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 font-black text-slate-500 uppercase">Parc.</th>
                            <th className="px-4 py-2 font-black text-slate-500 uppercase">Vencimento</th>
                            <th className="px-4 py-2 font-black text-slate-500 uppercase">Forma de Pagto</th>
                            <th className="px-4 py-2 font-black text-slate-500 uppercase text-right">Valor (R$)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {installments.map((inst, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 font-bold text-slate-400">
                                {String(inst.number).padStart(2, '0')}/{String(installments.length).padStart(2, '0')}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1 group">
                                  <Calendar size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                  <input
                                    type="date"
                                    value={inst.dueDate}
                                    onChange={(e) => updateInstallment(idx, 'dueDate', e.target.value)}
                                    className="bg-transparent border-none font-bold text-slate-700 p-0 focus:ring-0 w-full outline-none text-[11px]"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={inst.paymentMethod || ''}
                                  onChange={(e) => updateInstallment(idx, 'paymentMethod', e.target.value)}
                                  className="bg-transparent border-none font-medium text-slate-600 p-0 focus:ring-0 w-full outline-none text-[11px]"
                                >
                                  <option value="">Selecione...</option>
                                  {PAYMENT_METHODS.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <CurrencyInput
                                  value={inst.value}
                                  onChange={(val) => updateInstallment(idx, 'value', val)}
                                  prefixColor="text-blue-400"
                                  className="justify-end bg-blue-50/50 p-1.5 rounded-lg border border-transparent focus-within:border-blue-300 transition-all"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Prazo de Entrega (dias úteis)</label>
                    <input
                      type="number"
                      value={deliveryDays}
                      onChange={(e) => setDeliveryDays(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Forma de Pagamento</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Selecione a forma de pagamento...</option>
                        {PAYMENT_METHODS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Observações/Condições</label>
                    <textarea
                      placeholder="Informações adicionais sobre o pagamento..."
                      rows={2}
                      value={paymentConditions}
                      onChange={(e) => setPaymentConditions(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowOrderModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50" disabled={isSaving}>Cancelar</button>
                  <button
                    onClick={handleTransformToOrder}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : 'Confirmar Pedido'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
        }
      </div >
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">Gestão de Orçamentos</h2>
          <p className="text-slate-500 font-medium">Controle de propostas e conversão em pedidos.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
          <button
            onClick={() => setActiveTab('open')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'open' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Abertos
          </button>
          <button
            onClick={() => setActiveTab('closed')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'closed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Fechados
          </button>
        </div>
      </div>
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por cliente ou Nº..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <select
          value={filterSellerId}
          onChange={(e) => setFilterSellerId(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700"
        >
          <option value="">Todos os Vendedores</option>
          {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-[9px]">
                <th className="px-6 py-4">ID / Data</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Vendedor</th>
                <th className="px-6 py-4 text-right">Valor Total</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 italic font-bold">
                    <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                    Nenhuma proposta pendente.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: Order) => {
                  const customer = customers.find((c: Customer) => c.id === order.customerId);
                  const seller = sellers.find((s: Seller) => s.id === order.sellerId);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedQuoteId(order.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-black text-blue-600 uppercase text-[10px]">Nº {order.id}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <h3 className="font-black text-slate-900 uppercase">{customer?.name}</h3>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                            {seller?.name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-700">{seller?.name || 'Vendedor RTC'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-black text-slate-900">R$ {(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <ChevronRight className="text-slate-300 group-hover:text-blue-600 transition-colors" size={20} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic px-4">
              <FileText size={40} className="mx-auto text-slate-200 mb-3" />
              Nenhuma proposta encontrada.
            </div>
          ) : (
            filteredOrders.map((order: Order) => {
              const customer = customers.find((c: Customer) => c.id === order.customerId);
              const seller = sellers.find((s: Seller) => s.id === order.sellerId);
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedQuoteId(order.id)}
                  className="p-4 active:bg-slate-50 transition-colors flex justify-between items-center group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">Nº {order.id}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-black text-slate-900 uppercase text-sm truncate">{customer?.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-4 w-4 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[8px] font-black">
                        {seller?.name.charAt(0)}
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">{seller?.name || 'Vendedor RTC'}</span>
                    </div>
                  </div>
                  <div className="text-right pl-4">
                    <p className="text-sm font-black text-slate-900">R$ {(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <ChevronRight size={16} className="text-slate-300 ml-auto mt-1" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Quotes;
