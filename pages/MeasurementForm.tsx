
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Customer, TechnicalSheet, MeasurementItem, Product, ProductionInstallationSheet, ProductionSheetCortina, ProductionSheetToldo, ProductionSheetCobertura } from '../types';
import { Ruler, Sparkles, Plus, Search, Trash2, Save, FileText, Clock, MapPin, Phone, User, Building2, Package, CheckCircle2, CheckSquare, Square, Palette, Link as LinkIcon, CornerDownRight, X, Wrench } from 'lucide-react';
import { getProductionInsights } from '../services/geminiService';
import { dataService } from '../services/dataService';
import { fuzzyMatch } from '../utils/searchUtils';
import { QRCodeSVG } from 'qrcode.react';
import { CortinaForm, ToldoForm, CoberturaForm } from '../components/ProductionForms';

interface MeasurementFormProps {
  customers: Customer[];
  products: Product[];
  technicalSheets: TechnicalSheet[];
  initialCustomerId?: string;
  editingSheet?: TechnicalSheet;
  currentUser: any;
  onSave: (sheet: TechnicalSheet) => void;
  onGenerateQuote: (sheet: TechnicalSheet, selectedItemIds?: string[]) => void;
}

// Componente de Busca Customizado para Produtos
const SearchableProductSelect = ({ value, onChange, products }: { value: string, onChange: (val: string) => void, products: Product[] }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const selectedProduct = products.find(p => p.id === value);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = products.filter(p =>
    !searchTerm || fuzzyMatch(p.nome, searchTerm) || fuzzyMatch(p.tipo, searchTerm)
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearchTerm('');
        }}
        className="w-full px-1.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus-within:ring-1 focus-within:ring-blue-500 cursor-pointer min-h-[30px] flex items-center justify-between"
      >
        <span className={`font-black truncate ${selectedProduct ? 'text-blue-600' : 'text-slate-400'}`}>
          {selectedProduct ? selectedProduct.nome : 'Selecione...'}
        </span>
        <Search size={10} className="text-slate-400 flex-shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[250px]">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <input
              autoFocus
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1.5 text-[11px] bg-white border border-slate-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-slate-400 font-bold uppercase">Nenhum produto</div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    onChange(p.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] hover:bg-blue-50 transition-colors flex flex-col gap-0.5 ${p.id === value ? 'bg-blue-50/50 border-l-2 border-blue-500' : ''}`}
                >
                  <span className="font-black text-slate-800">{p.nome}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{p.tipo}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MeasurementForm = ({
  customers,
  products,
  technicalSheets,
  initialCustomerId,
  editingSheet,
  currentUser,
  onSave,
  onGenerateQuote
}: MeasurementFormProps) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || '');
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [historySelectedItems, setHistorySelectedItems] = useState<Record<string, Set<string>>>({});
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [editingProductionItemId, setEditingProductionItemId] = useState<string | null>(null);
  const [productionSheetData, setProductionSheetData] = useState<Partial<ProductionInstallationSheet>>({});
  const [showDriveUploadModal, setShowDriveUploadModal] = useState(false);
  const [currentSheetId, setCurrentSheetId] = useState<string | null>(editingSheet?.id || null);


  useEffect(() => {
    if (editingSheet) {
      setSelectedCustomerId(editingSheet.customerId);
      setItems([...editingSheet.items]);
      setSelectedItemIds(new Set(editingSheet.items.map((i: MeasurementItem) => i.id)));
      setCurrentSheetId(editingSheet.id);
    } else if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
      setCurrentSheetId(null);
    }
  }, [initialCustomerId, editingSheet]);

  // Ponte para receber o link do Google Drive do Apps Script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'DRIVE_LINK_UPLOADED') {
        setProductionSheetData(prev => ({ ...prev, videoLink: event.data.link }));
        setShowDriveUploadModal(false); // Fecha o modal automático
        alert("✅ Link do Google Drive recebido com sucesso!");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const openDriveUpload = () => {
    setShowDriveUploadModal(true);
  };

  const getGasUrl = () => {
    const customerName = customers.find(c => c.id === selectedCustomerId)?.name || '';
    const gasUrl = 'https://script.google.com/macros/s/AKfycbxK57Cc9WDZFYDUiWDe42zpf3aVTeloRxAW6lKzX9emfKbS7gDQM4VAinKPp-78IGCr/exec';
    return `${gasUrl}?clientName=${encodeURIComponent(customerName)}`;
  };

  const historicalSheets = technicalSheets
    .filter((s: TechnicalSheet) => s.customerId === selectedCustomerId && s.id !== editingSheet?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const selectedCustomer = customers.find((c: Customer) => c.id === selectedCustomerId);

  // Contagem total de itens selecionados (atuais + histórico)
  const totalSelectedCount = selectedItemIds.size + Object.values(historySelectedItems).reduce((acc, set) => acc + (set?.size || 0), 0);

  const addItem = () => {
    const newId = crypto.randomUUID();
    setItems([...items, {
      id: newId,
      environment: '',
      productId: '',
      color: '',
      width: 0,
      height: 0,
      productType: 'Toldo',
      notes: ''
    }]);
    // Novo item é selecionado por padrão
    setSelectedItemIds((prev: Set<string>) => {
      const next = new Set(prev);
      next.add(newId);
      return next;
    });
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i: MeasurementItem) => i.id !== id));
    setSelectedItemIds((prev: Set<string>) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map((item: MeasurementItem) => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'productId') {
          const product = products.find((p: Product) => p.id === value);
          if (product) {
            updated.productType = product.tipo;
            // Se deixar de ser acessório, remove o parentItemId
            if (!product.acessorio) {
              updated.parentItemId = undefined;
            }
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const handleAiInsights = async () => {
    if (items.length === 0) return;
    setLoadingAi(true);
    const insights = await getProductionInsights(items);
    setAiInsights(insights);
    setLoadingAi(false);
  };

  const validate = (checkItems = true) => {
    if (!selectedCustomerId) {
      alert("Por favor, selecione um cliente.");
      return false;
    }
    if (checkItems && items.length === 0 && totalSelectedCount === 0) {
      alert("Adicione ao menos um item de medição ou selecione itens do histórico.");
      return false;
    }

    if (items.some((item: MeasurementItem) => !item.productId || !item.environment)) {
      alert("Por favor, preencha o Ambiente e selecione o Produto para todos os itens novos.");
      return false;
    }
    return true;
  };

  const createSheetObject = (mergedItems?: MeasurementItem[]) => {
    return {
      id: currentSheetId || crypto.randomUUID(),
      customerId: selectedCustomerId,
      sellerId: currentUser?.sellerId || null,
      items: mergedItems || [...items],
      createdAt: editingSheet?.createdAt || new Date()
    } as TechnicalSheet;
  };

  const handleSave = () => {
    if (!validate(true)) return;
    const newSheet = createSheetObject();
    onSave(newSheet);

    // Keep the ID only if we want to continue editing, 
    // but the original code clears the form. 
    // To fix duplication between Save and Quote, we set the ID
    setCurrentSheetId(newSheet.id);

    setItems([]);
    setSelectedItemIds(new Set());
    setSelectedCustomerId('');
    setHistorySelectedItems({});
    setAiInsights(null);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSaveAndQuote = () => {
    if (!validate(true)) return;

    if (totalSelectedCount === 0) {
      alert("Por favor, selecione pelo menos um item para compor o orçamento.");
      return;
    }

    // Coleta itens atuais selecionados
    const currentSelected = items.filter(i => selectedItemIds.has(i.id));

    // Coleta itens históricos selecionados e os clona para o novo orçamento
    const historicalSelected: MeasurementItem[] = [];
    historicalSheets.forEach(sheet => {
      const selectedIds = historySelectedItems[sheet.id];
      if (selectedIds && selectedIds.size > 0) {
        sheet.items.forEach(item => {
          if (selectedIds.has(item.id)) {
            // Clonamos o item para que ele tenha um novo ID e não mude o histórico original
            historicalSelected.push({
              ...item,
              id: crypto.randomUUID(),
              parentItemId: undefined // Resetamos agrupamento ao importar, para evitar refs quebradas
            });
          }
        });
      }
    });

    const allItems = [...currentSelected, ...historicalSelected];
    const newSheet = createSheetObject(allItems);

    // Salvamos a "nova" ficha com todos os itens (atuais + importados)
    onSave(newSheet);

    // Geramos o orçamento com todos
    onGenerateQuote(newSheet); // Sem passar IDs específicos, ele pega todos da sheet enviada
  };

  const toggleHistoryItemSelection = (sheetId: string, itemId: string) => {
    setHistorySelectedItems(prev => {
      const next = { ...prev };
      if (!next[sheetId]) next[sheetId] = new Set();
      const sheetSet = new Set(next[sheetId]);
      if (sheetSet.has(itemId)) sheetSet.delete(itemId);
      else sheetSet.add(itemId);
      next[sheetId] = sheetSet;
      return next;
    });
  };

  const handleGenerateQuoteFromHistory = (sheet: TechnicalSheet) => {
    // Agora esse botão também pode usar a lógica unificada ou apenas desse sheet
    const selectedIds = historySelectedItems[sheet.id];
    if (!selectedIds || selectedIds.size === 0) {
      alert("Por favor, selecione pelo menos um item desta medição antiga para compor o orçamento.");
      return;
    }
    onGenerateQuote(sheet, Array.from(selectedIds));
  };

  const openProductionModal = async (itemId: string) => {
    setEditingProductionItemId(itemId);

    // Try to load existing production sheet
    try {
      const existing = await dataService.getProductionInstallationSheet(itemId);
      console.log('📥 Loaded production sheet data:', existing);

      if (existing) {
        setProductionSheetData(existing);
        console.log('✅ Set production sheet data to state');
      } else {
        setProductionSheetData({ measurementItemId: itemId });
        console.log('⚠️ No existing data, initializing empty sheet');
      }
    } catch (error) {
      console.error('❌ Error loading production sheet:', error);
      setProductionSheetData({ measurementItemId: itemId });
    }

    setShowProductionModal(true);
  };

  const closeProductionModal = () => {
    setShowProductionModal(false);
    setEditingProductionItemId(null);
    setProductionSheetData({});
  };

  const saveProductionSheet = async () => {
    if (!editingProductionItemId) return;

    try {
      // Get current item and product to determine type
      // Search in current items first
      let currentItem = items.find(i => i.id === editingProductionItemId);

      // If not found in current items, search in historical sheets
      if (!currentItem) {
        for (const sheet of historicalSheets) {
          currentItem = sheet.items.find((i: MeasurementItem) => i.id === editingProductionItemId);
          if (currentItem) break;
        }
      }

      const product = products.find(p => p.id === currentItem?.productId);
      const productType = product?.tipo as string;

      if (!productType) {
        alert('Erro: Tipo de produto não identificado');
        return;
      }

      const sheetToSave = {
        id: productionSheetData.id || crypto.randomUUID(),
        measurementItemId: editingProductionItemId,
        videoLink: productionSheetData.videoLink,
        observacoesGerais: productionSheetData.observacoesGerais,
        // Include specific data based on type
        cortina: productType === 'Cortina' ? productionSheetData.cortina : undefined,
        toldo: productType === 'Toldo' ? productionSheetData.toldo : undefined,
        cobertura: productType === 'Cobertura' ? productionSheetData.cobertura : undefined,
        createdAt: productionSheetData.createdAt || new Date(),
        updatedAt: new Date()
      };

      console.log('💾 Initiating saveProductionInstallationSheet with type:', productType);
      await dataService.saveProductionInstallationSheet(sheetToSave, productType);
      console.log('✅ Save call returned successfully');

      // Update local item with production sheet
      setItems(items.map(item =>
        item.id === editingProductionItemId
          ? { ...item, productionSheet: sheetToSave }
          : item
      ));

      console.log('✨ Setting success message and closing modal');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      closeProductionModal();
    } catch (error) {

      console.error('Error saving production sheet:', error);
      alert('Erro ao salvar ficha de produção: ' + (error as Error).message);
    }
  };


  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12 relative">
      {showSuccess && (
        <div className="fixed top-20 right-8 z-[200] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-right-8 duration-300">
          <CheckCircle2 size={24} />
          <div>
            <p className="font-bold">Ficha Técnica Salva!</p>
            <p className="text-xs opacity-90">Os dados foram vinculados ao cliente com sucesso.</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg">
              <Ruler size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{editingSheet ? 'Editando Ficha Técnica' : 'Lançamento de Medidas'}</h2>
              <p className="text-slate-500 text-xs">{editingSheet ? `ID: ${editingSheet.id}` : 'Crie fichas técnicas detalhadas.'}</p>
            </div>
          </div>
          {editingSheet && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-[10px] font-black uppercase tracking-widest">Modo Edição</span>
          )}
        </div>

        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Cliente *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                disabled={!!initialCustomerId}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed font-medium text-xs text-slate-900"
              >
                <option value="">Buscar cliente...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAiInsights}
                disabled={items.length === 0 || loadingAi}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-xs border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
              >
                {loadingAi ? <Clock className="animate-spin" size={14} /> : <Sparkles size={14} />}
                {loadingAi ? 'IA Analisando...' : 'IA: Analisar Medições'}
              </button>
            </div>
          </div>

          {selectedCustomer && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                  {selectedCustomer.type === 'CNPJ' ? <Building2 size={14} /> : <User size={14} />}
                  {selectedCustomer.name}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-600">
                  <MapPin size={12} className="text-blue-500" />
                  {selectedCustomer.address.street}, {selectedCustomer.address.number} - {selectedCustomer.address.neighborhood}
                </div>
              </div>
            </div>
          )}

          {selectedCustomer && historicalSheets.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                  <Clock size={14} />
                </div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico de Medições Realizadas</h4>
              </div>
              <div className="space-y-8">
                {historicalSheets.map(sheet => (
                  <div key={sheet.id} className="bg-slate-50/30 border border-slate-200 rounded-3xl p-6 transition-all shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                          <Clock size={20} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Medição Realizada em</p>
                          <h5 className="font-black text-slate-800 text-lg">
                            {new Date(sheet.createdAt).toLocaleDateString('pt-BR')} às {new Date(sheet.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </h5>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">ID da Ficha: {sheet.id}</p>
                        </div>
                      </div>

                      {/* Opcional: mantemos esse botão mas ele avisa sobre a global ou funciona apenas para esse sheet */}
                      <button
                        onClick={() => handleGenerateQuoteFromHistory(sheet)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] shadow-lg ${(historySelectedItems[sheet.id]?.size || 0) > 0 ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed uppercase tracking-widest'}`}
                      >
                        <FileText size={16} /> Ver apenas este ({historySelectedItems[sheet.id]?.size || 0})
                      </button>
                    </div>

                    <div className="space-y-2">
                      {sheet.items.map((item, index) => {
                        const product = products.find(p => p.id === item.productId);
                        const isGrouped = !!item.parentItemId;
                        const isSelected = historySelectedItems[sheet.id]?.has(item.id);

                        return (
                          <div
                            key={item.id}
                            className={`p-3 bg-white border rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-2 items-center transition-all 
                              ${isSelected ? 'border-emerald-300 bg-emerald-50/10' : 'border-slate-100 opacity-80'}
                              ${isGrouped ? 'md:ml-10 border-l-4 border-l-amber-200' : ''}`}
                          >
                            <div className="md:col-span-1 flex flex-col items-center gap-1 relative">
                              {isGrouped && (
                                <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-amber-300 hidden md:block">
                                  <CornerDownRight size={16} />
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => toggleHistoryItemSelection(sheet.id, item.id)}
                                  className={`p-1.5 rounded-md transition-colors ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                  title="Selecionar para orçamento"
                                >
                                  {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                </button>
                                <button
                                  onClick={() => openProductionModal(item.id)}
                                  className={`p-1.5 rounded-lg transition-colors shadow-sm ${item.productionSheet ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                  title="Ficha de Produção"
                                >
                                  <Wrench size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="md:col-span-2">
                              <p className="text-[8px] uppercase font-black text-slate-400 mb-0.5 tracking-tighter">Ambiente</p>
                              <p className="text-[11px] font-bold text-slate-700">{item.environment}</p>
                            </div>

                            <div className="md:col-span-3">
                              <p className="text-[8px] uppercase font-black text-slate-400 mb-0.5 tracking-tighter">Produto</p>
                              <p className="text-[11px] font-black text-blue-600">{product?.nome || 'Produto não encontrado'}</p>
                            </div>

                            <div className="md:col-span-2">
                              <p className="text-[8px] uppercase font-black text-slate-400 mb-0.5 tracking-tighter">Cor</p>
                              <p className="text-[11px] font-bold text-slate-500">{item.color || '-'}</p>
                            </div>

                            <div className="md:col-span-2">
                              <p className="text-[8px] uppercase font-black text-slate-400 mb-0.5 tracking-tighter text-center">Medidas</p>
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-[11px] font-mono font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-md">{item.width.toFixed(3)}m</span>
                                <span className="text-slate-300 text-[10px] font-black">×</span>
                                <span className="text-[11px] font-mono font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-md">{item.height.toFixed(3)}m</span>
                              </div>
                            </div>

                            <div className="md:col-span-2 flex justify-end">
                              {isGrouped && (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-black uppercase">Agrupado</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              Itens da Ficha Técnica (Novos)
              <span className="bg-slate-100 text-slate-500 text-[9px] px-1.5 py-0.5 rounded-full">{items.length}</span>
            </h3>
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-100"
            >
              <Plus size={14} /> Adicionar Ambiente
            </button>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="py-10 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center gap-2 opacity-50">
                <Ruler size={24} className="text-slate-300" />
                <p className="text-xs font-medium text-slate-400">Adicione um ambiente para começar ou selecione do histórico</p>
              </div>
            ) : (
              items.map((item, index) => {
                const product = products.find(p => p.id === item.productId);
                const isAccessory = product?.acessorio;
                const isGrouped = !!item.parentItemId;

                return (
                  <div
                    key={item.id}
                    className={`p-3 bg-white border rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-2 items-end hover:shadow-md transition-all 
                      ${selectedItemIds.has(item.id) ? 'border-blue-300 bg-blue-50/10' : 'border-slate-200 opacity-95'}
                      ${isGrouped ? 'md:ml-10 border-l-4 border-l-amber-300' : ''}`}
                  >
                    <div className="md:col-span-1 flex flex-col items-center gap-1 relative">
                      {isGrouped && (
                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-amber-500 hidden md:block">
                          <CornerDownRight size={16} />
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleItemSelection(item.id)}
                          className={`p-1.5 rounded-lg transition-colors shadow-sm ${selectedItemIds.has(item.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                          title="Selecionar para orçamento"
                        >
                          {selectedItemIds.has(item.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                        <button
                          onClick={() => openProductionModal(item.id)}
                          className={`p-1.5 rounded-lg transition-colors shadow-sm ${item.productionSheet ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                          title="Ficha de Produção"
                        >
                          <Wrench size={14} />
                        </button>
                      </div>
                      <span className="text-[8px] font-black text-slate-400 uppercase">#{index + 1}</span>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[8px] uppercase font-black text-slate-400 mb-1 tracking-tighter">Ambiente *</label>
                      <input
                        placeholder="Ex: Sala..."
                        value={item.environment}
                        onChange={(e) => updateItem(item.id, 'environment', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500 outline-none font-bold text-slate-700"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[8px] uppercase font-black text-slate-400 mb-1 tracking-tighter">Produto *</label>
                      <SearchableProductSelect
                        value={item.productId}
                        onChange={(val) => updateItem(item.id, 'productId', val)}
                        products={products}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[8px] uppercase font-black text-slate-400 mb-1 tracking-tighter">Cor</label>
                      <input
                        placeholder="Cor"
                        value={item.color || ''}
                        onChange={(e) => updateItem(item.id, 'color', e.target.value)}
                        className="w-full px-1.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500 outline-none font-medium"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[8px] uppercase font-black text-slate-400 mb-1 tracking-tighter text-center">Largura</label>
                      <input
                        type="number" step="0.001"
                        placeholder="0,000"
                        value={item.width || ''}
                        onChange={(e) => updateItem(item.id, 'width', parseFloat(e.target.value) || 0)}
                        className="w-full px-1 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500 outline-none text-right font-mono font-bold"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[8px] uppercase font-black text-slate-400 mb-1 tracking-tighter text-center">Altura</label>
                      <input
                        type="number" step="0.001"
                        placeholder="0,000"
                        value={item.height || ''}
                        onChange={(e) => updateItem(item.id, 'height', parseFloat(e.target.value) || 0)}
                        className="w-full px-1 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500 outline-none text-right font-mono font-bold"
                      />
                    </div>

                    <div className="md:col-span-2">
                      {isAccessory ? (
                        <div className="animate-in fade-in duration-200">
                          <label className="block text-[8px] uppercase font-black text-amber-500 mb-1 tracking-tighter">Agrupar ao #</label>
                          <select
                            value={item.parentItemId || ''}
                            onChange={(e) => updateItem(item.id, 'parentItemId', e.target.value)}
                            className="w-full px-1.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 focus:ring-1 focus:ring-amber-500 outline-none"
                          >
                            <option value="">Não agrupar</option>
                            {items.map((it, idx) => {
                              if (it.id === item.id) return null;
                              return (
                                <option key={it.id} value={it.id}>
                                  #{idx + 1} ({it.environment || 'Item'})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : (
                        <div className="h-8 border-l border-slate-100 ml-4 opacity-5 flex items-center justify-center">
                          <LinkIcon size={14} className="text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-1 flex justify-end">
                      <button onClick={() => removeItem(item.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-[0.98]"
          >
            <Save size={18} /> {editingSheet ? 'Atualizar Ficha' : 'Salvar Ficha'}
          </button>
          <button
            onClick={handleSaveAndQuote}
            className={`flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg ${totalSelectedCount > 0 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-slate-400 cursor-not-allowed'}`}
          >
            <FileText size={18} /> Gerar Orçamento ({totalSelectedCount})
          </button>
        </div>
      </div>

      {/* Production/Installation Sheet Modal */}
      {showProductionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Wrench size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Ficha de Produção e Instalação</h3>
                  <p className="text-xs text-blue-100 font-medium">Especificações técnicas do item</p>
                </div>
              </div>
              <button
                onClick={closeProductionModal}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Detect product type */}
              {(() => {
                // Search in current items first
                let currentItem = items.find(i => i.id === editingProductionItemId);

                // If not found in current items, search in historical sheets
                if (!currentItem) {
                  for (const sheet of historicalSheets) {
                    currentItem = sheet.items.find((i: MeasurementItem) => i.id === editingProductionItemId);
                    if (currentItem) break;
                  }
                }

                const product = products.find(p => p.id === currentItem?.productId);
                const productType = product?.tipo;

                // Debug logging
                console.log('🔍 Product Type Detection:', {
                  editingProductionItemId,
                  currentItem,
                  productId: currentItem?.productId,
                  product,
                  productType
                });


                return (
                  <>
                    {/* General Fields (always visible) */}
                    {/* Link do Vídeo */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-black text-slate-700 uppercase tracking-wide">
                          Link da Pasta / Vídeo
                          <span className="text-slate-400 font-normal ml-2 text-xs">(Drive, Fotos, etc.)</span>
                        </label>
                        <button
                          onClick={openDriveUpload}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-200"
                        >
                          <Wrench size={12} /> Gravar / Subir Mídia (Google Drive)
                        </button>
                      </div>
                      <input
                        type="url"
                        value={productionSheetData.videoLink || ''}
                        onChange={(e) => setProductionSheetData({ ...productionSheetData, videoLink: e.target.value })}
                        placeholder="Cole o link do vídeo aqui..."
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      />
                      {productionSheetData.videoLink && (
                        <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                          <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-shrink-0">
                              <div className="bg-white p-3 rounded-xl border-2 border-blue-300 shadow-sm">
                                <QRCodeSVG value={productionSheetData.videoLink} size={120} />
                              </div>
                              <p className="text-xs text-center text-blue-600 font-bold mt-2">Escaneie o QR Code</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-black text-blue-700 uppercase tracking-wide mb-2">Link do Vídeo:</p>
                              <a
                                href={productionSheetData.videoLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 underline font-medium break-all"
                              >
                                {productionSheetData.videoLink}
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Observações Gerais */}
                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wide">
                        Observações Gerais
                        <span className="text-slate-400 font-normal ml-2 text-xs">(Opcional)</span>
                      </label>
                      <textarea
                        value={productionSheetData.observacoesGerais || ''}
                        onChange={(e) => setProductionSheetData({ ...productionSheetData, observacoesGerais: e.target.value })}
                        placeholder="Detalhes gerais sobre produção ou instalação..."
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"
                      />
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-slate-200 my-4"></div>

                    {/* Product-Specific Forms */}
                    {productType === 'Cortina' && (
                      <CortinaForm
                        data={(productionSheetData.cortina || {}) as Partial<ProductionSheetCortina>}
                        onChange={(data: Partial<ProductionSheetCortina>) => setProductionSheetData({ ...productionSheetData, cortina: data })}
                      />
                    )}

                    {productType === 'Toldo' && (
                      <ToldoForm
                        data={(productionSheetData.toldo || {}) as Partial<ProductionSheetToldo>}
                        onChange={(data: Partial<ProductionSheetToldo>) => setProductionSheetData({ ...productionSheetData, toldo: data })}
                      />
                    )}

                    {productType === 'Cobertura' && (
                      <CoberturaForm
                        data={(productionSheetData.cobertura || {}) as Partial<ProductionSheetCobertura>}
                        onChange={(data: Partial<ProductionSheetCobertura>) => setProductionSheetData({ ...productionSheetData, cobertura: data })}
                      />
                    )}

                    {!productType && (
                      <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                        <p className="text-sm text-yellow-700 font-medium">
                          ⚠️ Tipo de produto não identificado. Por favor, selecione um produto para o item.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={closeProductionModal}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={saveProductionSheet}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
              >
                Salvar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Upload do Google Drive (Melhor para Mobile) */}
      {showDriveUploadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[400] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-400" />
                <h4 className="font-bold text-sm">Captura de Mídia (Google Drive)</h4>
              </div>
              <button
                onClick={() => setShowDriveUploadModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-slate-50">
              <iframe
                src={getGasUrl()}
                className="w-full h-full border-none"
                title="Google Drive Upload"
              />
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default MeasurementForm;
