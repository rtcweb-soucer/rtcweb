
import * as React from 'react';
import { useState, useEffect } from 'react';
import { RawMaterial, RawMaterialMovement, SystemUser, RawMaterialMapping, AccountCategory } from '../types';
import { dataService } from '../services/dataService';
import { 
  Plus, 
  Search, 
  FileUp, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History, 
  Package, 
  AlertTriangle,
  X,
  ChevronRight,
  Database,
  Filter,
  Link as LinkIcon,
  CheckCircle2,
  Calendar,
  Truck,
  FileText,
  CloudDownload,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { nfEmailService } from '../services/nfEmailService';

interface RawMaterialStockProps {
  currentUser: SystemUser;
}

const RawMaterialStock = ({ currentUser }: RawMaterialStockProps) => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [mappings, setMappings] = useState<RawMaterialMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHistoryListModal, setShowHistoryListModal] = useState(false);
  const [showCloudNfeModal, setShowCloudNfeModal] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [receivedInvoices, setReceivedInvoices] = useState<any[]>([]);
  const [lastApiError, setLastApiError] = useState<string | null>(null);
  const [filterStartDate, setFilterStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyMovements, setHistoryMovements] = useState<RawMaterialMovement[]>([]);
  
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
  const [currentCloudKey, setCurrentCloudKey] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState<Partial<RawMaterial>>({
    name: '',
    unit: 'm',
    min_stock: 0,
    category: 'Componente'
  });
  
  // Financeiro no XML
  const [xmlInstallments, setXmlInstallments] = useState<any[]>([]);
  const [generateFinancial, setGenerateFinancial] = useState(true);
  const [expenseCategories, setExpenseCategories] = useState<AccountCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  
  const [movement, setMovement] = useState({
    type: 'IN' as 'IN' | 'OUT',
    quantity: 0,
    notes: ''
  });

  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlData, setXmlData] = useState<any[]>([]);
  const [xmlSupplier, setXmlSupplier] = useState('');
  const [xmlInvoice, setXmlInvoice] = useState('');

  const categories = ['Todas', 'Alumínio', 'Tecido', 'Componente', 'Acessório', 'Outros'];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [mats, maps, movs] = await Promise.all([
        dataService.getRawMaterials(),
        dataService.getRawMaterialMappings(),
        dataService.getRawMaterialMovements()
      ]);
      setMaterials(mats);
      setMappings(maps);
      
      const cats = await dataService.getAccountCategories();
      const expenseCats = cats.filter(c => c.type === 'EXPENSE');
      setExpenseCategories(expenseCats);
      
      // Tentar encontrar categoria "Matéria Prima" ou "Custos Variáveis"
      const defaultCat = expenseCats.find(c => c.name.toLowerCase().includes('matéria prima')) || 
                        expenseCats.find(c => c.code === '2.0.0') || 
                        expenseCats[0];
      if (defaultCat) setSelectedCategoryId(defaultCat.id);
      
      const keys = new Set<string>();

      movs.forEach((m: any) => {
          if (m.nfe_key) keys.add(m.nfe_key);
      });
      setImportedKeys(keys);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      const data = await dataService.getRawMaterials();
      setMaterials(data);
    } catch (error) {
      console.error("Erro ao carregar matérias-primas:", error);
    }
  };

  const handleSaveMaterial = async () => {
    if (!newMaterial.name) return;
    try {
      const saved = await dataService.saveRawMaterial({
        ...newMaterial,
        id: newMaterial.id || crypto.randomUUID()
      } as RawMaterial);
      
      setShowAddModal(false);
      setNewMaterial({ name: '', unit: 'm', min_stock: 0, category: 'Componente' });
      
      const quickIdx = (window as any)._quickRegisterIndex;
      if (quickIdx !== undefined && quickIdx !== null) {
        const updatedXml = [...xmlData];
        if (updatedXml[quickIdx]) {
          updatedXml[quickIdx].mappedMaterialId = saved.id;
          setXmlData(updatedXml);
        }
        (window as any)._quickRegisterIndex = null;
      }

      loadInitialData();
    } catch (error) {
      alert("Erro ao salvar material");
    }
  };

  const handleSaveMovement = async () => {
    if (!selectedMaterial || movement.quantity <= 0) return;
    try {
      await dataService.saveRawMaterialMovement({
        id: crypto.randomUUID(),
        raw_material_id: selectedMaterial.id,
        type: movement.type,
        quantity: movement.quantity,
        source: 'MANUAL',
        notes: movement.notes,
        user_id: currentUser.id
      });
      setShowMovementModal(false);
      setMovement({ type: 'IN', quantity: 0, notes: '' });
      loadInitialData();
    } catch (error) {
      alert("Erro ao salvar movimentação");
    }
  };

  const handleViewHistory = async (m: RawMaterial) => {
    setSelectedMaterial(m);
    try {
      const movs = await dataService.getRawMaterialMovements(m.id);
      setHistoryMovements(movs);
      setShowHistoryListModal(true);
    } catch (err) {
      alert("Erro ao carregar histórico");
    }
  };

  const handleUpdateItemMapping = (index: number, materialId: string) => {
    const updatedData = [...xmlData];
    updatedData[index].mappedMaterialId = materialId;
    setXmlData(updatedData);
  };

  const processXmlContent = (xmlText: string): boolean => {
    try {
      if (!xmlText || xmlText.length < 100) {
        console.error("Conteúdo XML inválido ou muito curto:", xmlText);
        alert("O conteúdo do XML recebido parece inválido ou está vazio.");
        return false;
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      
      const parseError = xmlDoc.getElementsByTagName("parsererror");
      if (parseError.length > 0) {
        console.error("Erro ao analisar XML:", parseError[0].textContent);
        alert("Erro técnico ao processar o formato do arquivo.");
        return false;
      }

      // Função auxiliar para buscar tags ignorando namespace
      const getTags = (parent: Element | Document, name: string) => {
          return Array.from(parent.querySelectorAll('*')).filter(el => 
              el.localName === name || el.tagName === name || el.tagName.endsWith(':' + name)
          );
      };

      const getVal = (parent: any, name: string) => {
          return getTags(parent, name)[0]?.textContent || '';
      };

      const supplierName = getVal(xmlDoc, "xNome");
      const invoiceNum = getVal(xmlDoc, "nNF");
      
      setXmlSupplier(supplierName);
      setXmlInvoice(invoiceNum);

      const products = getTags(xmlDoc, "det");
      const items = [];
      
      console.log(`📦 Processando XML: Encontrados ${products.length} itens correspondentes.`);

      for (const det of products) {
          const prod = getTags(det, "prod")[0];
          if (!prod) continue;

          const name = getVal(prod, "xProd");
          const qty = getVal(prod, "qCom");
          const unit = getVal(prod, "uCom");
          const code = getVal(prod, "cProd");
          
          const mappingMatch = mappings.find(m => m.xml_product_name === name);
          const nameMatch = materials.find(m => m.name.toLowerCase() === name.toLowerCase());
          
          items.push({ 
              name, 
              qty: Number(qty), 
              unit, 
              code,
              mappedMaterialId: mappingMatch?.raw_material_id || nameMatch?.id || ''
          });
      }

      if (items.length === 0) {
          console.warn("Nenhum item 'det'/'prod' encontrado. XML Bruto (100 chars):", xmlText.substring(0, 100));
          const firstTag = xmlDoc.documentElement?.tagName || 'Desconhecida';
          alert(`Não foi possível encontrar produtos nesta nota (Tag Raiz: ${firstTag}). Verifique se é uma NF-e de mercadoria válida.\n\nInício do conteúdo: ${xmlText.substring(0, 50)}...`);
          return false;
      }

      setXmlData(items);

      // --- Novo: Processar Cobrança e Duplicatas ---
      const installments: any[] = [];
      const dups = getTags(xmlDoc, "dup");
      
      for (const dup of dups) {
          const nDup = getVal(dup, "nDup");
          const dVenc = getVal(dup, "dVenc");
          const vDup = getVal(dup, "vDup");
          
          installments.push({
              id: crypto.randomUUID(),
              number: nDup,
              date: dVenc,
              amount: Number(vDup)
          });
      }

      setXmlInstallments(installments);
      setGenerateFinancial(installments.length > 0);
      // ---------------------------------------------

      setShowXmlModal(true);
      return true;

    } catch (err) {
      console.error("Erro no processXmlContent:", err);
      alert("Falha crítica ao processar os dados do XML.");
      return false;
    }
  };

  const handleFetchCloudInvoices = async (useDates: boolean = false) => {
    setLoadingInvoices(true);
    setReceivedInvoices([]);
    try {
      setLastApiError(null);
      const response = await nfEmailService.listReceivedNFe(
        30, 
        useDates ? filterStartDate : undefined, 
        useDates ? filterEndDate : undefined
      );
      const list = nfEmailService.parseNFeReceivedList(response);
      setReceivedInvoices(list);
      
      if (list.length === 0) {
          setLastApiError("Nenhuma nota encontrada para este período ou critério.");
      }
    } catch (error: any) {
      setLastApiError(error.message || "Erro desconhecido na API.");
      alert("Erro ao buscar notas na nuvem. Verifique sua conexão ou configurações da API.");
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleImportInvoiceFromCloud = async (key: string) => {
    setLoadingInvoices(true);
    try {
      // 1. Tenta manifestar (Ciência) - Ignora se já manifestada
      try {
        await nfEmailService.manifestNFe(key, 'Ciencia');
      } catch (e) {
        console.warn("Manifestação já realizada ou falhou:", e);
      }

      // 2. Busca o conteúdo do XML via endpoint direto da API recebida
      const xmlText = await nfEmailService.getReceivedXML(key);
      
      // 3. Prepara os dados para o modal de XML existente
      setCurrentCloudKey(key);
      const success = processXmlContent(xmlText);
      
      // 4. Se processou com sucesso, fecha o modal da nuvem
      if (success) {
        setShowCloudNfeModal(false);
      }
    } catch (error: any) {
      alert("Erro ao importar dados da nota: " + error.message);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleImportXmlItems = async () => {
    let processed = 0;
    try {
      for (const item of xmlData) {
        if (!item.mappedMaterialId) continue;
        
        const existingMapping = mappings.find(m => m.xml_product_name === item.name);
        if (!existingMapping) {
          await dataService.saveRawMaterialMapping({
            id: crypto.randomUUID(),
            xml_product_name: item.name,
            raw_material_id: item.mappedMaterialId
          });
        }

        await dataService.saveRawMaterialMovement({
          id: crypto.randomUUID(),
          raw_material_id: item.mappedMaterialId,
          type: 'IN',
          quantity: item.qty,
          source: 'XML',
          supplier_name: xmlSupplier,
          invoice_number: xmlInvoice,
          nfe_key: currentCloudKey || undefined,
          notes: currentCloudKey 
            ? `Importado via Nuvem NFe #${xmlInvoice}` 
            : `Importado via XML NFe #${xmlInvoice}`,
          user_id: currentUser.id
        });
        processed++;
      }
      // --- Novo: Gerar Contas a Pagar ---
      if (generateFinancial && xmlInstallments.length > 0) {
        for (const inst of xmlInstallments) {
          await dataService.saveFinancialTransaction({
            id: crypto.randomUUID(),
            description: `Compra Matéria Prima - NF ${xmlInvoice} - ${xmlSupplier}`,
            amount: inst.amount,
            type: 'EXPENSE',
            status: 'PENDING',
            due_date: inst.date,
            category_id: selectedCategoryId || null,
            notes: `Gerado via importação de XML da Matéria Prima. NF ${xmlInvoice}, Fornecedor: ${xmlSupplier}`,
          } as any);
        }
      }
      // ----------------------------------

      alert(`${processed} itens de estoque atualizados com sucesso!${generateFinancial ? ' Financeiro gerado.' : ''}`);
      setShowXmlModal(false);
      setXmlFile(null);
      setXmlData([]);
      setXmlInstallments([]);
      setCurrentCloudKey(null);
      loadInitialData();
    } catch (err: any) {
      console.error("Erro na importação:", err);
      alert("Erro durante a importação: " + (err.message || "Erro desconhecido"));
    }
  };


  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Database className="text-indigo-600" /> Controle de Estoque de Materiais
          </h2>
          <p className="text-slate-500 text-sm">Gerencie insumos e rastreie fornecedores e notas fiscais.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { setShowCloudNfeModal(true); handleFetchCloudInvoices(); }}
            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 font-bold rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
          >
            <CloudDownload size={18} /> Consultar Notas (Nuvem)
          </button>
          <button 
            onClick={() => setShowXmlModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            <FileUp size={18} /> Arquivo XML
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={18} /> Novo Material
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome do material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Lista de Materiais */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-white rounded-3xl border border-slate-200 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-20">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="p-4 pl-6 text-left">Material</th>
                <th className="p-4">Categoria</th>
                <th className="p-4 text-center">Saldo Atual</th>
                <th className="p-4">Última Compra</th>
                <th className="p-4">Fornecedor</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 pr-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.map(m => (
                <tr key={m.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${m.current_stock !== undefined && m.current_stock <= m.min_stock ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}>
                        <Package size={18} />
                      </div>
                      <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{m.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {m.category}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className={`text-lg font-black ${m.current_stock !== undefined && m.current_stock <= m.min_stock ? 'text-rose-600' : 'text-slate-800'}`}>
                      {m.current_stock || 0}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{m.unit}</div>
                  </td>
                  <td className="p-4">
                    {m.last_purchase_date ? (
                      <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(m.last_purchase_date).toLocaleDateString('pt-BR')}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs italic">Sem registros</span>
                    )}
                  </td>
                  <td className="p-4">
                    {m.last_supplier ? (
                      <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                        <Truck size={14} className="text-slate-400" />
                        <span className="truncate max-w-[150px]">{m.last_supplier}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs italic">-</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${m.current_stock !== undefined && m.current_stock <= m.min_stock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {m.current_stock !== undefined && m.current_stock <= m.min_stock ? 'ESTOQUE BAIXO' : 'NORMAL'}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex justify-end gap-2">
                       <button onClick={() => handleViewHistory(m)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl" title="Ver Histórico"><History size={18} /></button>
                       <button 
                         onClick={() => { setSelectedMaterial(m); setMovement({ type: 'IN', quantity: 0, notes: '' }); setShowMovementModal(true); }}
                         className="px-3 py-1 bg-indigo-50 text-indigo-600 font-black rounded-lg hover:bg-indigo-100 text-[10px] uppercase shadow-sm"
                       >
                         Movimentar
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Adicionar Material */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800">Novo Material</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase block mb-1">Nome do Material</label>
                <input 
                  type="text"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  placeholder="Ex: Alumínio Branco 6mt"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase block mb-1">Unidade</label>
                  <select 
                    value={newMaterial.unit}
                    onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="m">METROS (m)</option>
                    <option value="un">UNIDADE (un)</option>
                    <option value="kg">QUILOS (kg)</option>
                    <option value="rl">ROLO (rl)</option>
                    <option value="cx">CAIXA (cx)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase block mb-1">Stock Mínimo</label>
                  <input 
                    type="number"
                    value={newMaterial.min_stock}
                    onChange={(e) => setNewMaterial({...newMaterial, min_stock: Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase block mb-1">Categoria</label>
                <select 
                  value={newMaterial.category}
                  onChange={(e) => setNewMaterial({...newMaterial, category: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                   {categories.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-6 py-2 text-slate-500 font-bold">Cancelar</button>
              <button onClick={handleSaveMaterial} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100">Criar Material</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Movimentação */}
      {showMovementModal && selectedMaterial && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800">Movimentar</h3>
                <p className="text-xs font-bold text-slate-400">{selectedMaterial.name}</p>
              </div>
              <button onClick={() => setShowMovementModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button 
                  onClick={() => setMovement({...movement, type: 'IN'})}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-black transition-all ${movement.type === 'IN' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <ArrowUpCircle size={18} /> ENTRADA
                </button>
                <button 
                  onClick={() => setMovement({...movement, type: 'OUT'})}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-black transition-all ${movement.type === 'OUT' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <ArrowDownCircle size={18} /> SAÍDA
                </button>
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase block mb-1">Quantidade ({selectedMaterial.unit})</label>
                <input 
                  type="number"
                  value={movement.quantity}
                  onChange={(e) => setMovement({...movement, quantity: Number(e.target.value)})}
                  className="w-full text-center text-3xl font-black py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase block mb-1">Notas / Motivo</label>
                <textarea 
                  value={movement.notes}
                  onChange={(e) => setMovement({...movement, notes: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold h-24 resize-none"
                  placeholder="Ex: Compra Local, Dano técnico..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowMovementModal(false)} className="px-6 py-2 text-slate-500 font-bold">Cancelar</button>
              <button 
                onClick={handleSaveMovement}
                className={`px-6 py-2 font-bold text-white rounded-xl shadow-lg transition-all ${movement.type === 'IN' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'}`}
              >
                Confirmar {movement.type === 'IN' ? 'Entrada' : 'Saída'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico Detalhado */}
      {showHistoryListModal && selectedMaterial && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
              <div>
                <h3 className="text-xl font-black text-slate-800">Histórico de Movimentações</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{selectedMaterial.name}</p>
              </div>
              <button onClick={() => setShowHistoryListModal(false)} className="p-2 hover:bg-white rounded-full"><X size={20} /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 text-xs">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 sticky top-0 bg-white">
                  <tr>
                    <th className="p-4 pl-6">Data/Hora</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4 text-center">Qtde</th>
                    <th className="p-4">Fornecedor</th>
                    <th className="p-4">NF #</th>
                    <th className="p-4">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {historyMovements.map(mov => (
                    <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6 text-slate-600 flex flex-col">
                        <span className="font-bold">{new Date(mov.created_at!).toLocaleDateString('pt-BR')}</span>
                        <span className="text-[10px] text-slate-400">{new Date(mov.created_at!).toLocaleTimeString('pt-BR')}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${mov.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {mov.type === 'IN' ? 'ENTRADA' : 'SAÍDA'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-black text-slate-800">{mov.quantity}</span>
                      </td>
                      <td className="p-4">
                        {mov.supplier_name ? (
                          <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                            <Truck size={12} className="text-slate-400" />
                            <span className="truncate max-w-[120px]">{mov.supplier_name}</span>
                          </div>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="p-4">
                        {mov.invoice_number ? (
                          <div className="flex items-center gap-1.5 text-indigo-600 font-black">
                            <FileText size={12} className="text-indigo-400" />
                            {mov.invoice_number}
                          </div>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="p-4 text-slate-500 italic max-w-[150px] truncate">{mov.notes}</td>
                    </tr>
                  ))}
                  {historyMovements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-20 text-center text-slate-400 font-bold">Nenhuma movimentação encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal XML Avançado com Mapeamento */}
      {showXmlModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] shadow-2xl animate-in zoom-in duration-200 flex flex-col overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
               <div>
                  <h3 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                    <FileUp size={24} /> Importação XML (NF-e)
                  </h3>
                  <p className="text-xs font-bold text-indigo-400">Arraste um arquivo XML ou selecione no seu computador.</p>
               </div>
               <button onClick={() => setShowXmlModal(false)} className="p-2 hover:bg-white rounded-full transition-colors"><X size={20} /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                {(!xmlFile && xmlData.length === 0) ? (
                   <div 
                    onClick={() => document.getElementById('xml-input')?.click()}
                    className="h-64 border-4 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                   >
                      <div className="p-6 bg-slate-50 text-slate-300 rounded-full group-hover:scale-110 transition-transform">
                         <FileUp size={48} />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest text-xs">Clique para selecionar arquivo</p>
                        <p className="text-[10px] text-slate-300 font-bold mt-1">APENAS ARQUIVOS .XML DE NF-E FORNECEDOR</p>
                      </div>
                      <input 
                        id="xml-input"
                        type="file" 
                        accept=".xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                             setXmlFile(file);
                             const reader = new FileReader();
                             reader.onload = (ev) => processXmlContent(ev.target?.result as string);
                             reader.readAsText(file);
                          }
                        }}
                      />
                   </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl shadow-sm text-indigo-600"><FileText size={20} /></div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase">Arquivo Carregado</p>
                             <p className="font-black text-slate-700">NF {xmlInvoice} - {xmlSupplier}</p>
                          </div>
                       </div>
                    </div>
                    
                    <table className="w-full text-left">
                      <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="p-4">Item na NF</th>
                          <th className="p-4 text-center">Qtde</th>
                          <th className="p-4">Material Vinculado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {xmlData.map((item, idx) => (
                          <tr key={idx} className={`${item.mappedMaterialId ? 'bg-emerald-50/30' : 'bg-rose-50/30'}`}>
                            <td className="p-4">
                              <span className="text-[10px] text-slate-400 block font-bold">#{item.code}</span>
                              <p className="font-black text-slate-700">{item.name}</p>
                            </td>
                            <td className="p-4 text-center">
                               <div className="font-black text-slate-800 text-sm">{item.qty}</div>
                               <div className="text-[10px] text-slate-400 uppercase font-bold">{item.unit}</div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <select 
                                  value={item.mappedMaterialId}
                                  onChange={(e) => handleUpdateItemMapping(idx, e.target.value)}
                                  className={`flex-1 p-2 border rounded-xl font-bold outline-none transition-all ${item.mappedMaterialId ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-white border-rose-200 text-rose-700 animate-pulse'}`}
                                >
                                  <option value="">Atenção: Selecione o material correspondente</option>
                                  {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                                </select>
                                <button 
                                  onClick={() => {
                                    setNewMaterial({
                                      name: item.name,
                                      unit: item.unit.toLowerCase().includes('mt') ? 'm' : item.unit.toLowerCase().includes('un') ? 'un' : 'un',
                                      min_stock: 0,
                                      category: 'Componente'
                                    });
                                    (window as any)._quickRegisterIndex = idx;
                                    setShowAddModal(true);
                                  }}
                                  title="Cadastrar como novo material"
                                  className="p-2 bg-white text-indigo-600 rounded-xl hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
                                >
                                  <Plus size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* --- Novo: Seção Financeira --- */}
                    <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="text-indigo-600" size={20} />
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Financeiro / Contas a Pagar</h4>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                          <button 
                            onClick={() => setGenerateFinancial(true)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${generateFinancial ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                          >
                            GERAR FINANCEIRO
                          </button>
                          <button 
                            onClick={() => setGenerateFinancial(false)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${!generateFinancial ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                          >
                            NÃO GERAR
                          </button>
                        </div>
                      </div>

                      {generateFinancial && (
                        <div className="animate-in slide-in-from-top-2 duration-300 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Categoria de Despesa</label>
                               <select 
                                 value={selectedCategoryId}
                                 onChange={(e) => setSelectedCategoryId(e.target.value)}
                                 className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                               >
                                 <option value="">Selecione uma categoria...</option>
                                 {expenseCategories.map(cat => (
                                   <option key={cat.id} value={cat.id}>{cat.code} - {cat.name}</option>
                                 ))}
                               </select>
                            </div>
                            <div className="flex items-end">
                               <button 
                                 onClick={() => {
                                   setXmlInstallments([...xmlInstallments, { id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], amount: 0, number: `${xmlInstallments.length + 1}` }]);
                                 }}
                                 className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 font-black rounded-xl hover:bg-indigo-100 text-xs transition-all border border-indigo-100"
                               >
                                 <Plus size={14} /> Adicionar Parcela
                               </button>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                              <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                  <th className="p-3"># Parcela</th>
                                  <th className="p-3">Vencimento</th>
                                  <th className="p-3">Valor (R$)</th>
                                  <th className="p-3 text-right">Ação</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 text-xs">
                                {xmlInstallments.map((inst, idx) => (
                                  <tr key={inst.id}>
                                    <td className="p-2">
                                      <input 
                                        type="text" 
                                        value={inst.number}
                                        onChange={(e) => {
                                          const newList = [...xmlInstallments];
                                          newList[idx].number = e.target.value;
                                          setXmlInstallments(newList);
                                        }}
                                        className="w-16 p-1 bg-transparent font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input 
                                        type="date" 
                                        value={inst.date}
                                        onChange={(e) => {
                                          const newList = [...xmlInstallments];
                                          newList[idx].date = e.target.value;
                                          setXmlInstallments(newList);
                                        }}
                                        className="p-1 bg-transparent font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input 
                                        type="number" 
                                        value={inst.amount}
                                        onChange={(e) => {
                                          const newList = [...xmlInstallments];
                                          newList[idx].amount = Number(e.target.value);
                                          setXmlInstallments(newList);
                                        }}
                                        className="w-24 p-1 bg-transparent font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded text-right"
                                      />
                                    </td>
                                    <td className="p-2 text-right">
                                      <button 
                                        onClick={() => setXmlInstallments(xmlInstallments.filter(i => i.id !== inst.id))}
                                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {xmlInstallments.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="p-4 text-center text-slate-400 font-bold bg-slate-50/50">
                                      Nenhuma parcela informada. Adicione manualmente se desejar gerar o contas a pagar.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                              {xmlInstallments.length > 0 && (
                                <tfoot className="bg-slate-50 border-t border-slate-100">
                                  <tr>
                                    <td colSpan={2} className="p-3 text-right font-black text-slate-400 text-[9px] uppercase">Total das Parcelas:</td>
                                    <td className="p-3 text-right font-black text-indigo-600">
                                      {xmlInstallments.reduce((acc, cur) => acc + cur.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                    <td></td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* ------------------------------- */}
                  </div>

                )}
             </div>
             <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-3xl">
                <button onClick={() => {setXmlFile(null); setXmlData([]);}} className="text-rose-500 font-bold text-xs underline">Limpar Arquivo</button>
                <div className="flex gap-3">
                  <button onClick={() => setShowXmlModal(false)} className="px-6 py-2 text-slate-500 font-bold">Cancelar</button>
                  {xmlData.length > 0 && (
                    <button 
                      onClick={handleImportXmlItems}
                      disabled={xmlData.some(i => !i.mappedMaterialId)}
                      className={`px-8 py-2 text-white font-black rounded-xl shadow-lg transition-all ${xmlData.some(i => !i.mappedMaterialId) ? 'bg-slate-300 shadow-none cursor-not-allowed' : 'bg-indigo-600 shadow-indigo-100 hover:scale-105'}`}
                    >
                      Confirmar Compra da NF {xmlInvoice}
                    </button>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Modal Consulta Cloud NFe */}
      {showCloudNfeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] shadow-2xl animate-in zoom-in duration-200 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/50">
              <div>
                <h3 className="text-xl font-black text-rose-900 flex items-center gap-2">
                   <CloudDownload size={24} /> Notas Contra o CNPJ (SEFAZ/Nuvem)
                </h3>
                <p className="text-xs font-bold text-rose-400">Clique para manifestar e importar o estoque automaticamente de notas recebidas.</p>
                <p className="text-[10px] font-black text-rose-300 uppercase mt-1">💡 Importante: Filtros de data referem-se ao dia em que a nota foi consultada pela primeira vez.</p>
              </div>
              <button 
                onClick={() => setShowCloudNfeModal(false)} 
                className="p-2 hover:bg-white rounded-full transition-colors"
                disabled={loadingInvoices}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {loadingInvoices ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-rose-600" size={48} />
                  <p className="font-black text-slate-400 animate-pulse uppercase text-xs tracking-widest">Buscando notas recebidas na SEFAZ...</p>
                </div>
              ) : (
                <>
                  {/* Barra de Filtros por Período */}
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Início (Consulta)</label>
                      <input 
                        type="date" 
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fim (Consulta)</label>
                      <input 
                        type="date" 
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                    </div>
                    <button 
                      onClick={() => handleFetchCloudInvoices(true)}
                      className="px-6 py-2.5 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-700 transition-all flex items-center gap-2 text-xs"
                    >
                      <Search size={14} /> Filtrar por Período
                    </button>
                    <button 
                      onClick={() => handleFetchCloudInvoices(false)}
                      className="px-6 py-2.5 bg-rose-50 text-rose-600 font-black rounded-xl hover:bg-rose-100 transition-all flex items-center gap-2 text-xs border border-rose-100"
                    >
                      <RefreshCw size={14} /> Buscar Novas
                    </button>
                  </div>

                  {receivedInvoices.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4">
                      <AlertCircle size={48} className={receivedInvoices.length === 0 && lastApiError ? "text-amber-500" : ""} />
                      <p className="font-bold text-center px-8 text-slate-500 text-sm">
                        {lastApiError || "Inicie uma busca para visualizar as notas da nuvem."}
                      </p>
                      <p className="text-[10px] uppercase font-black text-slate-300">
                        {lastApiError ? "Tente um período diferente ou 'Buscar Novas'" : "Utilize os filtros acima."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100 font-black text-[10px] text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-6 py-4">Data Emissão</th>
                            <th className="px-6 py-4">Nota / Série</th>
                            <th className="px-6 py-4">Fornecedor (Emitente)</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {receivedInvoices.map((nfe: any) => (
                            <tr key={nfe.key} className="hover:bg-slate-50 transition-colors group text-xs">
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-700">
                                   {nfe.date || 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                   <span className="font-black text-rose-600">NF {nfe.number}</span>
                                   <span className="text-[10px] font-bold text-slate-400">Série {nfe.series}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                   <span className="font-black text-slate-700 uppercase truncate max-w-[200px]">{nfe.customerName}</span>
                                   <span className="text-[10px] text-slate-400 font-bold">CNPJ: {nfe.cnpj}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${nfe.status === 'AUTORIZADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {nfe.status}
                                  </span>
                                  {importedKeys.has(nfe.key) && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black uppercase">
                                      <CheckCircle2 size={10} /> Lançada
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                   onClick={() => handleImportInvoiceFromCloud(nfe.key)}
                                   disabled={importedKeys.has(nfe.key)}
                                   className={`px-4 py-1.5 font-black rounded-lg transition-all shadow-md active:scale-95 uppercase text-[10px] ${
                                     importedKeys.has(nfe.key) 
                                     ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                     : 'bg-rose-600 text-white hover:bg-rose-700'
                                   }`}
                                >
                                   {importedKeys.has(nfe.key) ? 'Importada' : 'Importar'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50">
               <div className="flex flex-col">
                  <p className="text-[10px] text-slate-400 font-black uppercase max-w-sm">
                    Ao importar, o sistema realizará a ciência da operação na SEFAZ automaticamente.
                  </p>
                  <p className="text-[9px] text-slate-300 font-bold uppercase mt-1">
                    CNPJ CONSULTADO: {nfEmailService.config.cnpj}
                  </p>
               </div>
               <button 
                 onClick={() => setShowCloudNfeModal(false)} 
                 className="px-8 py-2 bg-slate-200 text-slate-700 font-black rounded-xl hover:bg-slate-300 transition-all active:scale-95"
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

export default RawMaterialStock;
