import * as React from 'react';
import { useState } from 'react';
import { Product, ProductionDetailing, ProductionDetailingRule } from '../types';
import { fuzzyMatch } from '../utils/searchUtils';
import { Plus, Search, Package, Trash2, X, Edit3, Info, CheckCircle2, AlertCircle, Settings2, FileText } from 'lucide-react';
import { dataService } from '../services/dataService';

interface ProductsProps {
  products: Product[];
  productionDetailings: ProductionDetailing[];
  setProductionDetailings: React.Dispatch<React.SetStateAction<ProductionDetailing[]>>;
  onAdd: (p: Product) => void;
  onUpdate: (p: Product) => void;
  onDelete: (id: string) => void;
}

const Products = ({ products, productionDetailings, setProductionDetailings, onAdd, onUpdate, onDelete }: ProductsProps) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'detailings'>('catalog');
  
  // States for Catalog
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    tipo: 'Toldo',
    nome: '',
    valor: 0,
    custo: 0,
    unidade: 'UN',
    acessorio: false,
    dias_garantia: 365,
    obs: '',
    ncm: '',
    cst: '',
    cest: '',
    cfop: '',
    detalhamento_tecnico: '',
    priceFormula: '',
    productionDetailingId: ''
  });

  // States for Detailings
  const [showDetailingModal, setShowDetailingModal] = useState(false);
  const [editingDetailing, setEditingDetailing] = useState<ProductionDetailing | null>(null);
  const [detailingFormData, setDetailingFormData] = useState<Partial<ProductionDetailing>>({
    name: '',
    type: 'Cortina Rolo',
    rules: []
  });

  // Catalog logic
  const filteredProducts = products.filter(p =>
    fuzzyMatch(p.nome, searchTerm) ||
    fuzzyMatch(p.tipo, searchTerm)
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ ...product, productionDetailingId: product.productionDetailingId || '' });
    } else {
      setEditingProduct(null);
      setFormData({
        tipo: 'Toldo',
        nome: '',
        valor: 0,
        custo: 0,
        unidade: 'UN',
        acessorio: false,
        dias_garantia: 365,
        obs: '',
        ncm: '',
        cst: '',
        cest: '',
        cfop: '',
        detalhamento_tecnico: '',
        priceFormula: '',
        productionDetailingId: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      ...formData,
      valor: Number(formData.valor),
      custo: Number(formData.custo),
      dias_garantia: Number(formData.dias_garantia),
      productionDetailingId: formData.productionDetailingId || undefined
    } as Product;

    if (editingProduct) {
      onUpdate({ ...editingProduct, ...productData });
    } else {
      onAdd({
        ...productData,
        id: crypto.randomUUID()
      });
    }
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      onDelete(id);
    }
  };

  // Detailings logic
  const handleOpenDetailingModal = (detailing?: ProductionDetailing) => {
    if (detailing) {
      setEditingDetailing(detailing);
      setDetailingFormData({ ...detailing, rules: [...(detailing.rules || [])] });
    } else {
      setEditingDetailing(null);
      setDetailingFormData({
        name: '',
        type: 'Cortina Rolo',
        rules: []
      });
    }
    setShowDetailingModal(true);
  };

  const handleAddRule = () => {
    setDetailingFormData(prev => ({
      ...prev,
      rules: [
        ...(prev.rules || []),
        { id: crypto.randomUUID(), detailingId: prev.id || '', components: '' } as ProductionDetailingRule
      ]
    }));
  };

  const handleRemoveRule = async (ruleId: string) => {
    try {
      const existingRule = editingDetailing?.rules?.find(r => r.id === ruleId);
      if (existingRule) {
        await dataService.deleteProductionDetailingRule(ruleId);
      }
      setDetailingFormData(prev => ({
        ...prev,
        rules: prev.rules?.filter(r => r.id !== ruleId)
      }));
    } catch (e) {
      alert("Erro ao remover regra");
    }
  };

  const handleUpdateRule = (index: number, field: string, value: any) => {
    setDetailingFormData(prev => {
      const newRules = [...(prev.rules || [])];
      newRules[index] = { ...newRules[index], [field]: value };
      return { ...prev, rules: newRules };
    });
  };

  const handleAddCutFormula = (ruleIndex: number) => {
    setDetailingFormData(prev => {
      const newRules = [...(prev.rules || [])];
      const rule = { ...newRules[ruleIndex] };
      rule.cutFormulas = [
        ...(rule.cutFormulas || []),
        { id: crypto.randomUUID(), name: '', type: 'MEASURE', formula: '' }
      ];
      newRules[ruleIndex] = rule;
      return { ...prev, rules: newRules };
    });
  };

  const handleUpdateCutFormula = (ruleIndex: number, formulaIndex: number, field: string, value: any) => {
    setDetailingFormData(prev => {
      const newRules = [...(prev.rules || [])];
      const rule = { ...newRules[ruleIndex] };
      const newFormulas = [...(rule.cutFormulas || [])];
      newFormulas[formulaIndex] = { ...newFormulas[formulaIndex], [field]: value };
      rule.cutFormulas = newFormulas;
      newRules[ruleIndex] = rule;
      return { ...prev, rules: newRules };
    });
  };

  const handleRemoveCutFormula = (ruleIndex: number, formulaIndex: number) => {
    setDetailingFormData(prev => {
      const newRules = [...(prev.rules || [])];
      const rule = { ...newRules[ruleIndex] };
      const newFormulas = [...(rule.cutFormulas || [])];
      newFormulas.splice(formulaIndex, 1);
      rule.cutFormulas = newFormulas;
      newRules[ruleIndex] = rule;
      return { ...prev, rules: newRules };
    });
  };

  const handleSaveDetailing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        id: detailingFormData.id || crypto.randomUUID(),
        name: detailingFormData.name!,
        type: detailingFormData.type!,
        rules: detailingFormData.rules || []
      };
      const saved = await dataService.saveProductionDetailing(payload as ProductionDetailing);
      
      setProductionDetailings(prev => {
        const exists = prev.find(p => p.id === saved.id);
        if (exists) {
          return prev.map(p => p.id === saved.id ? saved : p);
        }
        return [...prev, saved];
      });
      
      setShowDetailingModal(false);
      setEditingDetailing(null);
    } catch (err) {
      alert("Erro ao salvar detalhamento");
    }
  };

  const handleDeleteDetailing = async (id: string) => {
    if (window.confirm("Deseja realmente remover este detalhamento? Produtos vinculados perderão a referência.")) {
      try {
        await dataService.deleteProductionDetailing(id);
        setProductionDetailings(prev => prev.filter(p => p.id !== id));
      } catch (err) {
        alert("Erro ao remover");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestão de Produtos</h2>
          <p className="text-slate-500">Catálogo e parâmetros de produção.</p>
        </div>
        
        {activeTab === 'catalog' ? (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus size={20} />
            Novo Produto
          </button>
        ) : (
          <button
            onClick={() => handleOpenDetailingModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus size={20} />
            Novo Detalhamento
          </button>
        )}
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-4 px-4 font-semibold text-sm transition-colors relative ${activeTab === 'catalog' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <Package size={18} />
            Catálogo de Produtos
          </div>
          {activeTab === 'catalog' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('detailings')}
          className={`pb-4 px-4 font-semibold text-sm transition-colors relative ${activeTab === 'detailings' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <div className="flex items-center gap-2">
            <Settings2 size={18} />
            Detalhamentos de Produção
          </div>
          {activeTab === 'detailings' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'catalog' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="relative group max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Buscar produto por nome ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">IdProduto</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nome</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Valor</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Unidade</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Garantia</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Acessório</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-400">#{product.id}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${product.tipo === 'Toldo' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                          {product.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                            <Package size={18} />
                          </div>
                          <span className="text-sm font-bold text-slate-900">{product.nome}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">
                        R$ {product.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{product.unidade}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{product.dias_garantia} dias</td>
                      <td className="px-6 py-4">
                        {product.acessorio ? (
                          <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={14} /> Sim</span>
                        ) : (
                          <span className="text-slate-300 flex items-center gap-1 text-xs"><AlertCircle size={14} /> Não</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenModal(product)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                        Nenhum produto cadastrado ou encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'detailings' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Perfis de Detalhamento</h3>
                <p className="text-xs text-slate-500 mt-1">Crie regras de componentes baseados nas dimensões (largura/altura) do produto vendido.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nome do Perfil</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Qtd. Regras</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionDetailings.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">{d.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{d.type}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{d.rules?.length || 0} regras ativas</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetailingModal(d)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteDetailing(d.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {productionDetailings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                        Nenhum detalhamento técnico cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Cadastro/Edição de Produto */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-lg">
                  <Package size={20} />
                </div>
                <h3 className="font-bold text-lg text-slate-900">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[85vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Seção Dados Básicos */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">Informações Gerais</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo *</label>
                      <input
                        type="text" required placeholder="Ex: Toldo, Cortina, Motor..."
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Produto *</label>
                      <input
                        type="text" required placeholder="Ex: Toldo Articulado"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Venda (R$)</label>
                      <input
                        type="number" step="0.01" value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo (R$)</label>
                      <input
                        type="number" step="0.01" value={formData.custo}
                        onChange={(e) => setFormData({ ...formData, custo: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade</label>
                      <select
                        value={formData.unidade}
                        onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                      >
                        <option value="UN">UN</option>
                        <option value="MT">MT</option>
                        <option value="M2">M2</option>
                        <option value="KIT">KIT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalhamento de Produção (Etiqueta)</label>
                    <select
                      value={formData.productionDetailingId || ''}
                      onChange={(e) => setFormData({ ...formData, productionDetailingId: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Nenhum (Utiliza texto manual)</option>
                      {productionDetailings.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Ao vincular, a etiqueta de produção usará as regras dimensionais deste perfil.</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalhamento Fixo / Manual</label>
                    <textarea
                      rows={3} placeholder="Especificações fixas (se não usar o perfil acima)..."
                      value={formData.detalhamento_tecnico}
                      onChange={(e) => setFormData({ ...formData, detalhamento_tecnico: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Seção Cálculo de Preço Avançado */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest border-b border-amber-50 pb-2">Cálculo de Preço (Avançado)</h4>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <label className="block text-xs font-bold text-amber-900 uppercase">Fórmula Customizada</label>
                      <div className="group relative">
                        <Info size={14} className="text-amber-500 cursor-help" />
                        <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-[110] pointer-events-none">
                          <p className="font-bold mb-1">Variáveis Disponíveis:</p>
                          <ul className="list-disc pl-3 space-y-0.5 opacity-80">
                            <li><strong>Larg</strong>: Largura digitada</li>
                            <li><strong>Alt</strong>: Altura digitada</li>
                            <li><strong>Qtd</strong>: Quantidade</li>
                            <li><strong>Valor</strong>: Preço base acima</li>
                          </ul>
                          <p className="mt-2 text-amber-400">Ex: <code>((Larg+Alt)*2)*Valor</code></p>
                        </div>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: ((Larg+Alt)*2)*Valor"
                      value={formData.priceFormula}
                      onChange={(e) => setFormData({ ...formData, priceFormula: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none shadow-inner"
                    />
                    <p className="text-[10px] text-amber-700 font-medium italic">
                      Se preenchida, esta fórmula substituirá o cálculo padrão (M2 ou Unitário).
                    </p>
                  </div>
                </div>

                {/* Seção Fiscal e Extras */}
                <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 h-fit">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Dados Fiscais / Extras</h4>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 py-2">
                      <input
                        type="checkbox" id="acessorio"
                        checked={formData.acessorio}
                        onChange={(e) => setFormData({ ...formData, acessorio: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label htmlFor="acessorio" className="text-sm font-bold text-slate-700">É um Acessório?</label>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Garantia (dias)</label>
                      <input
                        type="number" value={formData.dias_garantia}
                        onChange={(e) => setFormData({ ...formData, dias_garantia: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">NCM</label>
                      <input
                        type="text" value={formData.ncm}
                        onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CST</label>
                        <input
                          type="text" value={formData.cst}
                          onChange={(e) => setFormData({ ...formData, cst: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CFOP</label>
                        <input
                          type="text" value={formData.cfop}
                          onChange={(e) => setFormData({ ...formData, cfop: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CEST</label>
                      <input
                        type="text" value={formData.cest}
                        onChange={(e) => setFormData({ ...formData, cest: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-8 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                >
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Cadastro/Edição de Detalhamento Técnico */}
      {showDetailingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg">
                  <Settings2 size={20} />
                </div>
                <h3 className="font-bold text-lg text-slate-900">{editingDetailing ? 'Editar Perfil de Detalhamento' : 'Novo Perfil de Detalhamento'}</h3>
              </div>
              <button onClick={() => setShowDetailingModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDetailing} className="p-6 overflow-y-auto max-h-[85vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Perfil *</label>
                  <input
                    type="text" required placeholder="Ex: Detalhamento Cortina Rolo Standard"
                    value={detailingFormData.name}
                    onChange={(e) => setDetailingFormData({ ...detailingFormData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Produto Aplicável *</label>
                  <input
                    type="text" required placeholder="Ex: Cortina Rolo"
                    value={detailingFormData.type}
                    onChange={(e) => setDetailingFormData({ ...detailingFormData, type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Regras de Dimensões e Componentes</h4>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-semibold text-xs rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Plus size={14} /> Adicionar Regra
                  </button>
                </div>
                
                {detailingFormData.rules?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhuma regra adicionada. Clique em "Adicionar Regra" para configurar.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailingFormData.rules?.map((rule, index) => (
                      <div key={rule.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm relative group">
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(rule.id)}
                          className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-200 text-rose-500 rounded-full hover:bg-rose-50 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-4 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Larg. Mínima (m)</label>
                              <input
                                type="number" step="0.01" value={rule.minWidth || ''}
                                onChange={(e) => handleUpdateRule(index, 'minWidth', parseFloat(e.target.value) || null)}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded outline-none text-xs"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Larg. Máxima (m)</label>
                              <input
                                type="number" step="0.01" value={rule.maxWidth || ''}
                                onChange={(e) => handleUpdateRule(index, 'maxWidth', parseFloat(e.target.value) || null)}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded outline-none text-xs"
                                placeholder="1.50"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alt. Mínima (m)</label>
                              <input
                                type="number" step="0.01" value={rule.minHeight || ''}
                                onChange={(e) => handleUpdateRule(index, 'minHeight', parseFloat(e.target.value) || null)}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded outline-none text-xs"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alt. Máxima (m)</label>
                              <input
                                type="number" step="0.01" value={rule.maxHeight || ''}
                                onChange={(e) => handleUpdateRule(index, 'maxHeight', parseFloat(e.target.value) || null)}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded outline-none text-xs"
                                placeholder="3.00"
                              />
                            </div>
                          </div>

                          <div className="md:col-span-8 space-y-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição de Componentes / Observações</label>
                              <textarea
                                required
                                rows={2}
                                placeholder="Descreva aqui os materiais..."
                                value={rule.components}
                                onChange={(e) => handleUpdateRule(index, 'components', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                              />
                            </div>
                            
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Cortes e Fórmulas de Produção</label>
                                <button
                                  type="button"
                                  onClick={() => handleAddCutFormula(index)}
                                  className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold hover:bg-indigo-100 transition-colors"
                                >
                                  + Add Fórmula
                                </button>
                              </div>
                              <div className="space-y-2">
                                {(rule.cutFormulas || []).map((formula, fIndex) => (
                                  <div key={formula.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <input
                                      type="text"
                                      placeholder="Ex: Tubo, Tecido"
                                      value={formula.name}
                                      onChange={(e) => handleUpdateCutFormula(index, fIndex, 'name', e.target.value)}
                                      className="flex-[2] px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none"
                                    />
                                    <select
                                      value={formula.type}
                                      onChange={(e) => handleUpdateCutFormula(index, fIndex, 'type', e.target.value)}
                                      className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none"
                                    >
                                      <option value="MEASURE">Medida</option>
                                      <option value="UNIT">Unidade</option>
                                    </select>
                                    {formula.type === 'MEASURE' ? (
                                      <input
                                        type="text"
                                        placeholder="Ex: L - 0.05"
                                        value={formula.formula || ''}
                                        onChange={(e) => handleUpdateCutFormula(index, fIndex, 'formula', e.target.value)}
                                        className="flex-[2] px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none"
                                      />
                                    ) : (
                                      <input
                                        type="number"
                                        placeholder="Qtd"
                                        value={formula.quantity || 1}
                                        onChange={(e) => handleUpdateCutFormula(index, fIndex, 'quantity', parseFloat(e.target.value) || 1)}
                                        className="flex-[2] px-2 py-1 bg-white border border-slate-200 rounded text-xs outline-none"
                                      />
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCutFormula(index, fIndex)}
                                      className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                                {(!rule.cutFormulas || rule.cutFormulas.length === 0) && (
                                  <div className="text-center py-2 text-[10px] text-slate-400 italic">
                                    Nenhuma fórmula configurada.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDetailingModal(false)}
                  className="px-8 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
                >
                  Salvar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
