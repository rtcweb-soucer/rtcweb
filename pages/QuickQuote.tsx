
import * as React from 'react';
import { useState, useMemo } from 'react';
import { Product } from '../types';
import { normalizeString, fuzzyMatch } from '../utils/searchUtils';
import {
  Search,
  Zap,
  ShoppingCart,
  Trash2,
  Plus,
  Copy,
  Camera,
  X,
  CheckCircle2,
  MessageCircle,
  Package,
  ArrowRight,
  Info
} from 'lucide-react';

interface QuickQuoteProps {
  products: Product[];
}

interface QuoteItem {
  id: string;
  product: Product;
  qty: number;
  width: number;
  height: number;
  environment: string;
}

const QuickQuote = ({ products }: QuickQuoteProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCopiedAlert, setShowCopiedAlert] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      fuzzyMatch(p.nome, searchTerm) ||
      fuzzyMatch(p.tipo, searchTerm)
    );
  }, [products, searchTerm]);

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

  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    setQuoteItems(quoteItems.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const calculateItemTotal = (item: QuoteItem) => {
    if (item.product.unidade === 'M2') {
      return item.product.valor * item.width * item.height * item.qty;
    }
    return item.product.valor * item.qty;
  };

  const totalQuote = quoteItems.reduce((acc, curr) => acc + calculateItemTotal(curr), 0);
  const maxInstallments = Math.max(1, Math.min(10, Math.floor(totalQuote / 300)));
  const installmentValue = totalQuote / maxInstallments;

  const copyToWhatsapp = () => {
    let text = `*ORÇAMENTO RÁPIDO - RTC DECOR*\n`;
    text += `----------------------------------\n`;
    quoteItems.forEach((item, idx) => {
      const val = calculateItemTotal(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
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
    text += `*TOTAL ESTIMADO: R$ ${totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;

    text += `*FORMAS DE PAGAMENTO:*\n`;
    text += `💳 Cartão de Crédito: Parcelamos em até 10x sem juros.\n`;
    text += `📉 Parcela Mínima: R$ 300,00.\n\n`;

    if (maxInstallments > 1) {
      text += `Como o valor total é de R$ ${totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, o parcelamento máximo permitido pela regra da parcela mínima seria de *${maxInstallments}x de R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*.\n\n`;
    } else {
      text += `Para este valor, o pagamento é à vista ou em 1x no cartão.\n\n`;
    }

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
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="text-amber-500" /> Orçamento Rápido
          </h2>
          <p className="text-slate-500">Consulte preços e gere propostas expressas em segundos.</p>
        </div>
        {quoteItems.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setQuoteItems([])}
              className="px-4 py-2 text-slate-400 hover:text-rose-500 font-bold text-sm transition-colors"
            >
              Limpar Tudo
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 shadow-sm transition-all text-sm"
            >
              <Camera size={18} className="text-blue-500" /> Print para Foto
            </button>
            <button
              onClick={copyToWhatsapp}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all text-sm"
            >
              <MessageCircle size={18} /> Enviar p/ WhatsApp
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lado Esquerdo: Busca e Seleção */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
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
            <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
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
              {searchTerm && filteredProducts.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400 italic">Nenhum produto encontrado.</p>
              )}
              {!searchTerm && (
                <div className="py-10 text-center opacity-30">
                  <Package size={40} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-medium">Digite para buscar no catálogo</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
            <Info className="text-blue-500 shrink-0" size={20} />
            <p className="text-xs text-blue-800 leading-relaxed">
              Este orçamento é de **referência rápida**. Para formalizar a venda, utilize a aba **"Medições"** para gerar a ficha técnica e proposta completa.
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
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {quoteItems.length} ITENS
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {quoteItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 opacity-20">
                  <ShoppingCart size={64} className="mb-4" />
                  <p className="text-lg font-bold">Carrinho Vazio</p>
                  <p className="text-sm">Adicione produtos da busca ao lado.</p>
                </div>
              ) : (
                quoteItems.map((item, idx) => (
                  <div key={item.id} className="bg-slate-50/50 border border-slate-100 p-5 rounded-3xl hover:border-blue-200 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">#{idx + 1}</span>
                          <h4 className="font-black text-slate-900 truncate">{item.product.nome}</h4>
                        </div>
                        <input
                          placeholder="Identificar Ambiente (Ex: Sala, Varanda...)"
                          value={item.environment}
                          onChange={(e) => updateItem(item.id, 'environment', e.target.value)}
                          className="text-xs bg-transparent border-none p-0 focus:ring-0 text-slate-500 font-medium italic w-full"
                        />
                      </div>

                      <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                        {item.product.unidade === 'M2' ? (
                          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <div className="space-y-0.5">
                              <span className="text-[8px] font-black text-slate-400 uppercase px-1">Larg</span>
                              <input
                                type="number" step="0.01" value={item.width}
                                onChange={(e) => updateItem(item.id, 'width', parseFloat(e.target.value) || 0)}
                                className="w-16 text-center text-xs font-bold bg-slate-50 rounded p-1 border-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <span className="text-slate-300 font-bold">×</span>
                            <div className="space-y-0.5">
                              <span className="text-[8px] font-black text-slate-400 uppercase px-1">Alt</span>
                              <input
                                type="number" step="0.01" value={item.height}
                                onChange={(e) => updateItem(item.id, 'height', parseFloat(e.target.value) || 0)}
                                className="w-16 text-center text-xs font-bold bg-slate-50 rounded p-1 border-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <span className="text-[8px] font-black text-slate-400 uppercase px-1">Qtd</span>
                            <input
                              type="number" value={item.qty}
                              onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                              className="w-16 text-center text-xs font-bold bg-slate-50 rounded p-1 border-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        <div className="text-right min-w-[100px]">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Subtotal</p>
                          <p className="text-sm font-black text-slate-900">R$ {calculateItemTotal(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {quoteItems.length > 0 && (
              <div className="p-8 bg-slate-900 text-white rounded-t-[40px] shadow-2xl flex flex-col gap-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-1">Valor Total Estimado</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-medium text-blue-200">R$</span>
                      <span className="text-4xl font-black tracking-tighter">
                        {totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <button
                      onClick={copyToWhatsapp}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                    >
                      <MessageCircle size={20} /> Copiar p/ WhatsApp
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-3">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div> Formas de Pagamento
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-xs font-bold flex items-center gap-2 mb-1">
                        <span>💳</span> Cartão de Crédito
                      </p>
                      <p className="text-[10px] text-slate-400 leading-none">Parcelamos em até 10x sem juros (Parc. Mínima R$ 300,00).</p>
                    </div>
                    <div className="bg-blue-600/20 p-4 rounded-2xl border border-blue-500/20">
                      <p className="text-[10px] font-black text-blue-300 uppercase mb-1">Sugestão de Parcelamento</p>
                      <p className="text-sm font-black">
                        {maxInstallments > 1
                          ? `${maxInstallments}x de R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : 'Pagamento à vista / 1x no cartão'}
                      </p>
                    </div>
                  </div>
                  <p className="text-[9px] text-center text-slate-500 font-bold uppercase tracking-widest pt-2">Atenção: Valores nominais sujeitos a variação por instalação e impostos.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Pré-visualização para Print */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-300">
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
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Data/Hora</p>
                  <p className="text-xs font-bold text-slate-900">{new Date().toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-3">
                {quoteItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50">
                    <div>
                      <p className="text-sm font-bold text-slate-900 uppercase leading-none mb-1">{item.product.nome}</p>
                      <p className="text-[9px] text-slate-500 font-medium">
                        {item.environment && `📍 ${item.environment} • `}
                        {item.product.unidade === 'M2' ? `${item.width.toFixed(2)}x${item.height.toFixed(2)}m` : `${item.qty} unid.`}
                      </p>
                    </div>
                    <p className="text-sm font-black text-slate-900">R$ {calculateItemTotal(item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="bg-blue-600 p-6 rounded-3xl text-white flex justify-between items-center shadow-lg shadow-blue-500/20">
                  <span className="text-xs font-black uppercase tracking-widest">Total Estimado</span>
                  <span className="text-2xl font-black">R$ {totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 italic">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Pagamento Parcelado</p>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-700 font-bold flex items-center gap-2">💳 Parcelas de até 10x sem juros</p>
                    <p className="text-xs text-slate-700 font-bold flex items-center gap-2">📉 Parcela mínima de R$ 300,00</p>
                    <p className="text-xs text-blue-600 font-black mt-2 bg-blue-50 p-2 rounded-lg not-italic">
                      🚀 Sugestão: {maxInstallments > 1
                        ? `${maxInstallments}x de R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : 'À vista / 1x no cartão'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-2 pt-4">
                <p className="text-[9px] text-slate-400 font-bold leading-relaxed px-4">
                  * Este documento é apenas uma prévia informativa para conferência rápida. Valores sujeitos a medição e impostos.
                </p>
                <p className="text-[8px] text-blue-600 font-black uppercase tracking-[0.3em] pt-2">RTC TOLDOS E DECORAÇÕES</p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col items-center gap-3">
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <Camera size={14} /> Tire um print desta tela para enviar a imagem
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickQuote;
