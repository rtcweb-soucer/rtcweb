
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Product, SystemUser, QuickQuote as QuickQuoteType, TechnicalSheet, Order, OrderStatus, MeasurementItem } from '../types';
import { fuzzyMatch } from '../utils/searchUtils';
import { calculateProductPrice } from '../utils/priceCalculator';
import { dataService } from '../services/dataService';
import ThreeDecimalInput from '../components/ThreeDecimalInput';
import {
  Search,
  Zap,
  ShoppingCart,
  Trash2,
  Plus,
  Camera,
  X,
  CheckCircle2,
  MessageCircle,
  Package,
  Info,
  Save,
  History,
  ExternalLink,
  ChevronRight,
  Edit2,
  Calendar
} from 'lucide-react';

interface QuickQuoteProps {
  products: Product[];
  storageKey?: string;
  currentUser: SystemUser | null;
  onAddTechnicalSheet: (sheet: TechnicalSheet) => Promise<void>;
  onUpdateOrder: (order: Order) => Promise<void>;
}

interface QuoteItem {
  id: string;
  product: Product;
  qty: number;
  width: number;
  height: number;
  environment: string;
  overrideTotal?: number;
}

const QuickQuote = ({ products, storageKey, currentUser, onAddTechnicalSheet, onUpdateOrder }: QuickQuoteProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`rtc_qq_${storageKey}`);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCopiedAlert, setShowCopiedAlert] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<QuickQuoteType[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [installmentsOverride, setInstallmentsOverride] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentReference, setCurrentReference] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const quotes = await dataService.getQuickQuotes();
      setHistory(quotes);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      fuzzyMatch(p.nome, searchTerm) ||
      fuzzyMatch(p.tipo, searchTerm)
    );
  }, [products, searchTerm]);

  // Persistência de estado local
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`rtc_qq_${storageKey}`, JSON.stringify(quoteItems));
    }
  }, [quoteItems, storageKey]);

  // Carregar histórico
  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);


  const addProduct = (product: Product) => {
    const newItem: QuoteItem = {
      id: crypto.randomUUID(),
      product,
      qty: 1,
      width: 1,
      height: 1,
      environment: ''
    };
    setQuoteItems([...quoteItems, newItem]);
    setSearchTerm('');
  };

  const removeItem = (id: string) => {
    setQuoteItems(quoteItems.filter(i => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<QuoteItem>) => {
    setQuoteItems(quoteItems.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const calculateItemTotal = (item: QuoteItem) => {
    if (item.overrideTotal !== undefined) return item.overrideTotal;
    
    return calculateProductPrice(item.product, {
      width: item.width,
      height: item.height,
      qty: item.qty
    });
  };

  const totalQuote = quoteItems.reduce((acc, curr) => acc + calculateItemTotal(curr), 0);
  const defaultInstallments = Math.max(1, Math.min(10, Math.floor(totalQuote / 300)));
  const currentInstallments = installmentsOverride || defaultInstallments;
  const installmentValue = totalQuote / currentInstallments;

  const handleSave = async (silent = false) => {
    if (quoteItems.length === 0) return null;
    
    if (!silent) setIsSaving(true);
    try {
      const newQuote: Partial<QuickQuoteType> = {
        id: currentId || crypto.randomUUID(),
        customerName,
        customerPhone,
        sellerId: (currentUser as any)?.sellerId || (currentUser as any)?.seller_id || currentUser?.id,
        items: quoteItems,
        totalValue: totalQuote,
        installments: currentInstallments,
        createdAt: new Date()
      };

      const saved = await dataService.saveQuickQuote(newQuote as QuickQuoteType);
      
      // Atualizar estados locais com o que veio do banco
      setCurrentId(saved.id);
      setCurrentReference(saved.quickQuoteNumber || null);
      
      if (!silent) {
        alert(`Orçamento salvo com sucesso! Referência: ${saved.quickQuoteNumber}`);
      }
      
      loadHistory(); // Atualiza a lista lateral se estiver aberta
      return saved;
    } catch (err) {
      console.error("Erro ao salvar orçamento:", err);
      if (!silent) alert("Erro ao salvar orçamento. Verifique sua conexão.");
      return null;
    } finally {
      if (!silent) setIsSaving(false);
    }
  };


  const handleLoadFromHistory = (quote: QuickQuoteType) => {
    setCurrentId(quote.id);
    setQuoteItems(quote.items);
    setCustomerName(quote.customerName || '');
    setCustomerPhone(quote.customerPhone || '');
    setInstallmentsOverride(quote.installments);
    setCurrentReference(quote.quickQuoteNumber || null);
    setShowHistory(false);
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("Deseja realmente excluir este orçamento do histórico?")) return;
    
    try {
      await dataService.deleteQuickQuote(id);
      loadHistory();
    } catch (err) {
      console.error("Erro ao deletar orçamento:", err);
      alert("Erro ao excluir do histórico");
    }
  };

  const handleNewQuote = () => {
    if (quoteItems.length > 0 && !confirm("Deseja limpar o orçamento atual para começar um novo?")) return;
    
    setCurrentId(null);
    setCurrentReference(null);
    setQuoteItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setInstallmentsOverride(null);
  };

  const handleConvertToOfficial = async (quote: QuickQuoteType) => {
    if (!window.confirm("Deseja transformar este orçamento rápido em um orçamento oficial?")) return;
    
    try {
      // 1. Criar Ficha Técnica
      const sheetId = crypto.randomUUID();
      const technicalSheet: TechnicalSheet = {
        id: sheetId,
        customerId: '', // Precisará ser vinculado depois na tela de orçamentos
        sellerId: quote.sellerId || '',
        items: quote.items.map((it: any) => ({
          id: crypto.randomUUID(),
          environment: it.environment || 'Ambiente não definido',
          productId: it.product.id,
          productType: it.product.tipo,
          width: it.width,
          height: it.height,
          quantity: it.qty,
          notes: ''
        } as MeasurementItem)),
        createdAt: new Date()
      };

      await onAddTechnicalSheet(technicalSheet);

      // 2. Criar Orçamento (Order)
      const orderId = `ORC-${Math.floor(Date.now() / 1000)}`;
      const newOrder: Order = {
        id: orderId,
        customerId: '', // Vincular depois
        technicalSheetId: sheetId,
        sellerId: quote.sellerId || '',
        itemIds: technicalSheet.items.map(it => it.id),
        status: OrderStatus.QUOTE_SENT,
        totalValue: quote.totalValue,
        createdAt: new Date(),
        itemPrices: technicalSheet.items.reduce((acc: any, it: any, idx: number) => {
          const originalItem = quote.items[idx];
          acc[it.id] = calculateItemTotal(originalItem);
          return acc;
        }, {}),
        contractObservations: `Convertido de Orçamento Rápido ${quote.quickQuoteNumber}`
      };

      await onUpdateOrder(newOrder);
      alert("Orçamento oficial gerado! Vá para a aba 'Orçamentos' para vincular o cliente e finalizar.");
      setShowHistory(false);
    } catch (err) {
      alert("Erro ao converter orçamento");
    }
  };

  const copyToWhatsapp = async () => {
    let reference = currentReference;
    
    // Se não tem referência, salva primeiro (silenciosamente)
    if (!reference) {
      const saved = await handleSave(true);
      if (saved) {
        reference = saved.quickQuoteNumber || null;
      }
    }

    let text = `*ORÇAMENTO RÁPIDO - RTC DECOR*\n`;
    if (reference) {
      text += `*Referência: ${reference}*\n`;
    }
    text += `----------------------------------\n`;
    quoteItems.forEach((item, idx) => {
      const val = calculateItemTotal(item).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      text += `*${idx + 1}. ${item.product.nome}*\n`;
      if (item.environment) text += `📍 Ambiente: ${item.environment}\n`;
      if (item.product.unidade === 'M2') {
        text += `📏 Medidas: ${item.width.toFixed(2)}m x ${item.height.toFixed(2)}m\n`;
      } else {
        text += `📦 Qtd: ${item.qty} ${item.product.unidade}\n`;
      }
      text += `💰 Subtotal: R$ ${val}\n\n`;
    });
    text += `----------------------------------\n`;
    text += `*TOTAL ESTIMADO: R$ ${totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n\n`;

    text += `*FORMAS DE PAGAMENTO:*\n`;
    if (currentInstallments > 1) {
      text += `💳 Cartão de Crédito: Parcelamos em até *${currentInstallments}x sem juros*.\n`;
    } else {
      text += `💳 Cartão de Crédito: Pagamento à vista ou 1x no cartão.\n`;
    }
    text += `📉 Parcela Mínima: R$ 300,00.\n\n`;

    if (currentInstallments > 1) {
      text += `Como o valor total é de R$ ${totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, o parcelamento escolhido foi de *${currentInstallments}x de R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*.\n\n`;
    }

    text += `*VALIDADE:* Este orçamento é válido por *10 dias*.\n\n`;
    text += `_Valores sujeitos a confirmação técnica._`;

    navigator.clipboard.writeText(text);
    setShowCopiedAlert(true);
    setTimeout(() => setShowCopiedAlert(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Alerta de Cópia */}
      {showCopiedAlert && (
        <div className="fixed top-20 right-8 z-[300] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-8 duration-300">
          <CheckCircle2 size={24} />
          <p className="font-bold">Texto copiado para o WhatsApp!</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Zap className="text-amber-500" size={28} /> Orçamento Rápido
          </h2>
          <p className="text-sm text-slate-500 font-medium">Consulte preços e gere propostas expressas em segundos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleNewQuote}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 font-bold rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm text-sm"
          >
            <Plus size={18} /> Novo
          </button>
          
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 font-bold rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm relative text-sm"
          >
            <History size={18} /> Histórico
          </button>

          {quoteItems.length > 0 && (
            <>
              <button
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 shadow-sm transition-all text-sm"
              >
                <Camera size={16} className="text-blue-500" /> Print
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 text-sm"
              >
                <Save size={16} /> {isSaving ? '...' : 'Salvar'}
              </button>
              <button
                onClick={copyToWhatsapp}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all text-sm"
              >
                <MessageCircle size={18} /> WhatsApp
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lado Esquerdo: Busca e Cliente */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Dados do Cliente (Opcional)</label>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nome do Cliente"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <input
                  type="text"
                  placeholder="Telefone / WhatsApp"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pesquisar Produto</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Ex: Toldo, Cortina, Blackout..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                />
              </div>

              {/* Resultados da Busca */}
              <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-2xl transition-all group border border-transparent hover:border-blue-400"
                  >
                    <div className="text-left">
                      <p className="font-bold text-sm leading-tight">{product.nome}</p>
                      <p className="text-[10px] opacity-60 uppercase font-black">{product.tipo} • R$ {product.valor.toLocaleString('pt-BR')}/{product.unidade}</p>
                    </div>
                    <Plus size={18} className="text-blue-500 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
            <Info className="text-blue-500 shrink-0" size={20} />
            <p className="text-xs text-blue-800 leading-relaxed">
              Este orçamento é de **referência rápida**. Use o botão "Salvar" para manter um histórico ou convertê-lo em orçamento oficial no futuro.
            </p>
          </div>
        </div>

        {/* Lado Direito: Carrinho de Itens */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart size={20} className="text-blue-600" /> Itens do Orçamento
              </h3>
              {currentReference && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                  Ref: {currentReference}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {quoteItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 opacity-20">
                  <ShoppingCart size={48} className="mb-2" />
                  <p className="text-sm font-bold">Carrinho Vazio</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quoteItems.map((item, idx) => (
                    <div key={item.id} className="bg-slate-50/50 border border-slate-100 p-3 rounded-2xl hover:border-blue-200 transition-all group">
                      {/* Nome do Produto no Topo - Mais compacto */}
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1 py-0.5 rounded uppercase tracking-tighter">#{idx + 1}</span>
                        <h4 className="font-bold text-slate-500 text-[10px] uppercase tracking-wide">{item.product.nome}</h4>
                      </div>

                      {/* Linha de Controles e Campos - Altura Igualada */}
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        {/* Campo Ambiente - Flexível e Equilibrado */}
                        <div className="flex-1 min-w-0">
                          <input
                            placeholder="Ambiente (Ex: Sala...)"
                            value={item.environment}
                            onChange={(e) => updateItem(item.id, { environment: e.target.value })}
                            className="text-xs bg-white border border-slate-200 px-3 h-10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 font-bold w-full shadow-sm"
                          />
                        </div>

                        {/* Dimensões ou Qtd - Levemente aumentados */}
                        <div className="shrink-0">
                          {item.product.unidade === 'M2' ? (
                            <div className="flex items-center gap-2 bg-white px-2 h-10 rounded-xl border border-slate-200 shadow-sm">
                              <div className="flex flex-col items-center">
                                <span className="text-[7px] font-black text-slate-400 uppercase leading-none">Larg</span>
                                <ThreeDecimalInput
                                  value={item.width}
                                  onChange={(val) => updateItem(item.id, { width: val })}
                                  className="w-16 text-center text-xs font-bold bg-slate-50 rounded p-1 border-none focus:ring-1 focus:ring-blue-500 h-6"
                                />
                              </div>
                              <span className="text-slate-300 font-bold">×</span>
                              <div className="flex flex-col items-center">
                                <span className="text-[7px] font-black text-slate-400 uppercase leading-none">Alt</span>
                                <ThreeDecimalInput
                                  value={item.height}
                                  onChange={(val) => updateItem(item.id, { height: val })}
                                  className="w-16 text-center text-xs font-bold bg-slate-50 rounded p-1 border-none focus:ring-1 focus:ring-blue-500 h-6"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 bg-white px-3 h-10 rounded-xl border border-slate-200 shadow-sm">
                              <span className="text-[7px] font-black text-slate-400 uppercase">Qtd</span>
                              <input
                                type="number" 
                                value={item.qty}
                                onChange={(e) => updateItem(item.id, { qty: parseInt(e.target.value) || 0 })}
                                className="w-14 text-center text-xs font-bold bg-slate-50 rounded p-1 border-none focus:ring-1 focus:ring-blue-500 h-7"
                              />
                              <span className="text-[9px] font-bold text-slate-400 uppercase">{item.product.unidade}</span>
                            </div>
                          )}
                        </div>

                        {/* Valor Total do Item - Tamanho Fixo Moderado */}
                        <div className="shrink-0 w-44">
                          <div className="bg-blue-50/50 border border-blue-100 px-3 h-10 rounded-xl flex items-center justify-end gap-2 group/price relative">
                            {editingItemId === item.id ? (
                              <input
                                type="number"
                                autoFocus
                                className="w-full text-right text-sm font-black bg-white border-2 border-blue-400 rounded-lg px-2 h-8 outline-none text-blue-700 shadow-inner"
                                value={item.overrideTotal ?? calculateItemTotal(item)}
                                onChange={(e) => updateItem(item.id, { overrideTotal: parseFloat(e.target.value) || 0 })}
                                onBlur={() => setEditingItemId(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setEditingItemId(null)}
                              />
                            ) : (
                              <>
                                <span className="text-[7px] absolute left-2 top-1 font-black text-blue-400 uppercase">Total</span>
                                <span className="text-base font-black text-slate-900 tracking-tight">
                                  R$ {calculateItemTotal(item).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <button 
                                  onClick={() => setEditingItemId(item.id)}
                                  className="p-1 text-slate-300 hover:text-blue-500 transition-all"
                                >
                                  <Edit2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Botão Remover */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-slate-300 hover:text-white hover:bg-rose-500 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {quoteItems.length > 0 && (
              <div className="bg-slate-900 text-white p-8 rounded-t-[40px] shadow-2xl flex flex-col gap-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-0.5">Valor Total Estimado</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-medium text-blue-200">R$</span>
                      <span className="text-4xl font-black tracking-tighter">
                        {totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          if (window.confirm('Deseja iniciar um novo orçamento? Os itens atuais serão perdidos.')) {
                            setQuoteItems([]);
                            setSelectedCustomer(null);
                            setQuickQuoteId(null);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
                      >
                        <Plus size={14} /> Novo
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Save size={14} /> {isSaving ? '...' : 'Salvar'}
                      </button>
                      <button
                        onClick={copyToWhatsapp}
                        className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold flex items-center gap-2 mb-1">
                          <span>💳</span> Cartão de Crédito
                        </p>
                        <p className="text-[10px] text-slate-400 leading-none">Parcelamos em até 10x sem juros (Parc. Mínima R$ 300,00).</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Parcelas</span>
                        <input 
                          type="number"
                          min="1"
                          max="12"
                          value={currentInstallments}
                          onChange={(e) => setInstallmentsOverride(parseInt(e.target.value) || 1)}
                          className="w-12 bg-white/10 border-none rounded p-1 text-center font-black text-xs text-blue-300 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="bg-blue-600/20 p-4 rounded-2xl border border-blue-500/20">
                      <p className="text-[10px] font-black text-blue-300 uppercase mb-1">Parcelamento Calculado</p>
                      <p className="text-sm font-black">
                        {currentInstallments > 1
                          ? `${currentInstallments}x de R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : 'Pagamento à vista / 1x no cartão'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Histórico */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <History className="text-blue-600" /> Histórico de Orçamentos Rápidos
              </h3>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {history.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300">
                  <Package size={48} className="mb-2" />
                  <p className="font-bold">Nenhum orçamento salvo</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {history.map((quote) => (
                    <div key={quote.id} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl hover:border-blue-300 transition-all group relative">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full uppercase">{quote.quickQuoteNumber}</span>
                          <h4 className="font-bold text-slate-900 mt-1">{quote.customerName || 'Consumidor Final'}</h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar size={12} /> {new Date(quote.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-lg font-black text-slate-900">R$ {quote.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-slate-200">
                        <button
                          onClick={() => handleLoadFromHistory(quote)}
                          className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all"
                        >
                          Carregar
                        </button>
                        <button
                          onClick={() => handleConvertToOfficial(quote)}
                          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-1"
                        >
                          Oficial <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteHistory(quote.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Print (Simplificado no exemplo) */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 flex justify-end">
              <button onClick={() => setShowPrintModal(false)} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-500 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div id="print-area" className="px-10 pb-12 space-y-6 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <img src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg" alt="RTC" className="h-10 mb-4" />
                  <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Referência de Valores</h3>
                  {currentReference && <p className="text-xs font-bold text-blue-600">ORÇAMENTO: {currentReference}</p>}
                </div>
              </div>
              
              <div className="space-y-3">
                {quoteItems.map((item, idx) => (
                  <div key={item.id} className="flex justify-between py-2 border-b border-slate-100">
                    <div className="text-xs">
                      <p className="font-bold">{idx + 1}. {item.product.nome}</p>
                      <p className="text-slate-500 text-[10px]">{item.width} x {item.height} | {item.environment || 'Geral'}</p>
                    </div>
                    <p className="font-bold text-xs">R$ {calculateItemTotal(item).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-center">
                <p className="text-sm font-black uppercase">Total Estimado</p>
                <p className="text-xl font-black text-slate-900">R$ {totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sugestão de Pagamento</p>
                <p className="text-xs font-black">{currentInstallments}x de R$ {installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              <p className="text-[9px] text-slate-400 italic text-center">
                Válido por 10 dias. Valores sujeitos a confirmação após medição técnica.
              </p>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
              <button 
                onClick={() => {
                  const content = document.getElementById('print-area')?.innerHTML;
                  const win = window.open('', '_blank');
                  win?.document.write(`<html><head><script src="https://cdn.tailwindcss.com"></script></head><body class="p-10">${content}</body></html>`);
                  win?.document.close();
                  setTimeout(() => win?.print(), 500);
                }}
                className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold"
              >
                Imprimir Documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickQuote;
