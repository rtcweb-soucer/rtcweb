
import * as React from 'react';
import { useState, useEffect } from 'react';
import { RawMaterial, RawMaterialMovement, SystemUser, RawMaterialMapping } from '../types';
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
  FileText
} from 'lucide-react';

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
  const [historyMovements, setHistoryMovements] = useState<RawMaterialMovement[]>([]);
  
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [newMaterial, setNewMaterial] = useState<Partial<RawMaterial>>({
    name: '',
    unit: 'm',
    min_stock: 0,
    category: 'Componente'
  });
  
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
      const [mats, maps] = await Promise.all([
        dataService.getRawMaterials(),
        dataService.getRawMaterialMappings()
      ]);
      setMaterials(mats);
      setMappings(maps);
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
      
      // Se viemos de um cadastro rápido no XML, já selecionamos o item automaticamente
      const quickIdx = (window as any)._quickRegisterIndex;
      if (quickIdx !== undefined && quickIdx !== null) {
        const updatedXml = [...xmlData];
        if (updatedXml[quickIdx]) {
          updatedXml[quickIdx].mappedMaterialId = saved.id;
          setXmlData(updatedXml);
        }
        (window as any)._quickRegisterIndex = null;
      }

      loadInitialData(); // Recarrega tudo para garantir sincronia
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

  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlFile(file);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const xmlText = event.target?.result as string;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      
      // Extract Supplier & Invoice info
      const supplierName = xmlDoc.getElementsByTagName("xNome")[0]?.textContent || '';
      const invoiceNum = xmlDoc.getElementsByTagName("nNF")[0]?.textContent || '';
      setXmlSupplier(supplierName);
      setXmlInvoice(invoiceNum);

      const products = xmlDoc.getElementsByTagName("det");
      const items = [];
      
      for (let i = 0; i < products.length; i++) {
        const prod = products[i].getElementsByTagName("prod")[0];
        const name = prod.getElementsByTagName("xProd")[0]?.textContent || '';
        const qty = prod.getElementsByTagName("qCom")[0]?.textContent || '0';
        const unit = prod.getElementsByTagName("uCom")[0]?.textContent || 'UN';
        const code = prod.getElementsByTagName("cProd")[0]?.textContent || '';
        
        // Mapeamento Inteligente
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
      setXmlData(items);
    };
    reader.readAsText(file);
  };

  const handleUpdateItemMapping = (index: number, materialId: string) => {
    const updatedData = [...xmlData];
    updatedData[index].mappedMaterialId = materialId;
    setXmlData(updatedData);
  };

  const handleImportXmlItems = async () => {
    let processed = 0;
    
    try {
      for (const item of xmlData) {
        if (!item.mappedMaterialId) continue;
        
        // 1. Mapeamento persistente
        const existingMapping = mappings.find(m => m.xml_product_name === item.name);
        if (!existingMapping) {
          await dataService.saveRawMaterialMapping({
            id: crypto.randomUUID(),
            xml_product_name: item.name,
            raw_material_id: item.mappedMaterialId
          });
        }

        // 2. Criar movimentação com dados de compra
        await dataService.saveRawMaterialMovement({
          id: crypto.randomUUID(),
          raw_material_id: item.mappedMaterialId,
          type: 'IN',
          quantity: item.qty,
          source: 'XML',
          supplier_name: xmlSupplier,
          invoice_number: xmlInvoice,
          notes: `Importado via XML NFe #${xmlInvoice}`,
          user_id: currentUser.id
        });
        processed++;
      }
      
      alert(`${processed} itens de estoque atualizados com sucesso!`);
      setShowXmlModal(false);
      setXmlFile(null);
      setXmlData([]);
      loadInitialData();
    } catch (err) {
      alert("Erro durante a importação.");
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
            onClick={() => setShowXmlModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            <FileUp size={18} /> Importar NFe (XML)
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
                    {m.current_stock !== undefined && m.current_stock <= m.min_stock ? (
                      <span className="inline-flex items-center gap-1 text-rose-500 font-bold text-[10px] bg-rose-50 px-2 py-1 rounded-full border border-rose-100">
                        <AlertTriangle size={12} /> ESTOQUE BAIXO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[10px] bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                        <CheckCircle2 size={12} /> NORMAL
                      </span>
                    )}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedMaterial(m); setShowMovementModal(true); }}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                        title="Movimentar"
                      >
                        <ArrowUpCircle size={18} />
                      </button>
                      <button 
                        onClick={() => handleViewHistory(m)}
                        className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
                        title="Histórico"
                      >
                        <History size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-slate-400 font-bold">Nenhum material encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Adicionar Material */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[600] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800">Cadastrar Insumo</h3>
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
                  placeholder="Ex: Cantoneira Alumínio Branca"
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
                    <option value="un">UN</option>
                    <option value="m">METRO</option>
                    <option value="m2">M²</option>
                    <option value="kg">KG</option>
                    <option value="cx">CAIXA</option>
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
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-100 sticky top-0 bg-white">
                  <tr>
                    <th className="p-4 pl-6 text-left">Data/Hora</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4 text-center">Qtde</th>
                    <th className="p-4">Fornecedor</th>
                    <th className="p-4">NF #</th>
                    <th className="p-4">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
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
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
              <div>
                <h3 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                   <LinkIcon size={24} /> Importador Inteligente de NFe (XML)
                </h3>
                <p className="text-xs font-bold text-indigo-400">Vincule os produtos do fornecedor aos seus materiais do estoque.</p>
              </div>
              <button onClick={() => setShowXmlModal(false)} className="p-2 hover:bg-white rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6">
              {!xmlFile ? (
                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center hover:border-indigo-400 transition-all group">
                   <input 
                      type="file" 
                      accept=".xml" 
                      onChange={handleXmlUpload} 
                      className="hidden" 
                      id="xml-input-mapping" 
                   />
                   <label htmlFor="xml-input-mapping" className="cursor-pointer">
                      <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <FileUp className="text-indigo-600" size={32} />
                      </div>
                      <p className="font-black text-slate-700">Clique para selecionar o XML da NFe</p>
                      <p className="text-slate-400 text-xs mt-1">O sistema lerá os itens e tentará identificar os vínculos salvos.</p>
                   </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase">Fornecedor</span>
                        <p className="font-bold text-slate-700 truncate">{xmlSupplier}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase">Nota Fiscal #</span>
                        <p className="font-black text-indigo-600">{xmlInvoice}</p>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[350px] overflow-y-auto rounded-2xl border border-slate-100 shadow-inner">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 font-black text-slate-500 uppercase tracking-wider z-10">
                        <tr>
                          <th className="p-4">Item na Nota</th>
                          <th className="p-4 text-center">Qtde</th>
                          <th className="p-4">Vincular ao Meu Material...</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
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
                  </div>
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

    </div>
  );
};

export default RawMaterialStock;
