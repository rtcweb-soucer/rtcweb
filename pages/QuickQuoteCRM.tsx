
import * as React from 'react';
import { useState, useMemo } from 'react';
import { Product } from '../types';
import { fuzzyMatch } from '../utils/searchUtils';
import { calculateProductPrice } from '../utils/priceCalculator';
import ThreeDecimalInput from '../components/ThreeDecimalInput';
import {
  ShoppingCart,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  MessageCircle,
  Package,
  Info,
  Camera
} from 'lucide-react';

interface QuickQuoteCRMProps {
  products: Product[];
  storageKey?: string;
  onSave?: (total: number) => void;
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

const QuickQuoteCRM = ({ products, storageKey, onSave }: QuickQuoteCRMProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`rtc_qq_crm_${storageKey}`);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCopiedAlert, setShowCopiedAlert] = useState(false);

  // Persistência de estado
  React.useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`rtc_qq_crm_${storageKey}`, JSON.stringify(quoteItems));
    }
  }, [quoteItems, storageKey]);

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
    <div className="w-full space-y-4">
      {/* Alerta de Cópia */}
      {showCopiedAlert && (
        <div className="fixed top-20 right-8 z-[300] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-8 duration-300">
          <CheckCircle2 size={24} />
          <p className="font-bold">Texto copiado!</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {/* Header Compacto com Seleção */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <ShoppingCart size={16} className="text-blue-600" /> Itens do Orçamento
            </h3>
            <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
              {quoteItems.length} ITENS
            </span>
          </div>

          <div className="relative">
            <select 
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
              onChange={(e) => {
                const prod = products.find(p => p.id === e.target.value);
                if (prod) addProduct(prod);
                e.target.value = "";
              }}
              defaultValue=""
            >
              <option value="" disabled>➕ Adicionar Produto...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.nome} - R$ {p.valor}/{p.unidade}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Plus size={14} className="text-slate-400" />
            </div>
          </div>
        </div>

        {/* Lista de Itens (Tabela) */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {quoteItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-10 opacity-20">
              <ShoppingCart size={40} className="mb-2" />
              <p className="text-xs font-bold">Vazio</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">
                  <th className="pb-2 pl-2">Item</th>
                  <th className="pb-2 text-center">Medidas/Qtd</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {quoteItems.map((item, idx) => (
                  <tr key={item.id} className="bg-white border border-slate-100 shadow-sm rounded-xl overflow-hidden group">
                    <td className="py-2 pl-3 rounded-l-xl border-y border-l border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-[10px] truncate w-24 xl:w-32">{item.product.nome}</p>
                          <input
                            placeholder="Ambiente..."
                            value={item.environment}
                            onChange={(e) => updateItem(item.id, { environment: e.target.value })}
                            className="text-[8px] bg-transparent border-none p-0 focus:ring-0 text-slate-400 font-medium italic w-full"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 border-y border-slate-100 text-center">
                      {item.product.unidade === 'M2' ? (
                        <div className="flex items-center justify-center gap-1">
                          <ThreeDecimalInput
                            value={item.width}
                            onChange={(val) => updateItem(item.id, { width: val, overrideTotal: undefined })}
                            className="w-10 text-center text-[10px] font-bold bg-slate-50 rounded p-1 border border-slate-100 focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-slate-300 font-bold text-[9px]">×</span>
                          <ThreeDecimalInput
                            value={item.height}
                            onChange={(val) => updateItem(item.id, { height: val, overrideTotal: undefined })}
                            className="w-10 text-center text-[10px] font-bold bg-slate-50 rounded p-1 border border-slate-100 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      ) : (
                        <input
                          type="number" value={item.qty}
                          onChange={(e) => updateItem(item.id, { qty: parseInt(e.target.value) || 0, overrideTotal: undefined })}
                          className="w-10 text-center text-[10px] font-bold bg-slate-50 rounded p-1 border border-slate-100 focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                    </td>
                    <td className="py-2 border-y border-slate-100 text-right">
                      <div className="relative inline-block">
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          value={Number(calculateItemTotal(item).toFixed(2))}
                          onChange={(e) => updateItem(item.id, { overrideTotal: parseFloat(e.target.value) || 0 })}
                          className="w-16 pl-4 pr-1 py-1 bg-white border border-blue-200 rounded text-[10px] font-black text-blue-700 focus:ring-1 focus:ring-blue-500 outline-none text-right"
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-2 rounded-r-xl border-y border-r border-slate-100 text-right">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Compacto */}
        {quoteItems.length > 0 && (
          <div className="bg-slate-900 text-white p-4 rounded-t-[30px] shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <p className="text-[7px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">Total Estimado</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-medium text-blue-200">R$</span>
                  <span className="text-xl font-black tracking-tighter">
                    {totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    copyToWhatsapp();
                    if (onSave) onSave(totalQuote);
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[9px] transition-all shadow-xl shadow-emerald-500/20 active:scale-95 uppercase"
                >
                  <MessageCircle size={12} /> Copiar & Mover
                </button>
                {onSave && (
                  <button
                    onClick={() => onSave(totalQuote)}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-black text-[9px] transition-all shadow-xl shadow-blue-500/20 active:scale-95 uppercase"
                  >
                    <CheckCircle2 size={12} /> Confirmar
                  </button>
                )}
              </div>
            </div>

            <div 
              className="pt-3 border-t border-white/10 space-y-2 cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => {
                let text = `*ORÇAMENTO RÁPIDO - RTC DECOR*\n----------------------------------\n`;
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
                text += `----------------------------------\n*TOTAL ESTIMADO: R$ ${totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;
                text += `*FORMAS DE PAGAMENTO:*\n💳 Cartão de Crédito: Parcelamos em até 10x sem juros.\n📉 Parcela Mínima: R$ 300,00.\n\n`;
                if (maxInstallments > 1) {
                  text += `Como o valor total é de R$ ${totalQuote.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, o parcelamento máximo permitido pela regra da parcela mínima seria de *${maxInstallments}x de R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*.\n\n`;
                } else {
                  text += `Para este valor, o pagamento é à vista ou em 1x no cartão.\n\n`;
                }
                text += `_Valores sujeitos a confirmação técnica._`;
                e.dataTransfer.setData('text/plain', text);
              }}
            >
              <div className="bg-blue-600/20 p-2 px-3 rounded-xl border border-blue-500/20 flex justify-between items-center">
                <p className="text-[8px] font-black text-blue-300 uppercase">Parcelamento:</p>
                <p className="text-[10px] font-black">
                  {maxInstallments > 1
                    ? `${maxInstallments}x de R$ ${installmentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : 'À vista / 1x'}
                </p>
              </div>
              <p className="text-[8px] font-bold text-slate-500 uppercase text-center tracking-widest flex items-center justify-center gap-1">
                🖐️ Arraste para o chat
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Botão de Print (Compacto) */}
      {quoteItems.length > 0 && (
        <button
          onClick={() => setShowPrintModal(true)}
          className="w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
        >
          <Camera size={14} className="text-blue-500" /> Gerar Imagem para Print
        </button>
      )}

      {/* Modal de Print (Duplicado para ser independente) */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 flex justify-end">
              <button onClick={() => setShowPrintModal(false)} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-500 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div id="print-area-crm" className="px-10 pb-12 space-y-6 bg-white">
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
              </div>

              <div className="text-center space-y-2 pt-4">
                <p className="text-[8px] text-blue-600 font-black uppercase tracking-[0.3em] pt-2">RTC TOLDOS E COBERTURAS LTDA</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickQuoteCRM;
